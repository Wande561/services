ALTER TABLE "Notification" ADD COLUMN "emailSentAt" TIMESTAMP(3);
ALTER TABLE "QuoteAlert" ADD COLUMN "emailSentAt" TIMESTAMP(3);
-- Older alerts were handled by the previous delivery mechanism; do not resend them on rollout.
UPDATE "Notification" SET "emailSentAt" = CURRENT_TIMESTAMP WHERE "kind" = 'AppointmentReminder';
UPDATE "QuoteAlert" SET "emailSentAt" = CURRENT_TIMESTAMP WHERE "dedupeKey" LIKE 'quote-expiry:%';
