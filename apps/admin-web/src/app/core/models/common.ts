/**
 * Shared HTTP shapes not (yet) in packages/shared-types. Kept minimal and aligned
 * with docs/API_CONTRACT.M1.md conventions. If Backend formalises these, update the mirror.
 */

/** Standard paginated list envelope (matches backend PersonsService: `{ data, page, pageSize, total }`). */
export interface Paginated<T> {
  data: T[];
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
 * POST /persons rejects with duplicate candidates as a 409 whose `messageKey` is
 * `errors.person.duplicate_candidates` and `details.candidates: DuplicateCandidate[]`
 * (backend ErrorKeys). Resubmit with `confirmDuplicate: true`.
 */
export const DUPLICATE_MESSAGE_KEY = 'errors.person.duplicate_candidates';

/** PATCH /persons/:id version conflict: 409 with this backend key. */
export const VERSION_CONFLICT_MESSAGE_KEY = 'errors.person.version_conflict';
