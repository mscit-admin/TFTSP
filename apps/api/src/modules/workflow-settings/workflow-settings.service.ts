import { Injectable } from '@nestjs/common';
import { WorkflowSettings } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { UpdateWorkflowSettingsDto } from './dto/workflow-settings.dto';
import { WorkflowSettingsRepository } from './workflow-settings.repository';

@Injectable()
export class WorkflowSettingsService {
  constructor(
    private readonly repo: WorkflowSettingsRepository,
    private readonly audit: AuditService,
  ) {}

  /** Effective settings for the current tenant (creates defaults on first use). */
  get(): Promise<WorkflowSettings> {
    return this.repo.getOrCreate();
  }

  async update(dto: UpdateWorkflowSettingsDto): Promise<WorkflowSettings> {
    const before = await this.repo.getOrCreate();
    const updated = await this.repo.update({
      ...(dto.approvalsRequired !== undefined ? { approvalsRequired: dto.approvalsRequired } : {}),
      ...(dto.expiryDays !== undefined ? { expiryDays: dto.expiryDays } : {}),
      ...(dto.reviewerCanEdit !== undefined ? { reviewerCanEdit: dto.reviewerCanEdit } : {}),
    });
    await this.audit.record({
      action: 'workflowSettings.update',
      entityType: 'WorkflowSettings',
      entityId: updated.tenantId,
      before,
      after: updated,
    });
    return updated;
  }
}
