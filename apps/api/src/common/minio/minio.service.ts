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
  private readonly client: Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('MINIO_BUCKET') ?? 'tftsp';
    this.client = new Client({
      endPoint: config.get<string>('MINIO_ENDPOINT') ?? 'localhost',
      port: parseInt(config.get<string>('MINIO_PORT') ?? '9000', 10),
      useSSL: (config.get<string>('MINIO_USE_SSL') ?? 'false') === 'true',
      accessKey: config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: config.get<string>('MINIO_SECRET_KEY') ?? 'minioadmin',
    });
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
}
