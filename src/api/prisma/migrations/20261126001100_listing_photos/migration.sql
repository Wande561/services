CREATE TABLE "ListingPhoto" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "image" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ServiceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ListingPhoto_listingId_createdAt_idx" ON "ListingPhoto"("listingId", "createdAt");
