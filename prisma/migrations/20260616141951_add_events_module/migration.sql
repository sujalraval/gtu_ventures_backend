-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('DEMO_DAY', 'INVESTOR_DAY', 'WORKSHOP', 'MASTERCLASS', 'HACKATHON');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventMode" AS ENUM ('IN_PERSON', 'VIRTUAL', 'HYBRID');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "EventMode" NOT NULL DEFAULT 'IN_PERSON',
    "description" TEXT,
    "venue" TEXT,
    "virtualLink" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "registrationDeadline" TIMESTAMP(3),
    "maxAttendees" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "targetCohorts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetSchemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "agenda" JSONB,
    "organiserName" TEXT,
    "organiserEmail" TEXT,
    "createdBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_code_key" ON "Event"("code");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
