# Changelog

All notable changes to **TFTSP — Tribal & Family Tree SaaS Platform** are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and the project follows a
phased delivery (M1 → M2 → M2.5 → M3 → M4 → M5); each phase closed on its Definition-of-Done gates
in CI before the next began.

## [Unreleased]
### Added
- Documentation suite under `docs/`: `specification/`, `user-guides/`, `dev-reference/`, `regulatory/`.

## [M5] — Members mobile app + push
### Added
- **Flutter members app** (`apps/mobile`, Android + iOS from one codebase): login with secure token
  storage + silent refresh, active-tenant switch, `CustomPainter` family tree (pinch-zoom/pan, in-tree
  search), person cards rendered exactly as the Visibility Resolver returns, change-requests +
  contributions + reputation, public view-request, in-app notifications, offline read cache, instant
  AR-RTL / EN-LTR.
- **Backend:** device registration (`POST /devices` upsert, `DELETE /devices/:token`) and an **FCM
  adapter** as the third `NotificationChannel` (no-ops without Firebase credentials). Migration
  `0007_device_registrations` (RLS).
- CI: Flutter job (`flutter analyze` + `test` + Android `build apk`).

## [M4] — Advanced display, exports, subscriptions, crowdsourcing
### Added
- **Advanced tree** (admin-web): d3 v7 with vertical / horizontal / Fan-Chart layouts, Canvas + LOD
  above 1,500 nodes, lazy expansion, path-between-two-people.
- **Exports:** server-side PDF (`puppeteer-core`, A0–A4, RTL) + PNG (2×/4×) + Excel/CSV round-trip.
- **Person documents:** presign → PUT → confirm with magic-byte check, SVG rejected, ≤10 MB; presigned
  download; soft-delete.
- **Subscriptions:** Free/Basic/Professional/Enterprise with a central plan-cap guard (supersedes the
  M2.5 stand-in); manual activation via a `PaymentGateway` abstraction; activation log; expiry alerts
  (platform-web).
- **Stats dashboards:** materialized views (hourly refresh) for tribe (admin-web) and platform
  (platform-web) dashboards.
- **Crowdsourcing & reputation** (no new engine): `contributionType` on change requests; per-contributor
  reputation (counters, accuracy, bronze/silver/gold); Viewer-suggest gating; 20-pending cap;
  out-of-scope 404; sanitized biography field.
- Migration `0006_subscriptions_documents_reputation_stats`.

## [M3] — Visibility, privacy & tree-view requests
### Added
- **Central Visibility Resolver** — every person read routed through it; blocked fields removed (not
  nulled); out-of-scope/hidden → 404 (existence hidden).
- Per-tenant visibility settings (level, women-display modes, field policies, member scope).
- Tree-view requests (public submit + ID-attachment upload; admin approve grants a Viewer role with a
  mandatory expiry via `role_assignments.valid_to`; expired grant → 401).
- Migration `0005_visibility_view_requests`.
### Fixed
- Tenant-isolation hazard: a concurrency-unsafe transaction-depth flag could make a query skip its RLS
  wrapping (intermittent). Replaced with a depth counter; search/count made sequential; regression test
  added.

## [M2.5] — Bulk import
### Added
- Streaming xlsx/CSV import (up to 100k rows) via a staging table + BullMQ: two-pass reference
  resolution, per-row duplicate detection, all-errors-before-insert preview, partial import.
- The batch enters the live tree only through the M2 approval workflow (batch = one change request);
  chunked apply + closure rebuild; batch rollback with a dependency guard.
- `/imports` WebSocket progress. Migration `0004_bulk_import`.
### Fixed
- Streaming upload raised a spurious `NO_FILE` 400 due to a busboy `close`-vs-async race — gated on
  whether a file part was seen.

## [M2] — Approval workflow & notifications
### Added
- **Change requests** (RFC-6902 JSON Patch) with a state machine (draft → submitted → under_review →
  approved | rejected | changes_requested → published, plus conflict/expired); quorum-based auto-publish
  with atomic apply + version-based conflict re-check; reviewer-counts-once; no self-approval.
- Per-tenant workflow settings (approvals 1–3, expiry days, reviewer-can-edit).
- **Notifications:** Socket.IO gateway (`/notifications`) + `NotificationChannel` abstraction (in-app +
  MJML/nodemailer email); REST list/mark-read; BullMQ expiry sweep + approaching-expiry warnings.
- Migration `0003_change_requests_notifications`.

## [M1] — Multi-tenant core: isolation, identity, lineage
### Added
- **Multi-tenancy:** shared schema + PostgreSQL Row-Level Security; `tenant_id` derived only from the
  JWT via a Prisma extension; app connects as a non-`BYPASSRLS` role.
- **Auth:** Argon2id, ≥12-char policy, 5-fail/15-min lockout, JWT access 15m + refresh 30d with rotation
  (reuse revokes the chain).
- **RBAC:** central `PolicyGuard` + `@RequirePermission` (no role checks in services).
- **Persons / Unions / Lineage:** CRUD with optimistic locking + soft-delete, duplicate pre-check,
  Closure Table maintained atomically per transaction, `/tree` + ancestors/descendants.
- **Tenant settings**, Audit log (before/after JSON diff), i18n (ar/en), Swagger.
- **admin-web** (Tribe Admin panel) and **platform-web** (Super-Admin console) — Angular, AR-RTL/EN-LTR
  with instant switch.
- Migrations `0001_init` + `0002_rls_and_search` (RLS policies, `pg_trgm`, `name_normalized`).

## [Foundation]
### Added
- npm-workspace monorepo (`apps/*`, `packages/*`), `docker compose` dev stack (PostgreSQL, Redis, MinIO,
  MailHog), frozen API contracts (`docs/API_CONTRACT.M*.md`), `packages/shared-types`, GitHub Actions CI,
  `DECISIONS.md`.
