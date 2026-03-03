-- CreateEnum
CREATE TYPE "WorkspaceMode" AS ENUM ('INTERNAL', 'MARKETPLACE');

-- AlterTable
ALTER TABLE "workspaces"
ADD COLUMN "mode" "WorkspaceMode" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;
