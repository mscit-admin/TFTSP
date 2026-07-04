import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleAssignment, Tenant, User } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKeys } from '../../common/errors/error-keys';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantNameAr: string;
  tenantNameEn: string;
  roles: string[];
}

export interface AuthUserView {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserView;
  tenants: TenantMembership[];
}

@Injectable()
export class AuthService {
  private readonly maxFailedAttempts: number;
  private readonly lockMinutes: number;

  constructor(
    private readonly repo: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    config: ConfigService,
  ) {
    this.maxFailedAttempts = config.get<number>('auth.maxFailedAttempts') ?? 5;
    this.lockMinutes = config.get<number>('auth.lockMinutes') ?? 15;
  }

  async login(email: string, password: string, tenantSlug?: string): Promise<LoginResult> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      throw AppException.unauthorized(ErrorKeys.INVALID_CREDENTIALS);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw AppException.unauthorized(ErrorKeys.ACCOUNT_LOCKED, {
        until: user.lockedUntil.toISOString(),
      });
    }

    const valid = await this.passwords.verify(user.passwordHash, password);
    if (!valid) {
      await this.registerFailedAttempt(user);
      throw AppException.unauthorized(ErrorKeys.INVALID_CREDENTIALS);
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.repo.updateUser(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    }

    const memberships = await this.buildMemberships(user.id);
    const activeTenantId = this.resolveActiveTenant(memberships, tenantSlug, user);

    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      tenantId: activeTenantId,
      isSuperAdmin: user.isSuperAdmin,
    });
    const { raw: refreshToken } = await this.tokens.issueRefreshToken(user.id, activeTenantId);

    return {
      accessToken,
      refreshToken,
      user: this.toUserView(user),
      tenants: memberships,
    };
  }

  async refresh(rawToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = TokenService.hashToken(rawToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);
    if (!stored) {
      throw AppException.unauthorized(ErrorKeys.INVALID_REFRESH_TOKEN);
    }

    // Reuse detection: a token presented after it was already rotated ⇒ revoke
    // the entire session family (Spec §4 / M1 acceptance criterion).
    if (stored.revokedAt) {
      await this.repo.revokeFamily(stored.familyId);
      throw AppException.unauthorized(ErrorKeys.REFRESH_TOKEN_REUSED);
    }

    if (stored.expiresAt < new Date()) {
      await this.repo.revokeRefreshToken(stored.id);
      throw AppException.unauthorized(ErrorKeys.INVALID_REFRESH_TOKEN);
    }

    const user = await this.repo.findUserById(stored.userId);
    if (!user) {
      throw AppException.unauthorized(ErrorKeys.INVALID_REFRESH_TOKEN);
    }

    // Rotate within the same family.
    const issued = await this.tokens.issueRefreshToken(
      user.id,
      stored.tenantId ?? undefined,
      stored.familyId,
    );
    await this.repo.revokeRefreshToken(stored.id, issued.record.id);

    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      email: user.email,
      tenantId: stored.tenantId ?? undefined,
      isSuperAdmin: user.isSuperAdmin,
    });

    return { accessToken, refreshToken: issued.raw };
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = TokenService.hashToken(rawToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);
    if (stored) {
      await this.repo.revokeFamily(stored.familyId);
    }
  }

  async me(current: AuthenticatedUser): Promise<{
    user: AuthUserView;
    roleAssignments: RoleAssignment[];
    activeTenant?: TenantMembership;
  }> {
    const user = await this.repo.findUserById(current.id);
    if (!user) {
      throw AppException.unauthorized(ErrorKeys.UNAUTHORIZED);
    }

    const assignments = await this.repo.findActiveAssignments(user.id, current.tenantId);
    let activeTenant: TenantMembership | undefined;
    if (current.tenantId) {
      const memberships = await this.buildMemberships(user.id);
      activeTenant = memberships.find((m) => m.tenantId === current.tenantId);
    }

    return { user: this.toUserView(user), roleAssignments: assignments, activeTenant };
  }

  // -------------------------------------------------------------------------

  private async registerFailedAttempt(user: User): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    if (attempts >= this.maxFailedAttempts) {
      await this.repo.updateUser(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: new Date(Date.now() + this.lockMinutes * 60_000),
      });
    } else {
      await this.repo.updateUser(user.id, { failedLoginAttempts: attempts });
    }
  }

  private async buildMemberships(userId: string): Promise<TenantMembership[]> {
    const assignments = await this.repo.findActiveAssignments(userId);
    if (assignments.length === 0) {
      return [];
    }
    const tenantIds = [...new Set(assignments.map((a) => a.tenantId))];
    const tenants = await this.repo.findTenantsByIds(tenantIds);
    const tenantById = new Map<string, Tenant>(tenants.map((t) => [t.id, t]));

    const rolesByTenant = new Map<string, Set<string>>();
    for (const a of assignments) {
      if (!rolesByTenant.has(a.tenantId)) {
        rolesByTenant.set(a.tenantId, new Set());
      }
      rolesByTenant.get(a.tenantId)!.add(a.role);
    }

    const memberships: TenantMembership[] = [];
    for (const [tenantId, roles] of rolesByTenant) {
      const tenant = tenantById.get(tenantId);
      if (!tenant || tenant.status === 'suspended') {
        continue;
      }
      memberships.push({
        tenantId,
        tenantSlug: tenant.slug,
        tenantNameAr: tenant.nameAr,
        tenantNameEn: tenant.nameEn,
        roles: [...roles],
      });
    }
    return memberships;
  }

  private resolveActiveTenant(
    memberships: TenantMembership[],
    tenantSlug: string | undefined,
    user: User,
  ): string | undefined {
    if (tenantSlug) {
      const match = memberships.find((m) => m.tenantSlug === tenantSlug);
      if (!match) {
        throw AppException.forbidden(ErrorKeys.NO_TENANT_MEMBERSHIP, { tenantSlug });
      }
      return match.tenantId;
    }
    if (memberships.length > 0) {
      return memberships[0].tenantId;
    }
    // Pure platform super admin with no tenant memberships.
    if (user.isSuperAdmin) {
      return undefined;
    }
    return undefined;
  }

  private toUserView(user: User): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isSuperAdmin: user.isSuperAdmin,
    };
  }
}
