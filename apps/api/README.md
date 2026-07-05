# TFTSP API (Backend) — M1–M4

NestJS 10 + Prisma + PostgreSQL 16. Multi-tenant (Shared Schema + Row-Level
Security), JWT auth, RBAC, persons/unions/lineage (closure table), audit, i18n.

## Run

```bash
# from the repo root: bring up infra (postgres/redis/minio/mailhog)
docker compose up -d postgres

cd apps/api
cp .env.example .env            # adjust secrets for anything real
npm install
npx prisma generate
DATABASE_URL="$DATABASE_MIGRATION_URL" npx prisma migrate deploy   # runs as owner; creates tftsp_app role + RLS
npm run seed                    # 2 tribes, ~200 persons/3 generations, users for every role
npm run start:dev
```

- API base URL: `http://localhost:3000/api/v1`
- Swagger/OpenAPI: `http://localhost:3000/api/docs`
- Seeded login password (all users): `ChangeMe!2026_seed`
  - Super Admin: `superadmin@tftsp.local`
  - Per tribe: `tribe_admin.<slug>@tftsp.local`, `reviewer.<slug>@...`, etc.
  - Slugs: `bani-hilal`, `bani-tamim`

> The app connects as `tftsp_app` (NO BYPASSRLS). Migrations and the seed run as
> the owner role (`DATABASE_MIGRATION_URL`). Never point `DATABASE_URL` at the
> owner in production — RLS enforcement depends on the app using `tftsp_app`.

## Test

```bash
npm run test:unit    # pure-logic unit specs — no Docker needed
npm test             # full suite incl. e2e (Testcontainers spins up real PostgreSQL 16 — Docker required)
npm run test:cov     # coverage
```

Key tests:
- `test/isolation.e2e-spec.ts` — **mandatory** cross-tenant isolation (Spec §4.5).
- `test/lineage.e2e-spec.ts` — cycle rejection + closure-table correctness.
- `test/auth.e2e-spec.ts` — refresh-token reuse revokes the chain; account lockout.
- `test/change-request.e2e-spec.ts` — M2 gates: conflict-not-applied, 2-approval quorum,
  scheduled expiry sweep + owner notification, in-app notification on every state change.

## Architecture (M1)

| Concern | Where |
|---|---|
| Tenant isolation | `common/prisma/prisma.extension.ts` (`SET LOCAL app.current_tenant` per tx) + `common/tenant/*` (AsyncLocalStorage, interceptor). RLS policies in `prisma/migrations/0002_*`. tenant_id is derived ONLY from the JWT. |
| Two DB planes | `PrismaService.tenant` (RLS app role) vs `PrismaService.platform` (trusted owner role: auth membership resolution + platform aggregates). |
| Auth | `modules/auth` — Argon2id, ≥12-char policy, 5-fail/15-min lockout, JWT access 15m + refresh 30d with rotation & reuse detection. |
| RBAC | `common/rbac/*` + `common/guards/policy.guard.ts`. Central `@RequirePermission(...)`; no manual role checks in services. |
| Platform admin | `modules/platform` — `SuperAdminGuard`-equivalent (`@SuperAdminOnly`), not tenant-scoped. |
| Persons | `modules/persons` — CRUD, optimistic locking (`version`), soft-delete, duplicate pre-check (pg_trgm, ≥0.6). |
| Unions | `modules/unions` — create/divorce/widow/remarry. |
| Lineage | `modules/lineage` — closure table maintained atomically in the same tx as father/mother edits; `/tree`, `/ancestors`, `/descendants`. |
| Audit | `modules/audit` — every tenant-scoped write records who/what/when/ip + before/after JSON. |
| i18n | `nestjs-i18n`, `src/i18n/{ar,en}` — all error messages are keys. |
| Logging | `nestjs-pino` — structured JSON with `request_id` + `tenant_id`. |

## Architecture (M2 — Change Requests, Approval Workflow, Notifications)

| Concern | Where |
|---|---|
| Change requests | `modules/change-requests` — RFC-6902 JSON patch on person/union/tribal_unit; state machine `draft→submitted→under_review→approved\|rejected\|changes_requested→published` (+ `conflict`/`expired`); captures `baseVersion`. |
| Auto-publish | `change-request.publisher.ts` — at approval quorum, applies the patch atomically (reusing M1 `*InTx` write paths + lineage), re-checking `baseVersion` → `published` or `conflict`. |
| Workflow settings | `modules/workflow-settings` — per-tenant `approvalsRequired`(1..3)/`expiryDays`/`reviewerCanEdit` (GET/PATCH, audited). |
| Notifications | `modules/notifications` — persistent entity + list/read/read-all; Socket.IO gateway `/notifications` (JWT handshake, room `t:<tenant>:u:<user>`, event `notification`); `NotificationChannel` abstraction with in-app + bilingual MJML email (MailHog). |
| Scheduled jobs | `modules/jobs` — BullMQ expiry sweep (hourly) + expiring-soon warning (daily). Redis-free `ChangeRequestMaintenanceService` holds the logic; scheduler gated by `ENABLE_SCHEDULER`. |

## Architecture (M2.5 — Bulk Import)

