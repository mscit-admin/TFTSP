import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { StatsRefreshService } from '../stats/stats-refresh.service';
import { JOB_STATS_REFRESH, STATS_QUEUE } from './jobs.constants';

/** BullMQ worker + hourly scheduler for the stats materialized-view refresh. */
@Processor(STATS_QUEUE)
@Injectable()
export class StatsRefreshProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly refresh: StatsRefreshService,
    @InjectQueue(STATS_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB_STATS_REFRESH) {
      await this.refresh.run();
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        JOB_STATS_REFRESH,
        {},
        { repeat: { pattern: '0 * * * *' }, removeOnComplete: true, removeOnFail: 50 },
      );
    } catch {
      // Redis may be unavailable; the on-demand refresh endpoint still works.
    }
  }
}
