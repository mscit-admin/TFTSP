import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import Busboy from 'busboy';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { MinioService } from '../../common/minio/minio.service';

/** ID-attachment upload cap (Spec §M4.3 uses 10 MB for documents; applied here too). */
export const MAX_ID_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface IdUploadResult {
  idAttachmentKey: string;
  tenantSlug?: string;
}

type Detection = 'ok' | 'svg' | 'unsupported';

/**
 * Magic-byte type check (NOT extension). Accepts PNG/JPEG/WEBP/GIF + PDF.
 * Rejects SVG (and any markup/XML) outright — the §M4.3 XSS rule, applied here.
 */
function detectAttachment(buf: Buffer): Detection {
  const isPng =
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isGif =
    buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38; // "GIF8"
  const isWebp =
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 && // "RIFF"
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50; // "WEBP"
  const isPdf =
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d; // "%PDF-"

  if (isPng || isJpeg || isGif || isWebp || isPdf) {
    return 'ok';
  }

  // SVG has no binary magic — sniff the leading text. Any markup/XML is rejected
  // as SVG (defence-in-depth against disguised SVG/XML payloads).
  const head = buf.slice(0, 512).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.includes('<svg') || head.startsWith('<')) {
    return 'svg';
  }
  return 'unsupported';
}

function safeSegment(value: string | undefined): string {
  const cleaned = (value ?? '').replace(/[^a-z0-9-]/gi, '_');
  return cleaned.length > 0 ? cleaned : randomUUID();
}

/**
 * Streams a public ID-attachment straight to MinIO under
 * `view-request-ids/<tenantSlug|uuid>/<uuid>` — never buffering the whole file.
 * Reuses the imports busboy pattern; adds the image/PDF magic-byte gate.
 */
export function streamIdAttachmentToMinio(
  req: Request,
  minio: MinioService,
): Promise<IdUploadResult> {
  return new Promise<IdUploadResult>((resolve, reject) => {
    let busboy: Busboy.Busboy;
    try {
      busboy = Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: MAX_ID_ATTACHMENT_BYTES },
      });
    } catch {
      reject(AppException.badRequest(ErrorKeys.UPLOAD_NO_FILE));
      return;
    }

    let handled = false;
    let fileSeen = false;
    let tenantSlug: string | undefined;
    const fail = (err: unknown): void => {
      if (!handled) {
        handled = true;
        reject(err);
      }
    };

    // Text fields (e.g. tenantSlug) precede the file in a normal form submission.
    busboy.on('field', (name, value) => {
      if (name === 'tenantSlug') {
        tenantSlug = value;
      }
    });

    busboy.on('file', (_name, fileStream, info) => {
      fileSeen = true;
      const fileKey = `view-request-ids/${safeSegment(tenantSlug)}/${randomUUID()}`;
      let sawData = false;
      const pass = new PassThrough();

      fileStream.on('limit', () => {
        pass.destroy();
        void minio.remove(fileKey).catch(() => undefined);
        fail(AppException.badRequest(ErrorKeys.UPLOAD_FILE_TOO_LARGE));
      });

      fileStream.once('data', (firstChunk: Buffer) => {
        sawData = true;
        const kind = detectAttachment(firstChunk);
        if (kind === 'svg') {
          fileStream.resume();
          fail(AppException.badRequest(ErrorKeys.UPLOAD_SVG_REJECTED));
          return;
        }
        if (kind === 'unsupported') {
          fileStream.resume();
          fail(
            AppException.badRequest(ErrorKeys.UPLOAD_UNSUPPORTED_TYPE, { filename: info.filename }),
          );
          return;
        }
        pass.write(firstChunk);
        fileStream.pipe(pass);
        minio
          .putStream(fileKey, pass)
          .then(() => {
            if (!handled) {
              handled = true;
              resolve({ idAttachmentKey: fileKey, tenantSlug });
            }
          })
          .catch(fail);
      });

      fileStream.on('end', () => {
        if (!sawData) {
          fail(AppException.badRequest(ErrorKeys.UPLOAD_NO_FILE));
        }
      });
      fileStream.on('error', fail);
    });

    busboy.on('error', fail);
    busboy.on('close', () => {
      if (!handled && !fileSeen) {
        fail(AppException.badRequest(ErrorKeys.UPLOAD_NO_FILE));
      }
    });

    req.pipe(busboy);
  });
}
