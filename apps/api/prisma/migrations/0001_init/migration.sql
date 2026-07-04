-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'platform_admin', 'tribe_admin', 'deputy_admin', 'branch_admin', 'reviewer', 'contributor', 'viewer', 'guest');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('tribe', 'branch', 'clan', 'family');

-- CreateEnum
CREATE TYPE "UnionStatus" AS ENUM ('active', 'divorced', 'widowed');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "logo_key" TEXT,
    "primary_color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "tenant_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "tribal_unit_id" UUID,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tribal_units" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "unit_type" "UnitType" NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tribal_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "father_name" TEXT,
    "grandfather_name" TEXT,
    "family_name" TEXT,
    "laqab" TEXT,
    "gender" "Gender" NOT NULL,
    "birth_date" TIMESTAMP(3),
    "birth_place" TEXT,
    "death_date" TIMESTAMP(3),
    "death_place" TEXT,
    "is_deceased" BOOLEAN NOT NULL DEFAULT false,
    "father_id" UUID,
    "mother_id" UUID,
    "tribal_unit_id" UUID,
    "profession" TEXT,
    "photo_key" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'published',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "husband_id" UUID NOT NULL,
    "wife_id" UUID NOT NULL,
    "marriage_date" TIMESTAMP(3),
    "status" "UnionStatus" NOT NULL DEFAULT 'active',
    "end_date" TIMESTAMP(3),
    "end_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_closures" (
    "tenant_id" UUID NOT NULL,
    "ancestor_id" UUID NOT NULL,
    "descendant_id" UUID NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "person_closures_pkey" PRIMARY KEY ("ancestor_id","descendant_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "role_assignments_tenant_id_user_id_idx" ON "role_assignments"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "role_assignments_user_id_idx" ON "role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "tribal_units_tenant_id_parent_id_idx" ON "tribal_units"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "persons_tenant_id_father_id_idx" ON "persons"("tenant_id", "father_id");

-- CreateIndex
CREATE INDEX "persons_tenant_id_mother_id_idx" ON "persons"("tenant_id", "mother_id");

-- CreateIndex
CREATE INDEX "persons_tenant_id_tribal_unit_id_idx" ON "persons"("tenant_id", "tribal_unit_id");

-- CreateIndex
CREATE INDEX "persons_tenant_id_deleted_at_idx" ON "persons"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "unions_tenant_id_husband_id_idx" ON "unions"("tenant_id", "husband_id");

-- CreateIndex
CREATE INDEX "unions_tenant_id_wife_id_idx" ON "unions"("tenant_id", "wife_id");

-- CreateIndex
CREATE INDEX "person_closures_tenant_id_descendant_id_idx" ON "person_closures"("tenant_id", "descendant_id");

-- CreateIndex
CREATE INDEX "person_closures_tenant_id_ancestor_id_idx" ON "person_closures"("tenant_id", "ancestor_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_tribal_unit_id_fkey" FOREIGN KEY ("tribal_unit_id") REFERENCES "tribal_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tribal_units" ADD CONSTRAINT "tribal_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tribal_units" ADD CONSTRAINT "tribal_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tribal_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_tribal_unit_id_fkey" FOREIGN KEY ("tribal_unit_id") REFERENCES "tribal_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_father_id_fkey" FOREIGN KEY ("father_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_mother_id_fkey" FOREIGN KEY ("mother_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unions" ADD CONSTRAINT "unions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unions" ADD CONSTRAINT "unions_husband_id_fkey" FOREIGN KEY ("husband_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unions" ADD CONSTRAINT "unions_wife_id_fkey" FOREIGN KEY ("wife_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_closures" ADD CONSTRAINT "person_closures_ancestor_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_closures" ADD CONSTRAINT "person_closures_descendant_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

