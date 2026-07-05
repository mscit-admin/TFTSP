-- ===========================================================================
-- TFTSP M4 — Subscriptions, Documents, Crowdsourcing/Reputation, Stats views.
-- Platform tables stay OUTSIDE RLS; new tenant-scoped tables are UNDER RLS.
-- Materialized views back the stats dashboards (refreshed hourly). Runs after 0005.
-- ===========================================================================

-- ---- Enums ----
CREATE TYPE "PlanTier" AS ENUM ('free', 'basic', 'professional', 'enterprise');
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired', 'suspended');
CREATE TYPE "DocumentKind" AS ENUM ('image', 'pdf');
CREATE TYPE "ContributionType" AS ENUM ('add_person', 'edit_data', 'fix_relation', 'upload_document', 'add_source', 'add_biography');
CREATE TYPE "TrustLevel" AS ENUM ('bronze', 'silver', 'gold');

-- ---- Column additions ----
ALTER TABLE "persons" ADD COLUMN "biography" TEXT;
ALTER TABLE "change_requests" ADD COLUMN "contribution_type" "ContributionType";

-- ---- Platform-level: subscriptions (no RLS) ----
CREATE TABLE "tenant_subscriptions" (
  "tenant_id"    UUID NOT NULL,
  "tier"         "PlanTier" NOT NULL DEFAULT 'free',
  "status"       "SubscriptionStatus" NOT NULL DEFAULT 'active',
  "activated_at" TIMESTAMP(3),
  "expires_at"   TIMESTAMP(3),
  "activated_by" UUID,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("tenant_id")
);
ALTER TABLE "tenant_subscriptions"
  ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "subscription_activations" (
  "id"           UUID NOT NULL,
  "tenant_id"    UUID NOT NULL,
  "tier"         "PlanTier" NOT NULL,
  "activated_by" UUID NOT NULL,
  "note"         TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_activations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "subscription_activations"
  ADD CONSTRAINT "subscription_activations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "subscription_activations_tenant_id_created_at_idx" ON "subscription_activations" ("tenant_id", "created_at");

-- ---- Tenant-scoped: person_documents (RLS) ----
CREATE TABLE "person_documents" (
  "id"          UUID NOT NULL,
  "tenant_id"   UUID NOT NULL,
  "person_id"   UUID NOT NULL,
  "kind"        "DocumentKind" NOT NULL,
  "object_key"  TEXT NOT NULL,
  "filename"    TEXT NOT NULL,
  "size_bytes"  INTEGER NOT NULL,
  "uploaded_by" UUID NOT NULL,
  "deleted_at"  TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "person_documents_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "person_documents"
  ADD CONSTRAINT "person_documents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_documents"
  ADD CONSTRAINT "person_documents_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "person_documents_tenant_id_person_id_deleted_at_idx" ON "person_documents" ("tenant_id", "person_id", "deleted_at");

-- ---- Tenant-scoped: reputation (RLS) ----
CREATE TABLE "contributor_reputations" (
  "tenant_id"           UUID NOT NULL,
  "user_id"             UUID NOT NULL,
  "total_contributions" INTEGER NOT NULL DEFAULT 0,
  "accepted"            INTEGER NOT NULL DEFAULT 0,
  "rejected"            INTEGER NOT NULL DEFAULT 0,
  "accuracy_rate"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trust_level"         "TrustLevel" NOT NULL DEFAULT 'bronze',
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contributor_reputations_pkey" PRIMARY KEY ("tenant_id", "user_id")
);
ALTER TABLE "contributor_reputations"
  ADD CONSTRAINT "contributor_reputations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "contributor_reputations_tenant_id_accuracy_rate_idx" ON "contributor_reputations" ("tenant_id", "accuracy_rate");

CREATE TABLE "reputation_thresholds" (
  "tenant_id"                  UUID NOT NULL,
  "silver_min_accepted"        INTEGER NOT NULL DEFAULT 5,
  "gold_min_accepted"          INTEGER NOT NULL DEFAULT 20,
  "silver_min_accuracy"        DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "gold_min_accuracy"          DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  "allow_viewer_contributions" BOOLEAN NOT NULL DEFAULT false,
  "max_pending"                INTEGER NOT NULL DEFAULT 20,
  "created_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                 TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reputation_thresholds_pkey" PRIMARY KEY ("tenant_id")
);
ALTER TABLE "reputation_thresholds"
  ADD CONSTRAINT "reputation_thresholds_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- Grants ----
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "tenant_subscriptions", "subscription_activations",
  "person_documents", "contributor_reputations", "reputation_thresholds"
  TO tftsp_app;

-- ---- RLS on the tenant-scoped tables ----
ALTER TABLE "person_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "person_documents"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE "contributor_reputations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "contributor_reputations"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE "reputation_thresholds" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "reputation_thresholds"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

-- ---- Materialized views for stats dashboards (Spec §3·M4.5) ----
-- Per-tenant person aggregates. Queried by the owner/platform client with an
-- explicit tenant_id filter (matviews carry no RLS); refreshed hourly (BullMQ).
CREATE MATERIALIZED VIEW "tribe_stats_mv" AS
SELECT
  p.tenant_id,
  count(*) FILTER (WHERE p.deleted_at IS NULL)                                AS total_persons,
  count(*) FILTER (WHERE p.deleted_at IS NULL AND p.is_deceased = false)      AS living_persons,
  count(*) FILTER (WHERE p.deleted_at IS NULL AND p.is_deceased = true)       AS deceased_persons,
  count(*) FILTER (WHERE p.deleted_at IS NULL AND p.gender = 'male')          AS male_persons,
  count(*) FILTER (WHERE p.deleted_at IS NULL AND p.gender = 'female')        AS female_persons,
  now()                                                                       AS refreshed_at
FROM persons p
GROUP BY p.tenant_id;
CREATE UNIQUE INDEX "tribe_stats_mv_tenant_id_idx" ON "tribe_stats_mv" ("tenant_id");

CREATE MATERIALIZED VIEW "platform_dashboard_mv" AS
SELECT
  (SELECT count(*) FROM tenants)                                     AS tribes,
  (SELECT count(*) FROM tenants WHERE status = 'active')             AS active_tribes,
  (SELECT count(*) FROM tenants WHERE status = 'suspended')          AS suspended_tribes,
  (SELECT count(*) FROM persons WHERE deleted_at IS NULL)            AS total_persons,
  (SELECT count(*) FROM users)                                       AS total_users,
  now()                                                              AS refreshed_at;

GRANT SELECT ON "tribe_stats_mv", "platform_dashboard_mv" TO tftsp_app;
