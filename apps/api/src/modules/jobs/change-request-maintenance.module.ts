import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChangeRequestMaintenanceService } from './change-request-maintenance.service';

/** Redis-free module exposing the maintenance logic (used by tests + JobsModule). */
@Module({
  imports: [NotificationsModule],
  providers: [ChangeRequestMaintenanceService],
  exports: [ChangeRequestMaintenanceService],
})
export class ChangeRequestMaintenanceModule {}
