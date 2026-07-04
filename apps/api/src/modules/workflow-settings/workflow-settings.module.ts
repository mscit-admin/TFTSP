import { Module } from '@nestjs/common';
import { WorkflowSettingsController } from './workflow-settings.controller';
import { WorkflowSettingsRepository } from './workflow-settings.repository';
import { WorkflowSettingsService } from './workflow-settings.service';

@Module({
  controllers: [WorkflowSettingsController],
  providers: [WorkflowSettingsService, WorkflowSettingsRepository],
  exports: [WorkflowSettingsService],
})
export class WorkflowSettingsModule {}
