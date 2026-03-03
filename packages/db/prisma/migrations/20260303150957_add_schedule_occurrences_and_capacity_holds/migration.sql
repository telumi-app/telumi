-- CreateEnum
CREATE TYPE "ScheduleOccurrenceStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "CapacityHoldStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'EXPIRED');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "timeline_duration_snapshot_seconds" INTEGER,
ADD COLUMN     "timeline_hash" TEXT;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "fallback_playlist_id" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "date_start" TIMESTAMP(3) NOT NULL,
    "date_end" TIMESTAMP(3) NOT NULL,
    "days_of_week" INTEGER[],
    "windows" JSONB NOT NULL DEFAULT '[]',
    "plays_per_hour" INTEGER NOT NULL,
    "screen_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_occurrences" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "screen_id" TEXT NOT NULL,
    "source_rule_id" TEXT NOT NULL,
    "start_at_utc" TIMESTAMP(3) NOT NULL,
    "end_at_utc" TIMESTAMP(3) NOT NULL,
    "plays_per_hour" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "timeline_duration_snapshot_seconds" INTEGER NOT NULL,
    "status" "ScheduleOccurrenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_holds" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "occurrences_json" JSONB NOT NULL,
    "status" "CapacityHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capacity_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_rules_workspace_id_idx" ON "schedule_rules"("workspace_id");

-- CreateIndex
CREATE INDEX "schedule_rules_campaign_id_idx" ON "schedule_rules"("campaign_id");

-- CreateIndex
CREATE INDEX "schedule_occurrences_screen_id_start_at_utc_idx" ON "schedule_occurrences"("screen_id", "start_at_utc");

-- CreateIndex
CREATE INDEX "schedule_occurrences_screen_id_end_at_utc_idx" ON "schedule_occurrences"("screen_id", "end_at_utc");

-- CreateIndex
CREATE INDEX "schedule_occurrences_campaign_id_idx" ON "schedule_occurrences"("campaign_id");

-- CreateIndex
CREATE INDEX "schedule_occurrences_workspace_id_idx" ON "schedule_occurrences"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "capacity_holds_idempotency_key_key" ON "capacity_holds"("idempotency_key");

-- CreateIndex
CREATE INDEX "capacity_holds_workspace_id_expires_at_idx" ON "capacity_holds"("workspace_id", "expires_at");

-- CreateIndex
CREATE INDEX "capacity_holds_campaign_id_status_idx" ON "capacity_holds"("campaign_id", "status");

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_occurrences" ADD CONSTRAINT "schedule_occurrences_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_occurrences" ADD CONSTRAINT "schedule_occurrences_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_occurrences" ADD CONSTRAINT "schedule_occurrences_screen_id_fkey" FOREIGN KEY ("screen_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_occurrences" ADD CONSTRAINT "schedule_occurrences_source_rule_id_fkey" FOREIGN KEY ("source_rule_id") REFERENCES "schedule_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_holds" ADD CONSTRAINT "capacity_holds_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
