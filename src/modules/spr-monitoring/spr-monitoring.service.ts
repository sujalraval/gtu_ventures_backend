import prisma from "../../lib/prisma";
import { AssessmentApprovalStatus, KPIStatus } from "@prisma/client";

export class SPRService {
  // --- SPR Submission (Startup) ---
  async submitSPR(data: any) {
    return prisma.startupProgressReport.create({
      data: {
        startupId: data.startupId,
        period: data.period,
        periodFrom: data.periodFrom ? new Date(data.periodFrom) : null,
        periodTo: data.periodTo ? new Date(data.periodTo) : null,
        status: AssessmentApprovalStatus.SUBMITTED,
        
        startupStage: data.startupStage,
        stageDescription: data.stageDescription,
        
        productStatus: data.productStatus,
        productMilestones: data.productMilestones,
        
        revenue: data.revenue ? parseFloat(data.revenue) : null,
        revenueGrowth: data.revenueGrowth,
        totalCustomers: data.totalCustomers ? parseInt(data.totalCustomers) : null,
        newCustomers: data.newCustomers ? parseInt(data.newCustomers) : null,
        
        teamSize: data.teamSize ? parseInt(data.teamSize) : null,
        newHires: data.newHires ? parseInt(data.newHires) : null,
        attritions: data.attritions ? parseInt(data.attritions) : null,
        keyRoles: data.keyRoles,
        
        fundingStatus: data.fundingStatus,
        fundingRaised: data.fundingRaised ? parseFloat(data.fundingRaised) : null,
        totalFunding: data.totalFunding ? parseFloat(data.totalFunding) : null,
        
        challenges: data.challenges,
        riskMitigation: data.riskMitigation,
        
        futurePlans: data.futurePlans,
        supportNeeded: data.supportNeeded,
        
        signatoryName: data.signatoryName,
        signatoryDesignation: data.signatoryDesignation,
        signatoryDate: data.signatoryDate ? new Date(data.signatoryDate) : null,
        declarationAccepted: data.declarationAccepted || false,
        milestoneId: data.milestoneId || null,
        slotIndex: data.slotIndex !== undefined ? Number(data.slotIndex) : null,
        sprType: data.sprType || null,
        rawSubmissionData: data.rawSubmissionData || null,
      },
    });
  }

  async getStartupSPRs(startupId: string) {
    return prisma.startupProgressReport.findMany({
      where: { startupId },
      include: { assessment: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- Assessment (Admin) ---
  async getAllSPRs() {
    return prisma.startupProgressReport.findMany({
      include: {
        startup: { select: { name: true, email: true } },
        assessment: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async submitAssessment(sprId: string, assessmentData: any) {
    // Calculate simple health score based on "YES" count
    const kpiFields = [
      'productValidation', 'innovationIP', 'marketTraction', 'technologyProgress',
      'goToMarket', 'financialDiscipline', 'customerSatisfaction', 'compliance',
      'revenueGrowth', 'fundingRaised', 'milestoneRate', 'teamExpansion',
      'socialImpact', 'partnerships'
    ];

    let yesCount = 0;
    kpiFields.forEach(field => {
      if (assessmentData[field] === KPIStatus.YES) yesCount++;
    });

    const healthScore = (yesCount / kpiFields.length) * 100;

    const assessment = await prisma.sPRAssessment.upsert({
      where: { sprId },
      update: {
        ...assessmentData,
        healthScore,
      },
      create: {
        sprId,
        ...assessmentData,
        healthScore,
      },
    });

    // Update SPR status to APPROVED or REJECTED based on admin action
    await prisma.startupProgressReport.update({
      where: { id: sprId },
      data: { status: assessmentData.approvalStatus || AssessmentApprovalStatus.APPROVED },
    });

    return assessment;
  }

  // --- Master Config ---
  async getMasterConfig() {
    return prisma.sPRMasterConfig.findMany();
  }

  async updateMasterConfig(id: string, data: any) {
    return prisma.sPRMasterConfig.update({
      where: { id },
      data,
    });
  }
}
