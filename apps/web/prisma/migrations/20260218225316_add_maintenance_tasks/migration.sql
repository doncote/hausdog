-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "item_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "interval_months" INTEGER NOT NULL,
    "next_due_date" TIMESTAMP(3) NOT NULL,
    "last_completed_at" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'user_created',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,

    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_maintenance_tasks_property_id" ON "maintenance_tasks"("property_id");

-- CreateIndex
CREATE INDEX "idx_maintenance_tasks_item_id" ON "maintenance_tasks"("item_id");

-- CreateIndex
CREATE INDEX "idx_maintenance_tasks_next_due_date" ON "maintenance_tasks"("next_due_date");

-- CreateIndex
CREATE INDEX "idx_maintenance_tasks_status" ON "maintenance_tasks"("status");

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
