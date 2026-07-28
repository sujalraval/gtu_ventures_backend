-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "milestoneTemplates" JSONB,
ADD COLUMN     "waitlistSettings" JSONB;

-- AlterTable
ALTER TABLE "Scheme" ADD COLUMN     "applicationFormJson" JSONB,
ADD COLUMN     "equityPercentage" DOUBLE PRECISION;
