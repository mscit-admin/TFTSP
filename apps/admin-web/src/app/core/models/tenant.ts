// Local mirror of packages/shared-types/src/tenant.ts.
export type TenantStatus = 'active' | 'suspended';

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

/**
 * Tribe settings edited by admin-web. The write shape is the sub-set of Tenant a
 * Tribe Admin may change (branding). Logo upload is stubbed to the API shape:
 * PUT the returned `logoKey` after uploading the file object (upload endpoint is M4).
 */
export interface TribeSettingsDto {
  nameAr?: string;
  nameEn?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoKey?: string | null;
}

/** Response shape for the stubbed logo-upload intent (M4 will back it with MinIO). */
export interface LogoUploadTicket {
  uploadUrl: string;
  logoKey: string;
}
