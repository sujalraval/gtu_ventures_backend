-- AlterTable
ALTER TABLE "Event" ADD COLUMN "certificateTemplate" JSONB;

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "certificateNo" TEXT;
ALTER TABLE "EventRegistration" ADD COLUMN "certificateIssuedAt" TIMESTAMP(3);
ALTER TABLE "EventRegistration" ADD COLUMN "certificateEmailedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_certificateNo_key" ON "EventRegistration"("certificateNo");
