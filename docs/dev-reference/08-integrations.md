# 08 — Integrations

The backend integrates six external systems. This doc gives the wiring, the config
keys, and where each lives. All paths are under `apps/api/src`.

## PostgreSQL

The primary store (PostgreSQL 16). See [03 — Data layer](./03-data-layer.md) for
the schema/RLS/matviews and [05 — AuthZ & security](./05-authz-and-security.md) for
the two-plane Prisma client and the `SET LOCAL app.current_tenant` mechanism. Two
connection URLs: `DATABASE_URL` (`tftsp_app`, RLS) and `DATABASE_MIGRATION_URL`
(owner `tftsp`, migrations/seed/stats-refresh).

## Redis / BullMQ

`modules/jobs/jobs.module.ts` wires `BullModule.forRootAsync` from `REDIS_HOST`
(default `localhost`) / `REDIS_PORT` (default `6379`) and registers three queues.
The whole `JobsModule` is **only imported when `ENABLE_SCHEDULER !== 'false'`**
(`app.module.ts`) — in tests/CI-without-Redis it is omitted entirely and the
underlying services are called directly.

| Queue (constant) | Jobs | Producer | Processor |
|---|---|---|---|
| `change-request-maintenance` (`CR_MAINTENANCE_QUEUE`) | `expiry-sweep` (cron `0 * * * *`, hourly), `expiry-warning` (cron `0 9 * * *`, daily) | `ChangeRequestScheduler` (repeatable jobs on init) | `ChangeRequestMaintenanceProcessor` → `ChangeRequestMaintenanceService` |
| `stats-refresh` (`STATS_QUEUE`) | `stats-refresh` (cron `0 * * * *`, hourly) | `StatsRefreshProcessor` (self-registers on init) | `StatsRefreshProcessor` → `StatsRefreshService` |
| `bulk-import` (`IMPORT_QUEUE`) | `import-parse` | `ImportDispatcherBridge` (registers a callback on `ImportDispatcher`) | `ImportParseProcessor` → `ImportParseService.run(batchId)` |

Design notes:

- The heavy logic (`ChangeRequestMaintenanceService`, `ImportParseService`) is
  **Redis-free** and injectable, so e2e tests drive it directly without a queue.
- `ImportDispatcherBridge` keeps `ImportsModule` free of any BullMQ dependency: the
  imports module calls an abstract `ImportDispatcher`, and the bridge (in
  `JobsModule`) wires it to the queue only when the scheduler is enabled.
- `ChangeRequestScheduler` catches Redis-unavailability and logs a warning rather
  than crashing bootstrap.
- Expiry maintenance runs cross-tenant on the **platform (owner)** client:
  `runExpirySweep` closes non-terminal change requests past `expiresAt` (→
  `expired`) and notifies each owner; `runExpiryWarning` notifies owners within
  `EXPIRY_WARNING_DAYS = 3` (no state change). See [06](./06-state-machines.md).

## MinIO (object storage)

`common/minio/minio.service.ts` (`@Global` module). Config: `MINIO_BUCKET`
(`tftsp`), `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`,
`MINIO_SECRET_KEY`. `onModuleInit` creates the bucket if missing (failure is logged,
not fatal — object storage may be absent in unit runs).

Methods: `putStream`, `getStream`, `remove`, `stat`, `getFirstBytes(key, n=512)`
(for magic-byte checks), and presigned URLs — **`presignedPut(key, 900)`** (direct
browser upload, 15-min TTL) and **`presignedGet(key, 900)`** (never a public URL).

Object-key conventions:

- Documents: `documents/{tenantId}/{personId}/{uuid}` (`documents/document.service.ts`).
- Import files: `imports/{tenantId}/{batchId}.dat` (`imports/import.service.ts`).
- View-request ID uploads streamed via `putStream`.

Upload validation is magic-byte based (`common/util/file-type.ts`,
`detectFileKind`) — see [05 — upload hardening](./05-authz-and-security.md). The
document flow is presign → client PUT → `confirm` re-reads the **actual** bytes and
rejects SVG/oversize; `listForPerson` returns 15-min presigned GET URLs. Import
uploads stream straight to MinIO with a 50 MB cap + xlsx-is-real-ZIP check.

## Email (MJML / SMTP / MailHog)

`modules/notifications/channels/email.channel.ts`
(`EmailNotificationChannel`, `name = 'email'`). Uses `nodemailer` with `SMTP_HOST`
(default `localhost`), `SMTP_PORT` (default `1025` = MailHog), sender `SMTP_FROM`.
View caught mail at the MailHog UI (`:8025`).

- **MJML templates are built inline in code** via `buildMjml(...)` and rendered
  with `mjml2html(..., { validationLevel: 'skip' })` — there are **no `.mjml`
  files on disk**. Each email is a bilingual (Arabic RTL + English LTR) `<mjml>`
  string.
- Content comes from i18n keys `notifications.{type}.subject` and
  `notifications.{type}.body` (in `i18n/{ar,en}/notifications.json`), rendered in
  both languages with the notification `payload` as args; subject is
  `"{subjectAr} — {subjectEn}"`.
