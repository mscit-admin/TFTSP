import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChangeRequestMaintenanceModule } from './change-request-maintenance.module';
import { ChangeRequestMaintenanceProcessor } from './change-request-maintenance.processor';
import { ChangeRequestScheduler } from './change-request-scheduler.service';
import { CR_MAINTENANCE_QUEUE } from './jobs.constants';

/**
 * BullMQ scheduler + worker for change-request maintenance. Requires Redis, so
 * it is only imported when the scheduler is enabled (see AppModule). Tests invoke
 * ChangeRequestMaintenanceService directly and skip this module.
 */
@Module({
  imports: [
    ChangeRequestMaintenanceModule,
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
    BullModule.registerQueue({ name: CR_MAINTENANCE_QUEUE }),
  ],
  providers: [ChangeRequestMaintenanceProcessor, ChangeRequestScheduler],
})
export class JobsModule {}
