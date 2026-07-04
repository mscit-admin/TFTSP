-- ===========================================================================
-- TFTSP M3 — Visibility & Privacy. visibility_settings + view_requests
-- (tenant-scoped, RLS) and member-scope columns on role_assignments. Runs after
-- 0004 as owner (tftsp).
-- ===========================================================================

-- ---- Enums ----
CREATE TYPE "VisibilityLevel" AS ENUM ('public', 'members', 'family', 'branch', 'admin');
CREATE TYPE "WomenDisplayMode" AS ENUM ('under_father', 'with_siblings', 'under_husband', 'hidden');
CREATE TYPE "MemberScope" AS ENUM ('direct', 'clan', 'branch', 'tribe');
CREATE TYPE "ViewRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired');

-- New notification type for non-member view requests (Spec §3·M3.5).
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'view_request_submitted';

-- ---- role_assignments: member scope + anchor person (authorization metadata) ----
ALTER TABLE "role_assignments" ADD COLUMN "member_scope" "MemberScope";
ALTER TABLE "role_assignments" ADD COLUMN "anchor_person_id" UUID;

-- ---- visibility_settings (one row per tenant) ----
CREATE TABLE "visibility_settings" (
  "tenant_id"                    UUID NOT NULL,
  "level"                        "VisibilityLevel" NOT NULL DEFAULT 'members',
  "women_display"                "WomenDisplayMode" NOT NULL DEFAULT 'with_siblings',
  "show_photos"                  BOOLEAN NOT NULL DEFAULT true,
  "show_phones"                  BOOLEAN NOT NULL DEFAULT false,
  "show_birth_dates"             BOOLEAN NOT NULL DEFAULT true,
  "show_deceased"                BOOLEAN NOT NULL DEFAULT true,
  "show_minors"                  BOOLEAN NOT NULL DEFAULT true,
  "show_documents"               BOOLEAN NOT NULL DEFAULT false,
  "default_member_scope"         "MemberScope" NOT NULL DEFAULT 'tribe',
  "require_id_for_view_request"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visibility_settings_pkey" PRIMARY KEY ("tenant_id")
);
ALTER TABLE "visibility_settings"
  ADD CONSTRAINT "visibility_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- view_requests ----
CREATE TABLE "view_requests" (
  "id"                UUID NOT NULL,
  "tenant_id"         UUID NOT NULL,
  "full_name"         TEXT NOT NULL,
  "phone"             TEXT NOT NULL,
  "alleged_branch"    TEXT,
  "reason"            TEXT NOT NULL,
  "id_attachment_key" TEXT,
  "status"            "ViewRequestStatus" NOT NULL DEFAULT 'pending',
  "reviewed_by"       UUID,
  "granted_user_id"   UUID,
  "valid_to"          TIMESTAMP(3),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "view_requests_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "view_requests"
  ADD CONSTRAINT "view_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "view_requests_tenant_id_status_idx" ON "view_requests" ("tenant_id", "status");

-- ---- Grants for the app role (mirrors prior migrations) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON "visibility_settings", "view_requests" TO tftsp_app;

-- ---- RLS: enable + tenant-isolation policy ----
ALTER TABLE "visibility_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "visibility_settings"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE "view_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "view_requests"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);
