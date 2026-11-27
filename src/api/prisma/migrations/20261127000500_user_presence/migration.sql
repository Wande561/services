ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMPTZ(3);
ALTER TABLE "Session" ADD COLUMN "lastActiveAt" TIMESTAMPTZ(3);
CREATE INDEX "Session_userId_lastActiveAt_idx" ON "Session"("userId", "lastActiveAt");
