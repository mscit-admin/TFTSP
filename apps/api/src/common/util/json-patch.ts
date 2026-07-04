import { AppException } from '../errors/app.exception';
import { ErrorKeys } from '../errors/error-keys';

/** A single RFC-6902 patch operation (add | remove | replace) — see shared-types. */
export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

/** Decode an RFC-6901 JSON Pointer segment (~1 => /, ~0 => ~). */
function decodeSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Validate the structural shape of a patch (paths start with '/', known ops). */
export function assertValidPatch(patch: unknown): asserts patch is JsonPatchOp[] {
  if (!Array.isArray(patch) || patch.length === 0) {
    throw AppException.badRequest(ErrorKeys.CR_INVALID_PATCH);
  }
  for (const op of patch) {
    const candidate = op as JsonPatchOp;
    const validOp =
      candidate &&
      (candidate.op === 'add' || candidate.op === 'remove' || candidate.op === 'replace') &&
      typeof candidate.path === 'string' &&
      candidate.path.startsWith('/');
    if (!validOp) {
      throw AppException.badRequest(ErrorKeys.CR_INVALID_PATCH, { op });
    }
  }
}

/**
 * Applies an RFC-6902 patch to a (deep-cloned) target object and returns the
 * result. Supports nested pointer paths. Intentionally minimal — the M2 targets
 * (person/union/tribal_unit) use shallow, well-known field paths.
 */
export function applyJsonPatch<T extends Record<string, unknown>>(
  target: T,
  patch: JsonPatchOp[],
): Record<string, unknown> {
  const result: Record<string, unknown> = structuredClone(target);
  for (const op of patch) {
    const segments = op.path.split('/').slice(1).map(decodeSegment);
    if (segments.length === 0) {
      throw AppException.badRequest(ErrorKeys.CR_INVALID_PATCH, { path: op.path });
    }
    let cursor: Record<string, unknown> = result;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const key = segments[i];
      if (typeof cursor[key] !== 'object' || cursor[key] === null) {
        cursor[key] = {};
      }
      cursor = cursor[key] as Record<string, unknown>;
    }
    const leaf = segments[segments.length - 1];
    if (op.op === 'remove') {
      delete cursor[leaf];
    } else {
      cursor[leaf] = op.value;
    }
  }
  return result;
}

/**
 * Flattens a shallow patch into a `{ field: value }` object suitable for a
 * domain DTO. `remove` maps to `null` (fields are nullable). Nested paths keep
 * only their top-level field (M2 targets are flat).
 */
export function patchToFieldObject(patch: JsonPatchOp[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const op of patch) {
    const field = decodeSegment(op.path.split('/')[1] ?? '');
    if (!field) {
      continue;
    }
    obj[field] = op.op === 'remove' ? null : op.value;
  }
  return obj;
}
