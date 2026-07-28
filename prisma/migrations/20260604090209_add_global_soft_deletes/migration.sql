-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AgreementClause" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AgreementPart" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AgreementSection" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AgreementTemplate" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApplicationAward" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApplicationFormB" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApplicationFormC" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApplicationFounder" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApplicationIP" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApplicationReview" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApplicationShareholder" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "City" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CohortAttendance" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CohortMeeting" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CohortMember" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CohortMentor" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CohortModule" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CohortSubmission" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CohortTask" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Country" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingAllocation" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingBooking" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingCostPlan" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingFloor" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingInvoice" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingQuota" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingRequest" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingResource" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CoworkingZone" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Designation" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "District" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FinancialVoucher" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GeneratedAgreement" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GrantTranche" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IncubationCenter" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "IncubatorExpense" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InventoryAllocation" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InventoryAsset" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InventoryConsumable" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InventoryMaintenance" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LibraryClause" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MentorSession" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MilestoneCategory" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ModuleResource" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrgRole" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PermissionModule" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SPRAssessment" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SPRMasterConfig" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Sector" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StartupGrantAllocation" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StartupGrantTranche" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StartupProfile" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StartupProgressReport" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "State" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubSector" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UCBudgetHead" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UtilisationCertificate" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UtilisationDocument" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UtilisationEntry" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AdminProfile_deletedAt_idx" ON "AdminProfile"("deletedAt");

-- CreateIndex
CREATE INDEX "AgreementClause_deletedAt_idx" ON "AgreementClause"("deletedAt");

-- CreateIndex
CREATE INDEX "AgreementPart_deletedAt_idx" ON "AgreementPart"("deletedAt");

-- CreateIndex
CREATE INDEX "AgreementSection_deletedAt_idx" ON "AgreementSection"("deletedAt");

-- CreateIndex
CREATE INDEX "AgreementTemplate_deletedAt_idx" ON "AgreementTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "ApplicationAward_deletedAt_idx" ON "ApplicationAward"("deletedAt");

-- CreateIndex
CREATE INDEX "ApplicationFormB_deletedAt_idx" ON "ApplicationFormB"("deletedAt");

-- CreateIndex
CREATE INDEX "ApplicationFormC_deletedAt_idx" ON "ApplicationFormC"("deletedAt");

-- CreateIndex
CREATE INDEX "ApplicationFounder_deletedAt_idx" ON "ApplicationFounder"("deletedAt");

-- CreateIndex
CREATE INDEX "ApplicationIP_deletedAt_idx" ON "ApplicationIP"("deletedAt");

-- CreateIndex
CREATE INDEX "ApplicationReview_deletedAt_idx" ON "ApplicationReview"("deletedAt");

-- CreateIndex
CREATE INDEX "ApplicationShareholder_deletedAt_idx" ON "ApplicationShareholder"("deletedAt");

-- CreateIndex
CREATE INDEX "City_deletedAt_idx" ON "City"("deletedAt");

-- CreateIndex
CREATE INDEX "Cohort_deletedAt_idx" ON "Cohort"("deletedAt");

-- CreateIndex
CREATE INDEX "CohortAttendance_deletedAt_idx" ON "CohortAttendance"("deletedAt");

-- CreateIndex
CREATE INDEX "CohortMeeting_deletedAt_idx" ON "CohortMeeting"("deletedAt");

-- CreateIndex
CREATE INDEX "CohortMember_deletedAt_idx" ON "CohortMember"("deletedAt");

-- CreateIndex
CREATE INDEX "CohortMentor_deletedAt_idx" ON "CohortMentor"("deletedAt");

-- CreateIndex
CREATE INDEX "CohortModule_deletedAt_idx" ON "CohortModule"("deletedAt");

-- CreateIndex
CREATE INDEX "CohortSubmission_deletedAt_idx" ON "CohortSubmission"("deletedAt");

-- CreateIndex
CREATE INDEX "CohortTask_deletedAt_idx" ON "CohortTask"("deletedAt");

-- CreateIndex
CREATE INDEX "Country_deletedAt_idx" ON "Country"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingAllocation_deletedAt_idx" ON "CoworkingAllocation"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingBooking_deletedAt_idx" ON "CoworkingBooking"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingCostPlan_deletedAt_idx" ON "CoworkingCostPlan"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingFloor_deletedAt_idx" ON "CoworkingFloor"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingInvoice_deletedAt_idx" ON "CoworkingInvoice"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingQuota_deletedAt_idx" ON "CoworkingQuota"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingRequest_deletedAt_idx" ON "CoworkingRequest"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingResource_deletedAt_idx" ON "CoworkingResource"("deletedAt");

-- CreateIndex
CREATE INDEX "CoworkingZone_deletedAt_idx" ON "CoworkingZone"("deletedAt");

-- CreateIndex
CREATE INDEX "Department_deletedAt_idx" ON "Department"("deletedAt");

