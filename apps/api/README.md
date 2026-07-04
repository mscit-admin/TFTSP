# TFTSP API (Backend) — M1

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

Architecture decisions specific to the backend are logged in the repo-root
`DECISIONS.md` (D-101 … D-107).

## Module conventions

Each module has `controller / service / repository / dto / tests`. Controllers are
thin; business logic lives in services; DB access lives in repositories.
```
