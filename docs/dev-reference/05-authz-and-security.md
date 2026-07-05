# 05 — Authorization & security

Security in TFTSP is defense-in-depth: **RLS at the database**, a **central policy
guard** in the app, and a **visibility resolver** on every read. No single layer is
trusted alone.

## Tenant isolation via RLS

### The GUC + the two planes

The active tenant is carried in a PostgreSQL session variable
`app.current_tenant`. The RLS policies (`tenant_isolation`, one per tenant-scoped
table) filter every row with
`tenant_id = current_setting('app.current_tenant', true)::uuid` — see
[03 — Data layer](./03-data-layer.md).

`PrismaService` (`common/prisma/prisma.service.ts`) exposes two clients:

- **`prisma.tenant`** — connects as `tftsp_app` (**no `BYPASSRLS`**). RLS-bound.
  Used for all tenant request handling.
- **`prisma.platform`** — connects as the owner role. Bypasses RLS. Used **only**
  by the trusted auth/platform plane: resolving `role_assignments` before a tenant
  is bound, cross-tenant reads behind `@SuperAdminOnly`, and stats matviews.

### How the GUC gets set (the Prisma extension)

`applyTenantExtension` (`common/prisma/prisma.extension.ts`) wraps **every** model
operation on the tenant client. When a tenant is bound and we are not already
inside an explicit tenant transaction, it runs the op inside a transaction that
first executes `SELECT set_config('app.current_tenant', <id>, true)` — the `true`
makes it a `SET LOCAL` scoped to that implicit transaction, so a pooled connection
never leaks a tenant to the next request:

