-- CreateEnum
CREATE TYPE "SprFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY');

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "sprCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sprFrequency" "SprFrequency" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "MilestoneTemplate" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryName" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "durationDays" INTEGER NOT NULL,
    "trancheNumber" INTEGER NOT NULL,
    "sprFrequency" "SprFrequency" NOT NULL DEFAULT 'MONTHLY',
    "sprCount" INTEGER NOT NULL DEFAULT 1,
    "allocatedFundPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilestoneTemplate_grantId_idx" ON "MilestoneTemplate"("grantId");

-- CreateIndex
CREATE INDEX "MilestoneTemplate_trancheNumber_idx" ON "MilestoneTemplate"("trancheNumber");

-- CreateIndex
CREATE INDEX "Milestone_templateId_idx" ON "Milestone"("templateId");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MilestoneTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneTemplate" ADD CONSTRAINT "MilestoneTemplate_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
