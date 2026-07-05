# M5 API Contract (FROZEN) — Members Mobile App (Flutter) + Push

> The final phase. The Flutter app (Android + iOS, one codebase) **consumes the existing, stable
> M1–M4 APIs** — no new read/write surface. Backend adds only **device registration + an FCM adapter**
> on the existing `NotificationChannel`. Types: `packages/shared-types/src/device.ts`. Base `/api/v1`.

## Backend additions (small)
1. **Device registration** (tenant-scoped, any authenticated member):
   | Method | Path | Body | Purpose |
   |---|---|---|---|
   | POST | `/devices` | `RegisterDeviceDto { token, platform }` | register/refresh the caller's FCM token (upsert by token) |
   | DELETE | `/devices/:token` | — | deregister on logout |
2. **FCM adapter** = the **third `NotificationChannel`** (alongside in-app WebSocket + email). When a
   `Notification` is created (M2 change-request state changes, M3 view-request), also push via FCM to the
   user's registered device tokens. Payload carries the notification `type` + `payload` so a tap can deep-open
   the item. Use `firebase-admin`; **no-op gracefully when FCM credentials are absent** (dev/CI) — never crash.
   Prune tokens FCM reports as unregistered.

## Mobile app scope (Flutter) — Spec §3·M5. For **members, contributors, visitors** (admin stays on web).
1. **Login** — same JWT; tokens in `flutter_secure_storage`; silent refresh; expired/revoked refresh → clean
   logout to login (no crash); tokens never logged.
2. **Tenant switch** — a multi-tribe user picks the active tribe; switching shows no data from the inactive one.
3. **Family tree** — vertical `CustomPainter`, incremental load via `GET /tree`, pinch-zoom/pan, in-tree
   search with camera-move, tap node → person card. ≤2s to draw 3 generations; ≥30fps up to 2,000 nodes.
4. **Person card** — details **exactly as the Visibility Resolver returns** (no blocked field ever reaches the
   app); images/documents via presigned URLs; lineage path to root.
5. **Requests & contributions** — create a Change Request (add/edit) with `contributionType`; track my requests;
   my contributions + reputation (`GET /reputation/me`).
6. **View-request** for non-members — same public M3 flow.
7. **Notifications** — FCM push (register device on login, deregister on logout) + an in-app notifications
   screen (`GET /notifications`); tapping a push opens the related item within ≤10s of the event.
8. **Language & direction** — AR RTL / EN LTR instant switch on every screen incl. the tree; theme follows the
   tribe's colours.
9. **Offline (read-only)** — local cache (drift/sqlite) of the last tree + opened cards; writes require a connection.

**Stack (mandatory):** Flutter stable, Riverpod, dio + retrofit (client generated from the backend OpenAPI),
flutter_secure_storage, easy_localization, firebase_messaging. Feature-First layout
(`features/<name>/{data,domain,presentation}`), `very_good_analysis` lint, all strings as translation keys.

## Acceptance gates (Spec §10·M5)
1. One Flutter codebase builds for Android (API 26+) and iOS (15+) in CI.
2. 3-gen tree draws ≤2s; pinch-zoom/pan ≥30fps up to 2,000 nodes.
3. Every person response in the app **matches the Visibility Resolver exactly** — verified at the **API level**
   (no blocked fields), not just UI.
4. Push arrives ≤10s of an approve/reject event on both platforms; tap opens the request.
5. Language toggle flips RTL/LTR instantly on all screens incl. the tree.
6. Expired/revoked refresh → clean logout, no crash; secure-storage tokens never appear in logs.
7. A two-tribe user switches and sees no data from the inactive tribe.

## CI reality (important)
- CI can run **`flutter analyze` + `flutter test`** (+ `flutter build apk` for Android) on a Linux runner via a
  Flutter SDK action — this proves the codebase compiles/analyzes and units pass.
- The **iOS build** needs a **macOS runner**; the device-behaviour gates (≥30fps, push ≤10s, real-device offline)
  and FCM delivery need real devices + a Firebase project — inherently **not** verifiable in headless CI.
  Firebase config files are placeholders committed for build; real credentials are deployment-time.

## Out of M5 scope (Backlog)
Mobile admin panel, import from mobile, advanced/radial tree styles, biometric login, deep links.

---

## Backend implementation notes (as shipped) — for the Mobile agent

> Appendix to the frozen contract. Types: `packages/shared-types/src/device.ts`. Migration: `0007_device_registrations`. Base `/api/v1`.

### Device registration
- `POST /devices` body `RegisterDeviceDto { token, platform: 'android'|'ios' }` → **200** `DeviceRegistration`
  `{ id, tenantId, userId, token, platform, createdAt, lastSeenAt }`. **Upsert by token** — re-registering the same
  token (refresh) updates the row (returns the same `id`), never duplicates. Requires an authenticated, tenant-bound
  access token; allowed for every member role. Returns **200** (not 201) because it is an upsert.
- `DELETE /devices/:token` → **200** `{ removed: 0 | 1 }`. Owner-scoped (only your own token) and idempotent — deleting
  a missing/foreign token returns `{ removed: 0 }`. **URL-encode the token** (FCM tokens may contain `:` `-` `_`).
- Flow: register on login / on FCM `onTokenRefresh`; deregister on logout **before** clearing the JWT (the call needs auth).

### Push payload
- FCM message: `notification { title, body }` (localized) plus a **`data`** block
  `{ type: <NotificationType>, payload: <JSON string>, notificationId, ... }`. Parse `data.type` + `data.payload`
  to deep-open the related item (e.g. `change_request_approved` → open that request). `type` mirrors the in-app
  `Notification.type`; `payload` is the same object returned by `GET /notifications`.
- Push is **best-effort and disabled in dev/CI** (no Firebase creds server-side). Do not rely on push for
  correctness — `GET /notifications` stays the source of truth; push only wakes the app. Delivery/latency gates
  need real devices + a Firebase project (not verifiable in headless CI).
