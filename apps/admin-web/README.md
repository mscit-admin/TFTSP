# admin-web — Tribe Admin Panel (TFTSP)

Angular (standalone components + Signals) panel used by **Tribe Admin / Deputy Admin /
Branch Admin** to manage **one** tribe's data. Part of the TFTSP monorepo; this app owns
`apps/admin-web` only and talks to the M1 REST API (`/api/v1`) described in
`docs/API_CONTRACT.M1.md`.

## Stack

- Angular 21 (standalone, Signals, `@angular/build` application builder)
- PrimeNG 21 + `@primeuix/themes` (Aura preset) for controls
- Tailwind CSS 3 for layout (logical utilities `ps-/pe-/start-/end-` so it mirrors in RTL)
- ngx-translate 18 for i18n — **AR (RTL) + EN (LTR)** with instant switch, no reload
- PrimeNG toast/confirm for feedback

## Prerequisites

- Node.js `^20.19 || ^22.12 || >=24` (matches Angular 21)
- The backend running on `http://localhost:3000` (the dev server proxies `/api` there —
  see `proxy.conf.json`)

## Run

```bash
cd apps/admin-web
npm install
npm start           # ng serve on http://localhost:4200 (proxies /api -> :3000)
```

Build a production bundle:

```bash
npm run build       # outputs to dist/admin-web
```

## What's in M1

| Area | Route | Notes |
|---|---|---|
| Login | `/login` | `POST /auth/login`, token storage, guards |
| Persons list | `/persons` | paginated PrimeNG table + `?q=` search |
| Person form | `/persons/new`, `/persons/:id` | all Spec §5 fields, father/mother/unit pickers, duplicate-candidate confirm, optimistic-lock `version` |
| Tribal units | `/tribal-units` | CRUD tree: tribe → branch → clan → family |
| Tree preview | `/tree` | **minimal** vertical SVG from `/tree` (rich d3 renderer is M4) |
| Tribe settings | `/settings` | name, colors (live preview), logo (upload stubbed to API shape) |

### M2 — Change Requests, Approval Workflow, Notifications

| Area | Route | Notes |
|---|---|---|
| Review queue | `/change-requests` | reviewers/admins; list `?queue=true` + `?status=` filter, status badges |
| Request detail | `/change-requests/:id` | human-readable RFC-6902 diff (field → current/proposed), reviewer actions (`approve`/`reject`/`request_changes` + comment), owner patch-edit + resubmit |
| My requests | `/my-requests` | `?mine=true`; `changes_requested`/`conflict` rows are flagged and editable |
| Workflow settings | `/workflow-settings` | Tribe Admin only — approvalsRequired (1–3), expiryDays, reviewerCanEdit |
| Notifications | topbar bell | `GET /notifications`, unread badge, mark-read/read-all, **live** via Socket.IO |

- **Non-admin write path:** when the user is not an M1 write-role, the person form computes a
  JSON Patch and submits a **Change Request** (`POST /change-requests` → `/submit`) instead of a
  direct write; admins keep direct write. Patch helpers live in `core/util/person-patch.ts`.
- **Socket.IO:** `NotificationService` owns the client (namespace `/notifications`, JWT in the
  handshake `auth`, same-origin via the `/socket.io` ws proxy). The authenticated shell opens it
  on entry and closes it on logout; incoming `notification` events update the bell and raise a toast.

### M2.5 — Bulk Import

| Area | Route | Notes |
|---|---|---|
| Import wizard | `/imports/new` | template download (`?format=&lang=`), 50 MB upload (`POST /imports`), **live progress** over the `/imports` socket, preview, submit |
| Preview | (in wizard & detail) | stats, all-at-once errors table (row + column + message), per-row decisions for duplicate/ambiguous rows (`PATCH /imports/:id/rows/:rowId`) |
| Batches list | `/imports` | `GET /imports` with counts + status badges |
| Batch detail | `/imports/:id` | counts, link to the batch's Change Request, **rollback** (Tribe Admin) with blocking-dependency message on refusal |

- **One Change Request:** submitting (`POST /imports/:id/submit` with `{ partial }`) sends the whole
  batch into the M2 approval workflow as a single change request; "import only valid rows" is offered
  when errors exist. The wizard links to the returned CR via the M2 review UI.
- **Socket.IO:** the `/imports` namespace is handled entirely by `ImportService` (same handshake as
  notifications); `import_progress` events drive the progress bar through parse/validate/resolve.

### Auth flow

- `AuthService` holds session state as Signals; tokens live in `TokenStorageService`
  (localStorage).
- `authInterceptor` attaches the bearer token and performs **one** silent refresh on 401
  (concurrent 401s queue behind it). Refresh failure clears the session and routes to
  `/login`. Reuse of a rotated refresh token revokes the chain **server-side** (M1 API).
- `authGuard` rehydrates the session via `/auth/me` on hard reload.

### i18n / RTL

- Strings live in `src/assets/i18n/{ar,en}.json` — every user-facing string is a key.
- `LanguageService.use()` calls `translate.use()` and flips `<html dir/lang>`
  synchronously → instant language + direction switch (M1 acceptance criterion).
- PrimeNG built-in labels are localized from the `primeng` block of each JSON file.

## Data-access rule

Components never call `HttpClient` (or the socket) directly. `ApiService` is the only HTTP
surface; typed resource services (`PersonService`, `TribalUnitService`, `UnionService`,
`TreeService`, `TenantSettingsService`, `AuthService`, plus M2's `ChangeRequestService`,
`WorkflowSettingsService`, `NotificationService`, and M2.5's `ImportService`) sit on top of it.
All Socket.IO wiring is confined to `NotificationService` (`/notifications`) and `ImportService`
(`/imports`).

## Deliberately out of scope (current)

Visibility/privacy settings (M3), exports/subscriptions/crowdsourcing (M4), mobile (M5), and the
rich d3/canvas tree renderer. See root `DECISIONS.md` (`D-2xx`) for the choices made.
