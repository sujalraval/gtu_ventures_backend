-- CreateTable
CREATE TABLE "EventScheduleSlot" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "pitchDeckId" TEXT,
    "position" INTEGER NOT NULL,
    "scheduledTime" TIMESTAMP(3),
    "durationMins" INTEGER NOT NULL DEFAULT 10,
    "bufferMins" INTEGER NOT NULL DEFAULT 5,
    "notes" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventScheduleSlot_pitchDeckId_key" ON "EventScheduleSlot"("pitchDeckId");

-- CreateIndex
CREATE INDEX "EventScheduleSlot_eventId_idx" ON "EventScheduleSlot"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventScheduleSlot_eventId_position_key" ON "EventScheduleSlot"("eventId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "EventScheduleSlot_eventId_startupId_key" ON "EventScheduleSlot"("eventId", "startupId");

-- AddForeignKey
ALTER TABLE "EventScheduleSlot" ADD CONSTRAINT "EventScheduleSlot_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventScheduleSlot" ADD CONSTRAINT "EventScheduleSlot_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventScheduleSlot" ADD CONSTRAINT "EventScheduleSlot_pitchDeckId_fkey" FOREIGN KEY ("pitchDeckId") REFERENCES "PitchDeckSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
