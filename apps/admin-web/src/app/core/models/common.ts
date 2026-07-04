/**
 * Shared HTTP shapes not (yet) in packages/shared-types. Kept minimal and aligned
 * with docs/API_CONTRACT.M1.md conventions. If Backend formalises these, update the mirror.
 */

/** Standard paginated list envelope. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Query for GET /persons (basic search — Spec Section 8). */
export interface PersonQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Error body per API_CONTRACT: `{ statusCode, messageKey, details? }`. */
export interface ApiErrorBody {
  statusCode: number;
  messageKey: string;
  details?: Record<string, unknown>;
}

/**
 * POST /persons may reject with duplicate candidates. Contract assumption (see report):
 * a 409 with `messageKey: 'errors.person.duplicateCandidates'` and
 * `details.candidates: DuplicateCandidate[]`. Resubmit with `confirmDuplicate: true`.
 */
export const DUPLICATE_MESSAGE_KEY = 'errors.person.duplicateCandidates';

/** PATCH /persons/:id version conflict. Contract assumption: 409 with this key. */
export const VERSION_CONFLICT_MESSAGE_KEY = 'errors.person.versionConflict';
