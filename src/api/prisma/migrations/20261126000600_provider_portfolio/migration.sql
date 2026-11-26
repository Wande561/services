CREATE TABLE "PortfolioItem" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "image" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PortfolioItem_price_check" CHECK ("priceCents" >= 0)
);
CREATE INDEX "PortfolioItem_providerId_createdAt_idx" ON "PortfolioItem"("providerId", "createdAt");
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
