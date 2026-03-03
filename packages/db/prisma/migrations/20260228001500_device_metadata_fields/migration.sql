DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceOrientation') THEN
        CREATE TYPE "DeviceOrientation" AS ENUM ('HORIZONTAL', 'VERTICAL');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeviceOperationalStatus') THEN
        CREATE TYPE "DeviceOperationalStatus" AS ENUM ('ACTIVE', 'INACTIVE');
    END IF;
END $$;

ALTER TABLE "devices"
    ADD COLUMN IF NOT EXISTS "orientation" "DeviceOrientation" NOT NULL DEFAULT 'HORIZONTAL',
    ADD COLUMN IF NOT EXISTS "resolution" TEXT NOT NULL DEFAULT 'AUTO',
    ADD COLUMN IF NOT EXISTS "operational_status" "DeviceOperationalStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN NOT NULL DEFAULT false;
