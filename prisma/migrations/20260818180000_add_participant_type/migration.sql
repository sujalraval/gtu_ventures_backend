-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "participantType" TEXT NOT NULL DEFAULT 'PARTICIPANT';
ALTER TABLE "EventRegistration" ADD COLUMN "startupName" TEXT;
