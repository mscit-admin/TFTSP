# DEPLOYMENT — running & trying TFTSP on a server

## 0. One command (interactive installer) — easiest

```bash
./install.sh
```
It asks **where to install** and **which port**, then builds and runs the whole system with Docker on a
**single port** (nginx gateway): Tribe Admin panel at `/`, Super-Admin panel at `/platform/`, API + WebSocket
proxied under `/api` and `/socket.io`. It also generates fresh JWT secrets and can seed demo data.

After it finishes (default port 8080):
- Tribe Admin panel → `http://<host>:8080/`
- Super-Admin panel → `http://<host>:8080/platform/`
- API docs (Swagger) → `http://<host>:8080/api/docs`
- Demo Super Admin → `superadmin@tftsp.local` / `ChangeMe!2026_seed`

### Bare public IP — no domain, no HTTPS
This is fully supported by `./install.sh`:
1. Run `./install.sh` on the server; when asked, enter your **public IP** as the host and pick a port (e.g. `8080`).
2. **Open two ports** in the OS firewall **and** the cloud security group:
   - the app port you chose (e.g. `8080`) — web UI + API
   - **`9000`** — MinIO, for document/photo upload & preview (presigned URLs are signed for `PUBLIC_HOST:9000`)
3. Access at `http://<PUBLIC_IP>:<port>/` (Tribe Admin) and `/platform/` (Super Admin). The Angular apps call
   the API with **relative** paths, so no domain is needed; document/photo URLs are signed for your public IP
   so they open from the browser (the installer set `MINIO_PUBLIC_ENDPOINT`, and MinIO CORS is `*`).

> **Security over plain HTTP:** without TLS, JWTs and data travel unencrypted — fine for a demo/internal
> network, **not** for production with real personal data. For production put a TLS reverse proxy (Caddy/Nginx
> with a free Let's Encrypt cert) in front once you have a domain, and set `MINIO_PUBLIC_USE_SSL=true`.
> If you only have an IP, a self-signed cert or an SSH tunnel is the interim option.

---

Manual paths below: **(A) Quick trial** (Docker for infra + API, run the web panels with Node); **(B)
Production notes** for a real deployment.

> Verified building blocks: the API migrations, the tenant-isolation e2e (Testcontainers), and both Angular
> builds all pass in CI. The compose/gateway wiring and `install.sh` have **not** been run end-to-end in the
> authoring environment — treat first boot as a smoke test and watch `docker compose logs -f`.

## Prerequisites
- **Docker** + Docker Compose v2
- **Node.js 22** (to run the two Angular panels and the seed)
- (Optional) **Flutter 3.24.x** for the mobile app
- Ports free: 3000 (API), 5432 (Postgres), 6379 (Redis), 9000/9001 (MinIO), 8025 (MailHog), 4200/4201 (web)

---

## A. Quick trial

### 1) Bring up infra + API
```bash
cp .env.example .env
docker compose up -d          # postgres, redis, minio, mailhog, api
docker compose logs -f api    # watch: it runs `prisma migrate deploy` then starts on :3000
```
On start the API auto-runs all migrations (as the DB owner) and auto-creates the MinIO bucket. Swagger is at
**http://localhost:3000/api/docs**.

### 2) Seed demo data + the first Super Admin
The seed creates a Platform Super Admin, 2 demo tribes (~200 people each, 3 generations), and users for every
role. Run it against the **owner** connection (RLS is not FORCEd, so the owner may seed tenant tables):
```bash
cd apps/api
npm ci                        # once, to get node_modules + Prisma client
DATABASE_URL="postgresql://tftsp:tftsp_dev_pw@localhost:5432/tftsp?schema=public" npm run seed
```
**Demo credentials** (change immediately outside a throwaway trial):
- Platform Super Admin → `superadmin@tftsp.local` / `ChangeMe!2026_seed`
- Tribe users (admin/reviewer/contributor/viewer …) are created per demo tribe — see `apps/api/prisma/seed.ts`
  for their emails; all use the same `ChangeMe!2026_seed` password.

### 3) Run the two web panels (each proxies `/api` + `/socket.io` → :3000)
```bash
# Platform / Super-Admin console
cd apps/platform-web && npm ci && npm start -- --port 4201    # http://localhost:4201

# Tribe Admin panel
cd apps/admin-web && npm ci && npm start -- --port 4200       # http://localhost:4200
```

### 4) Try the flow
1. Open **platform-web** (`:4201`) → log in as `superadmin@tftsp.local` → see the demo tribes, create a new
   tribe (with its first Tribe Admin), assign a subscription, view the platform dashboard.
2. Open **admin-web** (`:4200`) → log in as a Tribe Admin → browse people, open the **family tree**, submit a
   change request, review/approve it, try **bulk import**, set **visibility** policies, upload a document.
3. Emails (approvals/notifications) appear in **MailHog** at http://localhost:8025.
4. MinIO console: http://localhost:9001 (`minioadmin` / `minioadmin`).

### 5) Mobile (optional)
```bash
cd apps/mobile && flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1   # Android emulator → host
```
Push (FCM) stays disabled until you add a real Firebase project (see below); the app works fully without it —
`GET /notifications` is the source of truth.

---

## B. Production notes
- **Secrets:** replace every default in `.env` — `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, DB passwords,
  MinIO keys. Never ship `ChangeMe!2026_seed`; in production do NOT run the demo seed (create the first Super
  Admin via a one-off script/migration instead).
- **Database:** use a managed/hardened PostgreSQL 16. Keep the two roles: migrations run as the **owner**
  (`DATABASE_MIGRATION_URL`); the app connects as **`tftsp_app`** (created by migration `0002`, **NOBYPASSRLS**)
  via `DATABASE_URL` — this is what enforces tenant isolation. Never point the app at the owner role.
- **Object storage:** MinIO is S3-compatible — point `MINIO_*` at MinIO or S3; presigned URLs are 15-min.
- **Email:** swap MailHog for real SMTP (`SMTP_*`).
- **Redis:** required for BullMQ jobs (import, expiry sweeps, stats refresh) and push fan-out. Set
  `ENABLE_SCHEDULER=true` in exactly one instance to run the cron jobs.
- **Exports (PDF):** the API uses `puppeteer-core`; provide a Chromium binary via `PUPPETEER_EXECUTABLE_PATH`
  (or a system Chromium) on the API host.
- **Push (FCM):** set `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`; add the real
  `google-services.json` / `GoogleService-Info.plist` to the Flutter app. Absent = push disabled (no crash).
- **Web hosting:** `npm run build` each Angular app → serve the `dist/**/browser` output from Nginx, and
  reverse-proxy `/api` and `/socket.io` (WebSocket upgrade) to the API. The two panels are separate origins/
  domains by design (different audiences/security boundaries).
- **Backups:** daily `pg_dump` + a tested restore; a single tribe can be exported tenant-scoped.
- **Mobile builds:** Android `flutter build apk|appbundle`; **iOS needs macOS** — generate the Xcode project
  with `flutter create --platforms=ios .` then `flutter build ipa`.

## Troubleshooting
- API can't connect to DB → confirm `tftsp_app` exists (migration `0002`) and `DATABASE_URL` uses it.
- 401 everywhere → access token expired; the panels auto-refresh, but check `JWT_*` are set and consistent.
- WebSocket notifications not live → ensure the reverse proxy forwards `/socket.io` with the `Upgrade` header.
- Empty UI after login → you skipped the seed (step 2) or created a tribe with no people yet.
