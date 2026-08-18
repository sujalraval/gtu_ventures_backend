-- AlterTable
ALTER TABLE "Event" ADD COLUMN "registrationFields" JSONB;

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "customFields" JSONB;
