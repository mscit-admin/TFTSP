# M1 API Contract (FROZEN) — the single sync point for all agents

> The **Backend agent** owns and may refine this contract, but must announce any change.
> The **admin-web** and **platform-web** agents build against it. All request/response
> shapes also live as TypeScript types in `packages/shared-types` (generated/authored by Backend).
>
> Base URL: `/api/v1`. Auth: `Authorization: Bearer <access>`. All errors use i18n keys.

## Conventions
- Every tenant-scoped write emits an Audit entry (who/what/when/ip/before-after JSON diff).
- `tenant_id` is NEVER accepted from the client — it is derived from the JWT.
- Blocked/hidden fields are **removed** from responses, never nulled (M3 concern, but shape-compatible now).
- Errors: `{ "statusCode": number, "messageKey": "errors.xxx", "details"?: object }`.

## Auth (`/api/v1/auth`)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/login` | `{ email, password, tenantSlug? }` | `{ accessToken, refreshToken, user, tenants[] }` |
| POST | `/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` (rotation; reuse ⇒ whole chain revoked) |
| POST | `/logout` | `{ refreshToken }` | `204` |
| GET | `/me` | — | `{ user, roleAssignments[], activeTenant }` |

- Account lock: 5 failed attempts ⇒ 15-min lock. Password policy: ≥12 chars, hashed Argon2id.
- Access TTL 15m, Refresh TTL 30d with rotation.

## Platform admin (`/api/v1/platform/*`) — guarded by `SuperAdminGuard`, NOT tenant-scoped
| Method | Path | Purpose |
|---|---|---|
| GET | `/platform/tenants` | list tribes (+ counts) |
| POST | `/platform/tenants` | create tribe + assign first Tribe Admin `{ name_ar, name_en, slug, admin: { email, fullName, password } }` |
| POST | `/platform/tenants/:id/suspend` | suspend tribe |
| POST | `/platform/tenants/:id/activate` | reactivate |
| GET | `/platform/stats` | `{ tribes, persons, users }` |

## Tribal units (`/api/v1/tribal-units`) — tenant-scoped
CRUD. Entity: `{ id, parent_id, unit_type: tribe|branch|clan|family, name_ar, name_en }`.

## Persons (`/api/v1/persons`) — tenant-scoped, writes = admin roles only in M1
| Method | Path | Notes |
|---|---|---|
| GET | `/persons` | paginated list + basic search `?q=` (name_normalized trigram) |
| GET | `/persons/:id` | full person |
| POST | `/persons` | create; runs duplicate pre-check (Section 8, threshold 0.6) |
| PATCH | `/persons/:id` | optimistic lock via `version` |
| DELETE | `/persons/:id` | soft-delete (sets `deleted_at`), updates closure |

Person entity fields: see `packages/shared-types/src/person.ts` (authored from Spec Section 5).

## Unions (`/api/v1/unions`) — tenant-scoped
CRUD + lifecycle: create, divorce, widow, remarry.
Entity: `{ id, husband_id, wife_id, marriage_date?, status: active|divorced|widowed, end_date?, end_reason? }`.

## Lineage / Tree (`/api/v1/tree`)
| Method | Path | Returns |
|---|---|---|
| GET | `/tree?rootId=&generations=3` | `{ nodes[], edges[] }` compact (id, name, gender, isDeceased, childrenCount) |
| GET | `/persons/:id/ancestors` | closure-table lookup |
| GET | `/persons/:id/descendants` | closure-table lookup |

## Roles (Spec Section 6)
`SuperAdmin, PlatformAdmin, TribeAdmin, DeputyAdmin, BranchAdmin(scoped), Reviewer, Contributor, Viewer, Guest`.
Enforced by a single central `PolicyGuard` reading `@RequirePermission(...)` decorators. No manual role checks in services.
