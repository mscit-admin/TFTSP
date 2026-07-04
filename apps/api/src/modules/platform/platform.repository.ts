import { Injectable } from '@nestjs/common';
import { Prisma, Role, Tenant, TenantStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Platform administration data access. Uses the owner (platform) client: these
 * are platform-level tables and cross-tenant aggregates, guarded by SuperAdminGuard.
 */
@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.platform.tenant.findUnique({ where: { slug } });
  }

  findTenantById(id: string): Promise<Tenant | null> {
    return this.prisma.platform.tenant.findUnique({ where: { id } });
  }

  listTenants(): Promise<Tenant[]> {
    return this.prisma.platform.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  setTenantStatus(id: string, status: TenantStatus): Promise<Tenant> {
    return this.prisma.platform.tenant.update({ where: { id }, data: { status } });
  }

  userEmailExists(email: string): Promise<{ id: string } | null> {
    return this.prisma.platform.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
  }

  /** Creates tenant + first admin user + tribe_admin assignment atomically. */
  async createTenantWithAdmin(
    tenant: Prisma.TenantCreateInput,
    admin: { email: string; fullName: string; passwordHash: string },
  ): Promise<Tenant> {
    return this.prisma.platform.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({ data: tenant });
      const user = await tx.user.create({
        data: {
          email: admin.email.toLowerCase(),
          fullName: admin.fullName,
          passwordHash: admin.passwordHash,
          isSuperAdmin: false,
        },
      });
      await tx.roleAssignment.create({
        data: {
          tenantId: createdTenant.id,
          userId: user.id,
          role: Role.tribe_admin,
          tribalUnitId: null,
        },
      });
      return createdTenant;
    });
  }

  async personCountsByTenant(): Promise<Map<string, number>> {
    const rows = await this.prisma.platform.person.groupBy({
      by: ['tenantId'],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.tenantId, r._count._all]));
  }

  async userCountsByTenant(): Promise<Map<string, number>> {
    const rows = await this.prisma.platform.roleAssignment.findMany({
      select: { tenantId: true, userId: true },
    });
    const byTenant = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!byTenant.has(r.tenantId)) {
        byTenant.set(r.tenantId, new Set());
      }
      byTenant.get(r.tenantId)!.add(r.userId);
    }
    return new Map([...byTenant].map(([t, set]) => [t, set.size]));
  }

  async globalStats(): Promise<{ tribes: number; persons: number; users: number }> {
    const [tribes, persons, users] = await Promise.all([
      this.prisma.platform.tenant.count(),
      this.prisma.platform.person.count({ where: { deletedAt: null } }),
      this.prisma.platform.user.count(),
    ]);
    return { tribes, persons, users };
  }
}
