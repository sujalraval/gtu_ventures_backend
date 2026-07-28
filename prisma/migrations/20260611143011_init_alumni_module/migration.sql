-- AlterTable
ALTER TABLE "StartupProfile" ADD COLUMN     "cin" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "differentlyAbled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dpiitCert" TEXT,
ADD COLUMN     "dpiitNumber" TEXT,
ADD COLUMN     "firstGenEntrepreneur" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "founderEducation" TEXT,
ADD COLUMN     "founderLinkedIn" TEXT,
ADD COLUMN     "genderDistribution" JSONB,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "patentsFiled" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priorVentures" TEXT,
ADD COLUMN     "registeredAddress" TEXT,
ADD COLUMN     "techStack" TEXT;

-- CreateTable
CREATE TABLE "StartupFundingHistory" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "roundType" TEXT NOT NULL,
    "amountInr" DOUBLE PRECISION NOT NULL,
    "fundingDate" TIMESTAMP(3) NOT NULL,
    "investors" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StartupFundingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlumniReferral" (
    "id" TEXT NOT NULL,
    "referredBy" TEXT NOT NULL,
    "referredName" TEXT NOT NULL,
    "referredEmail" TEXT NOT NULL,
    "referredStartupName" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "note" TEXT,
    "targetCohortId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "statusNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlumniSuccessStory" (
    "id" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "startupName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "externalUrl" TEXT,
    "amount" DOUBLE PRECISION,
    "mediaOutlet" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniSuccessStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlumniEngagementFlag" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT,
    "alumniName" TEXT NOT NULL,
    "sector" TEXT,
    "types" TEXT[],
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniEngagementFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlumniKpiSnapshot" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT,
    "alumniName" TEXT NOT NULL,
    "sector" TEXT,
    "cohort" TEXT,
    "snapshotYear" INTEGER NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employees" INTEGER NOT NULL DEFAULT 0,
    "fundingRaised" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customers" INTEGER NOT NULL DEFAULT 0,
    "patentsFiled" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlumniKpiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StartupFundingHistory_profileId_idx" ON "StartupFundingHistory"("profileId");

-- CreateIndex
CREATE INDEX "StartupFundingHistory_deletedAt_idx" ON "StartupFundingHistory"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniKpiSnapshot_alumniName_snapshotYear_snapshotType_key" ON "AlumniKpiSnapshot"("alumniName", "snapshotYear", "snapshotType");

-- CreateIndex
CREATE INDEX "StartupProfile_deletedAt_idx" ON "StartupProfile"("deletedAt");

-- AddForeignKey
ALTER TABLE "StartupFundingHistory" ADD CONSTRAINT "StartupFundingHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StartupProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
