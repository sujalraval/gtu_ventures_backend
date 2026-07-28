-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF', 'STARTUP');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RE_SUBMISSION_REQUIRED', 'HOLD', 'SELECTED_FOR_PITCH');

-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('PRIVATE_LIMITED', 'LLP', 'PARTNERSHIP', 'PROPRIETORSHIP', 'OPC', 'NOT_REGISTERED');

-- CreateEnum
CREATE TYPE "StartupStage" AS ENUM ('IDEA', 'PROTOTYPE', 'EARLY_TRACTION', 'SCALING');

-- CreateEnum
CREATE TYPE "ApplicationLevel" AS ENUM ('SCREENING', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'CEO');

-- CreateEnum
CREATE TYPE "SchemeStatus" AS ENUM ('ACTIVE', 'DRAFT', 'CLOSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "OrgRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionModule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "actions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT,
    "isSetupComplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "role" "Role" NOT NULL DEFAULT 'STARTUP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPersonalDetails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "pob" TEXT,
    "maritalStatus" TEXT,
    "category" TEXT,
    "bloodGroup" TEXT,
    "pan" TEXT,
    "aadhaar" TEXT,
    "fatherSpouseName" TEXT,
    "phone" TEXT NOT NULL,
    "staffCode" TEXT,
    "punchId" TEXT,
    "shift" TEXT,
    "policy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isPartTime" BOOLEAN NOT NULL DEFAULT false,
    "isExternalStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserPersonalDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT,
    "pinCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDepartmentMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "dateOfJoining" TIMESTAMP(3) NOT NULL,
    "leaveDate" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserDepartmentMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReportingHierarchy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportLevel1" TEXT,
    "reportLevel2" TEXT,
    "reportLevel3" TEXT,
    "reportLevel4" TEXT,
    "reportLevel5" TEXT,
    "reportLevel6" TEXT,
    "reportLevel7" TEXT,
    "reportLevel8" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserReportingHierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBankDetails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserBankDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLeaveEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "totalLeave" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserLeaveEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExperience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sector" TEXT,
    "subSector" TEXT,
    "institutionName" TEXT,
    "yearsOfExp" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEducation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "passingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfessionalMetrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "technicalSkills" TEXT,
    "domainExpertise" TEXT,
    "certifications" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserProfessionalMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "department" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StartupProfile" (
    "id" TEXT NOT NULL,
    "companyName" TEXT,
    "industry" TEXT,
    "stage" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "StartupProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StartupApplication" (
    "id" TEXT NOT NULL,
    "applicationNo" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentLevel" "ApplicationLevel" NOT NULL DEFAULT 'LEVEL_1',
    "schemeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fullName" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "whatsapp" TEXT,
    "aadhaar" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "highestQualification" TEXT NOT NULL,
    "fromInstitution" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "locality" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL,
    "startupName" TEXT NOT NULL,
    "mainSector" TEXT NOT NULL,
    "subSectors" TEXT[],
    "stage" "StartupStage" NOT NULL,
    "briefAbout" TEXT NOT NULL,
    "problemStmt" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "revenueModel" TEXT[],
    "marketSize" TEXT,
    "ipStatus" TEXT,
    "lookingFor" TEXT[],
    "website" TEXT,
    "isRegistered" BOOLEAN NOT NULL DEFAULT false,
    "legalStatus" "LegalStatus",
    "cin" TEXT,
    "pan" TEXT,
    "gst" TEXT,
    "hasGst" TEXT,
    "incorporationDate" TIMESTAMP(3),
    "dpiitRegistered" TEXT,
    "dpiitNumber" TEXT,
    "dpiitDate" TIMESTAMP(3),
    "primaryEmail" TEXT NOT NULL,
    "primaryMobile" TEXT NOT NULL,
    "primaryWhatsapp" TEXT,
    "pitchDeck" TEXT,
    "founderIdProof" TEXT,
    "registrationCert" TEXT,
    "dpiitCert" TEXT,
    "patentDocs" TEXT,
    "gstCert" TEXT,
    "financialStatements" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isMobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedDocs" JSONB,
    "isFormASubmitted" BOOLEAN NOT NULL DEFAULT false,
    "isFormBSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "isFormCSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "isFormDSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "isFormESubmitted" BOOLEAN NOT NULL DEFAULT false,
    "isFormFSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "isFormGSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "isFormHSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isFormBApproved" BOOLEAN NOT NULL DEFAULT false,
    "revisionForm" TEXT,
    "isFormAApproved" BOOLEAN NOT NULL DEFAULT false,
    "isFormCApproved" BOOLEAN NOT NULL DEFAULT false,
    "isFormDApproved" BOOLEAN NOT NULL DEFAULT false,
    "isFormEApproved" BOOLEAN NOT NULL DEFAULT false,
    "isFormFApproved" BOOLEAN NOT NULL DEFAULT false,
    "isFormGApproved" BOOLEAN NOT NULL DEFAULT false,
    "isFormHApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StartupApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "level" "ApplicationLevel" NOT NULL,
    "screeningScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "businessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "innovationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feasibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uspNote" TEXT,
    "comments" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "providedBy" TEXT,
    "organizationName" TEXT,
    "categories" TEXT[],
    "sectors" TEXT[],
    "departments" TEXT[],
    "description" TEXT,
    "objectives" TEXT,
    "eligibility" TEXT,
    "targetBeneficiaries" TEXT[],
    "totalBudget" DOUBLE PRECISION,
    "maxGrant" DOUBLE PRECISION NOT NULL,
    "fundingType" TEXT[],
    "selectionCriteria" TEXT,
    "evaluationProcess" TEXT,
    "installments" INTEGER,
    "duration" TEXT,
    "validityPeriods" JSONB,
    "applicationPeriods" JSONB,
    "requiredDocuments" JSONB,
    "status" "SchemeStatus" NOT NULL DEFAULT 'DRAFT',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "sectors" TEXT[],
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "maxPerStartup" DOUBLE PRECISION NOT NULL,
    "cycle" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "trancheAllowed" BOOLEAN NOT NULL DEFAULT false,
    "noOfTranches" INTEGER NOT NULL DEFAULT 0,
    "ucMandatory" BOOLEAN NOT NULL DEFAULT true,
    "auditRequired" BOOLEAN NOT NULL DEFAULT false,
    "matchingFund" BOOLEAN NOT NULL DEFAULT false,
    "recoveryClause" BOOLEAN NOT NULL DEFAULT true,
    "utilisationPeriod" INTEGER DEFAULT 30,
    "utilisationPurpose" TEXT,
    "bankDetails" TEXT,
    "approvalAuthority" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disbursementMode" TEXT,
    "approvalDate" TIMESTAMP(3),
    "approvalRef" TEXT,
    "approvalRemarks" TEXT,
    "closureDate" TIMESTAMP(3),

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantTranche" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "milestone" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantTranche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantReceipt" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "installment" TEXT NOT NULL,
    "utr" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT,

    CONSTRAINT "GrantReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantAllocation" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "head" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "utilized" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "remarks" TEXT,
    "code" TEXT,

    CONSTRAINT "GrantAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "State" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "pincodePrefixes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubSector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationFormB" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "operationalAddress" TEXT,
    "authorityName" TEXT NOT NULL,
    "authorityDesignation" TEXT NOT NULL,
    "authorityEmail" TEXT NOT NULL,
    "authorityMobile" TEXT NOT NULL,
    "authorityPan" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "previousIncubation" TEXT DEFAULT 'no',
    "previousIncubatorName" TEXT,
    "previousIncubationPeriod" TEXT,
    "govtSchemes" TEXT DEFAULT 'no',
    "govtSchemeDetails" TEXT,
    "coi" TEXT,
    "moa" TEXT,
    "aoa" TEXT,
    "gstCert" TEXT,
    "panCard" TEXT,
    "cancelledCheque" TEXT,
    "declaration1" BOOLEAN NOT NULL DEFAULT false,
    "declaration2" BOOLEAN NOT NULL DEFAULT false,
    "declaration3" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFormB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationFounder" (
    "id" TEXT NOT NULL,
    "formBId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "aadhaar" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "photo" TEXT,
    "addressProof" TEXT,
    "govtId" TEXT,
    "panCard" TEXT,
    "cv" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFounder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationIP" (
    "id" TEXT NOT NULL,
    "formBId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "filingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAward" (
    "id" TEXT NOT NULL,
    "formBId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "prize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationShareholder" (
    "id" TEXT NOT NULL,
    "formBId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shares" TEXT,
    "percentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationShareholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationFormC" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "agreementDate" TIMESTAMP(3),
    "agreementDuration" INTEGER,
    "agreementType" TEXT,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "incubationType" TEXT,
    "incubationStartDate" TIMESTAMP(3),
    "incubationLocation" TEXT,
    "incubationFacilities" TEXT[],
    "grantType" TEXT,
    "sanctionedAmount" DOUBLE PRECISION,
    "disbursementMode" TEXT,
    "ucRequired" BOOLEAN NOT NULL DEFAULT true,
    "reportFrequency" TEXT,
    "reviewCommittee" TEXT,
    "auditRequired" BOOLEAN NOT NULL DEFAULT true,
    "kpiParameters" TEXT[],
    "ipOwnership" TEXT,
    "ndaObligations" TEXT,
    "publicationPolicy" TEXT,
    "governingLaw" TEXT DEFAULT 'Laws of India',
    "jurisdiction" TEXT DEFAULT 'Courts of Ahmedabad, Gujarat',
    "isUndertakingSigned" BOOLEAN NOT NULL DEFAULT false,
    "undertakingSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT,

    CONSTRAINT "ApplicationFormC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schemeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementPart" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementSection" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementClause" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryClause" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryClause_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgRole_name_key" ON "OrgRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OrgRole_code_key" ON "OrgRole"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionModule_key_key" ON "PermissionModule"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_moduleId_key" ON "RolePermission"("roleId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPersonalDetails_userId_key" ON "UserPersonalDetails"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPersonalDetails_pan_key" ON "UserPersonalDetails"("pan");

-- CreateIndex
CREATE UNIQUE INDEX "UserPersonalDetails_aadhaar_key" ON "UserPersonalDetails"("aadhaar");

-- CreateIndex
CREATE UNIQUE INDEX "UserPersonalDetails_staffCode_key" ON "UserPersonalDetails"("staffCode");

-- CreateIndex
CREATE UNIQUE INDEX "UserPersonalDetails_punchId_key" ON "UserPersonalDetails"("punchId");

-- CreateIndex
CREATE INDEX "UserPersonalDetails_firstName_lastName_idx" ON "UserPersonalDetails"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "UserPersonalDetails_phone_idx" ON "UserPersonalDetails"("phone");

-- CreateIndex
CREATE INDEX "UserAddress_userId_type_idx" ON "UserAddress"("userId", "type");

-- CreateIndex
CREATE INDEX "UserDepartmentMapping_institutionId_departmentId_idx" ON "UserDepartmentMapping"("institutionId", "departmentId");

-- CreateIndex
CREATE INDEX "UserDepartmentMapping_userId_idx" ON "UserDepartmentMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserReportingHierarchy_userId_key" ON "UserReportingHierarchy"("userId");

-- CreateIndex
CREATE INDEX "UserReportingHierarchy_userId_idx" ON "UserReportingHierarchy"("userId");

-- CreateIndex
CREATE INDEX "UserReportingHierarchy_reportLevel1_idx" ON "UserReportingHierarchy"("reportLevel1");

-- CreateIndex
CREATE UNIQUE INDEX "UserBankDetails_userId_key" ON "UserBankDetails"("userId");

-- CreateIndex
CREATE INDEX "UserBankDetails_userId_idx" ON "UserBankDetails"("userId");

-- CreateIndex
CREATE INDEX "UserBankDetails_accountNo_idx" ON "UserBankDetails"("accountNo");

-- CreateIndex
CREATE INDEX "UserLeaveEntitlement_userId_academicYear_leaveType_idx" ON "UserLeaveEntitlement"("userId", "academicYear", "leaveType");

-- CreateIndex
CREATE INDEX "UserExperience_userId_idx" ON "UserExperience"("userId");

-- CreateIndex
CREATE INDEX "UserEducation_userId_idx" ON "UserEducation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfessionalMetrics_userId_key" ON "UserProfessionalMetrics"("userId");

-- CreateIndex
CREATE INDEX "UserProfessionalMetrics_userId_idx" ON "UserProfessionalMetrics"("userId");

-- CreateIndex
CREATE INDEX "UserDocument_userId_documentType_idx" ON "UserDocument"("userId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_employeeId_key" ON "AdminProfile"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StartupProfile_userId_key" ON "StartupProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StartupApplication_applicationNo_key" ON "StartupApplication"("applicationNo");

-- CreateIndex
CREATE UNIQUE INDEX "StartupApplication_aadhaar_key" ON "StartupApplication"("aadhaar");

-- CreateIndex
CREATE UNIQUE INDEX "StartupApplication_cin_key" ON "StartupApplication"("cin");

-- CreateIndex
CREATE UNIQUE INDEX "StartupApplication_pan_key" ON "StartupApplication"("pan");

-- CreateIndex
CREATE UNIQUE INDEX "StartupApplication_dpiitNumber_key" ON "StartupApplication"("dpiitNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StartupApplication_userId_key" ON "StartupApplication"("userId");

-- CreateIndex
CREATE INDEX "StartupApplication_email_idx" ON "StartupApplication"("email");

-- CreateIndex
CREATE INDEX "StartupApplication_mobile_idx" ON "StartupApplication"("mobile");

-- CreateIndex
CREATE INDEX "StartupApplication_pinCode_idx" ON "StartupApplication"("pinCode");

-- CreateIndex
CREATE INDEX "StartupApplication_startupName_idx" ON "StartupApplication"("startupName");

-- CreateIndex
CREATE INDEX "StartupApplication_status_idx" ON "StartupApplication"("status");

-- CreateIndex
CREATE INDEX "StartupApplication_currentLevel_idx" ON "StartupApplication"("currentLevel");

-- CreateIndex
CREATE INDEX "StartupApplication_deletedAt_idx" ON "StartupApplication"("deletedAt");

-- CreateIndex
CREATE INDEX "StartupApplication_assignedToId_idx" ON "StartupApplication"("assignedToId");

-- CreateIndex
CREATE INDEX "ApplicationReview_applicationId_idx" ON "ApplicationReview"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationReview_reviewerId_idx" ON "ApplicationReview"("reviewerId");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_code_key" ON "Scheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Grant_code_key" ON "Grant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GrantReceipt_code_key" ON "GrantReceipt"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GrantAllocation_code_key" ON "GrantAllocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "State_name_countryId_key" ON "State"("name", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "District_name_stateId_key" ON "District"("name", "stateId");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_districtId_key" ON "City"("name", "districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_name_key" ON "Institution"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_institutionId_key" ON "Department"("name", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Designation_name_key" ON "Designation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_name_key" ON "Sector"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubSector_name_sectorId_key" ON "SubSector"("name", "sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFormB_applicationId_key" ON "ApplicationFormB"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFormC_applicationId_key" ON "ApplicationFormC"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationFormC_referenceNumber_key" ON "ApplicationFormC"("referenceNumber");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "PermissionModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrgRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "OrgRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPersonalDetails" ADD CONSTRAINT "UserPersonalDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentMapping" ADD CONSTRAINT "UserDepartmentMapping_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentMapping" ADD CONSTRAINT "UserDepartmentMapping_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentMapping" ADD CONSTRAINT "UserDepartmentMapping_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentMapping" ADD CONSTRAINT "UserDepartmentMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReportingHierarchy" ADD CONSTRAINT "UserReportingHierarchy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBankDetails" ADD CONSTRAINT "UserBankDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLeaveEntitlement" ADD CONSTRAINT "UserLeaveEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExperience" ADD CONSTRAINT "UserExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEducation" ADD CONSTRAINT "UserEducation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfessionalMetrics" ADD CONSTRAINT "UserProfessionalMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupProfile" ADD CONSTRAINT "StartupProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupApplication" ADD CONSTRAINT "StartupApplication_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupApplication" ADD CONSTRAINT "StartupApplication_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupApplication" ADD CONSTRAINT "StartupApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantTranche" ADD CONSTRAINT "GrantTranche_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantReceipt" ADD CONSTRAINT "GrantReceipt_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantAllocation" ADD CONSTRAINT "GrantAllocation_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "State" ADD CONSTRAINT "State_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubSector" ADD CONSTRAINT "SubSector_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFormB" ADD CONSTRAINT "ApplicationFormB_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFounder" ADD CONSTRAINT "ApplicationFounder_formBId_fkey" FOREIGN KEY ("formBId") REFERENCES "ApplicationFormB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationIP" ADD CONSTRAINT "ApplicationIP_formBId_fkey" FOREIGN KEY ("formBId") REFERENCES "ApplicationFormB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAward" ADD CONSTRAINT "ApplicationAward_formBId_fkey" FOREIGN KEY ("formBId") REFERENCES "ApplicationFormB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationShareholder" ADD CONSTRAINT "ApplicationShareholder_formBId_fkey" FOREIGN KEY ("formBId") REFERENCES "ApplicationFormB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFormC" ADD CONSTRAINT "ApplicationFormC_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationFormC" ADD CONSTRAINT "ApplicationFormC_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgreementTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementTemplate" ADD CONSTRAINT "AgreementTemplate_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementPart" ADD CONSTRAINT "AgreementPart_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgreementTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementSection" ADD CONSTRAINT "AgreementSection_partId_fkey" FOREIGN KEY ("partId") REFERENCES "AgreementPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementClause" ADD CONSTRAINT "AgreementClause_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "AgreementSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

