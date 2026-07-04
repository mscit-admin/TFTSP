# DECISIONS.md — ambiguity resolutions (Spec Section 11.9)

Every choice not spelled out by the spec is logged here (simplest viable option), per the agent behaviour rule.

## Foundation (Lead/PM)
- **D-001 Monorepo tooling:** npm workspaces (not Nx/Turbo) for M1 — simplest that satisfies the `apps/*` + `packages/*` layout. Revisit if build orchestration grows.
- **D-002 `packages/shared-ui` deferred:** In M1 each Angular app keeps its own components; a shared component library is extracted later to avoid two agents contending on one package. The `admin-web` and `platform-web` apps each own their UI for now.
- **D-003 Two separate Angular apps** (`apps/admin-web`, `apps/platform-web`) rather than one Angular workspace with two projects — keeps agent workstreams in disjoint directories and matches the "separate domains/deployments" intent of the spec.
- **D-004 API contract as the sync point:** `docs/API_CONTRACT.M1.md` + `packages/shared-types` are frozen before web work fans out. Backend owns changes and announces them.
- **D-005 DB roles:** migrations run as owner (`tftsp`), the app connects as `tftsp_app` WITHOUT BYPASSRLS so RLS is always enforced (Spec Section 4.2).
- **D-006 Partial dates:** year-only birth/death stored as `YYYY-01-01` with a `*_precision` marker deferred to when the UI needs it; API accepts `YYYY` or full ISO.

## platform-web (Platform-Web agent, M1)
- **D-100 Angular 21 (not 22):** the environment's Node is `v22.22.2`; the Angular 22 CLI hard-requires `>=22.22.3` and refuses to run. Angular 21.2 (previous LTS, supports `^22.12`) is used instead — still "latest usable LTS" here. Bump to 22 once Node is updated.
- **D-101 Zoneless change detection:** the Angular 21 scaffold ships zoneless by default (no `zone.js`). Kept it — matches the Signals-first mandate. All view state uses signals; templates read signals (incl. `LanguageService.isRtl()`) so they re-render reactively.
- **D-102 Create-tenant request body casing:** `POST /platform/tenants` is sent with **snake_case** `{ name_ar, name_en, slug, admin }` exactly as written in `docs/API_CONTRACT.M1.md` (the frozen sync point), even though `packages/shared-types` `CreateTenantDto` is camelCase. The contract doc is treated as authoritative for the wire shape. If Backend actually expects camelCase, flip `CreateTenantRequest` in `core/models/tenant.model.ts`.
- **D-103 Tenant list-response shape is casing-tolerant:** `GET /platform/tenants` count fields are unspecified. `PlatformService` normalizes each row from any of `personsCount` / `persons_count` / `counts.persons` (same for users) and either `nameAr` or `name_ar`, so the UI is robust to whichever the Backend emits.
- **D-104 Token storage in `localStorage`:** simplest persistence that survives reload for a desktop-only ops console; silent refresh + chain-revocation on reuse is handled by the interceptor. Revisit (httpOnly cookies) only if XSS surface grows.
- **D-105 Dev API access via proxy:** `apiBaseUrl` is the relative `/api/v1`; `proxy.conf.json` forwards `/api` to `http://localhost:3000` in dev and Nginx handles it in prod — no per-env rebuild of the URL.
- **D-106 Tailwind v4 + PrimeNG Aura, dark "ops console" shell:** platform-web deliberately uses a dark slate/indigo chrome (distinct from admin-web) to reinforce the separate security boundary; the routed content sits on a light canvas for readability.
- **D-107 No ESLint in-app yet:** the Angular 21 scaffold no longer adds ESLint by default; repo-wide lint/CI is left to the Lead rather than pinning a lint stack unilaterally in this sub-app.
