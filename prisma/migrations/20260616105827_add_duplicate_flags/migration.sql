-- AlterTable
ALTER TABLE "StartupApplication" ADD COLUMN     "duplicateApplicationIds" TEXT[],
ADD COLUMN     "isDuplicateFlagged" BOOLEAN NOT NULL DEFAULT false;
