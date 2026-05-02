-- CreateTable
CREATE TABLE "property_activity" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_name" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_property_activity_property_created" ON "property_activity"("property_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "property_activity" ADD CONSTRAINT "property_activity_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
