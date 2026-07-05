# 07 — Frontend architecture

Three clients consume the API: two Angular apps and a Flutter app. All three share
the same auth model (JWT-scoped tenancy, single-flight silent refresh on 401) and
first-class AR (RTL) / EN (LTR) with instant, no-reload direction switching.

**Tenancy is carried in the JWT — no client sends a tenant header.** `admin-web`
sees one tribe; `platform-web` is cross-tenant super-admin; `mobile` re-authenticates
(and purges cache) on tenant switch.

## `apps/admin-web` — Tribe Admin Panel (Angular)

**Framework:** Angular 21, standalone components throughout (no NgModules; routes
lazy-load via `loadComponent`). Builder `@angular/build:application`. Dev server on
`:4200` proxies `/api` → `:3000` (`proxy.conf.json`). Zone-based change detection
(`provideZoneChangeDetection({ eventCoalescing: true })`).

**State:** Signals, no NgRx. Services are `providedIn: 'root'` and hold state in
`signal`/`computed`. `AuthService` (`core/services/auth.service.ts`) exposes
readonly `user`/`activeTenant`/`roleAssignments` signals and role computeds
(`canWrite`, `isTribeAdmin`, `canReview`) driven by `M1_WRITE_ROLES`.
`NotificationService` holds `notifications`/`unread` signals.

**UI:** PrimeNG 21 + `@primeuix/themes` (Aura preset, `darkModeSelector:
'.app-dark'`) + Tailwind 3 using logical utilities (`ps-/pe-/start-/end-`) so
layout mirrors under RTL. `MessageService` (toast) provided globally; errors
surface per-call as toasts keyed on i18n messages.

**i18n / RTL:** `ngx-translate` 18 (`provideTranslateService` +
`provideTranslateHttpLoader`, prefix `./assets/i18n/`, `fallbackLang: 'en'`,
`lang: 'ar'`). `LanguageService` (`core/services/language.service.ts`) is the
single source of truth: `use(lang)` sets a signal, persists to `localStorage`
(`tftsp.admin.lang`), calls `translate.use()`, flips `<html lang|dir>`
synchronously, and localizes PrimeNG built-ins via `primeng.setTranslation`.
Bootstrapped before first paint (`provideAppInitializer`). `dir`/`isRtl` are
computed from `RTL_LANGS = ['ar']`.

**HTTP layer:** `provideHttpClient(withFetch(), withInterceptors([authInterceptor]))`.

- **`authInterceptor`** (`core/interceptors/auth.interceptor.ts`, functional
  `HttpInterceptorFn`): attaches `Authorization: Bearer <access>` from
  `TokenStorageService` unless the request opts out via the `SKIP_AUTH`
  `HttpContextToken` or is an auth endpoint. On **401** it performs **one silent
  refresh**; concurrent 401s queue on a module-level
  `BehaviorSubject<string|null>` behind a `refreshing` flag, then retry once with
  the rotated token. Refresh failure → `auth.clearSession()` + navigate `/login`.
  No tenant header is added — tenancy lives in the JWT.
- **`ApiService`** (`core/services/api.service.ts`) is the *only* HttpClient
  surface (typed `get/post/patch/put/delete/getBlob/postBlob`, base from
  `API_BASE_URL` token). ~20 resource services sit on top. Deliberate exception:
  `DocumentService` PUTs directly to a MinIO presigned URL with `SKIP_AUTH`.
- **`TokenStorageService`** stores tokens in `localStorage`
  (`tftsp.admin.access`/`.refresh`).

**Guards** (`core/guards/auth.guard.ts`): `authGuard` allows when authenticated,
rehydrating via `GET /auth/me` on hard reload; `guestGuard` keeps logged-in users
off `/login`. Public routes (`/request-view`, `/t/:tenantSlug/request-view`) sit
outside the shell/guards.

**Real-time:** `NotificationService` owns a `socket.io-client` on `/notifications`
(JWT in the handshake `auth`, re-read on rotation), surfacing `incoming$` for
toasts; `ImportService` owns `/imports` for live import progress. Socket origin
from `SOCKET_URL`.

### d3 tree (the signature feature)

Two files under `features/tree/`:

- **`tree-graph.ts`** — a **pure layout engine** (`TreeGraph`, no rendering). The
  **father edge is the structural parent, mother is fallback**. `merge()` de-dupes
  incoming `{nodes, edges}`; `layout(kind, collapsed, rtl)` runs
  `d3.hierarchy` + `d3.tree` under a synthetic virtual root for three layouts:
  `vertical`/`horizontal` (`nodeSize([64,120])`, positions swapped for horizontal)
  and `fan` (`tree().size([2π, radius])` + `d3.pointRadial`). RTL mirrors via a
  `sign = rtl ? -1 : 1` multiplier. Returns positioned nodes + Bézier link paths +
  bounds, plus `ancestorsOf`, `pathBetween` (LCA lineage), `findByName`.
