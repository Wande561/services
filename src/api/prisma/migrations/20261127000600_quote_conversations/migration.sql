ALTER TABLE "Message" ALTER COLUMN "bookingId" DROP NOT NULL, ADD COLUMN "quoteRequestId" TEXT;
ALTER TABLE "Notification" ALTER COLUMN "bookingId" DROP NOT NULL, ADD COLUMN "quoteRequestId" TEXT;
ALTER TABLE "Message" ADD CONSTRAINT "Message_context_check" CHECK (("bookingId" IS NOT NULL) <> ("quoteRequestId" IS NOT NULL));
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_context_check" CHECK (("bookingId" IS NOT NULL) <> ("quoteRequestId" IS NOT NULL));
ALTER TABLE "Message" ADD CONSTRAINT "Message_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Message_quoteRequestId_createdAt_id_idx" ON "Message"("quoteRequestId", "createdAt", "id");
