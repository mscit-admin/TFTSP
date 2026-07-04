import type { JsonPatchOp } from '../models';

export interface DiffRow {
  /** field name (path without the leading slash), e.g. "firstName" */
  field: string;
  op: JsonPatchOp['op'];
  oldValue: unknown;
  newValue: unknown;
}

function readPath(target: Record<string, unknown> | undefined, path: string): unknown {
  if (!target) return undefined;
  const segments = path.split('/').filter(Boolean);
  let cur: unknown = target;
  for (const seg of segments) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Turns an RFC-6902 patch into human-readable rows. When the current `target` entity is
 * supplied, each row's `oldValue` is resolved from it; otherwise only the incoming
 * (`newValue`) side is shown.
 */
export function patchToDiffRows(
  patch: JsonPatchOp[],
  target?: Record<string, unknown>,
): DiffRow[] {
  return patch.map((op) => ({
    field: op.path.replace(/^\//, '').replace(/\//g, '.'),
    op: op.op,
    oldValue: readPath(target, op.path),
    newValue: op.op === 'remove' ? undefined : op.value,
  }));
}

/** Renders a patch value for display (booleans/objects/empties become readable text). */
export function formatDiffValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
