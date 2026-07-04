/**
 * Auth types — mirrored locally from packages/shared-types/src/auth.ts
 * (Backend owns the canonical definitions; kept in sync with API_CONTRACT.M1.md).
 */

export type Role =
  | 'super_admin'
  | 'platform_admin'
  | 'tribe_admin'
  | 'deputy_admin'
  | 'branch_admin'
  | 'reviewer'
  | 'contributor'
  | 'viewer'
  | 'guest';

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

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
