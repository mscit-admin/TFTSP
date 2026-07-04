import { Injectable } from '@nestjs/common';
import { Prisma, Tenant } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Tenant is a PLATFORM-level table (outside RLS), so scoping is done EXPLICITLY
 * by the JWT-derived tenantId in every call — never by input, never by RLS.
 * Uses the platform (owner) client, like the rest of the platform plane.
 */
@Injectable()
export class TenantSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(tenantId: string): Promise<Tenant | null> {
    return this.prisma.platform.tenant.findUnique({ where: { id: tenantId } });
  }

  /**
   * Update scoped by id == tenantId. Returns affected count so the service can
   * distinguish "not found" without trusting any client-supplied identifier.
   */
  async updateScoped(tenantId: string, data: Prisma.TenantUpdateInput): Promise<Tenant> {
    return this.prisma.platform.tenant.update({ where: { id: tenantId }, data });
  }
}
