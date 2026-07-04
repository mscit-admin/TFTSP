import { Injectable, Logger } from '@nestjs/common';

type ParseFn = (batchId: string) => Promise<void>;

/**
 * Indirection so the (Redis-free) ImportsModule can hand off the parse job
 * without depending on BullMQ. JobsModule (when Redis is enabled) registers a
 * BullMQ-backed enqueue fn on startup; otherwise parsing is driven directly
 * (tests call ImportParseService.run). Mirrors the M2 scheduler gating.
 */
@Injectable()
export class ImportDispatcher {
  private readonly logger = new Logger(ImportDispatcher.name);
  private parseFn?: ParseFn;

  register(parseFn: ParseFn): void {
    this.parseFn = parseFn;
  }

  async enqueueParse(batchId: string): Promise<void> {
    if (this.parseFn) {
      await this.parseFn(batchId);
    } else {
      this.logger.warn(`No import worker registered; parse for ${batchId} not enqueued.`);
    }
  }
}
