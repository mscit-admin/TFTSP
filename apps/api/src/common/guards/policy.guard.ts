import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_SUPER_ADMIN_KEY } from '../decorators/super-admin.decorator';
import { AppException } from '../errors/app.exception';
import { ErrorKeys } from '../errors/error-keys';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_MATRIX, ScopeCheck } from '../rbac/permissions';
import { PERMISSION_KEY, PermissionRequirement } from '../rbac/require-permission.decorator';

/**
 * The single central authorization layer (Spec §6). Reads @SuperAdminOnly and
 * @RequirePermission metadata; NO service ever checks roles manually.
 *
 * role_assignments is authorization metadata (kept out of RLS, D-101) so it is
 * read here via the platform client with an explicit (tenantId, userId) filter,
 * validity window enforced by valid_from/valid_to.
 */
@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw AppException.unauthorized(ErrorKeys.UNAUTHORIZED);
    }

    // Platform Super Admin routes.
    const superAdminOnly = this.reflector.getAllAndOverride<boolean>(IS_SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (superAdminOnly) {
      if (!user.isSuperAdmin) {
        throw AppException.forbidden(ErrorKeys.FORBIDDEN);
      }
      return true;
    }

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Authenticated route without an explicit permission (e.g. /auth/me).
    if (!requirement) {
      return true;
    }

    // A super admin can act inside any tenant they have selected.
    if (user.isSuperAdmin && user.tenantId) {
      return true;
    }

    if (!user.tenantId) {
      throw AppException.forbidden(ErrorKeys.FORBIDDEN);
    }

    const now = new Date();
    const assignments = await this.prisma.platform.roleAssignment.findMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
    });

    if (assignments.length === 0) {
      // A temporary grant (e.g. a view-request Viewer) that has passed valid_to
      // ⇒ 401 with an expiry message (Spec §3·M3 gate 4), distinct from 403.
      await this.throwIfExpiredGrant(user.tenantId, user.id, now);
      throw AppException.forbidden(ErrorKeys.FORBIDDEN);
    }

    const allowedRoles = PERMISSION_MATRIX[requirement.permission];
    const matching = assignments.filter((a) => allowedRoles.includes(a.role));
    if (matching.length === 0) {
      throw AppException.forbidden(ErrorKeys.FORBIDDEN);
    }

    if (requirement.scope === ScopeCheck.TribalUnit) {
      const ok = await this.checkTribalUnitScope(matching, request, user.tenantId);
      if (!ok) {
        throw AppException.forbidden(ErrorKeys.FORBIDDEN);
      }
    }

    return true;
  }

  /** 401 with an expiry message when the user's only assignment(s) have lapsed. */
  private async throwIfExpiredGrant(tenantId: string, userId: string, now: Date): Promise<void> {
    const expired = await this.prisma.platform.roleAssignment.findFirst({
      where: { tenantId, userId, validTo: { lt: now } },
    });
    if (expired) {
      throw AppException.unauthorized(ErrorKeys.GRANT_EXPIRED, {
        expiredAt: expired.validTo?.toISOString(),
      });
    }
  }

  /**
   * branch_admin is confined to its assigned tribal_unit and that unit's
   * descendants; unscoped admin roles (tribe_admin/deputy_admin) pass. The
   * concrete target unit is resolved from the request (param/body) and matched
   * against the closure of each scoped assignment. In M1 we approximate the unit
   * hierarchy check with a direct + descendant lookup on tribal_units.
   */
  private async checkTribalUnitScope(
    assignments: { role: Role; tribalUnitId: string | null }[],
    request: { params?: Record<string, string>; body?: Record<string, unknown> },
    tenantId: string,
  ): Promise<boolean> {
    // Any unscoped (tribalUnitId === null) admin assignment grants full scope.
    const hasUnscoped = assignments.some((a) => a.tribalUnitId === null);
    if (hasUnscoped) {
      return true;
    }

    const targetUnitId =
      (request.body?.tribalUnitId as string | undefined) ??
      (request.params?.tribalUnitId as string | undefined);

    // No explicit unit on the request: fall back to allowing scoped admins (the
    // RLS + service layer still constrain the tenant). Tightened in M3.
    if (!targetUnitId) {
      return true;
    }

    const scopedUnitIds = assignments
      .map((a) => a.tribalUnitId)
      .filter((id): id is string => id !== null);

    if (scopedUnitIds.includes(targetUnitId)) {
      return true;
    }

    // Is the target a descendant of any scoped unit?
    const units = await this.prisma.platform.tribalUnit.findMany({
      where: { tenantId },
      select: { id: true, parentId: true },
    });
    const parentById = new Map(units.map((u) => [u.id, u.parentId]));
    let cursor: string | null | undefined = targetUnitId;
    while (cursor) {
      if (scopedUnitIds.includes(cursor)) {
        return true;
      }
      cursor = parentById.get(cursor) ?? null;
    }
    return false;
  }
}
