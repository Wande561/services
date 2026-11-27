-- Earlier installations of the notification migration may not contain these fields.
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "quoteReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "QuoteAlert" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "QuoteAlert_dedupeKey_key" ON "QuoteAlert"("dedupeKey");
