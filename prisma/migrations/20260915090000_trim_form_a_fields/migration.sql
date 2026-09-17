-- Form A is cut down to nine fields: startup name, founder name, contact
-- number, email, registered entity type, sector, stage, brief and pitchdeck.
-- Everything else it used to ask now belongs to Form B.
--
-- The columns stay on StartupApplication rather than moving to
-- ApplicationFormB, so no existing data has to be relocated. Form B already
-- syncs values back to this table (see submitFormB), so it is the natural
-- home; only the NOT NULL constraints have to go.
--
-- They were non-null only because submitFormA padded them with '' — and with
-- new Date() for dob, meaning every application on record has a date of birth
-- of whenever the draft was first saved. Nullable is the honest shape.

ALTER TABLE "StartupApplication"
  ALTER COLUMN "designation"          DROP NOT NULL,
  ALTER COLUMN "aadhaar"              DROP NOT NULL,
  ALTER COLUMN "gender"               DROP NOT NULL,
  ALTER COLUMN "dob"                  DROP NOT NULL,
  ALTER COLUMN "highestQualification" DROP NOT NULL,
  ALTER COLUMN "fromInstitution"      DROP NOT NULL,
  ALTER COLUMN "addressLine"          DROP NOT NULL,
  ALTER COLUMN "city"                 DROP NOT NULL,
  ALTER COLUMN "district"             DROP NOT NULL,
  ALTER COLUMN "state"                DROP NOT NULL,
  ALTER COLUMN "pinCode"              DROP NOT NULL,
  ALTER COLUMN "problemStmt"          DROP NOT NULL,
  ALTER COLUMN "solution"             DROP NOT NULL;

-- Clear the padding so "not answered yet" reads as NULL rather than an empty
-- string that looks like a real answer in the admin review screen.
UPDATE "StartupApplication" SET "designation"          = NULL WHERE "designation"          = '';
UPDATE "StartupApplication" SET "aadhaar"              = NULL WHERE "aadhaar"              = '';
UPDATE "StartupApplication" SET "gender"               = NULL WHERE "gender"               = '';
UPDATE "StartupApplication" SET "highestQualification" = NULL WHERE "highestQualification" = '';
UPDATE "StartupApplication" SET "fromInstitution"      = NULL WHERE "fromInstitution"      = '';
UPDATE "StartupApplication" SET "addressLine"          = NULL WHERE "addressLine"          = '';
UPDATE "StartupApplication" SET "city"                 = NULL WHERE "city"                 = '';
UPDATE "StartupApplication" SET "district"             = NULL WHERE "district"             = '';
UPDATE "StartupApplication" SET "state"                = NULL WHERE "state"                = '';
UPDATE "StartupApplication" SET "pinCode"              = NULL WHERE "pinCode"              = '';
UPDATE "StartupApplication" SET "problemStmt"          = NULL WHERE "problemStmt"          = '';
UPDATE "StartupApplication" SET "solution"             = NULL WHERE "solution"             = '';

-- Stage options for the trimmed Form A: Prototype/MVP, Pre Revenue, Growth,
-- Scaling. PROTOTYPE and SCALE already exist and cover two of them; these are
-- the two that do not. Added rather than replaced so existing IDEA / MVP /
-- REVENUE rows stay valid — Postgres cannot remove an enum value in place.
ALTER TYPE "StartupStage" ADD VALUE IF NOT EXISTS 'PRE_REVENUE';
ALTER TYPE "StartupStage" ADD VALUE IF NOT EXISTS 'GROWTH';
