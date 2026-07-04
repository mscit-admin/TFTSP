/**
 * Platform (tenant) types — mirrored from packages/shared-types/src/tenant.ts.
 *
 * NOTE (contract assumption): the create-tenant *request* body follows
 * API_CONTRACT.M1.md verbatim (snake_case: name_ar / name_en). The list
 * *response* is normalized by PlatformService to this canonical camelCase
 * shape, tolerating either casing the backend emits. See DECISIONS.md D-1xx.
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

/** Request body for POST /platform/tenants (wire shape = snake_case per contract). */
export interface CreateTenantRequest {
  slug: string;
  name_ar: string;
  name_en: string;
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
