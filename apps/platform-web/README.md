# platform-web — TFTSP SaaS Platform Console

The **Platform Operations Console** for the Tribal & Family Tree SaaS Platform.
Used **only by Super Admin / Platform Admin** to manage tribes (tenants) across the
whole platform. Deployed on a **separate domain** from the tribe-facing `admin-web`,
with a distinct "mission-control" dark shell to signal the different security boundary.

- **Angular 21** (standalone components, **zoneless**, Signals)
- **PrimeNG 21** (Aura theme) + **Tailwind CSS v4**
- **ngx-translate 18** — full **Arabic (RTL)** + **English (LTR)** with instant switch (no reload)

> Scope: **M1 only** — Super Admin login, tribes list/create, suspend/activate, basic stats.
> Subscriptions/plans, payments, and materialized-view dashboards are **out of scope** (M4).

## Prerequisites

- Node.js `^20.19 || ^22.12 || >=24` (Angular 21 requirement)
- npm 10+
- The Backend API (`apps/api`) reachable at `http://localhost:3000` for live data
  (dev requests to `/api/**` are proxied there — see `proxy.conf.json`).

## Install & run

```bash
cd apps/platform-web
npm install
npm start          # ng serve on http://localhost:4200 (proxies /api -> :3000)
```

Production build:

```bash
npm run build      # outputs dist/platform-web
```

Unit tests (Vitest via the Angular unit-test builder):

```bash
npm test
```

## Configuration

Runtime config lives in `src/environments/`:

| Key          | Default    | Notes                                              |
| ------------ | ---------- | -------------------------------------------------- |
| `apiBaseUrl` | `/api/v1`  | Relative — works behind the dev proxy and Nginx.   |
| `defaultLang`| `ar`       | Initial UI language (persisted per browser).       |

The dev proxy target lives in `proxy.conf.json` (default `http://localhost:3000`).

## What it does (M1)

| Area           | Route         | API consumed                                            |
| -------------- | ------------- | ------------------------------------------------------- |
| Super Admin login | `/login`   | `POST /auth/login` (+ silent refresh, bearer, logout)   |
| Platform stats | `/dashboard`  | `GET /platform/stats` → tribes / persons / users        |
| Tribes list    | `/tenants`    | `GET /platform/tenants` (with counts)                   |
| Create tribe   | `/tenants` ▸ dialog | `POST /platform/tenants` (+ first Tribe Admin)    |
| Suspend/Activate | `/tenants` ▸ row | `POST /platform/tenants/:id/suspend\|activate`     |

Only users carrying the **super-admin claim** pass `superAdminGuard`; anyone else is
bounced to `/login`. Tokens are stored in `localStorage`; the `authInterceptor` attaches
the bearer and performs a **single-flight silent refresh** on `401` (a rotated/reused
refresh token ⇒ backend revokes the chain ⇒ the console logs out cleanly).

## Internationalisation

Translation dictionaries: `public/i18n/ar.json`, `public/i18n/en.json` (served at
`/i18n/*.json`). The globe button toggles language; `LanguageService` flips
`<html lang>` / `<html dir>` reactively, so **RTL/LTR switches instantly** everywhere
without a reload.

## Project structure

```
src/app/
  app.ts / app.config.ts / app.routes.ts   # bootstrap, providers, lazy routes
  core/
    models/        auth.model.ts, tenant.model.ts   # types mirrored from packages/shared-types
    services/      auth, token-storage, platform, language   # thin typed data services
    interceptors/  auth.interceptor.ts               # bearer + silent refresh
    guards/        super-admin.guard.ts, guest.guard.ts
  layout/          shell.component.ts                 # topbar + nav + lang/logout
  features/
    auth/          login.component.ts
    dashboard/     dashboard.component.ts             # stats cards
    tenants/       tenants-list.component.ts          # table + create dialog + suspend/activate
public/i18n/       ar.json, en.json
```

## Notes / boundaries

- Components never call `HttpClient` directly — all API access goes through
  `AuthService` / `PlatformService`.
- This app owns only `apps/platform-web`; it does not depend on `admin-web`.
- No ESLint config is bundled here yet (repo-level lint/CI is the Lead's call).
```
