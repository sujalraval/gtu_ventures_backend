-- CreateEnum
CREATE TYPE "EventAnnouncementType" AS ENUM ('EVENT', 'SESSION', 'PROGRAM', 'GENERAL');

-- CreateEnum
CREATE TYPE "RSVPStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

-- CreateTable
CREATE TABLE "EventAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "EventAnnouncementType" NOT NULL DEFAULT 'GENERAL',
    "scheduledAt" TIMESTAMP(3),
    "durationMin" INTEGER,
    "location" TEXT,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "maxSeats" INTEGER,
    "targetCohort" TEXT,
    "speakerName" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EventAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAnnouncementRSVP" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "status" "RSVPStatus" NOT NULL DEFAULT 'GOING',
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAnnouncementRSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAnnouncementFeedback" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "startupName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAnnouncementFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventAnnouncement_type_idx" ON "EventAnnouncement"("type");

-- CreateIndex
CREATE INDEX "EventAnnouncement_createdBy_idx" ON "EventAnnouncement"("createdBy");

-- CreateIndex
CREATE INDEX "EventAnnouncement_deletedAt_idx" ON "EventAnnouncement"("deletedAt");

-- CreateIndex
CREATE INDEX "EventAnnouncementRSVP_announcementId_idx" ON "EventAnnouncementRSVP"("announcementId");

-- CreateIndex
CREATE INDEX "EventAnnouncementRSVP_startupId_idx" ON "EventAnnouncementRSVP"("startupId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAnnouncementRSVP_announcementId_startupId_key" ON "EventAnnouncementRSVP"("announcementId", "startupId");

-- CreateIndex
CREATE INDEX "EventAnnouncementFeedback_announcementId_idx" ON "EventAnnouncementFeedback"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAnnouncementFeedback_announcementId_startupId_key" ON "EventAnnouncementFeedback"("announcementId", "startupId");

-- AddForeignKey
ALTER TABLE "EventAnnouncement" ADD CONSTRAINT "EventAnnouncement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAnnouncementRSVP" ADD CONSTRAINT "EventAnnouncementRSVP_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "EventAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAnnouncementRSVP" ADD CONSTRAINT "EventAnnouncementRSVP_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAnnouncementFeedback" ADD CONSTRAINT "EventAnnouncementFeedback_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "EventAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAnnouncementFeedback" ADD CONSTRAINT "EventAnnouncementFeedback_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
