CREATE TABLE "floorplans" (
    "id" TEXT NOT NULL,
    "image_url" TEXT,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "floorplans_pkey" PRIMARY KEY ("id")
);
