-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "objective" TEXT;

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "frequency_per_hour" INTEGER NOT NULL DEFAULT 4;
