import { PassThrough } from 'node:stream';
import type { Request } from 'express';
import Busboy from 'busboy';
import { ImportFileFormat } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorKeys } from '../../../common/errors/error-keys';
import { MinioService } from '../../../common/minio/minio.service';
import { MAX_UPLOAD_BYTES } from '../import.constants';

export interface UploadResult {
  filename: string;
  format: ImportFileFormat;
}

/** xlsx == ZIP container; first bytes are the local-file-header magic "PK\x03\x04". */
function detectFormat(firstChunk: Buffer, filename: string): ImportFileFormat | undefined {
  const isZip =
    firstChunk.length >= 4 &&
    firstChunk[0] === 0x50 &&
    firstChunk[1] === 0x4b &&
    (firstChunk[2] === 0x03 || firstChunk[2] === 0x05 || firstChunk[2] === 0x07);
  if (isZip) {
    return ImportFileFormat.xlsx;
  }
  if (filename.toLowerCase().endsWith('.csv')) {
    return ImportFileFormat.csv;
  }
  return undefined;
}

/**
 * Streams the multipart file part straight to MinIO under `fileKey` — never
 * buffering the whole payload (Spec §12). Enforces the 50 MB limit and a
 * magic-byte type check (xlsx must be a real ZIP; CSV by extension).
 */
export function streamUploadToMinio(
  req: Request,
  minio: MinioService,
  fileKey: string,
): Promise<UploadResult> {
  return new Promise<UploadResult>((resolve, reject) => {
    let busboy: Busboy.Busboy;
    try {
      busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_UPLOAD_BYTES } });
    } catch {
      reject(AppException.badRequest(ErrorKeys.IMPORT_NO_FILE));
      return;
    }

    let handled = false;
    // Busboy emits 'close' synchronously once the multipart body is parsed —
    // which always precedes the async putStream resolve below. So 'close' must
    // only raise NO_FILE when NO file part was seen at all; otherwise the
    // putStream promise settles the outcome.
    let fileSeen = false;
    const fail = (err: unknown): void => {
      if (!handled) {
        handled = true;
        reject(err);
      }
    };

    busboy.on('file', (_name, fileStream, info) => {
      fileSeen = true;
      let format: ImportFileFormat | undefined;
      let sawData = false;
      const pass = new PassThrough();

      fileStream.on('limit', () => {
        pass.destroy();
        void minio.remove(fileKey).catch(() => undefined);
        fail(AppException.badRequest(ErrorKeys.IMPORT_FILE_TOO_LARGE));
      });

      fileStream.once('data', (firstChunk: Buffer) => {
        sawData = true;
        format = detectFormat(firstChunk, info.filename ?? '');
        if (!format) {
          fileStream.resume();
          fail(AppException.badRequest(ErrorKeys.IMPORT_UNSUPPORTED_FORMAT));
          return;
        }
        pass.write(firstChunk);
        fileStream.pipe(pass);
        minio
          .putStream(fileKey, pass)
          .then(() => {
            if (!handled) {
              handled = true;
              resolve({ filename: info.filename ?? 'import', format: format as ImportFileFormat });
            }
          })
          .catch(fail);
      });

      // Empty file part (no data chunk) — reject instead of hanging the request.
      fileStream.on('end', () => {
        if (!sawData) {
          fail(AppException.badRequest(ErrorKeys.IMPORT_NO_FILE));
        }
      });

      fileStream.on('error', fail);
    });

    busboy.on('error', fail);
    busboy.on('close', () => {
      if (!handled && !fileSeen) {
        fail(AppException.badRequest(ErrorKeys.IMPORT_NO_FILE));
      }
    });

    req.pipe(busboy);
  });
}
