/** Local mirrors of the M2.5 shared-types (kept in sync with packages/shared-types/src/import.ts). */

export const IMPORT_TEMPLATE_COLUMN_KEYS = [
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

export type ImportTemplateColumn = (typeof IMPORT_TEMPLATE_COLUMN_KEYS)[number];

export interface ImportRowError {
  column: string;
  messageKey: string;
}

export interface ImportBatchCounts {
  total: number;
  valid: number;
  error: number;
  duplicateCandidate: number;
  ambiguous: number;
  created: number;
  merged: number;
  ignored: number;
}

export const EMPTY_COUNTS: ImportBatchCounts = {
  total: 0,
  valid: 0,
  error: 0,
  duplicateCandidate: 0,
  ambiguous: 0,
  created: 0,
  merged: 0,
  ignored: 0,
};

/** A parsed row keyed by template column (raw string cells). */
export type RawRow = Record<ImportTemplateColumn, string | null>;
