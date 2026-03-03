-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('WORKSPACE_CREATED', 'GOAL_SELECTED', 'SETUP_COMPLETED', 'FINISHED');

-- CreateEnum
CREATE TYPE "ScreenCountRange" AS ENUM ('ONE_TO_TWO', 'THREE_TO_FIVE', 'SIX_TO_TEN', 'TEN_PLUS');

-- AlterTable
ALTER TABLE "workspaces"
ADD COLUMN "onboarding_step" "OnboardingStep" NOT NULL DEFAULT 'WORKSPACE_CREATED';

-- Backfill onboarding step based on old flag
UPDATE "workspaces"
SET "onboarding_step" = CASE
  WHEN "onboarding_completed" = true THEN 'FINISHED'::"OnboardingStep"
  ELSE 'WORKSPACE_CREATED'::"OnboardingStep"
END;

-- CreateTable
CREATE TABLE "workspace_settings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "screen_count" "ScreenCountRange" NOT NULL,
    "wants_to_sell_immediately" BOOLEAN,
    "has_cnpj" BOOLEAN,
    "cnpj" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_settings_workspace_id_key" ON "workspace_settings"("workspace_id");

-- CreateIndex
CREATE INDEX "workspace_settings_workspace_id_idx" ON "workspace_settings"("workspace_id");

-- AddForeignKey
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
