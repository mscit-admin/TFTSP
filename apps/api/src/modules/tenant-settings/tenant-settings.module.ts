import { Module } from '@nestjs/common';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsRepository } from './tenant-settings.repository';
import { TenantSettingsService } from './tenant-settings.service';

@Module({
  controllers: [TenantSettingsController],
  providers: [TenantSettingsService, TenantSettingsRepository],
})
export class TenantSettingsModule {}
