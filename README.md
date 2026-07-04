# TFTSP — Tribal & Family Tree SaaS Platform

منصة شجرة العائلات والقبائل — multi-tenant SaaS for managing Arab family/tribe trees, with strict
data isolation, full Arabic (RTL) + English (LTR) support.

> Built in strict phases: **M1 → M2 → M2.5 → M3 → M4 → M5**. Each phase closes on its
> acceptance criteria before the next begins. **Currently building: M1.**

## Components
1. **`apps/api`** — Backend API (NestJS 10, Prisma, PostgreSQL 16 + RLS, Redis, BullMQ)
2. **`apps/admin-web`** — Tribe Admin Panel (Angular)
3. **`apps/platform-web`** — SaaS Platform Panel / Super Admin (Angular)
4. **`apps/mobile`** — Members App (Flutter) — *placeholder until M5*

Shared: **`packages/shared-types`** (DTOs/entities) · **`packages/shared-ui`** (reserved).

## Architecture decisions
Non-negotiable choices are in the spec (Section 2). Ambiguity resolutions are logged in
[`DECISIONS.md`](./DECISIONS.md). The frozen M1 API surface is in
[`docs/API_CONTRACT.M1.md`](./docs/API_CONTRACT.M1.md).

Key: Shared-schema multi-tenancy with **PostgreSQL Row-Level Security** (`tenant_id` from JWT only);
JWT auth (Argon2id, 15m access / 30d refresh with rotation); Adjacency List + **Closure Table** for
lineage; **Union** entity for marriages; MinIO storage; d3.js web tree.

## Getting started (dev)
```bash
cp .env.example .env
docker compose up          # postgres, redis, minio, mailhog (+ services as they come online)
```

## Build team (agent roles)
| Agent | Owns | Directory |
|---|---|---|
| Lead / PM | phase gates, contract, CI, integration, `DECISIONS.md` | root |
| Backend | API, Prisma+RLS, auth, lineage, isolation tests | `apps/api`, `packages/shared-types` |
| Admin-Web | tribe panel | `apps/admin-web` |
| Platform-Web | SaaS panel | `apps/platform-web` |
| Mobile | placeholder in M1, built in M5 | `apps/mobile` |

## Backlog (not built now)
SMS/WhatsApp/Telegram, AI dedup, MFA/device mgmt, radial/timeline trees, payment gateways,
GEDCOM/ODS, mobile admin, biometrics/deep links.
