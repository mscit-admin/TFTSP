import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ImportDispatcher } from '../imports/import.dispatcher';
import { IMPORT_QUEUE, JOB_PARSE } from '../imports/import.constants';

/**
 * When Redis/BullMQ is enabled, wire the (Redis-free) ImportDispatcher to enqueue
 * real parse jobs. Keeps ImportsModule independent of BullMQ (mirrors the M2
 * scheduler gating).
 */
@Injectable()
export class ImportDispatcherBridge implements OnModuleInit {
  constructor(
    private readonly dispatcher: ImportDispatcher,
    @InjectQueue(IMPORT_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    this.dispatcher.register(async (batchId: string) => {
      await this.queue.add(JOB_PARSE, { batchId }, { removeOnComplete: true, removeOnFail: 50 });
    });
  }
}
