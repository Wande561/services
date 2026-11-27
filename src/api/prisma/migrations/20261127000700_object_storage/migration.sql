ALTER TABLE "ListingPhoto"
  ADD COLUMN "storageKey" TEXT,
  ALTER COLUMN "image" DROP NOT NULL;

ALTER TABLE "QuotePhoto"
  ADD COLUMN "storageKey" TEXT,
  ALTER COLUMN "data" DROP NOT NULL;

ALTER TABLE "PortfolioItem"
  ADD COLUMN "storageKey" TEXT,
  ALTER COLUMN "image" DROP NOT NULL;

ALTER TABLE "VerificationDocument"
  ADD COLUMN "storageKey" TEXT,
  ALTER COLUMN "data" DROP NOT NULL;
