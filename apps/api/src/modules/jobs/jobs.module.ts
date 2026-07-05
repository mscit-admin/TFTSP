import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportsModule } from '../imports/imports.module';
import { IMPORT_QUEUE } from '../imports/import.constants';
import { StatsModule } from '../stats/stats.module';
import { ChangeRequestMaintenanceModule } from './change-request-maintenance.module';
import { ChangeRequestMaintenanceProcessor } from './change-request-maintenance.processor';
import { ChangeRequestScheduler } from './change-request-scheduler.service';
import { ImportDispatcherBridge } from './import-dispatcher.bridge';
import { ImportParseProcessor } from './import-parse.processor';
import { StatsRefreshProcessor } from './stats-refresh.processor';
import { CR_MAINTENANCE_QUEUE, STATS_QUEUE } from './jobs.constants';

/**
 * BullMQ scheduler + workers (change-request maintenance + bulk-import parse).
 * Requires Redis, so it is only imported when the scheduler is enabled (see
 * AppModule). Tests invoke the underlying services directly and skip this module.
 */
@Module({
  imports: [
    ChangeRequestMaintenanceModule,
    ImportsModule,
    StatsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: CR_MAINTENANCE_QUEUE },
      { name: IMPORT_QUEUE },
      { name: STATS_QUEUE },
    ),
  ],
  providers: [
    ChangeRequestMaintenanceProcessor,
    ChangeRequestScheduler,
    ImportParseProcessor,
    ImportDispatcherBridge,
    StatsRefreshProcessor,
  ],
})
export class JobsModule {}
