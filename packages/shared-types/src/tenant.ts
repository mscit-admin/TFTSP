export type TenantStatus = 'active' | 'suspended';

/** Tenant (tribe) — platform-level entity, OUTSIDE RLS. Managed by Administration module. */
export interface Tenant {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  status: TenantStatus;
  logoKey?: string | null;
  primaryColor?: string | null;
  createdAt: string;
}

export interface CreateTenantDto {
  slug: string;
  nameAr: string;
  nameEn: string;
  admin: {
    email: string;
    fullName: string;
    password: string;
  };
}

export interface PlatformStats {
  tribes: number;
  persons: number;
  users: number;
}
