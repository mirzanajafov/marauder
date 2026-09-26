CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "name" TEXT,
    "kind" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "entities_fingerprint_key" ON "entities"("fingerprint");

CREATE TABLE "receivers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "receivers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "positions" (
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entity_id" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "positions_pkey" PRIMARY KEY ("time", "entity_id")
);

CREATE INDEX "positions_entity_id_time_idx" ON "positions"("entity_id", "time");

SELECT create_hypertable('positions', 'time', if_not_exists => TRUE, migrate_data => TRUE);