| Concern | Where |
|---|---|
| Upload | `modules/imports/import.controller.ts` (`POST /imports`, multipart field `file`) → `parsing/upload.util.ts` streams to MinIO (busboy, magic-byte + 50 MB). Template: `GET /imports/template`. |
| Staging + parse | `import-parse.service.ts` (Redis-free): exceljs/csv-parse streaming → per-row validation → two-pass ref resolution → §8 duplicate check → whole-batch cycle detection → `import_rows`. Worker: `modules/jobs/import-parse.processor.ts`. |
| Preview | `GET /imports/:id`, `GET /imports/:id/rows?status=`, `PATCH /imports/:id/rows/:rowId` (decision / merge target / resolve ambiguous). |
| Submit + publish | `import.service.ts` (plan-limit guard) → ONE M2 change request; `import-apply.service.ts` applies on approval (1,000/tx, in-file parents first, `import_batch_id` tags, merges via M2 JSON-Patch). |
| Rollback | `POST /imports/:id/rollback` — refused if later records depend; else soft-delete + `LineageService.rebuildClosure` + audit `import_rollback`. |
| Progress WS | `import.gateway.ts` — namespace `/imports`, event `import_progress`. |

## Architecture (M3 — Visibility & Privacy)

| Concern | Where |
|---|---|
| Visibility Resolver | `modules/visibility/visibility.resolver.ts` — THE central gate every person read passes. Existence policies remove a person (→ 404 / absent); field policies DELETE keys (never null). Injected into `PersonsService` (list/search/findOne) + `LineageService` (tree/ancestors/descendants). |
| Visibility settings | `visibility-settings.*` — per-tenant `level` + field policies + `defaultMemberScope` + `requireIdForViewRequest` (GET/PATCH, audited, lazy defaults). |
| Member scope | `role_assignments.member_scope` + `anchor_person_id`; clan/branch via tribal-unit subtree, direct via closure (ancestors+siblings+children). |
| View requests | `modules/view-requests` — public `POST /view-requests` (owner client, tenant via slug) notifies admins; Tribe Admin list/approve/reject. Approve creates a Viewer user + `role_assignments` row with mandatory `valid_to`. |
| Grant expiry | `PolicyGuard` → 401 `errors.auth.grant_expired` when the only assignment(s) have lapsed. |

## Architecture (M4 — Subscriptions, Documents, Exports, Stats, Crowdsourcing)

| Concern | Where |
|---|---|
| Subscriptions & plan cap | `modules/subscriptions` — platform-level (owner client, outside RLS, `@SuperAdminOnly`). `plan-limits.ts` maps tier→cap (Free 500 / Basic 5,000 / Professional 25,000 / Enterprise unlimited). `PlanLimitService.assertCanAddPersons()` is the single Guard, wired into `persons.create` and import submit (supersedes the M2.5 `Tenant.max_persons`). Manual activation via a `PaymentGateway` abstraction (`ManualPaymentGateway`). Endpoints `GET/PUT /platform/tenants/:id/subscription`, `GET …/activations`. |
| Person documents | `modules/documents` — `POST /documents/presign` (MinIO presigned PUT, 15-min) → client PUTs the bytes → `POST /documents/confirm` re-reads the **actual** first bytes, `detectFileKind` magic-byte check (**SVG rejected**, ≤10 MB), registers the row. `GET /persons/:id/documents` returns presigned GET URLs; `DELETE /documents/:id` soft-deletes. Every path first calls `persons.findOne` so an out-of-scope person → 404 (M3 resolver). |
| Exports | `modules/exports` — `tree-html.ts` builds an escaped RTL Arabic document (`@page size`, deceased †) and is the unit-tested seam; `pdf-renderer.ts` uses **puppeteer-core** with an env-resolved `executablePath` (never downloads Chromium). `POST /exports/tree/{pdf,png}` stream A0–A4 PDF / scale-2·4 PNG; `GET /exports/persons.{xlsx,csv}` use the import-template columns (round-trip). All person data flows through the visibility resolver via `LineageService`. |
| Statistics | `modules/stats` — PostgreSQL **materialized views** `tribe_stats_mv` / `platform_dashboard_mv` (refreshed hourly by BullMQ + on-demand `POST /stats/refresh`). Views have no RLS → read through the owner client with an explicit tenant filter; fast-changing counts (pending CRs, generations) are live-computed. `GET /stats/tribe` (Tribe Admin) / `GET /platform/stats/dashboard` (`@SuperAdminOnly`). |
| Crowdsourcing & reputation | `modules/reputation` + extended `change-requests`. **No new engine** — a contribution is an M2 Change Request with an optional `contributionType`. `change-request.service` enforces: pending cap (`too_many_pending`), Viewer may only suggest `edit_data`/`add_source` and only when `allowViewerContributions` (`viewer_not_allowed`), target must be visible (→ 404). `ReputationService.recordDecision` bumps accepted/rejected on approve/reject, recomputes `accuracyRate`, re-derives `trustLevel` (no auto-promotion). `GET /reputation/me`, `GET /reputation` (ranked), `GET/PATCH /reputation/thresholds`. |

Architecture decisions specific to the backend are logged in the repo-root
`DECISIONS.md` (D-101 … D-407).

## Module conventions

Each module has `controller / service / repository / dto / tests`. Controllers are
thin; business logic lives in services; DB access lives in repositories.
```
