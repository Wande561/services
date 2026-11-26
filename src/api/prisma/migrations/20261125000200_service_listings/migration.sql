-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('PerHour', 'PerSession', 'PerProject', 'PerSquareMeter');

-- CreateTable
CREATE TABLE "ServiceListing" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "location" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "maxPriceCents" INTEGER,
    "priceUnit" "PriceUnit" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceListing_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceListing_price_range_check" CHECK ("priceCents" >= 0 AND ("maxPriceCents" IS NULL OR "maxPriceCents" >= "priceCents"))
);

-- CreateIndex
CREATE INDEX "ServiceListing_providerId_createdAt_idx" ON "ServiceListing"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceListing_isPublished_createdAt_id_idx" ON "ServiceListing"("isPublished", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
