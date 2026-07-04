import { Readable } from 'node:stream';

/**
 * In-memory MinioService stand-in for e2e — keeps the import tests independent of
 * a real object store while exercising the full streaming put/get code paths.
 */
export class InMemoryMinio {
  readonly bucket = 'test';
  private readonly store = new Map<string, Buffer>();

  async onModuleInit(): Promise<void> {
    /* no-op */
  }

  async putStream(key: string, stream: Readable): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    this.store.set(key, Buffer.concat(chunks));
  }

  async getStream(key: string): Promise<Readable> {
    return Readable.from(this.store.get(key) ?? Buffer.alloc(0));
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }
}
