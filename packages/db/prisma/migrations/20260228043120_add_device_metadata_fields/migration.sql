/*
  Warnings:

  - Made the column `location_id` on table `devices` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "devices" ALTER COLUMN "location_id" SET NOT NULL;
