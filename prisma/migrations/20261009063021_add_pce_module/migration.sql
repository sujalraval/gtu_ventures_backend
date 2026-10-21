-- CreateEnum
CREATE TYPE "AssessmentResult" AS ENUM ('ACCEPTED', 'REJECTED', 'INCOMPLETE', 'HOLD');

-- CreateEnum
CREATE TYPE "AssessmentResultSource" AS ENUM ('REVIEWER', 'RULE', 'RULE_OVERRIDDEN');

-- CreateEnum
CREATE TYPE "AssignmentPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'UNDER_REVIEW', 'REVIEW_SUBMITTED', 'REVIEW_COMPLETED', 'REASSIGNED');

-- CreateEnum
CREATE TYPE "CommitteeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CommitteeType" AS ENUM ('PRELIMINARY_SCREENING', 'TECHNICAL_EVALUATION', 'PITCH_EVALUATION', 'JURY', 'FINANCE', 'FINAL_SELECTION', 'INCUBATION_APPROVAL');

-- CreateEnum
CREATE TYPE "EvaluatorAffiliation" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "EvaluatorDocumentType" AS ENUM ('CV', 'PAN_CARD', 'CANCELLED_CHEQUE', 'BANK_PROOF', 'GST_CERTIFICATE', 'ID_PROOF', 'APPOINTMENT_LETTER', 'INVITATION_LETTER', 'CONSENT_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "EvaluatorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "EvaluatorType" AS ENUM ('INTERNAL_EXPERT', 'EXTERNAL_EXPERT', 'JURY_MEMBER', 'INDUSTRY_EXPERT', 'TECHNICAL_EXPERT', 'FINANCIAL_EXPERT', 'MENTOR', 'ACADEMIC_EXPERT', 'SUBJECT_EXPERT', 'COMMITTEE_MEMBER', 'OTHER');

-- CreateEnum
CREATE TYPE "HonorariumStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvitationRecipientType" AS ENUM ('FOUNDER', 'CO_FOUNDER', 'EVALUATOR', 'PANEL_MEMBER', 'COMMITTEE_CHAIRPERSON');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RESENT', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "NotificationSendMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "NotificationTriggerEvent" AS ENUM ('STARTUP_REGISTRATION_SUBMITTED', 'STARTUP_REGISTRATION_APPROVED', 'STARTUP_REGISTRATION_REJECTED', 'STARTUP_REGISTRATION_CHANGES_REQUESTED', 'APPLICATION_SUBMITTED', 'APPLICATION_UNDER_REVIEW', 'APPLICATION_APPROVED', 'APPLICATION_REJECTED', 'APPLICATION_ON_HOLD', 'APPLICATION_RESUBMISSION_REQUIRED', 'APPLICATION_SELECTED_FOR_PITCH', 'DOCUMENTS_REQUIRED', 'DOCUMENTS_VERIFIED', 'DOCUMENTS_REJECTED', 'DOCUMENT_EXPIRY_REMINDER', 'INCUBATION_ONBOARDING', 'INCUBATION_STARTED', 'INCUBATION_MILESTONE', 'INCUBATION_ENDING_REMINDER', 'INCUBATION_COMPLETED', 'MENTOR_ASSIGNED', 'MENTOR_MEETING_SCHEDULED', 'MENTOR_MEETING_REMINDER', 'MENTOR_FEEDBACK_SUBMITTED', 'GRANT_APPLICATION_SUBMITTED', 'GRANT_APPLICATION_APPROVED', 'GRANT_APPLICATION_REJECTED', 'GRANT_DISBURSEMENT', 'EVENT_REGISTRATION_CONFIRMED', 'EVENT_REMINDER', 'WORKSHOP_REGISTRATION', 'WORKSHOP_REMINDER', 'PITCH_SCHEDULED', 'PITCH_REMINDER', 'USER_REGISTRATION', 'ACCOUNT_ACTIVATION', 'PASSWORD_RESET', 'ROLE_PERMISSION_CHANGED', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'SELECTED', 'SCHEME_CONFIRMED', 'DOCUMENTS_PENDING', 'VERIFICATION_PENDING', 'AGREEMENT_PENDING', 'FINAL_APPROVAL_PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PanelRole" AS ENUM ('CHAIRPERSON', 'MEMBER', 'OBSERVER');

-- CreateEnum
CREATE TYPE "PanelStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PceEvaluationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PceFinalDecision" AS ENUM ('APPROVED_FOR_INCUBATION', 'APPROVED_WITH_GRANT', 'APPROVED_WITHOUT_GRANT', 'APPROVED_WITH_CONDITIONS', 'RE_PRESENTATION_REQUIRED', 'WAITLISTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PitchEvaluationState" AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED', 'REOPENED');

-- CreateEnum
CREATE TYPE "PitchMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "PitchRecommendation" AS ENUM ('HIGHLY_RECOMMENDED', 'RECOMMENDED', 'RECOMMENDED_WITH_CONDITIONS', 'RECOMMENDED_FOR_INCUBATION', 'RE_PRESENTATION_REQUIRED', 'HOLD_FOR_REVIEW', 'WAITLISTED', 'NOT_RECOMMENDED');

-- CreateEnum
CREATE TYPE "PitchSessionType" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PitchStatus" AS ENUM ('INVITATION_PENDING', 'INVITATION_SENT', 'SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PitchingSessionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SchemeAssignmentAction" AS ENUM ('SUGGESTED', 'ASSIGNED', 'CHANGED', 'CONFIRMED', 'FINAL_APPROVED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SchemeAssignmentKind" AS ENUM ('SUGGESTED', 'PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "SchemeAssignmentStatus" AS ENUM ('NOT_ASSIGNED', 'SUGGESTED', 'PROVISIONALLY_ASSIGNED', 'ASSIGNED', 'CHANGED', 'CONFIRMED', 'FINAL_APPROVED');

-- CreateEnum
CREATE TYPE "SchemeEligibilityVerdict" AS ENUM ('ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'REVIEW_REQUIRED', 'NOT_ELIGIBLE');

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "bcc" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "body" TEXT,
ADD COLUMN     "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "relatedId" TEXT,
ADD COLUMN     "relatedType" TEXT,
ADD COLUMN     "sendMode" "NotificationSendMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "triggerEvent" "NotificationTriggerEvent";

-- CreateTable
CREATE TABLE "ApplicationAssignment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stage" "ApplicationLevel" NOT NULL DEFAULT 'LEVEL_1',
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "priority" "AssignmentPriority" NOT NULL DEFAULT 'NORMAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" TIMESTAMP(3),
    "reviewStartedAt" TIMESTAMP(3),
    "reviewCompletedAt" TIMESTAMP(3),
    "assessmentResult" "AssessmentResult",
    "assessmentScore" DOUBLE PRECISION,
    "remarks" TEXT,
    "reviewerId" TEXT,
    "reviewerName" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedByName" TEXT NOT NULL,
    "previousReviewerId" TEXT,
    "previousReviewerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationPceState" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schemeStatus" "SchemeAssignmentStatus" NOT NULL DEFAULT 'NOT_ASSIGNED',
    "provisionalSchemeId" TEXT,
    "finalSchemeId" TEXT,
    "schemeAssignedBy" TEXT,
    "schemeAssignedAt" TIMESTAMP(3),
    "schemeApprovedBy" TEXT,
    "schemeApprovedAt" TIMESTAMP(3),
    "schemeRemarks" TEXT,
    "eligibilityVerdict" "SchemeEligibilityVerdict",
    "eligibilityCheckedAt" TIMESTAMP(3),
    "eligibilityOverrideReason" TEXT,
    "pitchStatus" "PitchStatus" NOT NULL DEFAULT 'INVITATION_PENDING',
    "evaluationStatus" "PceEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationPceState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Committee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CommitteeType" NOT NULL,
    "mandateId" TEXT,
    "schemeId" TEXT,
    "purpose" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "remarks" TEXT,
    "status" "CommitteeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Committee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "role" "PanelRole" NOT NULL DEFAULT 'MEMBER',
    "expertCategories" TEXT[],
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "CommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationPanel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schemeId" TEXT,
    "sessionId" TEXT,
    "requiredEvaluators" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "mandateId" TEXT,
    "evaluationStage" TEXT,
    "pitchDate" TIMESTAMP(3),
    "session" "PitchSessionType",
    "sectors" TEXT[],
    "status" "PanelStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EvaluationPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluator" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT,
    "mobile" TEXT,
    "personalEmail" TEXT,
    "officialEmail" TEXT,
    "organization" TEXT,
    "designation" TEXT,
    "affiliation" "EvaluatorAffiliation" NOT NULL DEFAULT 'EXTERNAL',
    "type" "EvaluatorType" NOT NULL DEFAULT 'EXTERNAL_EXPERT',
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "sectors" TEXT[],
    "expertCategories" TEXT[],
    "areaOfExpertise" TEXT,
    "industryExperience" TEXT,
    "academicExpertise" TEXT,
    "specialization" TEXT,
    "shortProfile" TEXT,
    "status" "EvaluatorStatus" NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Evaluator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluatorBankDetail" (
    "id" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "accountHolderName" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "branch" TEXT,
    "accountType" TEXT,
    "pan" TEXT,
    "gstNumber" TEXT,
    "upiId" TEXT,
    "paymentRemarks" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluatorBankDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluatorDocument" (
    "id" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "type" "EvaluatorDocumentType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EvaluatorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluatorHonorarium" (
    "id" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "schemeId" TEXT,
    "panelId" TEXT,
    "pitchDate" TIMESTAMP(3),
    "applicationsEvaluated" INTEGER NOT NULL DEFAULT 0,
    "honorariumAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "travelAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "HonorariumStatus" NOT NULL DEFAULT 'PENDING',
    "paymentDate" TIMESTAMP(3),
    "transactionRef" TEXT,
    "remarks" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluatorHonorarium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalSelection" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "finalSchemeId" TEXT,
    "decision" "PceFinalDecision",
    "committeeRemarks" TEXT,
    "finalScore" DOUBLE PRECISION,
    "grantApproved" BOOLEAN NOT NULL DEFAULT false,
    "sanctionedGrantAmount" DOUBLE PRECISION,
    "grantConditions" TEXT,
    "rePresentationRequired" BOOLEAN NOT NULL DEFAULT false,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandateCategoryRequirement" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "minCount" INTEGER NOT NULL DEFAULT 1,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,

    CONSTRAINT "MandateCategoryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingDocument" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OnboardingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingRecord" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "incubationStartDate" TIMESTAMP(3),
    "mentorId" TEXT,
    "agreementStatus" TEXT,
    "kycVerified" BOOLEAN NOT NULL DEFAULT false,
    "bankDetailsVerified" BOOLEAN NOT NULL DEFAULT false,
    "registrationVerified" BOOLEAN NOT NULL DEFAULT false,
    "documentsVerifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelApplication" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "allocatedBy" TEXT,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "PanelApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelMember" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "role" "PanelRole" NOT NULL DEFAULT 'MEMBER',
    "expertCategories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PanelMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchEvaluation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "panelId" TEXT,
    "scheduleId" TEXT,
    "needOfInnovationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feasibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "potentialImpactScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "noveltyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "teamScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fundUtilizationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "presentationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criteriaRemarks" JSONB,
    "recommendation" "PitchRecommendation",
    "strengths" TEXT,
    "weaknesses" TEXT,
    "risks" TEXT,
    "suggestions" TEXT,
    "conditions" TEXT,
    "finalNote" TEXT,
    "remarks" TEXT,
    "recommendedSchemeId" TEXT,
    "alternativeSchemeId" TEXT,
    "schemeRecommendationRemarks" TEXT,
    "grantRecommended" BOOLEAN NOT NULL DEFAULT false,
    "recommendedGrantAmount" DOUBLE PRECISION,
    "grantPurpose" TEXT,
    "fundUtilizationRemarks" TEXT,
    "grantConditions" TEXT,
    "state" "PitchEvaluationState" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "reopenReason" TEXT,
    "reopenedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitchEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchEvaluationRevision" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PitchEvaluationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchInvitation" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT,
    "panelId" TEXT,
    "token" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "responseNote" TEXT,
    "recipientType" "InvitationRecipientType" NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "evaluatorId" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitchInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchSchedule" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schemeId" TEXT,
    "panelId" TEXT,
    "sessionId" TEXT,
    "presentationDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "durationMins" INTEGER DEFAULT 20,
    "reportingTime" TIMESTAMP(3),
    "session" "PitchSessionType",
    "mode" "PitchMode" NOT NULL DEFAULT 'OFFLINE',
    "venue" TEXT,
    "meetingLink" TEXT,
    "instructions" TEXT,
    "remarks" TEXT,
    "status" "PitchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "statusReason" TEXT,
    "rescheduledFromId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "startupNotifiedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PitchSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PitchingSession" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT,
    "name" TEXT NOT NULL,
    "round" TEXT,
    "presentationDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "session" "PitchSessionType",
    "reportingTime" TIMESTAMP(3),
    "mode" "PitchMode" NOT NULL DEFAULT 'OFFLINE',
    "venue" TEXT,
    "meetingLink" TEXT,
    "capacity" INTEGER,
    "instructions" TEXT,
    "remarks" TEXT,
    "status" "PitchingSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PitchingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAssessmentConfig" (
    "id" TEXT NOT NULL,
    "passMarkPercent" DOUBLE PRECISION,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "allowOverride" BOOLEAN NOT NULL DEFAULT true,
    "blockOnIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewAssessmentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeAssignmentHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "previousSchemeId" TEXT,
    "kind" "SchemeAssignmentKind" NOT NULL DEFAULT 'PROVISIONAL',
    "action" "SchemeAssignmentAction" NOT NULL DEFAULT 'ASSIGNED',
    "reason" TEXT,
    "remarks" TEXT,
    "performedBy" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemeAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeCommitteeMandate" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CommitteeType" NOT NULL DEFAULT 'PITCH_EVALUATION',
    "minMembers" INTEGER NOT NULL DEFAULT 1,
    "maxMembers" INTEGER,
    "purpose" TEXT,
    "remarks" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchemeCommitteeMandate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationAssignment_applicationId_stage_idx" ON "ApplicationAssignment"("applicationId", "stage");

-- CreateIndex
CREATE INDEX "ApplicationAssignment_reviewerId_status_idx" ON "ApplicationAssignment"("reviewerId", "status");

-- CreateIndex
CREATE INDEX "ApplicationAssignment_isActive_idx" ON "ApplicationAssignment"("isActive");

-- CreateIndex
CREATE INDEX "ApplicationAssignment_createdAt_idx" ON "ApplicationAssignment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationPceState_applicationId_key" ON "ApplicationPceState"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationPceState_schemeStatus_idx" ON "ApplicationPceState"("schemeStatus");

-- CreateIndex
CREATE INDEX "ApplicationPceState_pitchStatus_idx" ON "ApplicationPceState"("pitchStatus");

-- CreateIndex
CREATE INDEX "ApplicationPceState_evaluationStatus_idx" ON "ApplicationPceState"("evaluationStatus");

-- CreateIndex
CREATE INDEX "ApplicationPceState_onboardingStatus_idx" ON "ApplicationPceState"("onboardingStatus");

-- CreateIndex
CREATE INDEX "ApplicationPceState_provisionalSchemeId_idx" ON "ApplicationPceState"("provisionalSchemeId");

-- CreateIndex
CREATE INDEX "ApplicationPceState_finalSchemeId_idx" ON "ApplicationPceState"("finalSchemeId");

-- CreateIndex
CREATE INDEX "Committee_schemeId_idx" ON "Committee"("schemeId");

-- CreateIndex
CREATE INDEX "Committee_type_idx" ON "Committee"("type");

-- CreateIndex
CREATE INDEX "Committee_status_idx" ON "Committee"("status");

-- CreateIndex
CREATE INDEX "Committee_deletedAt_idx" ON "Committee"("deletedAt");

-- CreateIndex
CREATE INDEX "CommitteeMember_committeeId_idx" ON "CommitteeMember"("committeeId");

-- CreateIndex
CREATE INDEX "CommitteeMember_evaluatorId_idx" ON "CommitteeMember"("evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMember_committeeId_evaluatorId_key" ON "CommitteeMember"("committeeId", "evaluatorId");

-- CreateIndex
CREATE INDEX "EvaluationPanel_schemeId_idx" ON "EvaluationPanel"("schemeId");

-- CreateIndex
CREATE INDEX "EvaluationPanel_status_idx" ON "EvaluationPanel"("status");

-- CreateIndex
CREATE INDEX "EvaluationPanel_pitchDate_idx" ON "EvaluationPanel"("pitchDate");

-- CreateIndex
CREATE INDEX "EvaluationPanel_deletedAt_idx" ON "EvaluationPanel"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluator_code_key" ON "Evaluator"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluator_userId_key" ON "Evaluator"("userId");

-- CreateIndex
CREATE INDEX "Evaluator_affiliation_idx" ON "Evaluator"("affiliation");

-- CreateIndex
CREATE INDEX "Evaluator_type_idx" ON "Evaluator"("type");

-- CreateIndex
CREATE INDEX "Evaluator_status_idx" ON "Evaluator"("status");

-- CreateIndex
CREATE INDEX "Evaluator_deletedAt_idx" ON "Evaluator"("deletedAt");

-- CreateIndex
CREATE INDEX "Evaluator_officialEmail_idx" ON "Evaluator"("officialEmail");

-- CreateIndex
CREATE INDEX "Evaluator_personalEmail_idx" ON "Evaluator"("personalEmail");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluatorBankDetail_evaluatorId_key" ON "EvaluatorBankDetail"("evaluatorId");

-- CreateIndex
CREATE INDEX "EvaluatorDocument_evaluatorId_idx" ON "EvaluatorDocument"("evaluatorId");

-- CreateIndex
CREATE INDEX "EvaluatorDocument_type_idx" ON "EvaluatorDocument"("type");

-- CreateIndex
CREATE INDEX "EvaluatorDocument_deletedAt_idx" ON "EvaluatorDocument"("deletedAt");

-- CreateIndex
CREATE INDEX "EvaluatorHonorarium_evaluatorId_idx" ON "EvaluatorHonorarium"("evaluatorId");

-- CreateIndex
CREATE INDEX "EvaluatorHonorarium_schemeId_idx" ON "EvaluatorHonorarium"("schemeId");

-- CreateIndex
CREATE INDEX "EvaluatorHonorarium_panelId_idx" ON "EvaluatorHonorarium"("panelId");

-- CreateIndex
CREATE INDEX "EvaluatorHonorarium_status_idx" ON "EvaluatorHonorarium"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FinalSelection_applicationId_key" ON "FinalSelection"("applicationId");

-- CreateIndex
CREATE INDEX "FinalSelection_decision_idx" ON "FinalSelection"("decision");

-- CreateIndex
CREATE INDEX "FinalSelection_finalSchemeId_idx" ON "FinalSelection"("finalSchemeId");

-- CreateIndex
CREATE INDEX "MandateCategoryRequirement_mandateId_idx" ON "MandateCategoryRequirement"("mandateId");

-- CreateIndex
CREATE UNIQUE INDEX "MandateCategoryRequirement_mandateId_category_key" ON "MandateCategoryRequirement"("mandateId", "category");

-- CreateIndex
CREATE INDEX "OnboardingDocument_onboardingId_idx" ON "OnboardingDocument"("onboardingId");

-- CreateIndex
CREATE INDEX "OnboardingDocument_deletedAt_idx" ON "OnboardingDocument"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRecord_applicationId_key" ON "OnboardingRecord"("applicationId");

-- CreateIndex
CREATE INDEX "OnboardingRecord_status_idx" ON "OnboardingRecord"("status");

-- CreateIndex
CREATE INDEX "PanelApplication_panelId_idx" ON "PanelApplication"("panelId");

-- CreateIndex
CREATE INDEX "PanelApplication_applicationId_idx" ON "PanelApplication"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelApplication_panelId_applicationId_key" ON "PanelApplication"("panelId", "applicationId");

-- CreateIndex
CREATE INDEX "PanelMember_panelId_idx" ON "PanelMember"("panelId");

-- CreateIndex
CREATE INDEX "PanelMember_evaluatorId_idx" ON "PanelMember"("evaluatorId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelMember_panelId_evaluatorId_key" ON "PanelMember"("panelId", "evaluatorId");

-- CreateIndex
CREATE INDEX "PitchEvaluation_applicationId_idx" ON "PitchEvaluation"("applicationId");

-- CreateIndex
CREATE INDEX "PitchEvaluation_evaluatorId_idx" ON "PitchEvaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX "PitchEvaluation_panelId_idx" ON "PitchEvaluation"("panelId");

-- CreateIndex
CREATE INDEX "PitchEvaluation_state_idx" ON "PitchEvaluation"("state");

-- CreateIndex
CREATE UNIQUE INDEX "PitchEvaluation_applicationId_evaluatorId_key" ON "PitchEvaluation"("applicationId", "evaluatorId");

-- CreateIndex
CREATE INDEX "PitchEvaluationRevision_evaluationId_idx" ON "PitchEvaluationRevision"("evaluationId");

-- CreateIndex
CREATE UNIQUE INDEX "PitchEvaluationRevision_evaluationId_revision_key" ON "PitchEvaluationRevision"("evaluationId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "PitchInvitation_token_key" ON "PitchInvitation"("token");

-- CreateIndex
CREATE INDEX "PitchInvitation_scheduleId_idx" ON "PitchInvitation"("scheduleId");

-- CreateIndex
CREATE INDEX "PitchInvitation_panelId_idx" ON "PitchInvitation"("panelId");

-- CreateIndex
CREATE INDEX "PitchInvitation_status_idx" ON "PitchInvitation"("status");

-- CreateIndex
CREATE INDEX "PitchInvitation_recipientEmail_idx" ON "PitchInvitation"("recipientEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PitchSchedule_rescheduledFromId_key" ON "PitchSchedule"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "PitchSchedule_applicationId_idx" ON "PitchSchedule"("applicationId");

-- CreateIndex
CREATE INDEX "PitchSchedule_panelId_idx" ON "PitchSchedule"("panelId");

-- CreateIndex
CREATE INDEX "PitchSchedule_schemeId_idx" ON "PitchSchedule"("schemeId");

-- CreateIndex
CREATE INDEX "PitchSchedule_presentationDate_idx" ON "PitchSchedule"("presentationDate");

-- CreateIndex
CREATE INDEX "PitchSchedule_status_idx" ON "PitchSchedule"("status");

-- CreateIndex
CREATE INDEX "PitchSchedule_isActive_idx" ON "PitchSchedule"("isActive");

-- CreateIndex
CREATE INDEX "PitchSchedule_deletedAt_idx" ON "PitchSchedule"("deletedAt");

-- CreateIndex
CREATE INDEX "PitchingSession_schemeId_idx" ON "PitchingSession"("schemeId");

-- CreateIndex
CREATE INDEX "PitchingSession_presentationDate_idx" ON "PitchingSession"("presentationDate");

-- CreateIndex
CREATE INDEX "PitchingSession_status_idx" ON "PitchingSession"("status");

-- CreateIndex
CREATE INDEX "PitchingSession_deletedAt_idx" ON "PitchingSession"("deletedAt");

-- CreateIndex
CREATE INDEX "ReviewAssessmentConfig_isActive_idx" ON "ReviewAssessmentConfig"("isActive");

-- CreateIndex
CREATE INDEX "SchemeAssignmentHistory_applicationId_idx" ON "SchemeAssignmentHistory"("applicationId");

-- CreateIndex
CREATE INDEX "SchemeAssignmentHistory_schemeId_idx" ON "SchemeAssignmentHistory"("schemeId");

-- CreateIndex
CREATE INDEX "SchemeAssignmentHistory_performedAt_idx" ON "SchemeAssignmentHistory"("performedAt");

-- CreateIndex
CREATE INDEX "SchemeCommitteeMandate_schemeId_idx" ON "SchemeCommitteeMandate"("schemeId");

-- CreateIndex
CREATE INDEX "SchemeCommitteeMandate_deletedAt_idx" ON "SchemeCommitteeMandate"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeCommitteeMandate_schemeId_name_key" ON "SchemeCommitteeMandate"("schemeId", "name");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAssignment" ADD CONSTRAINT "ApplicationAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAssignment" ADD CONSTRAINT "ApplicationAssignment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAssignment" ADD CONSTRAINT "ApplicationAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPceState" ADD CONSTRAINT "ApplicationPceState_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPceState" ADD CONSTRAINT "ApplicationPceState_provisionalSchemeId_fkey" FOREIGN KEY ("provisionalSchemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPceState" ADD CONSTRAINT "ApplicationPceState_finalSchemeId_fkey" FOREIGN KEY ("finalSchemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Committee" ADD CONSTRAINT "Committee_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Committee" ADD CONSTRAINT "Committee_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "SchemeCommitteeMandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Evaluator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPanel" ADD CONSTRAINT "EvaluationPanel_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPanel" ADD CONSTRAINT "EvaluationPanel_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PitchingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationPanel" ADD CONSTRAINT "EvaluationPanel_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "SchemeCommitteeMandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluator" ADD CONSTRAINT "Evaluator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluatorBankDetail" ADD CONSTRAINT "EvaluatorBankDetail_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Evaluator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluatorDocument" ADD CONSTRAINT "EvaluatorDocument_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Evaluator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluatorHonorarium" ADD CONSTRAINT "EvaluatorHonorarium_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Evaluator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluatorHonorarium" ADD CONSTRAINT "EvaluatorHonorarium_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluatorHonorarium" ADD CONSTRAINT "EvaluatorHonorarium_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "EvaluationPanel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalSelection" ADD CONSTRAINT "FinalSelection_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalSelection" ADD CONSTRAINT "FinalSelection_finalSchemeId_fkey" FOREIGN KEY ("finalSchemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandateCategoryRequirement" ADD CONSTRAINT "MandateCategoryRequirement_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "SchemeCommitteeMandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingDocument" ADD CONSTRAINT "OnboardingDocument_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "OnboardingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRecord" ADD CONSTRAINT "OnboardingRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelApplication" ADD CONSTRAINT "PanelApplication_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "EvaluationPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelApplication" ADD CONSTRAINT "PanelApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelMember" ADD CONSTRAINT "PanelMember_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "EvaluationPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelMember" ADD CONSTRAINT "PanelMember_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Evaluator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvaluation" ADD CONSTRAINT "PitchEvaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvaluation" ADD CONSTRAINT "PitchEvaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Evaluator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvaluation" ADD CONSTRAINT "PitchEvaluation_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "EvaluationPanel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvaluation" ADD CONSTRAINT "PitchEvaluation_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PitchSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvaluation" ADD CONSTRAINT "PitchEvaluation_recommendedSchemeId_fkey" FOREIGN KEY ("recommendedSchemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvaluation" ADD CONSTRAINT "PitchEvaluation_alternativeSchemeId_fkey" FOREIGN KEY ("alternativeSchemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchEvaluationRevision" ADD CONSTRAINT "PitchEvaluationRevision_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "PitchEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchInvitation" ADD CONSTRAINT "PitchInvitation_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PitchSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchInvitation" ADD CONSTRAINT "PitchInvitation_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "EvaluationPanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchSchedule" ADD CONSTRAINT "PitchSchedule_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchSchedule" ADD CONSTRAINT "PitchSchedule_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchSchedule" ADD CONSTRAINT "PitchSchedule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PitchingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchSchedule" ADD CONSTRAINT "PitchSchedule_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "EvaluationPanel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchSchedule" ADD CONSTRAINT "PitchSchedule_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "PitchSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PitchingSession" ADD CONSTRAINT "PitchingSession_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeAssignmentHistory" ADD CONSTRAINT "SchemeAssignmentHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeAssignmentHistory" ADD CONSTRAINT "SchemeAssignmentHistory_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeAssignmentHistory" ADD CONSTRAINT "SchemeAssignmentHistory_previousSchemeId_fkey" FOREIGN KEY ("previousSchemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeCommitteeMandate" ADD CONSTRAINT "SchemeCommitteeMandate_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
