-- ===========================================================================
-- TFTSP M1 — Row-Level Security, app DB role, and Arabic search infrastructure.
-- This is a CUSTOM migration (Spec Section 4 + 8). It MUST run after 0001_init.
-- Migrations run as the owner role (tftsp); the application connects as
-- tftsp_app which has NO BYPASSRLS, so RLS is always enforced at the DB layer.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 2. Application role (NO BYPASSRLS). Idempotent create.
--    Password must match DATABASE_URL. Change it in production.
-- ---------------------------------------------------------------------------
DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tftsp_app') THEN
    CREATE ROLE tftsp_app LOGIN PASSWORD 'tftsp_app_pw' NOBYPASSRLS;
  END IF;
END
$$;

-- The app role needs DML on all current + future tables/sequences in this schema.
GRANT USAGE ON SCHEMA public TO tftsp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tftsp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tftsp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tftsp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tftsp_app;

-- ---------------------------------------------------------------------------
-- 3. Generated normalized-name column + trigram GIN index on persons (Spec §8).
--    Normalization: hamza forms (أ/إ/آ/ٱ) -> ا, ة -> ه, ى -> ي, strip tatweel
--    and tashkeel (harakat), collapse whitespace, trim. Implemented with a
--    single translate() (source chars past the target string are deleted) so
--    it is IMMUTABLE and usable in a STORED generated column.
-- ---------------------------------------------------------------------------
ALTER TABLE "persons"
  ADD COLUMN "name_normalized" text
  GENERATED ALWAYS AS (
    btrim(
      regexp_replace(
        translate(
          lower(coalesce("full_name", '')),
          -- keep-map (6): أ إ آ ٱ ى ة  ->  ا ا ا ا ي ه
          -- delete (9, no target): tatweel ـ + 8 harakat
          'أإآٱىةـًٌٍَُِّْ',
          'اااايه'
        ),
        '\s+', ' ', 'g'
      )
    )
  ) STORED;

CREATE INDEX "persons_name_normalized_trgm_idx"
  ON "persons" USING GIN ("name_normalized" gin_trgm_ops);

-- Composite index that starts with tenant_id for the common tenant-scoped
-- fuzzy search (Spec §4.1 + §8).
CREATE INDEX "persons_tenant_name_normalized_idx"
  ON "persons" ("tenant_id", "name_normalized");

-- ---------------------------------------------------------------------------
-- 4. Enable RLS on every tenant-scoped table and attach the isolation policy.
--    USING/WITH CHECK: tenant_id = current_setting('app.current_tenant')::uuid.
--    current_setting(..., true) => missing_ok: when unset it returns NULL and
--    the predicate yields NULL (no rows) instead of erroring.
-- ---------------------------------------------------------------------------

-- persons
ALTER TABLE "persons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "persons"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

-- unions
ALTER TABLE "unions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "unions"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

-- person_closures
ALTER TABLE "person_closures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "person_closures"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

-- tribal_units
ALTER TABLE "tribal_units" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tribal_units"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

-- audit_logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

-- NOTE: role_assignments deliberately stays OUT of RLS (Spec §4 vs. the auth
-- bootstrap problem: memberships must be resolvable before a tenant is bound).
-- See DECISIONS D-101. It is only ever read through the auth/PolicyGuard layer.
-- The platform-level tables (tenants, users, refresh_tokens) are also outside RLS.
