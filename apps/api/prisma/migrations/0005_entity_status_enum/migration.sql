CREATE TYPE "entity_status" AS ENUM ('unknown', 'tagged');

ALTER TABLE "entities"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "entity_status" USING "status"::"entity_status",
    ALTER COLUMN "status" SET DEFAULT 'unknown';
