-- CreateTable
CREATE TABLE "property_members" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invited_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_property_members_property_id" ON "property_members"("property_id");

-- CreateIndex
CREATE INDEX "idx_property_members_user_id" ON "property_members"("user_id");

-- CreateIndex
CREATE INDEX "idx_property_members_email" ON "property_members"("email");

-- CreateIndex
CREATE INDEX "idx_property_members_status" ON "property_members"("status");

-- CreateUniqueIndex: one active record per (property, user)
CREATE UNIQUE INDEX "uq_property_members_property_user" ON "property_members"("property_id", "user_id") WHERE "user_id" IS NOT NULL;

-- CreateUniqueIndex: one pending invite per (property, email)
CREATE UNIQUE INDEX "uq_property_members_property_email" ON "property_members"("property_id", "email");

-- AddForeignKey
ALTER TABLE "property_members" ADD CONSTRAINT "property_members_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