```ts
const [, result] = await base.$transaction([
  base.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`,
  query(args),
]);
```

The `tenantId` comes from `TenantContext` (an `AsyncLocalStorage` store,
`common/tenant/tenant-context.ts`), populated per request by
`TenantContextInterceptor` from `req.user.tenantId` — i.e. **only from the verified
JWT**.

### The tx-depth wrapping

Multi-statement work (person edit + closure maintenance) uses
`PrismaService.tenantTransaction(fn)`. It sets the GUC once and increments
`store.txDepth`; the extension skips its own wrapping while `txDepth > 0`, so inner
model ops don't try to open a nested transaction. `txDepth` is a **counter, not a
boolean** on purpose: concurrent tenant transactions in one request (`Promise.all`)
must both be able to enter/exit without one clearing the other's flag. If the flag
were wrongly cleared, a later op could hit a pooled connection whose GUC has
reverted to `''`, and `''::uuid` fails with SQLSTATE `22P02`.

### The isolation gate

`test/isolation.e2e-spec.ts` is the **mandatory** cross-tenant isolation test
(Spec §4.5), run in CI against a real PostgreSQL 16 via Testcontainers. It proves a
request bound to tenant A cannot read/write tenant B's rows even with a crafted id.

## The central PolicyGuard

Authorization is **data-driven and centralized** — no service ever checks a role
manually (Spec §6). Two global guards run in order (`app.module.ts`):

1. **`JwtAuthGuard`** (`common/guards/jwt-auth.guard.ts`) — authenticates (skips
   `@Public`), populating `req.user`.
2. **`PolicyGuard`** (`common/guards/policy.guard.ts`) — authorizes.

`PolicyGuard.canActivate` logic:

- `@Public()` → allow.
- `@SuperAdminOnly()` (`common/decorators/super-admin.decorator.ts`) → require
  `user.isSuperAdmin`, else `403 errors.auth.forbidden`.
- Read `@RequirePermission(permission, scope?)` metadata. If none, an authenticated
  route (e.g. `/auth/me`) is allowed.
- A super admin with a selected tenant may act in it.
- Otherwise load the user's **active** `role_assignments` for `(tenantId, userId)`
  via the **platform client** (validity window `validFrom <= now` and
  `validTo IS NULL OR validTo >= now`). Match the user's roles against
  `PERMISSION_MATRIX[permission]`. No match → `403`.
- If the only assignment(s) have **lapsed** (`validTo < now`), throw
  `401 errors.auth.grant_expired` (distinct from 403) — this is the temporary
  view-request grant expiring (M3 gate 4).

### Declaring a requirement

```ts
@Post()
@RequirePermission('person.create', ScopeCheck.TribalUnit)
create(@Body() dto: CreatePersonDto) { /* … */ }
```

`@RequirePermission` (`common/rbac/require-permission.decorator.ts`) sets metadata;
`PolicyGuard` reads it. The `Permission` union and the role mapping live in
`common/rbac/permissions.ts` (`PERMISSION_MATRIX`).

## Roles & scopes

Nine roles (`Role` enum): `super_admin`, `platform_admin`, `tribe_admin`,
`deputy_admin`, `branch_admin`, `reviewer`, `contributor`, `viewer`, `guest`.

- **`PERMISSION_MATRIX`** maps each permission (e.g. `person.update`,
  `changeRequest.review`, `import.rollback`, `visibilitySettings.update`,
  `device.manage`) to the set of roles that hold it. Notable groupings:
  `M1_WRITE_ROLES` (tribe/deputy/branch admin), `M2_REVIEW_ROLES` (tribe/deputy
  admin + reviewer), `READ_ROLES` (the six member roles).
- **Scope check** (`ScopeCheck`): `None` = any active assignment with the
  permission passes; `TribalUnit` = `branch_admin` (and below) is confined to its
  assigned `tribalUnitId` and that unit's descendants, resolved by walking the
  `tribal_units` parent chain (`checkTribalUnitScope`). Unscoped admin roles
  (tribe/deputy) pass unconditionally.
- `role_assignments` also carries `memberScope` + `anchorPersonId` (M3), used by
  the Visibility Resolver rather than the guard.

## The M3 Visibility Resolver

`VisibilityResolver` (`modules/visibility/visibility.resolver.ts`, a `@Global`
module) is the single gate **every person read passes through**: person detail,
list, search, `/tree`, ancestors/descendants, and the M2/M2.5/M4 flows that echo
person data. It is injected into `PersonsService` and `LineageService`.

- Inputs: `(requesting user, target person, tenant VisibilitySettings)`. Output:
  the permitted projection.
- **Existence policies** remove a person entirely: out-of-scope or hidden targets
  are **absent from lists/tree** and return **404** on detail — existence must not
  leak (a 403 would confirm the person exists). Example: a `clan`-scoped member
  requesting another clan's person gets 404.
- **Field policies** DELETE keys from the JSON (`showPhotos` → `photoKey`,
  `showBirthDates` → `birthDate`, etc.) — **never null**. Check with
  `'photoKey' in obj`.
- **Member scope** (`direct` / `clan` / `branch` / `tribe`) comes from the member's
  `role_assignments.member_scope` (falling back to
  `VisibilitySettings.defaultMemberScope`), resolved via the closure table (direct
  = ancestors + siblings + children) and the tribal-unit subtree (clan/branch).
- **Women display** (`under_father` / `with_siblings` / `under_husband` / `hidden`)
  — when hidden, a non-direct-relative viewer's search/list/tree returns no women.
- Admins (tribe/deputy/branch) see full data.

These four behaviors are the M3 acceptance gates in `API_CONTRACT.M3.md`.

## Auth mechanics

Implemented in `modules/auth` (`auth.service.ts`, `password.service.ts`,
`token.service.ts`, `jwt.strategy.ts`):

- **Passwords:** Argon2id hashing (`PasswordService`, `argon2.argon2id`); policy
  `≥ 12 chars` (`AUTH_MIN_PASSWORD_LENGTH`) enforced via
  `assertPolicy` → `errors.auth.weak_password`.
- **Account lockout:** `AUTH_MAX_FAILED_ATTEMPTS` (5) failures →
  `AUTH_LOCK_MINUTES` (15) lock (`users.failedLoginAttempts`/`lockedUntil`) →
  `errors.auth.account_locked`.
- **Access tokens:** JWT, TTL 15m, signed with `JWT_ACCESS_SECRET`, payload
  `{ sub, email, tenantId?, isSuperAdmin }`.
- **Refresh tokens:** high-entropy opaque strings (`randomBytes(32)`), TTL 30d.
  **Only the SHA-256 hash is stored** (`refresh_tokens.tokenHash`), so a DB leak
  exposes no usable token. Rotation links tokens by `familyId`; presenting an
  already-rotated (reused) token **revokes the whole family** —
  `errors.auth.refresh_token_reused`. Verified by `test/auth.e2e-spec.ts`.
- WebSocket handshakes (`/notifications`, `/imports`) re-verify the same access JWT
  and require an active tenant, else disconnect (see [08](./08-integrations.md)).

## Upload hardening (magic-byte / SVG reject)

`detectFileKind(buf)` (`common/util/file-type.ts`) classifies by **magic bytes,
not file extension** — PNG/JPEG/GIF/WEBP → `image`, `%PDF-` → `pdf`. SVG has no
binary magic, so the first 512 bytes are sniffed as UTF-8: anything starting with
`<?xml`, containing `<svg`, or starting with `<` is classified `svg` and
**rejected outright** (XSS rule, §M4.3).

This is enforced at the real bytes, not the declared type:

- **Documents** (`modules/documents`): `presign` does an early declared-type
  reject; `confirm` re-reads the *actual* uploaded first bytes from MinIO
  (`getFirstBytes`), runs `detectFileKind`, and on `svg`/`unsupported` deletes the
  object and throws `errors.upload.svg_rejected` / `unsupported_type`, then
  enforces the ≤10 MB cap against the real object size. So an SVG renamed `.png`
  is rejected at confirm (M4 gate 3).
- **View-request ID attachments** (`modules/view-requests`) and **import files**
  (`modules/imports`) apply the same magic-byte check on the streamed bytes (import
  additionally verifies xlsx is a real ZIP; 50 MB cap).

## Other hardening

- Global `ValidationPipe` (`whitelist + forbidNonWhitelisted + transform`) rejects
  unknown fields.
- `helmet()` security headers; pino logs **redact** `authorization`/`cookie`
  headers and never log tokens.
- Platform routes (`/platform/*`, `/platform/subscriptions`, platform stats) are
  `@SuperAdminOnly` and use the owner client — cross-tenant by design, never
  reachable by a tribe admin.
