// Local mirror of packages/shared-types/src/reputation.ts (M4 — DECISIONS D-202 mirror policy).
export type ContributionType =
  | 'add_person'
  | 'edit_data'
  | 'fix_relation'
  | 'upload_document'
  | 'add_source'
  | 'add_biography';

/** Types a Viewer may suggest when the tribe enables visitor contributions (Spec §13.2). */
export const VIEWER_ALLOWED_CONTRIBUTIONS: ContributionType[] = ['edit_data', 'add_source'];

export const CONTRIBUTION_TYPES: ContributionType[] = [
  'add_person',
  'edit_data',
  'fix_relation',
  'upload_document',
  'add_source',
  'add_biography',
];

export type TrustLevel = 'bronze' | 'silver' | 'gold';

export interface ContributorReputation {
  tenantId: string;
  userId: string;
  /** display name, if the backend joins it (optional) */
  fullName?: string | null;
  totalContributions: number;
  accepted: number;
  rejected: number;
  accuracyRate: number; // 0..1
  trustLevel: TrustLevel;
}

export interface ReputationThresholds {
  tenantId: string;
  silverMinAccepted: number;
  goldMinAccepted: number;
  silverMinAccuracy: number;
  goldMinAccuracy: number;
  allowViewerContributions: boolean;
  maxPending: number;
}

export type UpdateReputationThresholdsDto = Partial<Omit<ReputationThresholds, 'tenantId'>>;

export interface PersonBiography {
  personId: string;
  body: string; // sanitized rich text
  updatedAt: string;
}

/** Backend error keys surfaced by contribution flows. */
export const TOO_MANY_PENDING_KEY = 'errors.contribution.too_many_pending';
export const VIEWER_SUGGEST_DISABLED_KEY = 'errors.contribution.viewer_disabled';
