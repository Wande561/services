ALTER TYPE "NotificationKind" ADD VALUE 'ServiceCompletionConfirmation';
ALTER TABLE "Booking" ADD COLUMN "clientCompletedAt" TIMESTAMPTZ(3), ADD COLUMN "providerCompletedAt" TIMESTAMPTZ(3);
CREATE TABLE "ClientReview" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "ClientReview_bookingId_key" ON "ClientReview"("bookingId");
CREATE INDEX "ClientReview_clientId_createdAt_idx" ON "ClientReview"("clientId", "createdAt");
ALTER TABLE "ClientReview" ADD CONSTRAINT "ClientReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientReview" ADD CONSTRAINT "ClientReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
