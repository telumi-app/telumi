-- CreateEnum
CREATE TYPE "DeviceEventType" AS ENUM ('CRASH_LOOP', 'DOWNLOAD_FAILED', 'ASSET_CORRUPTED', 'LOW_STORAGE', 'NO_CONTENT_UPDATE', 'PLAYER_STARTED', 'PLAYER_STOPPED', 'NETWORK_DOWN', 'NETWORK_RESTORED');

-- CreateEnum
CREATE TYPE "DeviceEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PlayDeliveryStatus" AS ENUM ('ONLINE_VERIFIED', 'OFFLINE_SYNCED', 'NOT_ELIGIBLE', 'REJECTED');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "device_secret" TEXT,
ADD COLUMN     "is_partner_tv" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partner_name" TEXT,
ADD COLUMN     "partner_revenue_share_pct" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "device_events" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "event_type" "DeviceEventType" NOT NULL,
    "severity" "DeviceEventSeverity" NOT NULL DEFAULT 'INFO',
    "message" TEXT,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "play_events" (
    "id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "play_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "asset_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "manifest_version" TEXT,
    "asset_hash" TEXT,
    "hmac_signature" TEXT,
    "delivery_status" "PlayDeliveryStatus" NOT NULL DEFAULT 'ONLINE_VERIFIED',
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "play_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_events_device_id_event_type_occurred_at_idx" ON "device_events"("device_id", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "device_events_device_id_dedupe_key_idx" ON "device_events"("device_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "play_events_play_id_key" ON "play_events"("play_id");

-- CreateIndex
CREATE INDEX "play_events_device_id_started_at_idx" ON "play_events"("device_id", "started_at");

-- CreateIndex
CREATE INDEX "play_events_campaign_id_idx" ON "play_events"("campaign_id");

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_events" ADD CONSTRAINT "play_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
