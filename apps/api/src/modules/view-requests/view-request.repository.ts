import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Role,
  Tenant,
  ViewRequest,
  ViewRequestStatus,
  VisibilitySettings,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * View requests are submitted PUBLICLY (no tenant/JWT context), so creation and
 * the admin-review side both use the owner client with an explicit tenantId
 * (RLS can't apply without a bound tenant). Consistent with D-203/D-304.
 */
@Injectable()
export class ViewRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.platform.tenant.findUnique({ where: { slug } });
  }

  visibilitySettings(tenantId: string): Promise<VisibilitySettings | null> {
    return this.prisma.platform.visibilitySettings.findUnique({ where: { tenantId } });
  }

  create(data: Prisma.ViewRequestUncheckedCreateInput): Promise<ViewRequest> {
    return this.prisma.platform.viewRequest.create({ data });
  }

  /** Admins to notify for a tenant (tribe/deputy admins). */
  async adminUserIds(tenantId: string): Promise<string[]> {
    const now = new Date();
    const rows = await this.prisma.platform.roleAssignment.findMany({
      where: {
        tenantId,
        role: { in: [Role.tribe_admin, Role.deputy_admin] },
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  // ---- admin review (tenant RLS app client — admin is authenticated) ------

  /** RLS scopes to the current tenant; status is an optional filter. */
  list(status?: ViewRequestStatus): Promise<ViewRequest[]> {
    return this.prisma.tenant.viewRequest.findMany({
      where: { ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<ViewRequest | null> {
    return this.prisma.tenant.viewRequest.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.ViewRequestUncheckedUpdateInput): Promise<ViewRequest> {
    return this.prisma.tenant.viewRequest.update({ where: { id }, data });
  }

  /** Create the temporary Viewer user + role assignment (platform tables). */
  async grantViewer(
    tenantId: string,
    email: string,
    fullName: string,
    passwordHash: string,
    validTo: Date,
    memberScope: 'direct' | 'clan' | 'branch' | 'tribe',
  ): Promise<string> {
    return this.prisma.platform.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: email.toLowerCase(), fullName, passwordHash },
      });
      await tx.roleAssignment.create({
        data: {
          tenantId,
          userId: user.id,
          role: Role.viewer,
          memberScope,
          validFrom: new Date(),
          validTo,
        },
      });
      return user.id;
    });
  }
}
