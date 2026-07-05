# 02 — Local development & testing

## The `docker compose up` stack

`docker-compose.yml` at the repo root brings up the full local environment. The
infra services are always defined; the `api` service builds from `apps/api`.

| Service | Image | Ports | Purpose |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | `5432` | Primary DB (user `tftsp`, db `tftsp`). RLS lives here. |
| `redis` | `redis:7-alpine` | `6379` | BullMQ queues + scheduler. |
| `minio` | `minio/minio:latest` | `9000` (S3), `9001` (console) | Object storage (photos, documents, import files). Console creds `minioadmin`/`minioadmin`. |
| `mailhog` | `mailhog/mailhog:latest` | `1025` (SMTP), `8025` (web UI) | Catches outbound email in dev; view at http://localhost:8025. |
| `api` | built from `./apps/api` | `3000` | The NestJS backend. |

Inside the compose network the `api` service overrides the localhost defaults with
container hostnames (`postgres`, `redis`, `minio`, `mailhog`) and — importantly —
splits the two DB URLs: `DATABASE_URL` uses **`tftsp_app`** (RLS-enforced) while
`DATABASE_MIGRATION_URL` uses the owner **`tftsp`**.

```bash
cp .env.example .env
docker compose up            # postgres, redis, minio, mailhog (+ api)
```

The two Angular apps and the Flutter app are **not** in compose; run them with
their own toolchains (below). In dev you typically bring up infra with compose and
run the API with `npm run start:dev` for hot reload.

## Environment variables

Copy `.env.example` → `.env`. The important groups:

- **Database (two roles).** `DATABASE_URL` → `tftsp_app` (no `BYPASSRLS`; used at
  runtime). `DATABASE_MIGRATION_URL` → owner `tftsp` (migrations + seed only).
  **Never point `DATABASE_URL` at the owner** — RLS enforcement depends on the app
  using the non-owner role.
- **Redis/BullMQ.** `REDIS_HOST`, `REDIS_PORT`.
- **MinIO.** `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`,
  `MINIO_USE_SSL`, `MINIO_BUCKET` (`tftsp`).
- **Mail.** `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` (MailHog in dev).
- **JWT.** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL` (`15m`),
  `JWT_REFRESH_TTL` (`30d`).
- **App.** `API_PORT` (`3000`), `NODE_ENV`, and (typed in
  `common/config/configuration.ts`) `DEFAULT_LOCALE` (`ar`), `LOG_LEVEL`,
  `AUTH_MAX_FAILED_ATTEMPTS` (`5`), `AUTH_LOCK_MINUTES` (`15`),
  `AUTH_MIN_PASSWORD_LENGTH` (`12`), `DUPLICATE_SIMILARITY_THRESHOLD` (`0.6`).
- **Scheduler.** `ENABLE_SCHEDULER` (`false` disables the BullMQ scheduler; used in
  tests/CI-without-Redis — see below).
- **FCM (optional).** `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`. When
  absent, the push channel no-ops gracefully (dev/CI never crash).

## Running each app

### Backend (`apps/api`)

```bash
docker compose up -d postgres redis minio mailhog
cd apps/api
cp ../../.env.example .env
npm install
npx prisma generate
DATABASE_URL="$DATABASE_MIGRATION_URL" npx prisma migrate deploy   # runs as owner; creates tftsp_app + RLS
npm run seed                 # 2 tribes (bani-hilal, bani-tamim), ~200 persons/3 gens, a user per role
npm run start:dev            # watch mode
```

- API base: `http://localhost:3000/api/v1` · Swagger: `http://localhost:3000/api/docs`
- Seeded password (all users): `ChangeMe!2026_seed`. Super admin:
  `superadmin@tftsp.local`; per tribe: `tribe_admin.<slug>@tftsp.local`,
  `reviewer.<slug>@…`, etc.
- Note the migration step runs **as the owner** (`DATABASE_MIGRATION_URL`) — it is
  what creates the `tftsp_app` role and the RLS policies. The runtime app then
  connects as `tftsp_app`.

