import { Injectable } from '@nestjs/common';
import { VisibilitySettings } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { UpdateVisibilitySettingsDto } from './dto/visibility-settings.dto';
import { VisibilitySettingsRepository } from './visibility-settings.repository';

@Injectable()
export class VisibilitySettingsService {
  constructor(
    private readonly repo: VisibilitySettingsRepository,
    private readonly audit: AuditService,
  ) {}

  /** Effective settings for the current tenant (creates policy defaults on first use). */
  get(): Promise<VisibilitySettings> {
    return this.repo.getOrCreate();
  }

  async update(dto: UpdateVisibilitySettingsDto): Promise<VisibilitySettings> {
    const before = await this.repo.getOrCreate();
    const updated = await this.repo.update({ ...dto });
    await this.audit.record({
      action: 'visibilitySettings.update',
      entityType: 'VisibilitySettings',
      entityId: updated.tenantId,
      before,
      after: updated,
    });
    return updated;
  }
}
