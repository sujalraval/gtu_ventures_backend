-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'NEGOTIATING', 'UNDER_REVIEW', 'APPROVED', 'SIGNED', 'EXECUTED', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AssessmentApprovalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "KPIStatus" AS ENUM ('YES', 'NO', 'PENDING', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'AT_RISK');

-- CreateEnum
CREATE TYPE "CoworkingBuildingStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'UNDER_CONSTRUCTION');

-- CreateEnum
CREATE TYPE "CoworkingFloorType" AS ENUM ('MIXED', 'PURE_COWORKING');

-- CreateEnum
CREATE TYPE "CoworkingFloorStatus" AS ENUM ('AVAILABLE', 'FULL', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "CoworkingZoneType" AS ENUM ('OPEN_WORKSPACE', 'PRIVATE_OFFICE', 'MEETING_ZONE', 'ADMINISTRATIVE', 'EVENT_SPACE', 'RECEPTION', 'CAFETERIA', 'PASSAGE_BREAKOUT');

-- CreateEnum
CREATE TYPE "CoworkingResourceType" AS ENUM ('DESK', 'CABIN', 'MEETING_ROOM', 'SOFA', 'STANDUP_TABLE', 'AUDITORIUM_SEAT', 'RECEPTION_DESK');

-- CreateEnum
CREATE TYPE "CoworkingResourceStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MENTOR';
ALTER TYPE "Role" ADD VALUE 'EXPERT';

-- AlterEnum
ALTER TYPE "SchemeStatus" ADD VALUE 'TERMINATED';

-- DropIndex
DROP INDEX "StartupApplication_aadhaar_key";

-- DropIndex
DROP INDEX "StartupApplication_cin_key";

-- DropIndex
DROP INDEX "StartupApplication_dpiitNumber_key";

-- DropIndex
DROP INDEX "StartupApplication_pan_key";

-- DropIndex
DROP INDEX "UserPersonalDetails_aadhaar_key";

-- DropIndex
DROP INDEX "UserPersonalDetails_pan_key";

-- AlterTable
ALTER TABLE "ApplicationFormB" ALTER COLUMN "authorityName" DROP NOT NULL,
ALTER COLUMN "authorityDesignation" DROP NOT NULL,
ALTER COLUMN "authorityEmail" DROP NOT NULL,
ALTER COLUMN "authorityMobile" DROP NOT NULL,
ALTER COLUMN "authorityPan" DROP NOT NULL,
ALTER COLUMN "bankName" DROP NOT NULL,
ALTER COLUMN "branchName" DROP NOT NULL,
ALTER COLUMN "accountNo" DROP NOT NULL,
ALTER COLUMN "ifscCode" DROP NOT NULL,
ALTER COLUMN "accountType" DROP NOT NULL,
ALTER COLUMN "accountHolderName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ApplicationFounder" ADD COLUMN     "degreeCertificate" TEXT,
ADD COLUMN     "degreeName" TEXT,
ADD COLUMN     "lastEducation" TEXT,
ADD COLUMN     "marksheet" TEXT,
ADD COLUMN     "passingYear" TEXT,
ADD COLUMN     "universityName" TEXT,
ADD COLUMN     "whatsapp" TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "designation" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "mobile" DROP NOT NULL,
ALTER COLUMN "pan" DROP NOT NULL,
ALTER COLUMN "aadhaar" DROP NOT NULL,
ALTER COLUMN "address" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ApplicationShareholder" ADD COLUMN     "certificate" TEXT;

-- AlterTable
ALTER TABLE "Grant" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "milestoneTemplates" JSONB;

-- AlterTable
ALTER TABLE "GrantAllocation" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GrantReceipt" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LibraryClause" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RolePermission" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "StartupApplication" ADD COLUMN     "cohortId" TEXT;

-- AlterTable
ALTER TABLE "StartupProfile" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserBankDetails" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserRole" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AllocationHeadMaster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AllocationHeadMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "domain" TEXT,
    "budget" DOUBLE PRECISION,
    "schemeId" TEXT NOT NULL,
    "managerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "isPresent" BOOLEAN NOT NULL DEFAULT false,
    "markedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "CohortAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMeeting" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "instructorId" TEXT,
    "meetingLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMember" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMentor" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Advisor',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortMentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortModule" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortSubmission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "fileUrl" TEXT,
    "linkUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "reviewerRemarks" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortTask" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "submissionType" TEXT NOT NULL DEFAULT 'File',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedAgreement" (
    "id" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "executionDate" TIMESTAMP(3),
    "validityStart" TIMESTAMP(3),
    "validityEnd" TIMESTAMP(3),
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "undertakingNumber" TEXT,
    "undertakingDate" TIMESTAMP(3),
    "incubationType" TEXT,
    "incubationStartDate" TIMESTAMP(3),
    "incubationDuration" INTEGER,
    "sanctionedAmount" DOUBLE PRECISION DEFAULT 0,
    "disbursementMode" TEXT,
    "variables" JSONB NOT NULL,
    "workflowStatus" JSONB,
    "applicationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "schemeId" TEXT,
    "centerProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncubationCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "universityName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "authorizedSignatory" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "officialSealUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncubationCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryName" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "allocatedFund" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utilizedFund" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "proofUrl" TEXT,
    "approvalStatus" "AssessmentApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "sprAutoFetched" BOOLEAN NOT NULL DEFAULT false,
    "sprTypeMapping" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "trancheId" TEXT,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'bg-blue-500',
    "subcategories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleResource" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SPRAssessment" (
    "id" TEXT NOT NULL,
    "sprId" TEXT NOT NULL,
    "productValidation" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "innovationIP" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "marketTraction" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "technologyProgress" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "goToMarket" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "financialDiscipline" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "customerSatisfaction" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "compliance" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "revenueGrowth" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "fundingRaised" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "milestoneRate" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "teamExpansion" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "socialImpact" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "partnerships" "KPIStatus" NOT NULL DEFAULT 'PENDING',
    "healthScore" DOUBLE PRECISION,
    "observations" TEXT,
    "recommendations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SPRAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SPRMasterConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "reminderDays" INTEGER NOT NULL DEFAULT 7,
    "mandatoryFields" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SPRMasterConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StartupGrantAllocation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "code" TEXT,
    "sanctionedAmount" DOUBLE PRECISION NOT NULL,
    "sanctionDate" TIMESTAMP(3) NOT NULL,
    "approvalCommittee" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Approved',
    "totalReleased" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalUtilised" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StartupGrantAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StartupGrantTranche" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "releaseCondition" TEXT,
    "expectedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "paymentDate" TIMESTAMP(3),
    "utr" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StartupGrantTranche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StartupProgressReport" (
    "id" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AssessmentApprovalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "revenue" DOUBLE PRECISION,
    "teamSize" INTEGER,
    "challenges" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attritions" INTEGER,
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "fundingRaised" DOUBLE PRECISION,
    "fundingStatus" TEXT,
    "futurePlans" TEXT,
    "keyRoles" TEXT,
    "newCustomers" INTEGER,
    "newHires" INTEGER,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "productMilestones" TEXT,
    "productStatus" TEXT,
    "rawSubmissionData" JSONB,
    "revenueGrowth" TEXT,
    "riskMitigation" TEXT,
    "signatoryDate" TIMESTAMP(3),
    "signatoryDesignation" TEXT,
    "signatoryName" TEXT,
    "stageDescription" TEXT,
    "startupStage" TEXT,
    "supportNeeded" TEXT,
    "totalCustomers" INTEGER,
    "totalFunding" DOUBLE PRECISION,
    "milestoneId" TEXT,

    CONSTRAINT "StartupProgressReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UCBudgetHead" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allocatedAmount" DOUBLE PRECISION,
    "allocatedPercentage" DOUBLE PRECISION,
    "isFlexible" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UCBudgetHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilisationCertificate" (
    "id" TEXT NOT NULL,
    "ucNumber" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "trancheId" TEXT NOT NULL,
    "linkedSprId" TEXT,
    "certificatePeriodFrom" TIMESTAMP(3) NOT NULL,
    "certificatePeriodTo" TIMESTAMP(3) NOT NULL,
    "trancheAmountReleased" DOUBLE PRECISION NOT NULL,
    "totalAmountUtilised" DOUBLE PRECISION NOT NULL,
    "balanceCarriedForward" DOUBLE PRECISION NOT NULL,
    "isInterim" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "icRemarks" TEXT,
    "authorisedSignatoryName" TEXT NOT NULL,
    "authorisedSignatoryDesignation" TEXT NOT NULL,
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "trancheLocked" BOOLEAN NOT NULL DEFAULT false,
    "auditCorrectionOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilisationCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilisationDocument" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSizeKb" DOUBLE PRECISION NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilisationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilisationEntry" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "trancheId" TEXT NOT NULL,
    "budgetHeadId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "expensePurpose" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorGstin" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "gstAmount" DOUBLE PRECISION NOT NULL,
    "tdsAmount" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "ucId" TEXT,
    "reviewerRemarks" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "cashFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtilisationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingBuilding" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CoworkingBuildingStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CoworkingBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingFloor" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "type" "CoworkingFloorType" NOT NULL DEFAULT 'MIXED',
    "status" "CoworkingFloorStatus" NOT NULL DEFAULT 'AVAILABLE',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingZone" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CoworkingZoneType" NOT NULL DEFAULT 'OPEN_WORKSPACE',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingResource" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CoworkingResourceType" NOT NULL DEFAULT 'DESK',
    "status" "CoworkingResourceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingCostPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spaceType" "CoworkingResourceType" NOT NULL,
    "billedPer" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingCostPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingAllocation" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "costPlanId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PAID',
    "category" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "securityDeposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingBooking" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "additionalCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoworkingInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "seatsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialVoucher" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "debitAccountId" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "authorizedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "grantTrancheId" TEXT,

    CONSTRAINT "FinancialVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncubatorExpense" (
    "id" TEXT NOT NULL,
    "expenseNo" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL,
    "description" TEXT,
    "voucherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncubatorExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorSession" (
    "id" TEXT NOT NULL,
    "mentorName" TEXT NOT NULL,
    "sessionTopic" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hoursLogged" DOUBLE PRECISION NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "honorariumPaid" DOUBLE PRECISION NOT NULL,
    "voucherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAsset" (
    "id" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serialNumber" TEXT,
    "vendorName" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetValue" DOUBLE PRECISION NOT NULL,
    "voucherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "serialNumber" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DOUBLE PRECISION,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryConsumable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "alertPoint" INTEGER NOT NULL DEFAULT 5,
    "price" DOUBLE PRECISION,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryConsumable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAllocation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "checkoutCondition" TEXT NOT NULL DEFAULT 'Good',
    "returnCondition" TEXT,
    "remarks" TEXT,
    "verifiedByAdmin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMaintenance" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedReturnDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN_REPAIR',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllocationHeadMaster_name_key" ON "AllocationHeadMaster"("name");

-- CreateIndex
CREATE INDEX "CohortAttendance_meetingId_idx" ON "CohortAttendance"("meetingId");

-- CreateIndex
CREATE INDEX "CohortAttendance_startupId_idx" ON "CohortAttendance"("startupId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortAttendance_meetingId_startupId_key" ON "CohortAttendance"("meetingId", "startupId");

-- CreateIndex
CREATE INDEX "CohortMeeting_cohortId_idx" ON "CohortMeeting"("cohortId");

-- CreateIndex
CREATE INDEX "CohortMeeting_instructorId_idx" ON "CohortMeeting"("instructorId");

-- CreateIndex
CREATE INDEX "CohortMeeting_moduleId_idx" ON "CohortMeeting"("moduleId");

-- CreateIndex
CREATE INDEX "CohortMember_cohortId_idx" ON "CohortMember"("cohortId");

-- CreateIndex
CREATE INDEX "CohortMember_userId_idx" ON "CohortMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMember_cohortId_userId_key" ON "CohortMember"("cohortId", "userId");

-- CreateIndex
CREATE INDEX "CohortMentor_cohortId_idx" ON "CohortMentor"("cohortId");

-- CreateIndex
CREATE INDEX "CohortMentor_userId_idx" ON "CohortMentor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMentor_cohortId_userId_key" ON "CohortMentor"("cohortId", "userId");

-- CreateIndex
CREATE INDEX "CohortModule_cohortId_idx" ON "CohortModule"("cohortId");

-- CreateIndex
CREATE INDEX "CohortSubmission_startupId_idx" ON "CohortSubmission"("startupId");

-- CreateIndex
CREATE INDEX "CohortSubmission_status_idx" ON "CohortSubmission"("status");

-- CreateIndex
CREATE INDEX "CohortSubmission_taskId_idx" ON "CohortSubmission"("taskId");

-- CreateIndex
CREATE INDEX "CohortTask_cohortId_idx" ON "CohortTask"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedAgreement_agreementNumber_key" ON "GeneratedAgreement"("agreementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedAgreement_undertakingNumber_key" ON "GeneratedAgreement"("undertakingNumber");

-- CreateIndex
CREATE INDEX "GeneratedAgreement_agreementNumber_idx" ON "GeneratedAgreement"("agreementNumber");

-- CreateIndex
CREATE INDEX "GeneratedAgreement_applicationId_idx" ON "GeneratedAgreement"("applicationId");

-- CreateIndex
CREATE INDEX "GeneratedAgreement_status_idx" ON "GeneratedAgreement"("status");

-- CreateIndex
CREATE INDEX "Milestone_approvalStatus_idx" ON "Milestone"("approvalStatus");

-- CreateIndex
CREATE INDEX "Milestone_categoryName_idx" ON "Milestone"("categoryName");

-- CreateIndex
CREATE INDEX "Milestone_startupId_idx" ON "Milestone"("startupId");

-- CreateIndex
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");

-- CreateIndex
CREATE INDEX "Milestone_trancheId_idx" ON "Milestone"("trancheId");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneCategory_name_key" ON "MilestoneCategory"("name");

-- CreateIndex
CREATE INDEX "ModuleResource_moduleId_idx" ON "ModuleResource"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "SPRAssessment_sprId_key" ON "SPRAssessment"("sprId");

-- CreateIndex
CREATE UNIQUE INDEX "StartupGrantAllocation_applicationId_key" ON "StartupGrantAllocation"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "StartupGrantAllocation_code_key" ON "StartupGrantAllocation"("code");

-- CreateIndex
CREATE INDEX "StartupGrantAllocation_grantId_idx" ON "StartupGrantAllocation"("grantId");

-- CreateIndex
CREATE INDEX "StartupGrantTranche_allocationId_idx" ON "StartupGrantTranche"("allocationId");

-- CreateIndex
CREATE INDEX "StartupProgressReport_milestoneId_idx" ON "StartupProgressReport"("milestoneId");

-- CreateIndex
CREATE INDEX "StartupProgressReport_period_idx" ON "StartupProgressReport"("period");

-- CreateIndex
CREATE INDEX "StartupProgressReport_startupId_idx" ON "StartupProgressReport"("startupId");

-- CreateIndex
CREATE INDEX "StartupProgressReport_status_idx" ON "StartupProgressReport"("status");

-- CreateIndex
CREATE INDEX "UCBudgetHead_grantId_idx" ON "UCBudgetHead"("grantId");

-- CreateIndex
CREATE UNIQUE INDEX "UtilisationCertificate_ucNumber_key" ON "UtilisationCertificate"("ucNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UtilisationCertificate_trancheId_key" ON "UtilisationCertificate"("trancheId");

-- CreateIndex
CREATE INDEX "UtilisationCertificate_allocationId_idx" ON "UtilisationCertificate"("allocationId");

-- CreateIndex
CREATE INDEX "UtilisationCertificate_status_idx" ON "UtilisationCertificate"("status");

-- CreateIndex
CREATE INDEX "UtilisationEntry_allocationId_idx" ON "UtilisationEntry"("allocationId");

-- CreateIndex
CREATE INDEX "UtilisationEntry_budgetHeadId_idx" ON "UtilisationEntry"("budgetHeadId");

-- CreateIndex
CREATE INDEX "UtilisationEntry_status_idx" ON "UtilisationEntry"("status");

-- CreateIndex
CREATE INDEX "UtilisationEntry_trancheId_idx" ON "UtilisationEntry"("trancheId");

-- CreateIndex
CREATE INDEX "UtilisationEntry_ucId_idx" ON "UtilisationEntry"("ucId");

-- CreateIndex
CREATE UNIQUE INDEX "CoworkingBuilding_code_key" ON "CoworkingBuilding"("code");

-- CreateIndex
CREATE INDEX "CoworkingBuilding_code_idx" ON "CoworkingBuilding"("code");

-- CreateIndex
CREATE INDEX "CoworkingFloor_buildingId_idx" ON "CoworkingFloor"("buildingId");

-- CreateIndex
CREATE INDEX "CoworkingZone_floorId_idx" ON "CoworkingZone"("floorId");

-- CreateIndex
CREATE UNIQUE INDEX "CoworkingResource_code_key" ON "CoworkingResource"("code");

-- CreateIndex
CREATE INDEX "CoworkingResource_zoneId_idx" ON "CoworkingResource"("zoneId");

-- CreateIndex
CREATE INDEX "CoworkingResource_code_idx" ON "CoworkingResource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CoworkingAllocation_code_key" ON "CoworkingAllocation"("code");

-- CreateIndex
CREATE INDEX "CoworkingAllocation_resourceId_idx" ON "CoworkingAllocation"("resourceId");

-- CreateIndex
CREATE INDEX "CoworkingAllocation_userId_idx" ON "CoworkingAllocation"("userId");

-- CreateIndex
CREATE INDEX "CoworkingBooking_resourceId_idx" ON "CoworkingBooking"("resourceId");

-- CreateIndex
CREATE INDEX "CoworkingBooking_userId_idx" ON "CoworkingBooking"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoworkingQuota_userId_billingMonth_key" ON "CoworkingQuota"("userId", "billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "CoworkingInvoice_invoiceNumber_key" ON "CoworkingInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "CoworkingInvoice_userId_idx" ON "CoworkingInvoice"("userId");

-- CreateIndex
CREATE INDEX "CoworkingInvoice_billingMonth_idx" ON "CoworkingInvoice"("billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_name_key" ON "FinancialAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_code_key" ON "FinancialAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialVoucher_voucherNo_key" ON "FinancialVoucher"("voucherNo");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialVoucher_grantTrancheId_key" ON "FinancialVoucher"("grantTrancheId");

-- CreateIndex
CREATE INDEX "FinancialVoucher_debitAccountId_idx" ON "FinancialVoucher"("debitAccountId");

-- CreateIndex
CREATE INDEX "FinancialVoucher_creditAccountId_idx" ON "FinancialVoucher"("creditAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "IncubatorExpense_expenseNo_key" ON "IncubatorExpense"("expenseNo");

-- CreateIndex
CREATE UNIQUE INDEX "IncubatorExpense_voucherId_key" ON "IncubatorExpense"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorSession_voucherId_key" ON "MentorSession"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAsset_voucherId_key" ON "InventoryAsset"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_serialNumber_key" ON "InventoryItem"("serialNumber");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

-- CreateIndex
CREATE INDEX "InventoryAllocation_itemId_idx" ON "InventoryAllocation"("itemId");

-- CreateIndex
CREATE INDEX "InventoryAllocation_userId_idx" ON "InventoryAllocation"("userId");

-- CreateIndex
CREATE INDEX "InventoryMaintenance_itemId_idx" ON "InventoryMaintenance"("itemId");

-- CreateIndex
CREATE INDEX "StartupApplication_aadhaar_idx" ON "StartupApplication"("aadhaar");

-- CreateIndex
CREATE INDEX "StartupApplication_cin_idx" ON "StartupApplication"("cin");

-- CreateIndex
CREATE INDEX "StartupApplication_cohortId_idx" ON "StartupApplication"("cohortId");

-- CreateIndex
CREATE INDEX "StartupApplication_dpiitNumber_idx" ON "StartupApplication"("dpiitNumber");

-- CreateIndex
CREATE INDEX "StartupApplication_pan_idx" ON "StartupApplication"("pan");

-- CreateIndex
CREATE INDEX "UserPersonalDetails_aadhaar_idx" ON "UserPersonalDetails"("aadhaar");

-- CreateIndex
CREATE INDEX "UserPersonalDetails_pan_idx" ON "UserPersonalDetails"("pan");

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortAttendance" ADD CONSTRAINT "CohortAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CohortMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortAttendance" ADD CONSTRAINT "CohortAttendance_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMeeting" ADD CONSTRAINT "CohortMeeting_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMeeting" ADD CONSTRAINT "CohortMeeting_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMeeting" ADD CONSTRAINT "CohortMeeting_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CohortModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMentor" ADD CONSTRAINT "CohortMentor_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMentor" ADD CONSTRAINT "CohortMentor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortModule" ADD CONSTRAINT "CohortModule_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSubmission" ADD CONSTRAINT "CohortSubmission_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortSubmission" ADD CONSTRAINT "CohortSubmission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CohortTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortTask" ADD CONSTRAINT "CohortTask_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAgreement" ADD CONSTRAINT "GeneratedAgreement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAgreement" ADD CONSTRAINT "GeneratedAgreement_centerProfileId_fkey" FOREIGN KEY ("centerProfileId") REFERENCES "IncubationCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAgreement" ADD CONSTRAINT "GeneratedAgreement_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedAgreement" ADD CONSTRAINT "GeneratedAgreement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgreementTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_categoryName_fkey" FOREIGN KEY ("categoryName") REFERENCES "MilestoneCategory"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_trancheId_fkey" FOREIGN KEY ("trancheId") REFERENCES "StartupGrantTranche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleResource" ADD CONSTRAINT "ModuleResource_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CohortModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SPRAssessment" ADD CONSTRAINT "SPRAssessment_sprId_fkey" FOREIGN KEY ("sprId") REFERENCES "StartupProgressReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupApplication" ADD CONSTRAINT "StartupApplication_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupGrantAllocation" ADD CONSTRAINT "StartupGrantAllocation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupGrantAllocation" ADD CONSTRAINT "StartupGrantAllocation_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupGrantTranche" ADD CONSTRAINT "StartupGrantTranche_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "StartupGrantAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupProgressReport" ADD CONSTRAINT "StartupProgressReport_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupProgressReport" ADD CONSTRAINT "StartupProgressReport_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UCBudgetHead" ADD CONSTRAINT "UCBudgetHead_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationCertificate" ADD CONSTRAINT "UtilisationCertificate_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "StartupGrantAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationCertificate" ADD CONSTRAINT "UtilisationCertificate_trancheId_fkey" FOREIGN KEY ("trancheId") REFERENCES "StartupGrantTranche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationDocument" ADD CONSTRAINT "UtilisationDocument_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "UtilisationEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationEntry" ADD CONSTRAINT "UtilisationEntry_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "StartupGrantAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationEntry" ADD CONSTRAINT "UtilisationEntry_budgetHeadId_fkey" FOREIGN KEY ("budgetHeadId") REFERENCES "UCBudgetHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationEntry" ADD CONSTRAINT "UtilisationEntry_trancheId_fkey" FOREIGN KEY ("trancheId") REFERENCES "StartupGrantTranche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisationEntry" ADD CONSTRAINT "UtilisationEntry_ucId_fkey" FOREIGN KEY ("ucId") REFERENCES "UtilisationCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingFloor" ADD CONSTRAINT "CoworkingFloor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "CoworkingBuilding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingZone" ADD CONSTRAINT "CoworkingZone_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "CoworkingFloor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingResource" ADD CONSTRAINT "CoworkingResource_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CoworkingZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingAllocation" ADD CONSTRAINT "CoworkingAllocation_costPlanId_fkey" FOREIGN KEY ("costPlanId") REFERENCES "CoworkingCostPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingAllocation" ADD CONSTRAINT "CoworkingAllocation_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CoworkingResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingAllocation" ADD CONSTRAINT "CoworkingAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingBooking" ADD CONSTRAINT "CoworkingBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CoworkingResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingBooking" ADD CONSTRAINT "CoworkingBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingQuota" ADD CONSTRAINT "CoworkingQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoworkingInvoice" ADD CONSTRAINT "CoworkingInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialVoucher" ADD CONSTRAINT "FinancialVoucher_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialVoucher" ADD CONSTRAINT "FinancialVoucher_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialVoucher" ADD CONSTRAINT "FinancialVoucher_grantTrancheId_fkey" FOREIGN KEY ("grantTrancheId") REFERENCES "StartupGrantTranche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncubatorExpense" ADD CONSTRAINT "IncubatorExpense_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FinancialVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorSession" ADD CONSTRAINT "MentorSession_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FinancialVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FinancialVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAllocation" ADD CONSTRAINT "InventoryAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAllocation" ADD CONSTRAINT "InventoryAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMaintenance" ADD CONSTRAINT "InventoryMaintenance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