Useful scripts (`apps/api/package.json`): `build`, `start:dev`, `start:prod`,
`prisma:generate`, `prisma:migrate` (`migrate deploy`), `prisma:migrate:dev`,
`seed`, `lint`, `format`, `typecheck`, `test`, `test:unit`, `test:e2e`, `test:cov`.

### Angular apps (`apps/admin-web`, `apps/platform-web`)

Each has its own lockfile. Typical dev loop:

```bash
cd apps/admin-web      # or apps/platform-web
npm ci
npm start              # ng serve (dev server)
npm run build          # production build (this is what CI gates on)
```

### Flutter app (`apps/mobile`)

```bash
cd apps/mobile
flutter pub get
flutter run            # on a device/emulator
flutter analyze        # lint (very_good_analysis)
flutter test           # unit/widget tests
```

## CI (`.github/workflows/ci.yml`)

CI runs on every push (to any branch) and every PR, with
`concurrency: cancel-in-progress` so a new push kills an in-flight run (frees a
hung/slow e2e). Node **22** everywhere. Four independent jobs:

### `api` (lint · build · test)

- Boots a `redis:7-alpine` **service container** (health-checked) so any BullMQ
  module that connects at bootstrap has Redis available.
- Env: `REDIS_HOST=localhost`, `REDIS_PORT=6379`, and **`ENABLE_SCHEDULER=false`**
  — the e2e suite drives the maintenance service directly, so the cron scheduler
  stays off in CI.
- Steps: `npm ci` (root workspace; the lockfile is at the repo root) →
  `prisma:generate` → `lint` → `build` → `test:unit` →
  **`test:e2e -- --forceExit`**.
- The e2e step uses **Testcontainers**, which spins up a real **PostgreSQL 16**
  container on the Docker-enabled runner (isolation + lineage + auth + M2 gates).
  `--forceExit` guards against a lingering Socket.IO/Prisma handle stalling the
  runner.

### `admin-web` / `platform-web` (build)

Each: `npm ci` (app-local lockfile) → `npm run build`. These jobs prove the
Angular apps compile in production mode.

### `mobile` (flutter analyze · test · build apk)

Uses `subosito/flutter-action@v2`, channel `stable`, Flutter `3.24.5`:
`flutter pub get` → `flutter analyze` → `flutter test` →
`flutter build apk --debug` (Android build gate).

**CI reality (documented in the workflow + `API_CONTRACT.M5.md`):**
- The **iOS build** needs a macOS runner + a generated Xcode project — out of
  scope for Linux CI (deploy-time).
- Real-device gates (≥30fps, push ≤10s, real offline) are QA/deploy-time.
- **Puppeteer/Chromium:** exports use **`puppeteer-core`** with an env-resolved
  `executablePath` — it never downloads Chromium. If no Chromium is present on the
  server, `POST /exports/tree/*` returns `500 errors.export.failed`; the
  unit-tested seam is the HTML builder (`exports/tree-html.ts`), not the browser.
- **FCM-disabled:** the push channel no-ops when `FCM_*` creds are absent, so
  bootstrap and notification sends never crash in dev/CI.

## Test suites (`apps/api/test`)

- `npm run test:unit` — pure-logic specs (Arabic normalization, dates, duration,
  JSON-patch, etc.); **no Docker needed**.
- `npm test` — full suite including e2e (Testcontainers → real PostgreSQL 16;
  Docker required).
- `npm run test:e2e` — runs `*.e2e-spec.ts` with `--runInBand`.

Key e2e gates:
- `test/isolation.e2e-spec.ts` — **mandatory** cross-tenant isolation (Spec §4.5).
- `test/lineage.e2e-spec.ts` — cycle rejection + closure-table correctness.
- `test/auth.e2e-spec.ts` — refresh-token reuse revokes the whole chain; account
  lockout.
- `test/change-request.e2e-spec.ts` — M2 gates: conflict-not-applied, 2-approval
  quorum, scheduled expiry sweep + owner notification, in-app notification on
  every state change.
