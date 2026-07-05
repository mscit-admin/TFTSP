# 09 — Extension recipes

Concrete, copy-the-existing-pattern guides for the five most common extensions.
Every recipe cites the real files that already do this so you can mirror them
rather than invent.

## Recipe 1 — Add a new tenant-scoped module (with RLS)

Reference module: `modules/devices` (small, complete, tenant-scoped). Also see the
module conventions in `apps/api/README.md`: thin **controller**, logic in
**service**, DB access in **repository**, shapes in **dto/**.

1. **Schema.** Add the model to `apps/api/prisma/schema.prisma`. It **must** carry
   `tenantId String @map("tenant_id") @db.Uuid`, a relation to `Tenant`
   (`onDelete: Cascade`), and a composite index that **starts with `tenant_id`**
   (`@@index([tenantId, ...])`). Add the reverse relation on `Tenant`. Follow the
   `DeviceRegistration` model as a template.

2. **Migration.** Create the migration (Recipe 5). In its `migration.sql`, after
   the `CREATE TABLE`, grant + enable RLS with the **identical** policy every other
   tenant table uses (copy from `0007_device_registrations/migration.sql`):

   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON "my_things" TO tftsp_app;
   ALTER TABLE "my_things" ENABLE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation ON "my_things"
     USING      ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
     WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);
   ```

   Do **not** add `FORCE ROW LEVEL SECURITY` (unnecessary — the app is never the
   owner) and do **not** exclude it from RLS unless it's genuinely a platform
   table.

3. **Repository.** Use `this.prisma.tenant.myThing.*` — the tenant extension sets
   `app.current_tenant` automatically, so **never filter by `tenantId` in the
   `where` yourself and never accept it from input**. For multi-statement atomic
   work, use `this.prisma.tenantTransaction(tx => …)`. See
   `devices/device.repository.ts`.

4. **Service + controller.** Service holds logic; controller is thin and annotates
   each route with `@RequirePermission(...)` (Recipe 2). Audit writes via the
   audit module (`action: 'mything.create'`, before/after). See
   `devices/device.service.ts`.

5. **Register.** Add `MyThingModule` to `imports` in `app.module.ts`. If other
   modules need its provider, `exports` it (e.g. `DevicesModule` exports
   `DeviceRepository`).

## Recipe 2 — Add a new endpoint + permission

1. **Define the permission.** In `common/rbac/permissions.ts`, add the string to
   the `Permission` union and an entry to `PERMISSION_MATRIX` mapping it to the
   roles that hold it (reuse `READ_ROLES` / `M1_WRITE_ROLES` / `M2_REVIEW_ROLES`
   where they fit):

   ```ts
   export type Permission = /* … */ | 'myThing.read' | 'myThing.write';

   export const PERMISSION_MATRIX: Record<Permission, Role[]> = {
     // …
     'myThing.read': READ_ROLES,
     'myThing.write': [Role.tribe_admin, Role.deputy_admin],
   };
   ```

2. **Decorate the route.** In the controller, add `@RequirePermission('myThing.write')`.
   For branch-scoped writes, pass `ScopeCheck.TribalUnit` so `branch_admin` is
   confined to its unit + descendants (`PolicyGuard.checkTribalUnitScope`).
   Mirror `persons/persons.controller.ts`:

   ```ts
   @Post()
   @RequirePermission('myThing.write', ScopeCheck.TribalUnit)
   create(@Body() dto: CreateMyThingDto) { return this.service.create(dto); }
   ```

3. That is all the authorization you write — the global `PolicyGuard` enforces it.
   **Never check roles manually in the service.** For a super-admin-only,
   cross-tenant route, use `@SuperAdminOnly()` instead (see
   `modules/subscriptions/subscription.controller.ts`), which reads via the
   platform client.

4. **DTO + validation.** Add a `class-validator` DTO in `dto/`; the global strict
   `ValidationPipe` rejects unknown fields. Add new error keys to
   `common/errors/error-keys.ts` and their translations to `i18n/{ar,en}/`, and
   throw `AppException.badRequest(ErrorKeys.MY_KEY, details)` — never a raw string.

## Recipe 3 — Add a new notification type / channel

**A new notification type:**

1. Add the value to the `NotificationType` enum in `schema.prisma` and a migration
   that extends the PG enum:
   `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'my_event';` (mirror how
   `0005` added `view_request_submitted`).
2. Add the copy under both `i18n/ar/notifications.json` and
   `i18n/en/notifications.json` with `my_event.subject` and `my_event.body` — the
   in-app, email, and FCM channels all read these same keys.
3. Emit it by calling `NotificationService.notify(...)`
   (`modules/notifications/notification.service.ts`) with the recipient user, the
   type, and a `payload`. `notify` persists the row (authoritative), emits the
   `notification` socket event, sends the MJML email, and pushes via FCM — all
   automatically, with per-channel error isolation. See how
   `change-request.service.ts` emits its lifecycle events.

**A new channel** (e.g. SMS): implement the `NotificationChannel` interface
(`name` + a `send`/`deliver` method) as the existing channels do
(`channels/in-app.channel.ts`, `email.channel.ts`, `fcm.channel.ts`), then add your
provider to the `NOTIFICATION_CHANNELS` factory in `notifications.module.ts`.
Follow the FCM pattern for graceful-disable when credentials are absent, so
dev/CI never crash.

## Recipe 4 — Add a new contribution type

Contributions are **not a separate engine** — a contribution is an M2 change
request with a `contributionType` (Spec §13). To add one:

1. Add the value to the `ContributionType` enum in `schema.prisma` + a migration
   extending the PG enum (mirror how `0006` introduced the type). Update
   `packages/shared-types/src/reputation.ts` / `change-request.ts` if the client
   needs the literal.
2. If viewers should be allowed to suggest it under `allowViewerContributions`, add
   it to `VIEWER_ALLOWED_CONTRIBUTIONS` in `common/rbac/contributions.ts`
   (currently `edit_data`, `add_source`). Otherwise it falls under
   `CONTRIBUTOR_ROLES` only.
3. No new endpoint: clients pass `contributionType` on the existing
   `POST /change-requests`. `ChangeRequestService.create` →
   `enforceContributionRules()` already applies the pending cap
   (`errors.contribution.too_many_pending`), the viewer allow-list
   (`errors.contribution.viewer_not_allowed`), and the visibility check
   (out-of-scope target → 404). Approve/reject already updates reputation via
   `ReputationService.recordDecision`.
4. If the type edits a new Person field (like `add_biography` → `/biography`),
   ensure the field exists on `Person` and that `change-request.publisher.ts`
   `patchToFieldObject` handles it — the publisher applies the JSON-Patch through
   the same `persons.updateInTx` path, so most fields need no publisher change.

## Recipe 5 — Add a new migration

Migrations run **as the owner role** (`DATABASE_MIGRATION_URL`); the app runs as
`tftsp_app`. The convention is a numbered directory `NNNN_short_name/migration.sql`
(the repo uses `0001`…`0007`).

1. Edit `schema.prisma`, then generate the migration:

   ```bash
   cd apps/api
   # dev: create + apply as the owner
   DATABASE_URL="$DATABASE_MIGRATION_URL" npm run prisma:migrate:dev -- --name my_change
   ```

   This scaffolds `prisma/migrations/NNNN_my_change/migration.sql`.

2. **Hand-edit the SQL for anything Prisma can't express** — this is the norm in
   this repo. Copy the exact patterns from the existing migrations:
   - **RLS** for a new tenant table → the `tenant_isolation` policy block from
     Recipe 1 (template: `0002`/`0007`).
   - **Extend a PG enum** → `ALTER TYPE "X" ADD VALUE IF NOT EXISTS 'y';`
     (template: `0004` adding `import_batch`, `0005` adding
     `view_request_submitted`).
   - **Generated column / trigram index / new index** → template: the
     `name_normalized` block in `0002`.
   - **Grants** for a new table are re-issued explicitly per migration even though
     `ALTER DEFAULT PRIVILEGES` from `0002` would cover them (belt-and-suspenders;
     copy from any later migration).
   - **Materialized view** → template: `tribe_stats_mv` in `0006` (add a UNIQUE
     index if you want `REFRESH … CONCURRENTLY`; matviews carry no RLS, so they
     must be queried by the owner client with an explicit `tenant_id` filter, and
     wired into the `stats-refresh` job).

3. Apply in CI/prod with `npm run prisma:migrate` (`prisma migrate deploy`) using
   the owner URL. Regenerate the client with `npm run prisma:generate`.
4. If you added or changed tenant isolation, extend `test/isolation.e2e-spec.ts`
   so the mandatory cross-tenant gate covers the new table.

> **Reminder:** never point `DATABASE_URL` at the owner role. The runtime app must
> connect as `tftsp_app` or RLS stops protecting you.
