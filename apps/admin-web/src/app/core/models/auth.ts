// Local mirror of packages/shared-types/src/auth.ts.
import type { RoleAssignment, Role } from './roles';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
}

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantNameAr: string;
  tenantNameEn: string;
  roles: Role[];
}

export interface LoginDto {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenants: TenantMembership[];
}

export interface RefreshDto {
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  isSuperAdmin: boolean;
  exp?: number;
  iat?: number;
}

export interface MeResponse {
  user: AuthUser;
  roleAssignments: RoleAssignment[];
  activeTenant?: TenantMembership;
}
