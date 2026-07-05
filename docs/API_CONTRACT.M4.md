# M4 API Contract (FROZEN) — Advanced Display, Exports, Subscriptions, Crowdsourcing

> The largest phase; all three web workstreams participate. Backend owns this contract.
> Types: `packages/shared-types/{subscription,document,reputation,stats}.ts`. Base `/api/v1`.
> Same auth/tenant/RLS/audit conventions. **Every person read still flows through the M3 Visibility Resolver.**

## 1. Advanced tree rendering (admin-web) — Spec §3·M4.1, §7
- Layouts: **vertical (from M1) + horizontal + Fan Chart** only (radial/timeline = Backlog).
- d3.js v7 in Angular; **Canvas + Level-of-Detail above 1,500 visible nodes**, SVG below.
- Consumes the existing `GET /tree` (compact nodes/edges, already resolver-filtered); lazy expansion
  (root + 3 generations, +2 per expand). No new tree endpoint required; add `?layout=` only if needed client-side.
- **Gate:** 10,000-node tree loads ≤ 3s, pan/zoom ≥ 30fps on a mid device.

## 2. Export (Spec §3·M4.2, §M4.7)
| Method | Path | Purpose |
|---|---|---|
| POST | `/exports/tree/pdf` | server-side **Puppeteer** PDF, `{ rootId, layout, paper: A0..A4 }`, RTL correct → PDF stream (or a job id + `/exports/:id` if async) |
| POST | `/exports/tree/png` | high-res PNG `{ rootId, layout, scale: 2\|4 }` |
| GET | `/exports/persons.xlsx` / `/exports/persons.csv` | tabular export using the **import template columns** (round-trip) |
- **Gate:** Arabic PDF renders correct direction + fonts on A3 and A4.

## 3. Person documents (Spec §3·M4.3)
| Method | Path | Purpose |
|---|---|---|
| POST | `/documents/presign` | `RequestUploadDto` → `{ uploadUrl, objectKey }` (MinIO presigned PUT, 15-min) |
| POST | `/documents/confirm` | `ConfirmUploadDto` → registers `PersonDocument`; **magic-byte check, SVG rejected, ≤10MB** |
| GET | `/persons/:id/documents` | `DocumentWithUrl[]` (presigned GET URLs, 15-min) |
| DELETE | `/documents/:id` | soft-delete |
- **Gate:** an SVG masked as `.png` is rejected (magic bytes, not extension).

## 4. Subscriptions & plan enforcement (Spec §3·M4.4, §M4.8)
- Plans: **Free 500 / Basic 5,000 / Professional 25,000 / Enterprise unlimited** (`PLAN_LIMITS`).
- **Central Guard** enforces the person cap on create/import/publish. Supersedes the M2.5 `Tenant.max_persons`
  stand-in — derive the cap from the tenant's subscription tier.
- Manual activation (bank transfer) in v1 via a `PaymentGateway` abstraction (no real gateway).

**Platform-web (Super Admin), `/api/v1/platform/subscriptions`:**
| Method | Path | Purpose |
|---|---|---|
| GET | `/platform/tenants/:id/subscription` | current `TenantSubscription` |
| PUT | `/platform/tenants/:id/subscription` | `SetSubscriptionDto` (assign tier, manual activate, expiry) — audited |
| GET | `/platform/tenants/:id/subscription/activations` | `SubscriptionActivation[]` (activation log) |
- **Gate:** a Free tribe at 500 persons — the 501st add is rejected with an upgrade message
  (`errors.subscription.plan_limit_reached`, details `{ tier, max, current }`).

## 5. Statistics dashboards (Spec §3·M4.5)
Backed by **Materialized Views refreshed hourly** (BullMQ scheduled refresh + on-demand admin trigger).
| Method | Path | Audience | Returns |
|---|---|---|---|
| GET | `/stats/tribe` | Tribe Admin (admin-web) | `TribeStats` |
| GET | `/platform/stats/dashboard` | Super Admin (platform-web) | `PlatformDashboard` |

## 6. Crowdsourcing & reputation (Spec §13, within M4)
**No new engine** — a contribution is an **M2 Change Request** with a `contributionType`. Any parallel workflow is rejected.
- Contribution types: `add_person, edit_data, fix_relation, upload_document, add_source, add_biography`
  (biography = a sanitized rich-text field on Person, approved like any change).
- **Contributor** role creates contributions; **Viewer** may suggest `edit_data`/`add_source` only, and only
  when the tribe enables `allowViewerContributions` (else **403**).
- **Reputation** (`ContributorReputation`, per contributor per tenant): counters updated on each
  approve/reject decision; `accuracyRate` recomputed immediately; `trustLevel` bronze/silver/gold by
  per-tenant thresholds. **No automatic privilege promotion in v1** — admins promote manually.
- Every contribution passes the **Visibility Resolver**: suggesting an edit on a person outside the
  contributor's scope ⇒ **404**.
- Flood protection: **max 20 pending** contributions per contributor (`errors.contribution.too_many_pending`),
  plus a rate limit on creation.

| Method | Path | Purpose |
|---|---|---|
| GET | `/reputation/me` | current user's `ContributorReputation` in the active tenant |
| GET | `/reputation` | Tribe Admin: contributors ranked by accuracy |
| GET/PATCH | `/reputation/thresholds` | Tribe Admin: `ReputationThresholds` (incl. `allowViewerContributions`, `maxPending`) |
- Change-request creation (M2 endpoint) gains an optional `contributionType`; the approve/reject path
  updates reputation counters.

### Acceptance gates (Spec §10·M4 + §13)
1. 10k-node tree: ≤3s load, ≥30fps pan/zoom.  2. Arabic PDF correct on A3/A4.  3. SVG-as-.png rejected.
4. Free tribe 501st add rejected with upgrade message.  5. Accepted contribution raises `accepted` +
recomputes `accuracyRate`; rejected raises `rejected`.  6. Viewer in a non-enabled tribe → 403 on suggest.
7. Contributor at 20 pending → blocked on the 21st.  8. Suggest on out-of-scope person → 404.

## Out of M4 scope
Mobile (M5); radial/timeline trees, GEDCOM, real payment gateways, SMS/WhatsApp/Telegram, AI (all Backlog).