- **`tree-view.component.ts`** — rendering + interaction. An `effect()` re-renders
  on data/layout/RTL/highlight changes. **SVG below 1,500 visible nodes, Canvas +
  Level-of-Detail above** (`CANVAS_THRESHOLD = 1500`). `d3-zoom` for pan/zoom
  (scaleExtent `[0.05, 4]`); node click lazily fetches **+2 generations**
  (`treeService.getTree(id, 2)`); search highlights the ancestor path + moves the
  camera; a "measure" mode highlights the LCA path between two nodes. Export
  buttons call the server (`ExportService`) for PDF (A0–A4) / PNG (2x/4x). Gender
  colors: male `#2a78d6`, female `#e87ba4`, highlight `#eb6834`; deceased nodes are
  dashed.

**Folders:** `core/` (guards, interceptors, models, ~20 services, util, injection
tokens) + `features/` (auth, persons, tribal-units, tree, change-requests, imports,
visibility, view-requests, stats, reputation, workflow-settings, settings) +
`layout/` (shell, notification bell). No `shared/` folder — cross-cutting code
lives in `core/`.

## `apps/platform-web` — Platform / Super-Admin Console (Angular)

Same Angular 21 + PrimeNG 21 Aura + `ngx-translate` 18 baseline; differences:

- **Audience/scope:** Super Admin / Platform Admin only, separate domain, dark
  "mission-control" shell (`darkModeSelector: '.pw-dark'`). Manages **tenants
  across the whole platform**, not one tribe's tree.
- **Zoneless** change detection (`provideZonelessChangeDetection()` +
  `provideBrowserGlobalErrorListeners()`) vs admin-web's zone-based.
- **Tailwind v4** (`@tailwindcss/postcss`) and **Vitest** unit tests (admin-web has
  neither).
- i18n served from `public/i18n/` (prefix `i18n/`).
- **No central `ApiService`** — each resource service builds its own
  `${apiBaseUrl}/platform` base and calls HttpClient directly. **No d3, no
  Socket.IO** (no realtime dependency).
- **Guards** (`core/guards/`): `superAdminGuard` (requires
  `isAuthenticated() && isSuperAdmin()`, `isSuperAdmin` computed off
  `user.isSuperAdmin`), `guestGuard`.
- **`authInterceptor`** — the same single-flight silent-refresh pattern; gates on
  `req.url.startsWith(environment.apiBaseUrl)` + an `AUTH_FREE` list; only the
  `Authorization` header, no tenant header (platform endpoints are cross-tenant).

**Features:** `PlatformService` (`/platform/*`: list/create/suspend/activate
tenants, stats), `SubscriptionService`
(`/platform/tenants/:id/subscription` get/set/activations —
tier assignment + manual bank-transfer activation + expiry), `PlatformStatsService`
(`/platform/stats/dashboard`). Components: dashboard (M1 stats +
M4 KPIs / tribes-by-plan / expiring-soon), tenants list (create dialog +
suspend/activate + expiry badges), subscription manager (per-tribe dialog +
activation log + `PLAN_LIMITS` caps).

**Folders:** `core/` (models, services, `auth.interceptor`, guards) + `layout/`
(dark ops-console shell) + `features/` (auth, dashboard, tenants). i18n in
`public/i18n/`.

## `apps/mobile` — Members App (Flutter)

For **members, contributors, visitors** (admin stays on web). Consumes the stable
M1–M4 APIs; the only backend addition is device registration + FCM.

**SDK/stack:** Dart `>=3.5 <4`, Flutter `>=3.24`, `very_good_analysis` lint.
**Explicit no-codegen policy** (no retrofit/riverpod_generator/drift/build_runner)
so `flutter analyze`/`test` stay green without a codegen step. Key deps:
`flutter_riverpod` (classic `Notifier`/`Provider`), `dio`,
`flutter_secure_storage`, `easy_localization`, `firebase_core` +
`firebase_messaging`, `sqflite` + `connectivity_plus` (offline), `go_router`,
`cached_network_image`.

**Bootstrap (`lib/main.dart`):** ensures bindings,
`EasyLocalization.ensureInitialized()`, a **guarded** `_initFirebase()` (try/catch
no-op when config absent), then `runApp(ProviderScope(EasyLocalization(TftspApp)))`.
`MaterialApp.router` themes from the tribe's `primaryColorHex`; post-first-frame it
inits `PushService`.

