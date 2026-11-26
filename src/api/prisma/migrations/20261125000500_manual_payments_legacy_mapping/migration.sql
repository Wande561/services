-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'BankTransfer', 'CardInPerson');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'PaymentRecorded';
ALTER TYPE "NotificationKind" ADD VALUE 'PaymentVoided';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "maxPriceCents" INTEGER,
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "priceUnit" "PriceUnit";

-- CreateTable
CREATE TABLE "LegacyIdentity" (
    "source" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LegacyIdentity_pkey" PRIMARY KEY ("source","principal")
);

-- CreateTable
CREATE TABLE "BookingPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BookingPayment_amount_check" CHECK ("amountCents" > 0)
);

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_listing_price_check" CHECK (
    ("priceCents" IS NULL AND "maxPriceCents" IS NULL AND "priceUnit" IS NULL)
    OR
    ("priceCents" IS NOT NULL AND "priceCents" >= 0 AND "priceUnit" IS NOT NULL
        AND ("maxPriceCents" IS NULL OR "maxPriceCents" >= "priceCents"))
);

-- CreateIndex
CREATE UNIQUE INDEX "LegacyIdentity_source_userId_key" ON "LegacyIdentity"("source", "userId");

-- CreateIndex
CREATE INDEX "BookingPayment_bookingId_recordedAt_idx" ON "BookingPayment"("bookingId", "recordedAt");

CREATE UNIQUE INDEX "BookingPayment_active_booking_key" ON "BookingPayment"("bookingId") WHERE "voidedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "LegacyIdentity" ADD CONSTRAINT "LegacyIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPayment" ADD CONSTRAINT "BookingPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
