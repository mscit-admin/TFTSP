# M3 API Contract (FROZEN) — Visibility, Privacy & Tree-View Requests

> The security-critical phase. Backend owns this contract; Admin-Web builds the policy UI + review.
> Types: `packages/shared-types/src/visibility.ts`. Base `/api/v1`. Same auth/tenant/RLS/audit conventions.

## Governing rule — the Visibility Resolver (Spec §3·M3.1)
- **One central service** through which EVERY person read passes: person detail, list, search, `/tree`,
  ancestors/descendants, tree-node payloads, and the M2/M2.5 flows that echo person data.
- Inputs: `(requesting user, target person, tenant VisibilitySettings)`. Output: the permitted projection
  of the entity. **Blocked fields are REMOVED from the response JSON — never nulled** (M3 acceptance gate).
- Existence must not leak: a target outside the requester's scope returns **404** (not 403) so callers
  can't infer a person exists (M3 acceptance gate).

## Visibility levels (per tenant) — Spec §3·M3.2
`public | members | family | branch | admin` — the tribe-wide baseline gate before field policies apply.

## Field policies (per tenant) — Spec §3·M3.3
`VisibilitySettings`: `womenDisplay` (under_father | with_siblings | under_husband | hidden), `showPhotos`,
`showPhones`, `showBirthDates`, `showDeceased`, `showMinors` (under-18), `showDocuments`,
`defaultMemberScope`, `requireIdForViewRequest`. A blocked policy ⇒ the corresponding field(s) are dropped.
- **Women hidden** ⇒ a non-direct-relative (e.g. external Viewer) search/list/tree returns **no women**
  (M3 acceptance gate).

## Member read scope (Spec §3·M3.4)
`direct` (direct ancestors + siblings + children) | `clan` | `branch` | `tribe`, derived from the member's
role assignment (falling back to `defaultMemberScope`). Resolved via the Closure Table + tribal-unit tree.
- A `clan`-scoped member requesting a person in another clan ⇒ **404** (M3 acceptance gate).

## Visibility settings endpoints (`/api/v1/visibility-settings`) — tenant-scoped, Tribe Admin
| Method | Path | Body / Returns |
|---|---|---|
| GET | `/visibility-settings` | `VisibilitySettings` |
| PATCH | `/visibility-settings` | `UpdateVisibilitySettingsDto` (audited) |

## Tree-viewing requests (Spec §3·M3.5)
Non-members request temporary view access; approval grants a **Viewer role with a mandatory expiry**.
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/view-requests/id-attachment` | **public** | `multipart/form-data`, file field **`file`** + a `tenantSlug` field → streams to MinIO; returns `{ idAttachmentKey }`. Images (PNG/JPEG/WEBP/GIF) + PDF only, **magic-byte** checked, **SVG rejected outright**, ≤ 10 MB. Use the returned key as `idAttachmentKey` in the submission below. |
| POST | `/view-requests` | **public** (tenant via `tenantSlug`) | submit `CreateViewRequestDto` (triple name, phone, alleged branch, reason, optional `idAttachmentKey` per `requireIdForViewRequest`) → notifies admins |
| GET | `/view-requests?status=` | Tribe Admin | list requests |
| POST | `/view-requests/:id/approve` | Tribe Admin | `ApproveViewRequestDto { validTo }` — creates/links a Viewer user + a `role_assignments` row with `valid_to` |
| POST | `/view-requests/:id/reject` | Tribe Admin | reject |

- Reuses the M1 `role_assignments (valid_from, valid_to)` for the temporary grant — no special role type.
- Temporary permission **expires by date**: a request made after `valid_to` ⇒ **401** with an expiry
  message (M3 acceptance gate). Enforced in the auth/PolicyGuard layer.
- ID attachment (if required) uploaded to MinIO like other documents (presign or direct, per M4 rules —
  for M3 a minimal key handoff is acceptable; log in DECISIONS).

## Acceptance gates (Spec §10·M3)
1. `clan`-scoped member requests a person in another clan → **404**.
2. Women-hidden tenant → external Viewer search returns no women.
3. Blocked fields **absent** from response JSON (not null).
4. Temporary grant past `valid_to` → **401** with expiry message.

## Notes for Admin-Web
- **Settings shape** (`GET/PATCH /visibility-settings`): `{ tenantId, level, womenDisplay, showPhotos, showPhones,
  showBirthDates, showDeceased, showMinors, showDocuments, defaultMemberScope, requireIdForViewRequest }`.
  PATCH accepts any subset. In M3 the redactable Person fields are `photoKey` (showPhotos) and `birthDate`
  (showBirthDates); `showPhones`/`showDocuments` are stored now and take effect when those fields ship (M4).
- **Redaction behavior:** blocked fields are **absent** from person JSON (check with `'photoKey' in obj`, not
  `=== null`). Out-of-scope / hidden persons are **absent from lists/tree** and **404** on detail — treat 404 as
  "not visible", not necessarily "does not exist". Admins (tribe/deputy/branch) see full data.
- **View-request review shape** (`ViewRequest`): `{ id, tenantId, fullName, phone, allegedBranch?, reason,
  idAttachmentKey?, status, reviewedBy?, grantedUserId?, validTo?, createdAt }`. Public POST returns the pending
  request; approve requires `{ validTo }` (ISO) and returns it `approved` with `grantedUserId` + `validTo`.
  Admins are notified via `notification` type `view_request_submitted` (payload `{ viewRequestId, fullName }`).
- **Expired grant:** a request after `valid_to` returns **401** with `messageKey: "errors.auth.grant_expired"` —
  the client should route to a re-request / login screen.

## Out of M3 scope
Advanced tree renders/exports/subscriptions/crowdsourcing (M4), mobile (M5). The resolver must be efficient
enough to keep tree reads within the §9 latency targets, but perf tuning beyond correctness is M4.
