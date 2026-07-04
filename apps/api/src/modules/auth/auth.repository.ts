import { Injectable } from '@nestjs/common';
import { Prisma, RefreshToken, RoleAssignment, Tenant, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Data access for the auth plane. Users, refresh_tokens and role_assignments are
 * platform/authorization tables read BEFORE a tenant is bound, so they use the
 * platform (owner) client (D-101/D-102).
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.platform.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findUserById(id: string): Promise<User | null> {
    return this.prisma.platform.user.findUnique({ where: { id } });
  }

  updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.platform.user.update({ where: { id }, data });
  }

  /** Active role assignments for a user (optionally within one tenant). */
  findActiveAssignments(userId: string, tenantId?: string): Promise<RoleAssignment[]> {
    const now = new Date();
    return this.prisma.platform.roleAssignment.findMany({
      where: {
        userId,
        ...(tenantId ? { tenantId } : {}),
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
    });
  }

  findTenantsByIds(ids: string[]): Promise<Tenant[]> {
    return this.prisma.platform.tenant.findMany({ where: { id: { in: ids } } });
  }

  findTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.platform.tenant.findUnique({ where: { slug } });
  }

  createRefreshToken(data: Prisma.RefreshTokenUncheckedCreateInput): Promise<RefreshToken> {
    return this.prisma.platform.refreshToken.create({ data });
  }

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.platform.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(id: string, replacedById?: string): Promise<void> {
    await this.prisma.platform.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById: replacedById ?? null },
    });
  }

  /** Reuse detection: revoke every live token in a session family. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.platform.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
