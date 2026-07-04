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

Components never call `HttpClient` directly. `ApiService` is the only HTTP surface;
typed resource services (`PersonService`, `TribalUnitService`, `UnionService`,
`TreeService`, `TenantSettingsService`, `AuthService`) sit on top of it.

## Deliberately out of M1 scope

Approval-workflow UI, bulk import, visibility settings, exports, subscriptions,
crowdsourcing, and the rich d3/canvas tree renderer. See root `DECISIONS.md`
(`D-ADMIN-*`) for the choices made.
