-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('Pending', 'Quoted', 'Accepted', 'Declined', 'RevisionRequested');

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "preferredAt" TIMESTAMPTZ(3) NOT NULL,
    "location" TEXT NOT NULL,
    "additionalInfo" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'Pending',
    "changeRequest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotePhoto" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "QuotePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVersion" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "labourCents" INTEGER NOT NULL,
    "materialsCents" INTEGER NOT NULL,
    "travelCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "appointmentAt" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAlert" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "QuoteAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteRequest_providerId_createdAt_idx" ON "QuoteRequest"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteRequest_clientId_createdAt_idx" ON "QuoteRequest"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "QuotePhoto_requestId_idx" ON "QuotePhoto"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersion_requestId_version_key" ON "QuoteVersion"("requestId", "version");

-- CreateIndex
CREATE INDEX "QuoteAlert_recipientId_createdAt_idx" ON "QuoteAlert"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteAlert_recipientId_readAt_idx" ON "QuoteAlert"("recipientId", "readAt");

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Profile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ServiceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotePhoto" ADD CONSTRAINT "QuotePhoto_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAlert" ADD CONSTRAINT "QuoteAlert_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAlert" ADD CONSTRAINT "QuoteAlert_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_amounts_check" CHECK (
  "labourCents" >= 0 AND "materialsCents" >= 0 AND "travelCents" >= 0
  AND "totalCents"::bigint = "labourCents"::bigint + "materialsCents"::bigint + "travelCents"::bigint
  AND "durationMinutes" BETWEEN 1 AND 10080
);
