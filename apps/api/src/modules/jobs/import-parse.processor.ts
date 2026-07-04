import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ImportParseService } from '../imports/import-parse.service';
import { IMPORT_QUEUE, JOB_PARSE } from '../imports/import.constants';

/** BullMQ worker that runs the (streaming) import parse pipeline off the request path. */
@Processor(IMPORT_QUEUE)
export class ImportParseProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportParseProcessor.name);

  constructor(private readonly parse: ImportParseService) {
    super();
  }

  async process(job: Job<{ batchId: string }>): Promise<void> {
    if (job.name === JOB_PARSE) {
      await this.parse.run(job.data.batchId);
    } else {
      this.logger.warn(`Unknown import job ${job.name}`);
    }
  }
}
