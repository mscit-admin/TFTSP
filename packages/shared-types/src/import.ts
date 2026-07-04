/** M2.5 — Bulk Import (Spec Section 3 · M2.5 and Section 12). */

export type ImportFileFormat = 'xlsx' | 'csv';

export type ImportBatchStatus =
  | 'uploaded'
  | 'parsing'
  | 'validating'
  | 'resolving'
  | 'preview' // parsed + validated + resolved; awaiting user decisions/submit
  | 'submitted' // sent to the M2 approval workflow as one Change Request
  | 'published' // approved + applied to the live tree
  | 'rejected' // workflow rejected the batch
  | 'rolled_back'
  | 'failed';

export type ImportRowStatus =
  | 'valid'
  | 'error'
  | 'duplicate_candidate'
  | 'ambiguous'; // >1 DB match on reference resolution — needs manual pick

/** Per-row user decision on the preview screen. */
export type ImportRowDecision = 'new' | 'merge' | 'ignore';

export interface ImportRowError {
  /** template column key, e.g. "gender", "fatherRef" */
  column: string;
  messageKey: string;
}

export interface ImportRow {
  id: string;
  tenantId: string;
  importBatchId: string;
  /** in-file identifier used to resolve intra-file parent/spouse refs (e.g. "ref:15") */
  rowRef: string;
  rowNumber: number;
  raw: Record<string, string | null>;
  status: ImportRowStatus;
  errors: ImportRowError[];
  /** resolved FKs after the two-pass resolution */
  resolvedFatherId?: string | null;
  resolvedMotherId?: string | null;
  resolvedSpouseId?: string | null;
  /** for duplicate_candidate rows */
  duplicateOfId?: string | null;
  similarity?: number | null;
  decision: ImportRowDecision;
  mergeTargetId?: string | null;
}

export interface ImportBatchCounts {
  total: number;
  valid: number;
  error: number;
  duplicateCandidate: number;
  ambiguous: number;
  /** filled after publish */
  created: number;
  merged: number;
  ignored: number;
}

export interface ImportBatch {
  id: string;
  tenantId: string;
  filename: string;
  fileKey: string; // MinIO object key
  format: ImportFileFormat;
  status: ImportBatchStatus;
  counts: ImportBatchCounts;
  /** the single M2 Change Request the batch is submitted through */
  changeRequestId?: string | null;
  createdBy: string;
  createdAt: string;
  /** 0..100, streamed over WebSocket during parse/validate/resolve/publish */
  progress: number;
}

export interface UpdateImportRowDto {
  decision?: ImportRowDecision;
  mergeTargetId?: string;
  /** resolve an ambiguous reference by picking a specific person */
  resolvedFatherId?: string;
  resolvedMotherId?: string;
  resolvedSpouseId?: string;
}

export interface SubmitImportDto {
  /** when true, import only the valid rows and skip error rows (explicit user choice) */
  partial?: boolean;
}

/** WebSocket progress event (namespace `/imports`). */
export const IMPORT_WS_EVENT = 'import_progress' as const;
export interface ImportProgressEvent {
  importBatchId: string;
  status: ImportBatchStatus;
  progress: number;
  counts?: Partial<ImportBatchCounts>;
}

/** Official template column keys (bilingual headers rendered from these). Spec Section 12. */
export const IMPORT_TEMPLATE_COLUMNS = [
  'rowRef',
  'fullName',
  'gender',
  'fatherRef',
  'motherRef',
  'birthDate',
  'deathDate',
  'branch',
  'clan',
  'family',
  'spouseRef',
  'laqab',
  'profession',
  'phone',
  'notes',
] as const;
export type ImportTemplateColumn = (typeof IMPORT_TEMPLATE_COLUMNS)[number];