- Delivery is best-effort — any render/send failure is caught and logged, never
  breaking the request.

## Socket.IO gateways

Two namespaces, same JWT handshake and per-tenant+user room model
(`room = t:{tenantId}:u:{userId}`). Both verify the access JWT with
`JWT_ACCESS_SECRET` and require an active tenant, else `disconnect(true)`. Token is
read from `handshake.auth.token` (preferred), then `Authorization: Bearer`, then
`?token=`.

| Gateway | Namespace | Event | Payload | Driven by |
|---|---|---|---|---|
| `NotificationGateway` (`notifications/notification.gateway.ts`) | `/notifications` | `notification` | the persisted `Notification` row | `InAppNotificationChannel` → `emitToUser` |
| `ImportGateway` (`imports/import.gateway.ts`) | `/imports` | `import_progress` | `{ importBatchId, status, progress, counts? }` | `ImportProgressService` during parse/validate/resolve/publish |

Both modules import `JwtModule.register({})` to get `JwtService` for handshake
verification.

## FCM push adapter (M5)

Two parts:

**Device registration** (`modules/devices`, tenant-scoped under RLS): `POST
/devices` upserts by token (200, never duplicates), `DELETE /devices/:token`
deregisters (owner-scoped, idempotent). Guarded by `device.manage` (all member
roles). `DeviceRepository` (`listTokensForUser`, `deleteByTokens` for pruning) is
exported for reuse by the channel.

**FCM channel** (`notifications/channels/fcm.service.ts` + `fcm.channel.ts`), the
**third `NotificationChannel`** alongside in-app + email:

- **Enabled only when all three of `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`,
  `FCM_PRIVATE_KEY` are present.** If any is missing, `enabled = false` and every
  call is a safe no-op that logs once — **this is how it is disabled in dev/CI**
  (just omit the env vars). Never crashes on bootstrap or send.
- Lazy `firebase-admin` init into a named app `tftsp-fcm`; the private key's
  literal `\n` are restored to newlines. A one-time init failure sets a permanent
  `initFailed` flag so it won't retry per-notification.
- `send()` uses `sendEachForMulticast` with `notification { title, body }` +
  a `data` block `{ type, payload: JSON.stringify(...), notificationId }`,
  `android.priority: high`, `apns` priority 10. Returns
  `{ successCount, invalidTokens }`; the channel prunes invalid tokens
  (`registration-token-not-registered`, etc.) via `devices.deleteByTokens`.

Channel fan-out: `NotificationService.notify` (`notification.service.ts`)
**persists the notification first** (the authoritative record —
`GET /notifications` is the source of truth), then fans out to all channels
(`[inApp, email, fcm]`, the `NOTIFICATION_CHANNELS` factory) in parallel with
per-channel error isolation. Push is best-effort: it only wakes the app.

## Puppeteer exports (M4)

`modules/exports`. `ExportController` (`export.read` permission): `POST
/exports/tree/{pdf,png}` stream a binary (`Content-Disposition: attachment`);
`GET /exports/persons.{xlsx,csv}` stream tabular data using the import-template
columns (round-trip, ExcelJS — no browser). All person data flows through the
visibility resolver via `LineageService.getTree`.

- **HTML seam:** `ExportService` builds visibility-filtered, escaped RTL-Arabic
  tree HTML (`tree-html.ts`, `@page size`, deceased marker). This builder is the
  **unit-tested** seam (`tree-html.spec.ts`), so export logic is verified **without
  a browser present**.
- **Renderer:** `pdf-renderer.ts` uses **`puppeteer-core`** (never full
  `puppeteer` — CI must not download Chromium). `resolveExecutable()` picks
  `PUPPETEER_EXECUTABLE_PATH`, else searches `PLAYWRIGHT_BROWSERS_PATH` (default
  `/opt/pw-browsers`) and system paths (`/usr/bin/chromium`,
  `/usr/bin/google-chrome`, …). If none found → `500 errors.export.failed`. Launch
  args: `--no-sandbox --disable-setuid-sandbox`, `headless: true`; browser always
  closed in `finally`. PDF via `page.pdf({ format: paper, printBackground: true,
  preferCSSPageSize: true })` (A0–A4); PNG via `setViewport({ deviceScaleFactor:
  scale })` + `screenshot({ fullPage: true })` (scale 2/4).

## Config keys at a glance

| System | Keys |
|---|---|
| Postgres | `DATABASE_URL`, `DATABASE_MIGRATION_URL` |
| Redis / jobs | `REDIS_HOST`, `REDIS_PORT`, `ENABLE_SCHEDULER` |
| MinIO | `MINIO_BUCKET`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` |
| WebSocket auth | `JWT_ACCESS_SECRET` |
| FCM | `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (all three required) |
| Puppeteer | `PUPPETEER_EXECUTABLE_PATH`, `PLAYWRIGHT_BROWSERS_PATH` |
| Locale (email/FCM copy) | `DEFAULT_LOCALE` (default `ar`) |
