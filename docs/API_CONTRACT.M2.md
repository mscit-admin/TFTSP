# M2 API Contract (FROZEN) — Change Requests, Approval Workflow, Notifications

> Builds on the verified M1 base. Backend owns this contract; Admin-Web builds against it.
> Types live in `packages/shared-types` (`change-request.ts`, `notification.ts`).
> Base URL `/api/v1`. Same auth/tenant/error conventions as M1. Every write is audited.

## Governing rules (Spec §3 · M2)
- Every edit to the tree by a **non-admin role** (Contributor/Viewer-with-suggest, etc.) becomes a
  **Change Request** carrying an RFC-6902 **JSON Patch** on the target entity. Admin roles still write
  directly (M1 behaviour unchanged).
- Nothing touches live data until **`published`**. Publish is **atomic** and **re-checks conflicts**:
  if the target's `version` changed since the request's `baseVersion`, the request goes to **`conflict`**
  and is NOT applied (owner must re-draft).
- State machine: `draft → submitted → under_review → approved | rejected | changes_requested → published`
  (plus terminal `conflict`, `expired`).

## Change Requests (`/api/v1/change-requests`) — tenant-scoped
| Method | Path | Purpose |
|---|---|---|
| POST | `/change-requests` | create a `draft` `{ targetType, targetId?, operation, patch }` (captures `baseVersion`) |
| GET | `/change-requests` | list; filters `?status=&mine=true&queue=true` (queue = awaiting my review) |
| GET | `/change-requests/:id` | full request incl. `reviews[]` |
| PATCH | `/change-requests/:id` | edit `patch` while `draft`/`changes_requested` (or reviewer edit if `reviewerCanEdit`) |
| POST | `/change-requests/:id/submit` | `draft → submitted` |
| POST | `/change-requests/:id/review` | body `{ decision: approve\|reject\|request_changes, comment? }` |

- Applying approvals: when the count of distinct `approve` reviews reaches the tenant's
  `approvalsRequired`, the request becomes `approved` and the backend **publishes it automatically**
  (atomic apply + conflict re-check → `published` or `conflict`). One `reject` ⇒ `rejected`.
  `request_changes` ⇒ `changes_requested` (owner may edit + resubmit).
- A reviewer may not approve their own request; each reviewer counts once.

## Workflow settings (`/api/v1/workflow-settings`) — tenant-scoped, Tribe Admin
| Method | Path | Body / Returns |
|---|---|---|
| GET | `/workflow-settings` | `{ approvalsRequired, expiryDays, reviewerCanEdit }` |
| PATCH | `/workflow-settings` | `{ approvalsRequired?(1..3), expiryDays?, reviewerCanEdit? }` (audited) |

## Notifications
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/notifications` | `{ data[], unread, page, pageSize, total }` |
| POST | `/api/v1/notifications/:id/read` | mark read |
| POST | `/api/v1/notifications/read-all` | mark all read |

- **In-app:** Socket.IO gateway, namespace `/notifications`, JWT-authed, joins a **tenant+user room**;
  emits event `notification` (payload = `Notification`) within ≤2s of any request state change.
- **Email:** bilingual (ar/en) **MJML** templates via the `NotificationChannel` abstraction, delivered
  through MailHog in dev. Triggers: new request, approval, rejection, changes-requested, expiry-approaching.

## Scheduled jobs (BullMQ)
- Expiry sweep: requests past `expiresAt` and not terminal ⇒ `expired`, owner notified (in-app + email).
- Expiry-approaching warning (e.g. 3 days out) ⇒ notify owner.

## Out of M2 scope
Bulk import (M2.5), visibility resolver (M3), exports/subscriptions/crowdsourcing (M4), mobile (M5).
