import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ChangeRequestMaintenanceService } from './change-request-maintenance.service';
import { CR_MAINTENANCE_QUEUE, JOB_EXPIRY_SWEEP, JOB_EXPIRY_WARNING } from './jobs.constants';

@Processor(CR_MAINTENANCE_QUEUE)
export class ChangeRequestMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(ChangeRequestMaintenanceProcessor.name);

  constructor(private readonly maintenance: ChangeRequestMaintenanceService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case JOB_EXPIRY_SWEEP:
        await this.maintenance.runExpirySweep();
        break;
      case JOB_EXPIRY_WARNING:
        await this.maintenance.runExpiryWarning();
        break;
      default:
        this.logger.warn(`Unknown job ${job.name}`);
    }
  }
}
