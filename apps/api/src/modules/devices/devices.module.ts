import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceRepository } from './device.repository';
import { DeviceService } from './device.service';

/**
 * M5 — mobile device registration. The FCM NotificationChannel (in the
 * notifications module) reuses `DeviceRepository` to look up + prune tokens.
 * AuditService comes from the global AuditModule.
 */
@Module({
  controllers: [DeviceController],
  providers: [DeviceService, DeviceRepository],
  exports: [DeviceRepository],
})
export class DevicesModule {}
