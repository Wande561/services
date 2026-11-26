ALTER TYPE "QuoteStatus" ADD VALUE 'DepositPending';
ALTER TYPE "QuoteStatus" ADD VALUE 'SlotUnavailable';
ALTER TABLE "QuoteRequest" ADD COLUMN "depositCents" INTEGER,
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "branchCode" TEXT,
  ADD COLUMN "accountNumber" TEXT,
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "depositConfirmedAt" TIMESTAMPTZ(3),
  ADD COLUMN "depositConfirmedBy" TEXT,
  ADD CONSTRAINT "QuoteRequest_deposit_check" CHECK ("depositCents" IS NULL OR "depositCents" > 0);
