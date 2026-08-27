-- Multiple scheme selection.
--
-- A startup may now ask to be considered for several schemes. An admin picks
-- one during onboarding, which is what sets StartupApplication.schemeId.
-- schemeId keeps its existing meaning — "the scheme this application proceeds
-- in" — so agreements, grants, cohorts and milestones are untouched.

-- CreateEnum
CREATE TYPE "SchemePreferenceStatus" AS ENUM ('REQUESTED', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApplicationIntent" AS ENUM ('SCHEME_ONLY', 'SCHEME_WITH_SPACE', 'SPACE_ONLY');

-- AlterTable
ALTER TABLE "StartupApplication"
  ADD COLUMN "intent" "ApplicationIntent" NOT NULL DEFAULT 'SCHEME_ONLY';

-- A startup applying for incubation space only has no scheme, so schemeId can
-- no longer be NOT NULL. Until now the code wrote a '00000000-…' sentinel in
-- that case — a foreign key pointing at a Scheme row that does not exist.
ALTER TABLE "StartupApplication"
  ALTER COLUMN "schemeId" DROP NOT NULL;

-- Replace any sentinel already stored with a real NULL, so "no scheme" has one
-- representation rather than two.
UPDATE "StartupApplication"
   SET "schemeId" = NULL
 WHERE "schemeId" = '00000000-0000-0000-0000-000000000000';

-- CreateTable
CREATE TABLE "ApplicationSchemePreference" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "SchemePreferenceStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationSchemePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSchemePreference_applicationId_schemeId_key"
  ON "ApplicationSchemePreference"("applicationId", "schemeId");

-- CreateIndex
CREATE INDEX "ApplicationSchemePreference_schemeId_idx"
  ON "ApplicationSchemePreference"("schemeId");

-- CreateIndex
CREATE INDEX "ApplicationSchemePreference_applicationId_status_idx"
  ON "ApplicationSchemePreference"("applicationId", "status");

-- AddForeignKey
ALTER TABLE "ApplicationSchemePreference"
  ADD CONSTRAINT "ApplicationSchemePreference_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSchemePreference"
  ADD CONSTRAINT "ApplicationSchemePreference_schemeId_fkey"
  FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSchemePreference"
  ADD CONSTRAINT "ApplicationSchemePreference_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing application already has exactly one scheme, and it
-- is by definition the one it is proceeding in. Without this, existing
-- applications would show an empty preference list in the admin UI and look
-- like they had never chosen a scheme.
--
-- Skipped for the '00000000-0000-0000-0000-000000000000' sentinel that
-- applications.service.ts writes when no scheme was picked, and for any
-- schemeId with no matching Scheme row, which would violate the new FK.
INSERT INTO "ApplicationSchemePreference"
  ("id", "applicationId", "schemeId", "priority", "status", "decidedAt", "createdAt", "updatedAt")
SELECT
  -- Plain text id rather than gen_random_uuid(), which needs PG13+ or the
  -- pgcrypto extension — matching 20260818170000. The column is TEXT, and
  -- a."id" is unique, so the result is too.
  md5(a."id" || '-scheme-pref'),
  a."id",
  a."schemeId",
  0,
  'SELECTED'::"SchemePreferenceStatus",
  a."approvedAt",
  a."createdAt",
  CURRENT_TIMESTAMP
FROM "StartupApplication" a
JOIN "Scheme" s ON s."id" = a."schemeId"
WHERE a."schemeId" <> '00000000-0000-0000-0000-000000000000'
ON CONFLICT ("applicationId", "schemeId") DO NOTHING;
