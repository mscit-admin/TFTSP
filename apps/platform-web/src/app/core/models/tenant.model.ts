/**
 * Platform (tenant) types — mirrored from packages/shared-types/src/tenant.ts.
 *
 * NOTE: the create-tenant *request* body is camelCase (nameAr / nameEn),
 * matching the backend DTO and packages/shared-types CreateTenantDto (the
 * frozen contract was reconciled to camelCase). The list *response* is
 * normalized by PlatformService, tolerating either casing the backend emits.
 */

export type TenantStatus = 'active' | 'suspended';

/** Canonical tenant row used across the UI (post-normalization). */
export interface TenantRow {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  status: TenantStatus;
  createdAt?: string;
  /** aggregate counts returned by GET /platform/tenants */
  personsCount: number;
  usersCount: number;
}

/** Request body for POST /platform/tenants (camelCase — matches backend DTO). */
export interface CreateTenantRequest {
  slug: string;
  nameAr: string;
  nameEn: string;
  admin: {
    email: string;
    fullName: string;
    password: string;
  };
}

/** GET /platform/stats */
export interface PlatformStats {
  tribes: number;
  persons: number;
  users: number;
}
