import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CR_MAINTENANCE_QUEUE, JOB_EXPIRY_SWEEP, JOB_EXPIRY_WARNING } from './jobs.constants';

/** Registers the repeatable maintenance jobs on startup (Spec §3 M2). */
@Injectable()
export class ChangeRequestScheduler implements OnModuleInit {
  private readonly logger = new Logger(ChangeRequestScheduler.name);

  constructor(@InjectQueue(CR_MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    try {
      // Expiry sweep hourly; expiry-approaching warning daily.
      await this.queue.add(
        JOB_EXPIRY_SWEEP,
        {},
        { repeat: { pattern: '0 * * * *' }, removeOnComplete: true, removeOnFail: 100 },
      );
      await this.queue.add(
        JOB_EXPIRY_WARNING,
        {},
        { repeat: { pattern: '0 9 * * *' }, removeOnComplete: true, removeOnFail: 100 },
      );
      this.logger.log('Registered change-request maintenance jobs.');
    } catch (err) {
      this.logger.warn(`Could not register maintenance jobs (Redis unavailable?): ${String(err)}`);
    }
  }
}
