-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_categories_user_id" ON "categories"("user_id");

-- CreateIndex
CREATE INDEX "idx_categories_is_system" ON "categories"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "uq_categories_slug_user" ON "categories"("slug", "user_id");

-- Seed system default categories
INSERT INTO "categories" ("id", "slug", "name", "icon", "is_system", "user_id", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'appliance', 'Appliance', 'cooking-pot', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'automotive', 'Automotive', 'car', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'hvac', 'HVAC', 'thermometer', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'plumbing', 'Plumbing', 'droplets', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'electrical', 'Electrical', 'zap', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'structure', 'Structure', 'building', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'exterior', 'Exterior', 'trees', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'furniture', 'Furniture', 'armchair', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'electronics', 'Electronics', 'monitor', true, NULL, NOW(), NOW()),
  (gen_random_uuid(), 'other', 'Other', 'box', true, NULL, NOW(), NOW());
