-- Preserve any previously supplied branch codes while removing the requirement.
ALTER TABLE "QuoteVersion" DROP CONSTRAINT "QuoteVersion_deposit_terms_check";
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_deposit_terms_check" CHECK (
  (NOT "depositRequired" AND "depositCents" IS NULL AND "bankName" IS NULL AND "accountNumber" IS NULL AND "paymentReference" IS NULL)
  OR ("depositRequired" AND "depositCents" IS NOT NULL AND "depositCents" > 0
    AND "depositCents"::bigint = ("totalCents"::bigint + 2) / 4
    AND "bankName" IS NOT NULL AND "accountNumber" IS NOT NULL AND "paymentReference" IS NOT NULL)
);
