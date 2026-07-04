import { Injectable } from '@nestjs/common';
import { Prisma, WorkflowSettings } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

/** Tenant-scoped (RLS). One row per tenant, lazily created with defaults. */
@Injectable()
export class WorkflowSettingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  find(): Promise<WorkflowSettings | null> {
    return this.prisma.tenant.workflowSettings.findUnique({
      where: { tenantId: this.tenantContext.requireTenantId() },
    });
  }

  async getOrCreate(): Promise<WorkflowSettings> {
    const tenantId = this.tenantContext.requireTenantId();
    const existing = await this.prisma.tenant.workflowSettings.findUnique({
      where: { tenantId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.tenant.workflowSettings.create({ data: { tenantId } });
  }

  async update(data: Prisma.WorkflowSettingsUpdateInput): Promise<WorkflowSettings> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.tenant.workflowSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        approvalsRequired: (data.approvalsRequired as number) ?? 1,
        expiryDays: (data.expiryDays as number) ?? 30,
        reviewerCanEdit: (data.reviewerCanEdit as boolean) ?? false,
      },
      update: data,
    });
  }
}
