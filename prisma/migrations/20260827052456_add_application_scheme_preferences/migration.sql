-- DropForeignKey
ALTER TABLE "StartupApplication" DROP CONSTRAINT "StartupApplication_schemeId_fkey";

-- AddForeignKey
ALTER TABLE "StartupApplication" ADD CONSTRAINT "StartupApplication_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
