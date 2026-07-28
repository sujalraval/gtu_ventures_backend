/*
  Warnings:

  - The values [EARLY_TRACTION,SCALING] on the enum `StartupStage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StartupStage_new" AS ENUM ('IDEA', 'PROTOTYPE', 'MVP', 'REVENUE', 'SCALE');
ALTER TABLE "StartupApplication" ALTER COLUMN "stage" TYPE "StartupStage_new" USING ("stage"::text::"StartupStage_new");
ALTER TYPE "StartupStage" RENAME TO "StartupStage_old";
ALTER TYPE "StartupStage_new" RENAME TO "StartupStage";
DROP TYPE "public"."StartupStage_old";
COMMIT;
