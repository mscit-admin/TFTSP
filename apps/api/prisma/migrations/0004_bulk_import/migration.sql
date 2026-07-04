-- ===========================================================================
-- TFTSP M2.5 — Bulk Import. Staging tables (import_batches, import_rows) under
-- RLS, plus Person.import_batch_id traceability, Tenant.max_persons plan stand-in,
-- and the import_batch change-request target type. Runs after 0003 as owner (tftsp).
-- ===========================================================================

-- ---- Enums ----
CREATE TYPE "ImportFileFormat" AS ENUM ('xlsx', 'csv');
CREATE TYPE "ImportBatchStatus" AS ENUM (
  'uploaded', 'parsing', 'validating', 'resolving', 'preview',
  'submitted', 'published', 'rejected', 'rolled_back', 'failed'
);
CREATE TYPE "ImportRowStatus" AS ENUM ('valid', 'error', 'duplicate_candidate', 'ambiguous');
CREATE TYPE "ImportRowDecision" AS ENUM ('new', 'merge', 'ignore');

-- New change-request target type for the batch-as-one-CR flow (Spec §12).
ALTER TYPE "ChangeTargetType" ADD VALUE IF NOT EXISTS 'import_batch';

-- ---- Platform column: plan-limit stand-in (Free = 500), see DECISIONS D-301 ----
ALTER TABLE "tenants" ADD COLUMN "max_persons" INTEGER NOT NULL DEFAULT 500;

-- ---- Person traceability tag ----
ALTER TABLE "persons" ADD COLUMN "import_batch_id" UUID;
CREATE INDEX "persons_tenant_id_import_batch_id_idx"
  ON "persons" ("tenant_id", "import_batch_id");

-- ---- import_batches ----
CREATE TABLE "import_batches" (
  "id"                UUID NOT NULL,
  "tenant_id"         UUID NOT NULL,
  "filename"          TEXT NOT NULL,
  "file_key"          TEXT NOT NULL,
  "format"            "ImportFileFormat" NOT NULL,
  "status"            "ImportBatchStatus" NOT NULL DEFAULT 'uploaded',
  "progress"          INTEGER NOT NULL DEFAULT 0,
  "counts"            JSONB NOT NULL DEFAULT '{}',
  "change_request_id" UUID,
  "error"             TEXT,
  "created_by"        UUID NOT NULL,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "import_batches_tenant_id_status_idx" ON "import_batches" ("tenant_id", "status");
CREATE INDEX "import_batches_tenant_id_created_by_idx" ON "import_batches" ("tenant_id", "created_by");

-- ---- import_rows ----
CREATE TABLE "import_rows" (
  "id"                 UUID NOT NULL,
  "tenant_id"          UUID NOT NULL,
  "import_batch_id"    UUID NOT NULL,
  "row_ref"            TEXT NOT NULL,
  "row_number"         INTEGER NOT NULL,
  "raw"                JSONB NOT NULL,
  "status"             "ImportRowStatus" NOT NULL DEFAULT 'valid',
  "errors"             JSONB NOT NULL DEFAULT '[]',
  "resolved_father_id" UUID,
  "resolved_mother_id" UUID,
  "resolved_spouse_id" UUID,
  "duplicate_of_id"    UUID,
  "similarity"         DOUBLE PRECISION,
  "decision"           "ImportRowDecision" NOT NULL DEFAULT 'new',
  "merge_target_id"    UUID,
  "created_person_id"  UUID,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "import_rows"
  ADD CONSTRAINT "import_rows_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "import_rows_tenant_id_import_batch_id_status_idx"
  ON "import_rows" ("tenant_id", "import_batch_id", "status");
CREATE INDEX "import_rows_import_batch_id_row_ref_idx"
  ON "import_rows" ("import_batch_id", "row_ref");

-- ---- Grants for the app role (mirrors 0002/0003) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON "import_batches", "import_rows" TO tftsp_app;

-- ---- RLS: enable + tenant-isolation policy on the staging tables ----
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "import_batches"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE "import_rows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "import_rows"
  USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant', true)::uuid);
