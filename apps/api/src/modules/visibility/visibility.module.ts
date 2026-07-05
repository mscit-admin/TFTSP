import { Global, Module } from '@nestjs/common';
import { VisibilitySettingsController } from './visibility-settings.controller';
import { VisibilitySettingsRepository } from './visibility-settings.repository';
import { VisibilitySettingsService } from './visibility-settings.service';
import { VisibilityResolver } from './visibility.resolver';

/**
 * Global so EVERY person read path (persons, lineage/tree, and any future echo)
 * can inject the resolver without a bypass. Spec §3·M3.1.
 */
@Global()
@Module({
  controllers: [VisibilitySettingsController],
  providers: [VisibilityResolver, VisibilitySettingsService, VisibilitySettingsRepository],
  exports: [VisibilityResolver, VisibilitySettingsService],
})
export class VisibilityModule {}
