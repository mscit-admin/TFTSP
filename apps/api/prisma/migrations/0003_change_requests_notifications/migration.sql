-- ===========================================================================
-- TFTSP M2 — Change Requests, Approval Workflow, Notifications.
-- Adds 4 tenant-scoped tables (all under RLS, tenant_id + composite index) and
-- their enums. Runs after 0002. Migrations run as the owner (tftsp).
-- ===========================================================================

-- ---- Enums ----
CREATE TYPE "ChangeTargetType" AS ENUM ('person', 'union', 'tribal_unit');
CREATE TYPE "ChangeOperation" AS ENUM ('create', 'update', 'delete');
CREATE TYPE "ChangeRequestStatus" AS ENUM (
  'draft', 'submitted', 'under_review', 'approved', 'rejected',
  'changes_requested', 'published', 'conflict', 'expired'
);
CREATE TYPE "ReviewDecision" AS ENUM ('approve', 'reject', 'request_changes');
CREATE TYPE "NotificationType" AS ENUM (
  'change_request_submitted', 'change_request_approved', 'change_request_rejected',
  'change_request_changes_requested', 'change_request_published',
  'change_request_expiring', 'change_request_expired', 'change_request_conflict'
);

-- ---- workflow_settings (one row per tenant) ----
CREATE TABLE "workflow_settings" (
  "tenant_id"          UUID NOT NULL,
  "approvals_required" INTEGER NOT NULL DEFAULT 1,
  "expiry_days"        INTEGER NOT NULL DEFAULT 30,
  "reviewer_can_edit"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workflow_settings_pkey" PRIMARY KEY ("tenant_id")
);
ALTER TABLE "workflow_settings"
  ADD CONSTRAINT "workflow_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- change_requests ----
CREATE TABLE "change_requests" (
  "id"           UUID NOT NULL,
  "tenant_id"    UUID NOT NULL,
  "target_type"  "ChangeTargetType" NOT NULL,
  "target_id"    UUID,
  "operation"    "ChangeOperation" NOT NULL,
  "patch"        JSONB NOT NULL,
  "status"       "ChangeRequestStatus" NOT NULL DEFAULT 'draft',
  "base_version" INTEGER,
  "created_by"   UUID NOT NULL,
  "expires_at"   TIMESTAMP(3) NOT NULL,
  "published_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "change_requests_tenant_id_status_idx" ON "change_requests" ("tenant_id", "status");
CREATE INDEX "change_requests_tenant_id_created_by_idx" ON "change_requests" ("tenant_id", "created_by");
CREATE INDEX "change_requests_tenant_id_expires_at_idx" ON "change_requests" ("tenant_id", "expires_at");

-- ---- change_request_reviews ----
CREATE TABLE "change_request_reviews" (
  "id"                UUID NOT NULL,
  "tenant_id"         UUID NOT NULL,
  "change_request_id" UUID NOT NULL,
  "reviewer_id"       UUID NOT NULL,
  "decision"          "ReviewDecision" NOT NULL,
  "comment"           TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "change_request_reviews_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "change_request_reviews"
  ADD CONSTRAINT "change_request_reviews_change_request_id_fkey"
  FOREIGN KEY ("change_request_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "change_request_reviews_change_request_id_reviewer_id_key"
  ON "change_request_reviews" ("change_request_id", "reviewer_id");
CREATE INDEX "change_request_reviews_tenant_id_change_request_id_idx"
  ON "change_request_reviews" ("tenant_id", "change_request_id");

-- ---- notifications ----
CREATE TABLE "notifications" (
  "id"         UUID NOT NULL,
  "tenant_id"  UUID NOT NULL,
  "user_id"    UUID NOT NULL,
  "type"       "NotificationType" NOT NULL,
  "payload"    JSONB NOT NULL,
  "read_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "notifications_tenant_id_user_id_read_at_idx"
  ON "notifications" ("tenant_id", "user_id", "read_at");
CREATE INDEX "notifications_tenant_id_user_id_created_at_idx"
  ON "notifications" ("tenant_id", "user_id", "created_at");

-- ---- Grants for the app role (explicit, mirrors 0002) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "workflow_settings", "change_requests", "change_request_reviews", "notifications"
  TO tftsp_app;

-- ---- RLS: enable + tenant-isolation policy on every new tenant-scoped table ----
ALTER TABLE "workflow_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workflow_settings"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE "change_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "change_requests"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE "change_request_reviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "change_request_reviews"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notifications"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);
