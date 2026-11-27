ALTER TYPE "ServiceCategory" ADD VALUE IF NOT EXISTS 'Other';
ALTER TABLE "Profile" ADD COLUMN "otherService" TEXT;
