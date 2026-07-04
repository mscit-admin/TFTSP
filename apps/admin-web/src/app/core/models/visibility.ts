// Local mirror of packages/shared-types/src/visibility.ts (M3 — DECISIONS D-202 mirror policy).

/** Tribe-wide baseline visibility level (Spec §3·M3.2). */
export type VisibilityLevel =
  | 'public'
  | 'members' // authenticated members only
  | 'family'
  | 'branch'
  | 'admin';

/** Women-display policy (Spec §3·M3.3 — 4 modes). */
export type WomenDisplayMode =
  | 'under_father'
  | 'with_siblings'
  | 'under_husband'
  | 'hidden'; // hidden from non-direct-relatives

/** Member read scope granted by role (Spec §3·M3.4). */
export type MemberScope =
  | 'direct' // direct ancestors + siblings + children
  | 'clan'
  | 'branch'
  | 'tribe';

/** Per-tenant visibility + field policy. Every person read passes the Visibility Resolver. */
export interface VisibilitySettings {
  tenantId: string;
  level: VisibilityLevel;
  womenDisplay: WomenDisplayMode;
  showPhotos: boolean;
  showPhones: boolean;
  showBirthDates: boolean;
  showDeceased: boolean;
  showMinors: boolean; // children under 18
  showDocuments: boolean;
  /** default read scope for a plain member (role assignments can narrow/widen) */
  defaultMemberScope: MemberScope;
  /** require an ID attachment on non-member tree-view requests */
  requireIdForViewRequest: boolean;
}

export type UpdateVisibilitySettingsDto = Partial<Omit<VisibilitySettings, 'tenantId'>>;

/** Non-member tree-viewing request (Spec §3·M3.5). */
export type ViewRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ViewRequest {
  id: string;
  tenantId: string;
  fullName: string; // triple name
  phone: string;
  allegedBranch?: string | null;
  reason: string;
  idAttachmentKey?: string | null; // MinIO key, if the tribe requires it
  status: ViewRequestStatus;
  reviewedBy?: string | null;
  grantedUserId?: string | null;
  /** mandatory expiry of the granted Viewer role */
  validTo?: string | null;
  createdAt: string;
}

/** Public submission (tenant identified by slug; no auth). */
export interface CreateViewRequestDto {
  tenantSlug: string;
  fullName: string;
  phone: string;
  allegedBranch?: string;
  reason: string;
  idAttachmentKey?: string;
}

export interface ApproveViewRequestDto {
  /** mandatory expiry date for the temporary Viewer grant */
  validTo: string;
}

/** Enum-like option lists for the settings UI (kept in-app; not in shared-types). */
export const VISIBILITY_LEVELS: VisibilityLevel[] = [
  'public',
  'members',
  'family',
  'branch',
  'admin',
];

export const WOMEN_DISPLAY_MODES: WomenDisplayMode[] = [
  'under_father',
  'with_siblings',
  'under_husband',
  'hidden',
];

export const MEMBER_SCOPES: MemberScope[] = ['direct', 'clan', 'branch', 'tribe'];
