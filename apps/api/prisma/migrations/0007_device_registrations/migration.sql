-- M5 — mobile device registration for FCM push (Spec §3·M5.7).
-- One tenant-scoped table under RLS. A device token is globally unique (a physical
-- device holds one FCM token); re-registration upserts by token.

-- ---- Enum ----
CREATE TYPE "DevicePlatform" AS ENUM ('android', 'ios');

-- ---- Tenant-scoped: device_registrations (RLS) ----
CREATE TABLE "device_registrations" (
  "id"           UUID NOT NULL,
  "tenant_id"    UUID NOT NULL,
  "user_id"      UUID NOT NULL,
  "token"        TEXT NOT NULL,
  "platform"     "DevicePlatform" NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_registrations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "device_registrations"
  ADD CONSTRAINT "device_registrations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "device_registrations_token_key" ON "device_registrations" ("token");
CREATE INDEX "device_registrations_tenant_id_user_id_idx" ON "device_registrations" ("tenant_id", "user_id");

-- ---- Grants ----
GRANT SELECT, INSERT, UPDATE, DELETE ON "device_registrations" TO tftsp_app;

-- ---- RLS ----
ALTER TABLE "device_registrations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "device_registrations"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);
