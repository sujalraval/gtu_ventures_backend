-- Alumni module: add soft-delete columns and performance indexes

ALTER TABLE "AlumniSuccessStory"  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "AlumniReferral"      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "AlumniEngagementFlag" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "AlumniKpiSnapshot"   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "AlumniSuccessStory_deletedAt_idx"   ON "AlumniSuccessStory"("deletedAt");
CREATE INDEX IF NOT EXISTS "AlumniSuccessStory_startupId_idx"   ON "AlumniSuccessStory"("startupId");
CREATE INDEX IF NOT EXISTS "AlumniReferral_deletedAt_idx"       ON "AlumniReferral"("deletedAt");
CREATE INDEX IF NOT EXISTS "AlumniReferral_status_idx"          ON "AlumniReferral"("status");
CREATE INDEX IF NOT EXISTS "AlumniEngagementFlag_deletedAt_idx" ON "AlumniEngagementFlag"("deletedAt");
CREATE INDEX IF NOT EXISTS "AlumniEngagementFlag_status_idx"    ON "AlumniEngagementFlag"("status");
CREATE INDEX IF NOT EXISTS "AlumniKpiSnapshot_deletedAt_idx"    ON "AlumniKpiSnapshot"("deletedAt");
CREATE INDEX IF NOT EXISTS "AlumniKpiSnapshot_alumniId_idx"     ON "AlumniKpiSnapshot"("alumniId");
