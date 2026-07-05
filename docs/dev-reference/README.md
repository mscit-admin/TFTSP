# TFTSP Developer Reference

Developer-facing documentation for **TFTSP — Tribal & Family Tree SaaS Platform**
(منصة شجرة العائلات والقبائل): a multi-tenant SaaS for managing Arab family/tribe
trees, with strict per-tenant data isolation and full Arabic (RTL) + English (LTR)
support.

This reference is grounded in the real implementation. It is the map you use to
find things and the "why" behind the design; it does **not** duplicate the frozen
API surface — that lives in [`docs/API_CONTRACT.M1.md` … `M5.md`](../) — nor the
ambiguity log, which lives in [`DECISIONS.md`](../../DECISIONS.md).

## The system in one paragraph

A **NestJS 10 + Prisma + PostgreSQL 16** backend (`apps/api`) exposes a versioned
REST API under `/api/v1`. Tenancy is **shared-schema with PostgreSQL Row-Level
Security**: `tenant_id` comes *only* from the verified JWT and is pushed into a
per-request Postgres GUC (`app.current_tenant`) so RLS scopes every row at the
database layer. Two Angular apps consume the API — `apps/admin-web` (tribe admin
panel) and `apps/platform-web` (super-admin / SaaS platform panel) — plus a
Flutter members app (`apps/mobile`). Redis/BullMQ runs background jobs (import
parsing, export rendering hooks, expiry sweeps, stats refresh), MinIO stores
objects (photos, documents, import files), and notifications fan out over three
channels (in-app Socket.IO, MJML email, FCM push).

## Build phases

The product was built in strict phases; every milestone closed on acceptance
criteria before the next began. The phase labels recur throughout the code and
these docs:

| Phase | Theme |
|---|---|
| **M1** | Foundations: auth, RBAC, tenancy/RLS, persons, unions, lineage/closure, audit, i18n |
| **M2** | Change requests, approval workflow, notifications |
| **M2.5** | Bulk import (xlsx/CSV) via staging + the M2 workflow |
| **M3** | Visibility resolver, privacy field policies, tree-view requests |
| **M4** | Advanced tree render, exports (Puppeteer), subscriptions/plan caps, stats, crowdsourcing/reputation |
| **M5** | Flutter members app + device registration + FCM push |

## How to navigate

| Doc | Read it when you want to… |
|---|---|
| [01 — Architecture](./01-architecture.md) | Understand the monorepo layout, the 4 components, the request lifecycle, and the multi-tenancy model. |
| [02 — Local dev & testing](./02-local-dev-and-testing.md) | Run the stack locally, understand env vars, run each app, and understand the CI jobs / Testcontainers e2e. |
| [03 — Data layer](./03-data-layer.md) | Tour the Prisma schema, the closure table, migrations 0001–0007, RLS policies, and materialized views. |
| [04 — API conventions](./04-api-conventions.md) | Learn the base path, auth header, error shape, pagination envelope, i18n keys, and versioning. |
| [05 — AuthZ & security](./05-authz-and-security.md) | Understand RLS enforcement, the central PolicyGuard, roles/scopes, the visibility resolver, and upload hardening. |
| [06 — State machines](./06-state-machines.md) | See the change-request, import-batch, subscription, and view-request lifecycles with transition rules. |
| [07 — Frontend architecture](./07-frontend-architecture.md) | Understand the two Angular apps and the Flutter app: state, HTTP, guards, i18n, tree rendering. |
| [08 — Integrations](./08-integrations.md) | Learn how PostgreSQL, Redis/BullMQ, MinIO, email, Socket.IO, FCM, and Puppeteer are wired. |
| [09 — Extension recipes](./09-extension-recipes.md) | Add a tenant-scoped module, endpoint+permission, notification type, contribution type, or migration. |

## Ground rules baked into the codebase

These invariants are non-negotiable and are enforced in code — keep them true in
any change you make:

1. **`tenant_id` is never accepted from the client.** It is derived only from the
   verified JWT and injected into RLS. (`common/tenant/*`, `common/prisma/*`)
2. **The app connects as `tftsp_app`, a role without `BYPASSRLS`.** Migrations and
   the seed run as the owner role. Never point `DATABASE_URL` at the owner.
3. **No manual role checks in services.** Authorization is data-driven via
   `@RequirePermission(...)` read by the single central `PolicyGuard`.
4. **Every person read passes the Visibility Resolver** (M3+). Blocked fields are
   *removed* from responses, never nulled; out-of-scope persons return 404.
5. **No hard-coded human strings in business code.** Errors and messages are i18n
   keys resolved by `nestjs-i18n`.
6. **Nothing touches the live tree except through the approved path.** Non-admin
   edits and bulk imports flow through the M2 change-request workflow.
