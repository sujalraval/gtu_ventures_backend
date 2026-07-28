-- AlterTable
ALTER TABLE "MessageThread" ADD COLUMN     "applicationId" TEXT;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
