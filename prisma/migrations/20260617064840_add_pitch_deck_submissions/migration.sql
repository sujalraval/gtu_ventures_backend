-- CreateEnum
CREATE TYPE "PitchDeckStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateTable
CREATE TABLE "PitchDeckSubmission" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "status" "PitchDeckStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reviewerNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitchDeckSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PitchDeckSubmission_eventId_idx" ON "PitchDeckSubmission"("eventId");

-- CreateIndex
CREATE INDEX "PitchDeckSubmission_startupId_idx" ON "PitchDeckSubmission"("startupId");

-- CreateIndex
CREATE INDEX "PitchDeckSubmission_eventId_startupId_idx" ON "PitchDeckSubmission"("eventId", "startupId");

-- AddForeignKey
ALTER TABLE "PitchDeckSubmission" ADD CONSTRAINT "PitchDeckSubmission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchDeckSubmission" ADD CONSTRAINT "PitchDeckSubmission_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchDeckSubmission" ADD CONSTRAINT "PitchDeckSubmission_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
