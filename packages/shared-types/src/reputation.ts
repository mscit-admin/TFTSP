/** M4 — Community contributions & reputation (Spec §13, within M4). No new engine: a
 *  contribution IS an M2 Change Request with an added type. */

export type ContributionType =
  | 'add_person'
  | 'edit_data'
  | 'fix_relation'
  | 'upload_document'
  | 'add_source'
  | 'add_biography';

/** Types a Viewer may suggest when the tribe enables visitor contributions (Spec §13.2). */
export const VIEWER_ALLOWED_CONTRIBUTIONS: ContributionType[] = ['edit_data', 'add_source'];

export type TrustLevel = 'bronze' | 'silver' | 'gold';

/** Per-contributor, per-tenant reputation counters (Spec §13.3). */
export interface ContributorReputation {
  tenantId: string;
  userId: string;
  totalContributions: number;
  accepted: number;
  rejected: number;
  /** computed = accepted / max(1, accepted + rejected) */
  accuracyRate: number;
  trustLevel: TrustLevel;
}

/** Per-tenant thresholds (adjustable, Spec §13.3). */
export interface ReputationThresholds {
  tenantId: string;
  silverMinAccepted: number;
  goldMinAccepted: number;
  silverMinAccuracy: number;
  goldMinAccuracy: number;
  /** whether Viewers may suggest limited corrections (Spec §13.2) */
  allowViewerContributions: boolean;
  /** max pending contributions per contributor (Spec §13.6, default 20) */
  maxPending: number;
}

/** Biography/story — a formatted text field added on Person, approved like any change. */
export interface PersonBiography {
  personId: string;
  body: string; // sanitized rich text
  updatedAt: string;
}
