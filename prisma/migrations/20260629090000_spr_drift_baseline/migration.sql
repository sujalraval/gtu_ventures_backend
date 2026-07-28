-- Baseline: columns added via db push, already exist in DB without defaults
ALTER TABLE "MilestoneTemplate" ADD COLUMN IF NOT EXISTS "sprTypes" TEXT[] NOT NULL;
ALTER TABLE "StartupProgressReport" ADD COLUMN IF NOT EXISTS "slotIndex" INTEGER;
ALTER TABLE "StartupProgressReport" ADD COLUMN IF NOT EXISTS "sprType" TEXT;
