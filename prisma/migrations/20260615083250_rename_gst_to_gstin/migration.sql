/*
  Warnings:

  - You are about to drop the column `gst` on the `StartupApplication` table. All the data in the column will be lost.
  - You are about to drop the column `hasGst` on the `StartupApplication` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StartupApplication" DROP COLUMN "gst",
DROP COLUMN "hasGst",
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "hasGstin" TEXT;