**HTTP:** `ApiClient` (`lib/core/api/api_client.dart`) builds a `Dio` (baseUrl from
`--dart-define=API_BASE_URL`, 15s/20s timeouts) with `AuthInterceptor` + a
**redacting** log interceptor (method/path/status only — never bodies/tokens). A
**separate bare `refreshDio`** (no interceptors) does refresh + retry to avoid
recursion. `AuthInterceptor` (`lib/core/api/auth_interceptor.dart`): attaches the
bearer unless the path is an auth endpoint; on **401** runs **single-flight
refresh** guarded by a `Completer<bool>`, retries once via `refreshDio` (marked
with a `tftsp_retried` flag); refresh failure → clean logout. Tokens never logged.

**Secure storage:** `TokenStorage` interface with `SecureTokenStorage`
(`FlutterSecureStorage`, `encryptedSharedPreferences` on Android, first-unlock on
iOS; keys `tftsp.accessToken`/`.refreshToken`) and `InMemoryTokenStorage` for
tests. `AuthTokens` is never logged.

**Riverpod wiring (`lib/core/providers.dart`):** infrastructure providers
(token storage, connectivity stream, cache DB), `apiClientProvider` (its
`onSessionExpired` calls the auth controller's `handleSessionExpired()`), per-feature
API providers, `pushServiceProvider`. **`activeTenantIdProvider`** derives the
active tenant from auth state; repositories key their cache on it and data
providers watch it, so switching tribes refetches everything and never leaks the
inactive tribe's data. Feature controllers are classic `Notifier`s.

**Routing / tenant switch:** `go_router` `routerProvider`; a
`ValueNotifier<AuthStatus>` bridges Riverpod auth into `refreshListenable`.
`redirect` handles unknown/unauthenticated/authenticated. Because the JWT is
tenant-scoped, **tenant switch re-authenticates** against the chosen `tenantSlug`
(password re-entered, never persisted) and **purges the previous tribe's cache**
(`clearScope`).

### CustomPainter tree

- **Layout `domain/tree_layout.dart`** — pure, deterministic
  `computeTreeLayout(TreeResponse)`: assigns depth by DFS from roots, packs leaves,
  centres internal nodes over visible children, places **multi-parent (father +
  mother) DAG nodes once** (first visit). O(V+E), ~2,000 nodes. Returns
  `TreeLayout{positions, size, nodeRadius}` + `nodeAt(point)` hit-test.
- **Painter `presentation/tree_painter.dart`** — `TreePainter extends
  CustomPainter`: orthogonal parent→child connectors, then node discs + labels;
  gender colors from the `ColorScheme` (male `primaryContainer`, female
  `tertiaryContainer`), deceased lerped toward surface, active node bordered;
  child-count badge for hidden descendants. **RTL by mirroring the x-axis**
  (`_x(x) => rtl ? size.width - x : x`). `shouldRepaint` gated on
  identity/rtl/highlight.
- **Screen `presentation/tree_screen.dart`** — `CustomPaint` inside a
  `RepaintBoundary` inside an `InteractiveViewer` (`constrained: false`, scale
  0.2–4, `boundaryMargin: 400`) so pinch-zoom/pan transform the cached layer
  **without repainting**. `TransformationController` drives camera moves for
  in-tree search; RTL-aware tap hit-test pushes `/person/:id`.

**Offline cache:** `CacheDatabase` (`lib/core/db/cache_database.dart`) — sqflite,
one table `cache_entries(scope, cache_key, value, updated_at)` PK
`(scope, cache_key)`, upsert on conflict. `scope` = tenant id; `clearScope`
purges a tribe on switch. Strictly a **read cache**. `TreeRepository`/`PersonRepository`
are cache-through: offline → serve cache or throw `common.networkError`; online →
fetch, cache, fall back to cache on API error; return `(data, fromCache)` so the UI
shows an offline badge. Writes are blocked offline.

**FCM:** `PushService` (`lib/features/notifications/fcm/push_service.dart`) wraps
`firebase_messaging`, every call guarded so missing Firebase config never crashes.
`init()` requests permission, listens to `onMessageOpenedApp` +
`getInitialMessage` (tap routing) and `onTokenRefresh`;
`registerForCurrentUser()` posts the token (`POST /devices`) after login,
`deregister()` (`DELETE /devices/:token`) on logout. Top-level
`firebaseBackgroundHandler` is `@pragma('vm:entry-point')`.

**Folders:** Feature-First `lib/features/<name>/{data,domain,presentation}` (auth,
tree, person, contributions, view_request, notifications, home) + `lib/core/`
(api, auth, connectivity, db, l10n, logging, router, theme, widgets, providers).
