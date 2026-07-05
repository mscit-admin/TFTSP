# 04 — API conventions

This is the contract shape shared by every endpoint. For the actual route
surface, see the frozen contracts: `docs/API_CONTRACT.M1.md` … `M5.md`. This doc
covers the conventions those routes all obey, and where they are implemented.

## Base path & versioning

- Every route is prefixed **`/api/v1`** (`app.setGlobalPrefix('api/v1')` in
  `apps/api/src/main.ts`).
- Versioning is path-based (`v1`). A breaking change would introduce `v2` rather
  than mutate `v1` in place; `packages/shared-types` + the `API_CONTRACT.M*.md`
  files are the frozen sync point (D-004).
- **Swagger/OpenAPI** is served at `/api/docs` (`DocumentBuilder` in `main.ts`,
  `addBearerAuth()`), and controllers annotate operations with
  `@ApiTags`/`@ApiOperation`/`@ApiBearerAuth`.
- Bootstrap also applies `helmet()`, permissive CORS (`origin: true,
  credentials: true`), and the global strict `ValidationPipe`
  (`whitelist + forbidNonWhitelisted + transform`) — unknown body fields are
  rejected, not silently dropped.

## Authentication

- **`Authorization: Bearer <accessToken>`** on every non-`@Public` route.
- The access token is a JWT (`jwt.strategy.ts`) whose payload is
  `{ sub, email, tenantId?, isSuperAdmin }`; the strategy maps it to
  `req.user: AuthenticatedUser { id, email, isSuperAdmin, tenantId? }`.
- **`tenantId` comes only from the token** — it is never read from a header, path,
  or body. The active tenant is baked into the access token at login/refresh time;
  a multi-tenant user switching tribes gets a new token bound to the new tenant.
- `@Public()` (`common/decorators/public.decorator.ts`) opts a route out of auth
  (e.g. `/auth/login`, `/auth/refresh`, the public view-request endpoints).
- Auth mechanics (Argon2id, lockout, refresh rotation with reuse detection) are in
  [05 — AuthZ & security](./05-authz-and-security.md).

## Error shape

Every error is serialized by the global `AllExceptionsFilter`
(`common/errors/all-exceptions.filter.ts`) to the frozen shape:

```json
{ "statusCode": 409, "messageKey": "errors.person.version_conflict",
  "message": "…localized…", "details": { } }
```

- `messageKey` is a machine-readable i18n key — the stable field clients branch
  on. `message` is the localized human string (resolved via `nestjs-i18n` against
  the request locale). `details` is optional structured context.
- Business code throws **`AppException`** (`common/errors/app.exception.ts`) with a
  key from **`ErrorKeys`** (`common/errors/error-keys.ts`) — never a hard-coded
  string. Helpers: `AppException.badRequest/unauthorized/forbidden/notFound/
  conflict(key, details?)`.
- class-validator failures are folded into
  `errors.validation.failed` with `details.errors`.

Representative keys (see `error-keys.ts` for the full catalogue): auth
(`invalid_credentials`, `account_locked`, `grant_expired`, `forbidden`), persons
(`version_conflict`, `duplicate_candidates`, `self_ancestry`,
`father_must_be_male`), change requests (`cr_invalid_state`, `cannot_review_own`),
imports (`plan_limit_exceeded`, `rollback_blocked`, `has_errors`), uploads
(`svg_rejected`, `unsupported_type`, `file_too_large`), subscriptions
(`plan_limit_reached`), contributions (`too_many_pending`, `viewer_not_allowed`).

## Pagination envelope

List endpoints return a uniform envelope:

```json
{ "data": [ ... ], "page": 1, "pageSize": 20, "total": 137 }
```

Notifications extend it with an `unread` count. This is the shape for `GET
/persons`, `/change-requests`, `/imports`, `/notifications`, etc.

## i18n

- `nestjs-i18n` with fallback language `ar` (Spec default) and resolvers, in
  order: `QueryResolver(['lang'])` → `HeaderResolver(['x-lang'])` →
  `AcceptLanguageResolver`. So `?lang=en`, `x-lang: en`, or `Accept-Language`
  selects the response locale.
- Message catalogues live in `apps/api/src/i18n/{ar,en}/` (e.g. `errors.*`,
  `notifications.*`). Error `messageKey`s and notification subjects/bodies are all
  keys resolved from these files — the same keys are reused by the email and FCM
  channels.
- Client-side, the Angular apps use `ngx-translate` and the Flutter app uses
  `easy_localization`; all three switch AR (RTL) / EN (LTR) instantly. See
  [07 — Frontend architecture](./07-frontend-architecture.md).

## Cross-cutting write conventions

- **Every tenant-scoped write is audited** — who/what/when/ip + before/after JSON
  (`modules/audit`, `AuditLog`). Actions are dotted strings
  (`person.update`, `union.divorce`, `viewRequest.approve`, `import_rollback`,
  `access.denied`).
- **`tenant_id` is never accepted from the client** on any write; it is injected
  from the JWT via RLS.
- **Optimistic concurrency** on persons via the integer `version` column; a
  mismatch returns `409 errors.person.version_conflict`.
- **Blocked/hidden fields are removed** from person responses, never nulled (M3
  Visibility Resolver — check `'photoKey' in obj`, not `=== null`).
