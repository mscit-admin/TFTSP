# M2.5 API Contract (FROZEN) — Bulk Import

> Builds on M2's approval workflow. Backend owns this contract; Admin-Web builds the import wizard.
> Types: `packages/shared-types/src/import.ts`. Base `/api/v1`. Same auth/tenant/RLS/audit conventions.

## Governing rules (Spec §3 · M2.5 and §12)
- Import from **xlsx (exceljs streaming reader) and CSV (csv-parse)** — server-side only. ODS = Backlog.
- **Nothing touches the live tree directly.** Rows land in a **staging table** (`import_rows`) via a **BullMQ**
  job; the approved batch is applied only through the **M2 approval workflow** (the batch = ONE Change Request).
- Streaming up to **100,000 rows** without exceeding **512 MB** worker memory; live progress over WebSocket.
- Upload file: **magic-byte** type check + **50 MB** limit; streamed to MinIO.
- Subscription plan-limit checked **before** processing (rows + current count). NOTE: full subscription
  management is M4 — for M2.5 enforce against a per-tenant `maxPersons` (default Free = 500) as a stand-in,
  logged in DECISIONS; wire to the real plan in M4.

## Processing pipeline (Spec §12)
```
upload (stream → MinIO) → parse + per-row validation → import_rows (valid|error|duplicate_candidate)
→ ref resolution pass 1 (in-file via rowRef) → pass 2 (DB: name_normalized + clan; >1 match = ambiguous)
→ duplicate check per row (§8 engine, threshold 0.6)
→ PREVIEW (stats + row/column errors + duplicate candidates, per-row decision)
→ submit as ONE Change Request → M2 workflow → publish: chunked apply (1,000/tx) + closure rebuild + audit
```
- Validation includes **lineage-integrity rules on the whole batch** after resolution (no cycles, father=male,
  date logic), not row-by-row only.
- All validation errors are surfaced **at once** with row + column **before any insert**. A partially-broken
  file may be imported for its valid rows only, by explicit user choice (`SubmitImportDto.partial=true`).
- Merge into an existing record uses the **same JSON-Patch mechanism** as M2 (no direct writes).
- Created/merged records carry `import_batch_id` for traceability and rollback.

## Endpoints (`/api/v1/imports`) — tenant-scoped
| Method | Path | Purpose |
|---|---|---|
| GET | `/imports/template?format=xlsx\|csv&lang=ar\|en` | download the official bilingual template |
| POST | `/imports` | multipart upload → create batch, stream to MinIO, enqueue parse job → `ImportBatch` |
| GET | `/imports` | list batches (`{ data, page, pageSize, total }`) |
| GET | `/imports/:id` | batch detail incl. `counts`, `progress`, `status` |
| GET | `/imports/:id/rows?status=&page=` | staging rows for preview (errors + duplicate candidates) |
| PATCH | `/imports/:id/rows/:rowId` | set `decision` (new/merge/ignore), pick merge target, resolve ambiguous refs |
| POST | `/imports/:id/submit` | body `SubmitImportDto` → creates ONE Change Request into the M2 workflow |
| POST | `/imports/:id/rollback` | batch-level rollback (see rules) |

## WebSocket progress
- Namespace `/imports` (JWT-authed, tenant+user room like `/notifications`). Event `import_progress`,
  payload `ImportProgressEvent` `{ importBatchId, status, progress(0..100), counts? }`, emitted during
  parse / validate / resolve / publish.

## Rollback (Spec §12)
- **Batch-level only** (no single rows), Tribe Admin.
- **Refused** if later records depend on the batch's records (children added after, unions, approved edits) —
  return the blocking dependency list with a clear message.
- Executes: soft-delete all `import_batch_id` records + rebuild the tribe's Closure Table via BullMQ + audit
  entry `import_rollback`.

## Audit
Import log records: file, user, counts (new/merged/ignored/error), final status. Rollback logged as `import_rollback`.

## Out of M2.5 scope
Visibility resolver (M3), exports/subscriptions/crowdsourcing (M4), mobile (M5), ODS import (Backlog).
