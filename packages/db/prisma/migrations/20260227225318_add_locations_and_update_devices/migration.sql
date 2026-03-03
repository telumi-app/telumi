-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "place_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_workspace_id_idx" ON "locations"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_workspace_id_name_key" ON "locations"("workspace_id", "name");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Remove old columns, add new columns
ALTER TABLE "devices" DROP COLUMN IF EXISTS "last_seen_at";
ALTER TABLE "devices" DROP COLUMN IF EXISTS "status";
DROP TYPE IF EXISTS "DeviceStatus";

ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "last_heartbeat" TIMESTAMP(3);
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "pairing_expires_at" TIMESTAMP(3);

-- Add location_id with temporary nullable, then populate and make NOT NULL
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "location_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "devices_location_id_idx" ON "devices"("location_id");

-- CreateIndex (unique name per workspace)
CREATE UNIQUE INDEX IF NOT EXISTS "devices_workspace_id_name_key" ON "devices"("workspace_id", "name");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
