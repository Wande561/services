CREATE TYPE "VerificationTier" AS ENUM ('Basic', 'IdentityVerified', 'BusinessVerified');
CREATE TYPE "VerificationKind" AS ENUM ('Individual', 'Business');
CREATE TYPE "VerificationReviewStatus" AS ENUM ('Pending', 'Approved', 'Rejected');
ALTER TABLE "User" ADD COLUMN "isVerificationAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN "verificationTier" "VerificationTier" NOT NULL DEFAULT 'Basic';
CREATE TABLE "VerificationSubmission" (
  "id" TEXT NOT NULL, "providerId" TEXT NOT NULL, "kind" "VerificationKind" NOT NULL,
  "status" "VerificationReviewStatus" NOT NULL DEFAULT 'Pending', "legalName" TEXT, "businessName" TEXT,
  "registrationNumber" TEXT, "contactPhone" TEXT NOT NULL, "contactEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMPTZ(3),
  "reviewedById" TEXT, "reviewNote" TEXT, "checks" JSONB, CONSTRAINT "VerificationSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerificationSubmission_providerId_createdAt_idx" ON "VerificationSubmission"("providerId", "createdAt");
CREATE INDEX "VerificationSubmission_status_createdAt_idx" ON "VerificationSubmission"("status", "createdAt");
CREATE UNIQUE INDEX "VerificationSubmission_one_pending" ON "VerificationSubmission"("providerId") WHERE "status" = 'Pending';
ALTER TABLE "VerificationSubmission" ADD CONSTRAINT "VerificationSubmission_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Profile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "VerificationDocument" (
  "id" TEXT NOT NULL, "submissionId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL, "data" BYTEA NOT NULL, CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerificationDocument_submissionId_kind_key" ON "VerificationDocument"("submissionId", "kind");
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "VerificationSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
