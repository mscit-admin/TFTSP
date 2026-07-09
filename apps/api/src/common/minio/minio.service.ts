import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'node:stream';

/**
 * S3-compatible object storage (MinIO). Streaming put/get so large import files
 * never buffer the whole payload in memory (Spec §9 / §12). Migration to S3 is
 * an endpoint swap.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  /** Internal client — all server-side object ops (put/get/stat/bucket). */
  private readonly client: Client;
  /**
   * Presign client — signs browser-facing URLs. When `MINIO_PUBLIC_ENDPOINT` is set
   * (e.g. a server's public IP), presigned URLs are signed for that host so a browser
   * can reach them, even though the API connects over the internal Docker hostname.
   * Presigning is a local computation, so this client never opens a connection.
   */
  private readonly presignClient: Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'tftsp';
    const accessKey = config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin';
    const secretKey = config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin';
    this.client = new Client({
      endPoint: config.get<string>('MINIO_ENDPOINT') ?? 'localhost',
      port: parseInt(config.get<string>('MINIO_PORT') ?? '9000', 10),
      useSSL: (config.get<string>('MINIO_USE_SSL') ?? 'false') === 'true',
      accessKey,
      secretKey,
    });
    const publicEndpoint = config.get<string>('MINIO_PUBLIC_ENDPOINT');
    this.presignClient = publicEndpoint
      ? new Client({
          endPoint: publicEndpoint,
          port: parseInt(
            config.get<string>('MINIO_PUBLIC_PORT') ?? config.get<string>('MINIO_PORT') ?? '9000',
            10,
          ),
          useSSL: (config.get<string>('MINIO_PUBLIC_USE_SSL') ?? 'false') === 'true',
          accessKey,
          secretKey,
        })
      : this.client;
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, '');
        this.logger.log(`Created MinIO bucket "${this.bucket}"`);
      }
    } catch (err) {
      // Object storage may be unavailable in some environments (e.g. unit runs).
      this.logger.warn(`MinIO bucket check failed: ${String(err)}`);
    }
  }

  /** Stream an object in. `size` optional; MinIO does multipart when unknown. */
  async putStream(key: string, stream: Readable, size?: number): Promise<void> {
    await this.client.putObject(this.bucket, key, stream, size);
  }

  /** Stream an object out (for the parse worker). */
  getStream(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  async remove(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  /** Presigned PUT URL (default 15-min TTL) for direct browser upload (Spec §M4.3). */
  presignedPut(key: string, expirySeconds = 900): Promise<string> {
    return this.presignClient.presignedPutObject(this.bucket, key, expirySeconds);
  }

  /** Presigned GET URL (default 15-min TTL); signed for the browser-facing endpoint. */
  presignedGet(key: string, expirySeconds = 900): Promise<string> {
    return this.presignClient.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async stat(key: string): Promise<{ size: number }> {
    const s = await this.client.statObject(this.bucket, key);
    return { size: s.size };
  }

  /** Read the first `n` bytes of an object (for magic-byte validation on confirm). */
  async getFirstBytes(key: string, n = 512): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      const done = (): void => {
        stream.destroy();
        resolve(Buffer.concat(chunks).subarray(0, n));
      };
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        total += chunk.length;
        if (total >= n) {
          done();
        }
      });
      stream.on('end', done);
      stream.on('error', reject);
    });
  }
}
