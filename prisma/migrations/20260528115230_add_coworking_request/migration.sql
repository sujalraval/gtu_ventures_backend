-- AlterTable
ALTER TABLE "StartupApplication" ADD COLUMN     "additionalDocs" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coworkingCredits" DOUBLE PRECISION NOT NULL DEFAULT 10,
ADD COLUMN     "coworkingDailyLimit" DOUBLE PRECISION NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "CoworkingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceType" TEXT NOT NULL,
    "seatsCount" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "justification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoworkingRequest_userId_idx" ON "CoworkingRequest"("userId");

-- AddForeignKey
ALTER TABLE "CoworkingRequest" ADD CONSTRAINT "CoworkingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
