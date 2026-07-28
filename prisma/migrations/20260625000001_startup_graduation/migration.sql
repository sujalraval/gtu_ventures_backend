-- Startup graduation: track when and by whom a startup was graduated to alumni status

ALTER TABLE "StartupApplication"
  ADD COLUMN IF NOT EXISTS "graduatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "graduatedBy" TEXT;

CREATE INDEX IF NOT EXISTS "StartupApplication_graduatedAt_idx" ON "StartupApplication"("graduatedAt");
