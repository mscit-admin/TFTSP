# apps/mobile — TFTSP Members App (Flutter)

The M5 members app for **Android + iOS from one codebase**. It consumes the
stable M1–M4 REST APIs (base `/api/v1`) and the M5 device-registration + FCM
additions. Admin stays on the web; this app serves **members, contributors and
visitors**.

## Run it

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=https://your-api.example.com/api/v1
```

- `API_BASE_URL` defaults to `http://10.0.2.2:8080/api/v1` (Android emulator →
  host machine). Override per environment with `--dart-define`.
- Analyzer + tests (what CI runs):
  ```bash
  flutter analyze
  flutter test
  flutter build apk --debug   # Android build gate
  ```

### Firebase (push) configuration

Placeholder Firebase configs are committed so the build succeeds without real
credentials:

- `android/app/google-services.json`
- `ios/Runner/GoogleService-Info.plist`

They are **structurally valid but non-functional**. Replace them with the real
files from your Firebase project at deploy time. The app **no-ops gracefully**
when Firebase is unavailable (dev/CI): `Firebase.initializeApp()` and all
`PushService` calls are guarded and never crash the app.

### iOS project scaffolding

`ios/` contains the hand-authored sources that matter (`AppDelegate.swift`,
`Info.plist` with deployment target 15 + remote-notification background mode,
`Podfile` pinned to `platform :ios, '15.0'`, placeholder `GoogleService-Info`).
The Xcode project/workspace (`Runner.xcodeproj`, `Assets.xcassets`,
`LaunchScreen.storyboard`) are **generated at build time** on a macOS runner via
`flutter create --platforms=ios .` — a valid `project.pbxproj` cannot be reliably
hand-authored. Per the M5 contract the iOS build + device gates require a macOS
runner and are out of scope for headless Linux CI.

## Architecture

**Feature-First**, `very_good_analysis` lints, **no code generation** (so
`flutter analyze`/`test` are green without a `build_runner` step):

- **State** — Riverpod (classic `Notifier`/`Provider`, no `riverpod_generator`).
- **API** — hand-written **dio** services (no retrofit/codegen). A single
  `AuthInterceptor` attaches the bearer token, performs a **single-flight silent
  refresh** on 401, retries once, and triggers a **clean logout** when the
  refresh token is expired/revoked. Tokens are **never logged** (headers redacted).
- **Secure storage** — `flutter_secure_storage` behind a `TokenStorage`
  interface (`SecureTokenStorage` in prod, `InMemoryTokenStorage` in tests).
- **i18n / RTL** — `easy_localization` with `assets/translations/{ar,en}.json`.
  Every user-facing string is a translation key; the AppBar toggle flips
  AR-RTL ⇄ EN-LTR **instantly on every screen** (the tree painter mirrors its
  x-axis from the locale).
- **Theme** — Material 3 seeded from the active tribe's `primaryColor`
  (fetched from `/tenant/settings`).
- **Offline read cache** — `sqflite` key/value table scoped by `tenantId`
  (`CacheDatabase`). The last tree and opened person cards are cached; an
  **offline badge** shows when disconnected and **writes are blocked** offline.
- **Push** — `firebase_messaging`; device registered via `POST /devices` on
  login and removed via `DELETE /devices/:token` on logout; taps route to the
  related item.

```
lib/
  core/
    api/        api_client, auth_interceptor, api_exception, endpoints
    auth/       token_storage (interface + secure + in-memory)
    connectivity/ connectivity_service
    db/         cache_database (sqflite)
    l10n/       l10n (locales, RTL helper)
    logging/    app_logger (redacting; never logs tokens)
    router/     app_router (go_router + auth redirect)
    theme/      app_theme (seed from tribe colour)
    widgets/    offline_badge, language_toggle
    providers.dart   (infrastructure + API + repository providers)
  features/<name>/{data,domain,presentation}
    auth · tree · person · contributions · view_request · notifications · home
  main.dart     (bootstrap: EasyLocalization + guarded Firebase + ProviderScope)
test/           token-storage, tenant-switch, tree-layout, tree-merge,
                person-model (visibility tolerance), l10n-key parity
```

### Family tree (CustomPainter)

`computeTreeLayout` (pure, tested) assigns generations by DFS from the roots and
packs leaves left-to-right, centring each parent over its children — O(V+E),
handles multi-parent (father+mother) DAGs without looping, scales to 2,000
nodes. `TreePainter` draws connectors + node discs; it's wrapped in a
`RepaintBoundary` inside an `InteractiveViewer`, so pinch-zoom/pan transforms the
cached layer **without repainting** (smooth on large trees). In-tree search
moves the camera to the first match; tapping a node opens its card.

### Person card & visibility

The card renders **only the fields the API returns**. The Visibility Resolver
(M3) **omits** blocked fields, so every optional field is null-tolerant and the
UI simply skips absent ones — no field is ever assumed present. Photos/documents
load from short-lived presigned URLs.

### Tenant switch

The JWT is tenant-scoped, so switching the active tribe **re-authenticates**
against the chosen `tenantSlug` (password re-entered, never persisted) and
**purges the previous tribe's cache**. All data providers watch
`activeTenantIdProvider`, so switching refetches everything and never shows the
inactive tribe's data.

## What a Flutter SDK still needs to verify

Dart/Flutter are not installed in the authoring environment, so the following
were reasoned through by hand and should be confirmed by CI:

- `flutter pub get` resolves the pinned versions together.
- `flutter analyze` is clean under `very_good_analysis`.
- `flutter test` passes (6 test files).
- `flutter build apk` succeeds with the placeholder `google-services.json`.
- Device-only gates (≥30fps pan/zoom, push ≤10s, real-device offline) need
  physical devices + a real Firebase project.
