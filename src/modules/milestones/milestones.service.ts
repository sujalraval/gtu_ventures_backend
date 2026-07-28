import prisma from "../../lib/prisma";
import { MilestoneStatus, AssessmentApprovalStatus, SprFrequency } from "@prisma/client";

export class MilestoneService {
  async createMilestone(data: any) {
    return prisma.milestone.create({
      data: {
        startupId: data.startupId,
        title: data.title,
        description: data.description,
        categoryName: data.categoryName || data.category,
        priority: data.priority,
        plannedStart: new Date(data.plannedStart),
        plannedEnd: new Date(data.plannedEnd),
        allocatedFund: Number(data.allocatedFund) || 0,
        status: MilestoneStatus.NOT_STARTED,
        approvalStatus: AssessmentApprovalStatus.DRAFT,
        trancheId: data.trancheId || null,
      },
    });
  }

  async getMilestonesByStartup(startupId: string) {
    return prisma.milestone.findMany({
      where: { startupId },
      include: {
        category: true,
        tranche: true,
      },
      orderBy: { plannedStart: "asc" },
    });
  }

  async getAllMilestones() {
    return prisma.milestone.findMany({
      include: {
        startup: {
          select: { 
            name: true, 
            email: true,
            startupProfile: { select: { companyName: true } },
            startupApplication: { select: { startupName: true } }
          },
        },
        category: true,
        tranche: true,
      },
    });
  }

  async updateProgress(id: string, progressData: any) {
    return prisma.milestone.update({
      where: { id },
      data: {
        status: MilestoneStatus.IN_PROGRESS,
        actualStart: progressData.actualStart ? new Date(progressData.actualStart) : undefined,
        proofUrl: progressData.proofUrl,
        approvalStatus: AssessmentApprovalStatus.SUBMITTED,
      },
    });
  }

  async approveMilestone(id: string, approvalData: any) {
    return await prisma.$transaction(async (tx) => {
      // 1. Update the milestone
      const milestone = await tx.milestone.update({
        where: { id },
        data: {
          status: MilestoneStatus.COMPLETED,
          completionDate: new Date(),
          approvalStatus: AssessmentApprovalStatus.APPROVED,
          utilizedFund: Number(approvalData.utilizedFund) || 0,
        },
      });

      // 2. If linked to a tranche, update parent allocation totals
      if (milestone.trancheId) {
        const tranche = await tx.startupGrantTranche.findUnique({
          where: { id: milestone.trancheId },
          include: { 
            allocation: {
              include: { tranches: { include: { milestones: true } } }
            }
          }
        });

        if (tranche && tranche.allocation) {
          // Recalculate total utilised from ALL milestones in ALL tranches for this allocation
          const totalUtilised = tranche.allocation.tranches.reduce((sum, t) => {
            return sum + (t.milestones || []).reduce((mSum, m) => mSum + (m.utilizedFund || 0), 0);
          }, 0);

          await tx.startupGrantAllocation.update({
            where: { id: tranche.allocationId },
            data: { totalUtilised }
          });

          // 3. Check if all milestones for THIS tranche are now done to mark it Eligible
          const allMilestonesForTranche = await tx.milestone.findMany({
            where: { trancheId: milestone.trancheId }
          });

          const allApproved = allMilestonesForTranche.every(
            m => m.approvalStatus === AssessmentApprovalStatus.APPROVED && m.status === MilestoneStatus.COMPLETED
          );

          if (allApproved) {
            await tx.startupGrantTranche.update({
              where: { id: milestone.trancheId },
              data: { status: "Eligible" }
            });
          }
        }
      }

      return milestone;
    });
  }

  async getCategories() {
    return prisma.milestoneCategory.findMany();
  }

  async createCategory(data: any) {
    return prisma.milestoneCategory.create({
      data: {
        name: data.name,
        color: data.color,
        subcategories: data.subcategories || [],
      },
    });
  }

  async updateCategory(name: string, data: any) {
    return prisma.milestoneCategory.update({
      where: { name },
      data: {
        color: data.color,
        subcategories: data.subcategories,
      },
    });
  }

  async deleteCategory(name: string) {
    return prisma.milestoneCategory.delete({
      where: { name },
    });
  }

  // ── Milestone Template CRUD ──────────────────────────────────────────────────

  async createTemplate(grantId: string, data: any) {
    return prisma.milestoneTemplate.create({
      data: {
        grantId,
        title: data.title,
        description: data.description,
        categoryName: data.categoryName,
        priority: data.priority || 'Medium',
        durationDays: Number(data.durationDays),
        trancheNumber: Number(data.trancheNumber),
        sprFrequency: (data.sprFrequency as SprFrequency) || SprFrequency.MONTHLY,
        sprCount: Number(data.sprCount) || 1,
        sprTypes: Array.isArray(data.sprTypes) ? data.sprTypes : [],
        allocatedFundPct: Number(data.allocatedFundPct) || 0,
        order: Number(data.order) || 0,
        isActive: data.isActive !== false,
      },
    });
  }

  async getTemplatesByGrant(grantId: string) {
    return prisma.milestoneTemplate.findMany({
      where: { grantId, isActive: true },
      orderBy: [{ trancheNumber: 'asc' }, { order: 'asc' }],
    });
  }

