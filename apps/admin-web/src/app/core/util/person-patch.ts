import type { CreatePersonDto, JsonPatchOp, Person } from '../models';

/**
 * Person fields carried by a change-request patch (entity paths match the Person model,
 * which is what the backend applies the RFC-6902 patch against).
 */
const PATCH_FIELDS: (keyof CreatePersonDto)[] = [
  'firstName',
  'fatherName',
  'grandfatherName',
  'familyName',
  'laqab',
  'gender',
  'birthDate',
  'birthPlace',
  'isDeceased',
  'deathDate',
  'deathPlace',
  'fatherId',
  'motherId',
  'tribalUnitId',
  'profession',
  'biography',
];

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

/** RFC-6902 `add` ops for every provided field — used when operation = create. */
export function buildCreatePatch(dto: CreatePersonDto): JsonPatchOp[] {
  const ops: JsonPatchOp[] = [];
  for (const field of PATCH_FIELDS) {
    const value = dto[field];
    if (!isEmpty(value)) {
      ops.push({ op: 'add', path: `/${field}`, value });
    }
  }
  return ops;
}

/**
 * RFC-6902 patch for changed fields only — used when operation = update. A field cleared
 * to empty becomes a `remove`; otherwise a `replace`. Unchanged fields are omitted so the
 * diff (and the reviewer's view) stays minimal.
 */
export function buildUpdatePatch(original: Person, dto: CreatePersonDto): JsonPatchOp[] {
  const ops: JsonPatchOp[] = [];
  for (const field of PATCH_FIELDS) {
    const next = dto[field];
    const prev = (original as unknown as Record<string, unknown>)[field];
    const bothEmpty = isEmpty(prev) && isEmpty(next);
    if (bothEmpty || prev === next) continue;
    if (isEmpty(next)) {
      ops.push({ op: 'remove', path: `/${field}` });
    } else {
      ops.push({ op: 'replace', path: `/${field}`, value: next });
    }
  }
  return ops;
}
