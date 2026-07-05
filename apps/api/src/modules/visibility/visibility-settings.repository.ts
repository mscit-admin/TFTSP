import { Injectable } from '@nestjs/common';
import { Prisma, VisibilitySettings } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context';

/** Tenant-scoped (RLS). One row per tenant, lazily created with policy defaults. */
@Injectable()
export class VisibilitySettingsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getOrCreate(): Promise<VisibilitySettings> {
    const tenantId = this.tenantContext.requireTenantId();
    const existing = await this.prisma.tenant.visibilitySettings.findUnique({
      where: { tenantId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.tenant.visibilitySettings.create({ data: { tenantId } });
  }

  async update(data: Prisma.VisibilitySettingsUncheckedUpdateInput): Promise<VisibilitySettings> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.tenant.visibilitySettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data } as Prisma.VisibilitySettingsUncheckedCreateInput,
      update: data,
    });
  }
}