-- CreateIndex
CREATE INDEX "Designation_deletedAt_idx" ON "Designation"("deletedAt");

-- CreateIndex
CREATE INDEX "District_deletedAt_idx" ON "District"("deletedAt");

-- CreateIndex
CREATE INDEX "FinancialAccount_deletedAt_idx" ON "FinancialAccount"("deletedAt");

-- CreateIndex
CREATE INDEX "FinancialVoucher_deletedAt_idx" ON "FinancialVoucher"("deletedAt");

-- CreateIndex
CREATE INDEX "GeneratedAgreement_deletedAt_idx" ON "GeneratedAgreement"("deletedAt");

-- CreateIndex
CREATE INDEX "GrantTranche_deletedAt_idx" ON "GrantTranche"("deletedAt");

-- CreateIndex
CREATE INDEX "IncubationCenter_deletedAt_idx" ON "IncubationCenter"("deletedAt");

-- CreateIndex
CREATE INDEX "IncubatorExpense_deletedAt_idx" ON "IncubatorExpense"("deletedAt");

-- CreateIndex
CREATE INDEX "Institution_deletedAt_idx" ON "Institution"("deletedAt");

-- CreateIndex
CREATE INDEX "InventoryAllocation_deletedAt_idx" ON "InventoryAllocation"("deletedAt");

-- CreateIndex
CREATE INDEX "InventoryAsset_deletedAt_idx" ON "InventoryAsset"("deletedAt");

-- CreateIndex
CREATE INDEX "InventoryConsumable_deletedAt_idx" ON "InventoryConsumable"("deletedAt");

-- CreateIndex
CREATE INDEX "InventoryItem_deletedAt_idx" ON "InventoryItem"("deletedAt");

-- CreateIndex
CREATE INDEX "InventoryMaintenance_deletedAt_idx" ON "InventoryMaintenance"("deletedAt");

-- CreateIndex
CREATE INDEX "LibraryClause_deletedAt_idx" ON "LibraryClause"("deletedAt");

-- CreateIndex
CREATE INDEX "MentorSession_deletedAt_idx" ON "MentorSession"("deletedAt");

-- CreateIndex
CREATE INDEX "Milestone_deletedAt_idx" ON "Milestone"("deletedAt");

-- CreateIndex
CREATE INDEX "MilestoneCategory_deletedAt_idx" ON "MilestoneCategory"("deletedAt");

-- CreateIndex
CREATE INDEX "ModuleResource_deletedAt_idx" ON "ModuleResource"("deletedAt");

-- CreateIndex
CREATE INDEX "OrgRole_deletedAt_idx" ON "OrgRole"("deletedAt");

-- CreateIndex
CREATE INDEX "PermissionModule_deletedAt_idx" ON "PermissionModule"("deletedAt");

-- CreateIndex
CREATE INDEX "RolePermission_deletedAt_idx" ON "RolePermission"("deletedAt");

-- CreateIndex
CREATE INDEX "SPRAssessment_deletedAt_idx" ON "SPRAssessment"("deletedAt");

-- CreateIndex
CREATE INDEX "SPRMasterConfig_deletedAt_idx" ON "SPRMasterConfig"("deletedAt");

-- CreateIndex
CREATE INDEX "Sector_deletedAt_idx" ON "Sector"("deletedAt");

-- CreateIndex
CREATE INDEX "StartupGrantAllocation_deletedAt_idx" ON "StartupGrantAllocation"("deletedAt");

-- CreateIndex
CREATE INDEX "StartupGrantTranche_deletedAt_idx" ON "StartupGrantTranche"("deletedAt");

-- CreateIndex
CREATE INDEX "StartupProfile_deletedAt_idx" ON "StartupProfile"("deletedAt");

-- CreateIndex
CREATE INDEX "StartupProgressReport_deletedAt_idx" ON "StartupProgressReport"("deletedAt");

-- CreateIndex
CREATE INDEX "State_deletedAt_idx" ON "State"("deletedAt");

-- CreateIndex
CREATE INDEX "SubSector_deletedAt_idx" ON "SubSector"("deletedAt");

-- CreateIndex
CREATE INDEX "UCBudgetHead_deletedAt_idx" ON "UCBudgetHead"("deletedAt");

-- CreateIndex
CREATE INDEX "UserRole_deletedAt_idx" ON "UserRole"("deletedAt");

-- CreateIndex
CREATE INDEX "UtilisationCertificate_deletedAt_idx" ON "UtilisationCertificate"("deletedAt");

-- CreateIndex
CREATE INDEX "UtilisationDocument_deletedAt_idx" ON "UtilisationDocument"("deletedAt");

-- CreateIndex
CREATE INDEX "UtilisationEntry_deletedAt_idx" ON "UtilisationEntry"("deletedAt");

-- CreateIndex
CREATE INDEX "VerificationToken_deletedAt_idx" ON "VerificationToken"("deletedAt");