  async updateTemplate(id: string, data: any) {
    return prisma.milestoneTemplate.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        categoryName: data.categoryName,
        priority: data.priority,
        durationDays: data.durationDays !== undefined ? Number(data.durationDays) : undefined,
        trancheNumber: data.trancheNumber !== undefined ? Number(data.trancheNumber) : undefined,
        sprFrequency: data.sprFrequency as SprFrequency | undefined,
        sprCount: data.sprCount !== undefined ? Number(data.sprCount) : undefined,
        allocatedFundPct: data.allocatedFundPct !== undefined ? Number(data.allocatedFundPct) : undefined,
        order: data.order !== undefined ? Number(data.order) : undefined,
        isActive: data.isActive,
      },
    });
  }

  async deleteTemplate(id: string) {
    return prisma.milestoneTemplate.delete({ where: { id } });
  }

  // ── Auto-assign templates when grant is allocated to a startup ───────────────

  async autoAssignFromTemplates(
    startupId: string,
    grantId: string,
    allocationDate: Date,
    tranches: { id: string; installmentNo: number; amount: number }[]
  ) {
    const templates = await prisma.milestoneTemplate.findMany({
      where: { grantId, isActive: true },
      orderBy: [{ trancheNumber: 'asc' }, { order: 'asc' }],
    });

    console.log('[AutoAssign] grantId:', grantId, '| templates found:', templates.length);
    if (templates.length === 0) return [];

    // Delete ALL existing milestones for this startup (idempotent re-trigger)
    await prisma.milestone.deleteMany({ where: { startupId } });

    // Ensure all required categories exist (upsert so FK never fails)
    const uniqueCategories = [...new Set(templates.map((t) => t.categoryName))];
    await Promise.all(
      uniqueCategories.map((name) =>
        prisma.milestoneCategory.upsert({
          where: { name },
          update: {},
          create: { name, color: 'bg-blue-500' },
        })
      )
    );

    const trancheMap = new Map(tranches.map((t) => [t.installmentNo, t]));

    const milestonesCreated = await prisma.$transaction(
      templates.map((tpl) => {
        const tranche = trancheMap.get(tpl.trancheNumber);
        const plannedStart = new Date(allocationDate);
        const plannedEnd = new Date(allocationDate);
        plannedEnd.setDate(plannedEnd.getDate() + tpl.durationDays);

        const allocatedFund = tranche
          ? (tranche.amount * tpl.allocatedFundPct) / 100
          : 0;

        return prisma.milestone.create({
          data: {
            startupId,
            templateId: tpl.id,
            title: tpl.title,
            description: tpl.description,
            categoryName: tpl.categoryName,
            priority: tpl.priority,
            plannedStart,
            plannedEnd,
            allocatedFund,
            sprFrequency: tpl.sprFrequency,
            sprCount: tpl.sprCount,
            sprTypeMapping: tpl.sprTypes,
            trancheId: tranche?.id || null,
            status: MilestoneStatus.NOT_STARTED,
            approvalStatus: AssessmentApprovalStatus.DRAFT,
          },
        });
      })
    );

    return milestonesCreated;
  }

  // ── Milestone Detail — all related data in one query ─────────────────────────

  async getMilestoneDetail(id: string) {
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: {
        category: true,
        template: true,
        tranche: {
          include: {
            utilisationCertificate: {
              include: { entries: { include: { budgetHead: true } } },
            },
          },
        },
        sprs: {
          orderBy: { submissionDate: 'asc' },
          include: { assessment: true },
        },
      },
    });

    if (!milestone) return null;

    return milestone;
  }

  async getAlerts() {
    const alerts: any[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // 1. Missed Milestones
    const missedMilestones = await prisma.milestone.findMany({
      where: {
        plannedEnd: { lt: now },
        status: { not: 'COMPLETED' },
      },
      include: { startup: { select: { startupProfile: true } } },
    });

    missedMilestones.forEach(m => {
      const companyName = m.startup?.startupProfile?.companyName || m.startupId;
      alerts.push({
        type: 'danger',
        severity: 'critical',
        date: m.plannedEnd.toISOString().split('T')[0],
        message: `${m.id} (${companyName}) - At Risk: Milestone "${m.title}" is past its deadline.`,
        timestamp: m.plannedEnd.getTime()
      });
    });

    // 2. Stale KPIs
    const startups = await prisma.user.findMany({
      where: { role: 'STARTUP' },
      include: {
        startupProgressReports: {
          orderBy: { submissionDate: 'desc' },
          take: 1,
        },
        startupProfile: true,
      },
    });

    startups.forEach(s => {
      const latestSPR = s.startupProgressReports[0];
      const companyName = s.startupProfile?.companyName || s.email;
      if (!latestSPR || latestSPR.submissionDate < thirtyDaysAgo) {
        alerts.push({
          type: 'warning',
          severity: 'high',
          date: latestSPR ? latestSPR.submissionDate.toISOString().split('T')[0] : 'Never',
          message: `SPR Missing (${companyName}) - High Risk: KPI report not submitted in the last 30 days.`,
          timestamp: latestSPR ? latestSPR.submissionDate.getTime() : 0
        });
      }
    });

    // Sort by timestamp asc (oldest missed deadlines first)
    alerts.sort((a, b) => a.timestamp - b.timestamp);

    return alerts;
  }
}
