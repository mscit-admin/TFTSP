import { Injectable, Logger } from '@nestjs/common';
import { StatsRepository } from './stats.repository';

/** Redis-free refresh entrypoint (BullMQ worker + tests call this directly). */
@Injectable()
export class StatsRefreshService {
  private readonly logger = new Logger(StatsRefreshService.name);

  constructor(private readonly repo: StatsRepository) {}

  async run(): Promise<void> {
    await this.repo.refreshViews();
    this.logger.log('Refreshed stats materialized views.');
  }
}
