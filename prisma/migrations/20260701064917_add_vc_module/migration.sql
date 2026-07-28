-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VC';

-- CreateTable
CREATE TABLE "VcFirm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fundName" TEXT NOT NULL,
    "website" TEXT,
    "sebiRegNo" TEXT,
    "headquarters" TEXT,
    "signatoryName" TEXT NOT NULL,
    "signatoryEmail" TEXT NOT NULL,
    "signatoryMobile" TEXT,
    "description" TEXT,
    "minTicket" DOUBLE PRECISION,
    "maxTicket" DOUBLE PRECISION,
    "targetStages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetSectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VcFirm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VcInterest" (
    "id" TEXT NOT NULL,
    "vcFirmId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "pipelineStage" TEXT NOT NULL DEFAULT 'LEAD',
    "ndaAccepted" BOOLEAN NOT NULL DEFAULT false,
    "ndaAcceptedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VcInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VcMeeting" (
    "id" TEXT NOT NULL,
    "vcFirmId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "interestId" TEXT,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "mode" TEXT NOT NULL DEFAULT 'ONLINE',
    "meetingLink" TEXT,
    "calendarLink" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VcMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VcInvestmentOutcome" (
    "id" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "amountInr" DOUBLE PRECISION NOT NULL,
    "instrumentType" TEXT NOT NULL,
    "investorName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VcInvestmentOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VcFirm_userId_key" ON "VcFirm"("userId");

-- CreateIndex
CREATE INDEX "VcFirm_status_idx" ON "VcFirm"("status");

-- CreateIndex
CREATE INDEX "VcInterest_vcFirmId_idx" ON "VcInterest"("vcFirmId");

-- CreateIndex
CREATE INDEX "VcInterest_startupId_idx" ON "VcInterest"("startupId");

-- CreateIndex
CREATE UNIQUE INDEX "VcInterest_vcFirmId_startupId_key" ON "VcInterest"("vcFirmId", "startupId");

-- CreateIndex
CREATE INDEX "VcMeeting_vcFirmId_idx" ON "VcMeeting"("vcFirmId");

-- CreateIndex
CREATE INDEX "VcMeeting_startupId_idx" ON "VcMeeting"("startupId");

-- CreateIndex
CREATE UNIQUE INDEX "VcInvestmentOutcome_interestId_key" ON "VcInvestmentOutcome"("interestId");

-- AddForeignKey
ALTER TABLE "VcFirm" ADD CONSTRAINT "VcFirm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VcInterest" ADD CONSTRAINT "VcInterest_vcFirmId_fkey" FOREIGN KEY ("vcFirmId") REFERENCES "VcFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VcInterest" ADD CONSTRAINT "VcInterest_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VcMeeting" ADD CONSTRAINT "VcMeeting_vcFirmId_fkey" FOREIGN KEY ("vcFirmId") REFERENCES "VcFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VcMeeting" ADD CONSTRAINT "VcMeeting_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VcMeeting" ADD CONSTRAINT "VcMeeting_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "VcInterest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VcInvestmentOutcome" ADD CONSTRAINT "VcInvestmentOutcome_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "VcInterest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
