-- CreateEnum
CREATE TYPE "ReliabilityCaseKind" AS ENUM ('FreeCancellation', 'LateCancellation', 'VeryLateCancellation', 'NoShow', 'Punctuality', 'LateArrival');

-- CreateEnum
CREATE TYPE "ReliabilityCaseStatus" AS ENUM ('Pending', 'Applied', 'Exempt', 'Rejected', 'Reversed');

-- CreateTable
CREATE TABLE "ReliabilityAccount" (
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "bookingRestrictedUntil" TIMESTAMPTZ(3),
    "suspendedUntil" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReliabilityAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ReliabilityCase" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "kind" "ReliabilityCaseKind" NOT NULL,
    "status" "ReliabilityCaseStatus" NOT NULL DEFAULT 'Pending',
    "reason" TEXT NOT NULL,
    "dispute" TEXT,
    "decisionNote" TEXT,
    "penaltyCredits" INTEGER NOT NULL DEFAULT 0,
    "depositForfeitureCents" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "appliedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReliabilityCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReliabilityEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "caseId" TEXT,
    "kind" TEXT NOT NULL,
    "pointsDelta" INTEGER NOT NULL DEFAULT 0,
    "creditsDelta" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReliabilityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReliabilityAlert" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ReliabilityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingReschedule" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "proposedAt" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingReschedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReliabilityCase_subjectId_status_occurredAt_idx" ON "ReliabilityCase"("subjectId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "ReliabilityCase_status_createdAt_idx" ON "ReliabilityCase"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReliabilityCase_bookingId_subjectId_kind_key" ON "ReliabilityCase"("bookingId", "subjectId", "kind");

-- CreateIndex
CREATE INDEX "ReliabilityEntry_userId_createdAt_idx" ON "ReliabilityEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReliabilityEntry_bookingId_userId_kind_key" ON "ReliabilityEntry"("bookingId", "userId", "kind");

-- CreateIndex
CREATE INDEX "ReliabilityAlert_recipientId_createdAt_idx" ON "ReliabilityAlert"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "BookingReschedule_bookingId_createdAt_idx" ON "BookingReschedule"("bookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReliabilityAccount" ADD CONSTRAINT "ReliabilityAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityCase" ADD CONSTRAINT "ReliabilityCase_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityCase" ADD CONSTRAINT "ReliabilityCase_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityCase" ADD CONSTRAINT "ReliabilityCase_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityCase" ADD CONSTRAINT "ReliabilityCase_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityEntry" ADD CONSTRAINT "ReliabilityEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityEntry" ADD CONSTRAINT "ReliabilityEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityEntry" ADD CONSTRAINT "ReliabilityEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReliabilityCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityAlert" ADD CONSTRAINT "ReliabilityAlert_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilityAlert" ADD CONSTRAINT "ReliabilityAlert_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Enforce the non-cash credit cap even if a future code path makes a mistake.
ALTER TABLE "ReliabilityAccount" ADD CONSTRAINT "ReliabilityAccount_creditBalance_check" CHECK ("creditBalance" BETWEEN -10 AND 0);
ALTER TABLE "ReliabilityAccount" ADD CONSTRAINT "ReliabilityAccount_points_check" CHECK ("points" >= 0);
ALTER TABLE "ReliabilityCase" ADD CONSTRAINT "ReliabilityCase_penalty_check" CHECK ("penaltyCredits" BETWEEN 0 AND 3 AND "depositForfeitureCents" >= 0);
ALTER TABLE "BookingReschedule" ADD CONSTRAINT "BookingReschedule_status_check" CHECK ("status" IN ('Pending', 'Accepted', 'Declined', 'Cancelled'));
