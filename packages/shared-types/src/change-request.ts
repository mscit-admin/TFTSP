/** M2 — Change Requests & Approval Workflow (Spec Section 3 · M2). */

export type ChangeTargetType = 'person' | 'union' | 'tribal_unit';
export type ChangeOperation = 'create' | 'update' | 'delete';

export type ChangeRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'published'
  | 'conflict'
  | 'expired';

export type ReviewDecision = 'approve' | 'reject' | 'request_changes';

/** A single JSON Patch operation (RFC 6902) — the diff carried by a change request. */
export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

export interface ChangeRequestReview {
  id: string;
  changeRequestId: string;
  reviewerId: string;
  decision: ReviewDecision;
  comment?: string | null;
  createdAt: string;
}

export interface ChangeRequest {
  id: string;
  tenantId: string;
  targetType: ChangeTargetType;
  /** null when operation = create (target does not exist yet) */
  targetId?: string | null;
  operation: ChangeOperation;
  /** RFC-6902 patch applied atomically on publish */
  patch: JsonPatchOp[];
  status: ChangeRequestStatus;
  /** target `version` captured at creation — used to detect conflict at publish time */
  baseVersion?: number | null;
  reviews: ChangeRequestReview[];
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  publishedAt?: string | null;
}

export interface CreateChangeRequestDto {
  targetType: ChangeTargetType;
  targetId?: string;
  operation: ChangeOperation;
  patch: JsonPatchOp[];
}

export type UpdateChangeRequestDto = Partial<Pick<CreateChangeRequestDto, 'patch'>>;

export interface ReviewChangeRequestDto {
  decision: ReviewDecision;
  comment?: string;
}

/** Per-tenant workflow configuration (Spec M2 §3). */
export interface WorkflowSettings {
  tenantId: string;
  approvalsRequired: number; // 1..3
  expiryDays: number; // default 30
  reviewerCanEdit: boolean;
}

export type UpdateWorkflowSettingsDto = Partial<Omit<WorkflowSettings, 'tenantId'>>;
