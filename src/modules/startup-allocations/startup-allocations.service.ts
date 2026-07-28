import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';
import { MilestoneService } from '../milestones/milestones.service';

const milestoneService = new MilestoneService();

export class StartupAllocationsService {
  /**
   * Generates a sequential allocation code: STARTUP-ALC-YYYY-XXX
   */
  static async generateAllocationCode() {
    const currentYear = new Date().getFullYear();
    const prefix = `SGA-${currentYear}`;
    
    const latest = await prisma.startupGrantAllocation.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' }
    });

    let nextNumber = 1;
    if (latest && latest.code) {
      const parts = latest.code.split('-');
      const lastNumber = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Creates a new startup grant allocation
   */
  static async createAllocation(data: any) {
    const { applicationId, grantId, sanctionedAmount, sanctionDate, tranches, ...rest } = data;

    // 1. Validate application
    const application = await prisma.startupApplication.findUnique({
      where: { id: applicationId },
      include: { grantAllocation: true },
    });

    if (!application) throw new NotFoundError('Startup application not found');
    if (application.grantAllocation) throw new BadRequestError('This application already has a grant allocation');

    // 2. Validate grant master
    const grantMaster = await prisma.grant.findUnique({
      where: { id: grantId }
    });

    if (!grantMaster) throw new NotFoundError('Grant Master not found');

    // 3. Prepare data
    const code = await this.generateAllocationCode();
    const parsedAmount = parseFloat(String(sanctionedAmount)) || 0;
    const parsedDate = new Date(sanctionDate);

    // 4. Create in transaction
    return await prisma.$transaction(async (tx) => {
      const allocation = await tx.startupGrantAllocation.create({
        data: {
          applicationId,
          grantId,
          code,
          sanctionedAmount: parsedAmount,
          sanctionDate: parsedDate,
          approvalCommittee: rest.approvalCommittee,
          remarks: rest.remarks,
          status: data.status || 'Approved',
              tranches: {
                create: tranches.map((t: any, index: number) => ({
                  installmentNo: t.installmentNo || index + 1,
                  amount: parseFloat(String(t.amount)) || 0,
                  releaseCondition: t.releaseCondition,
                  expectedDate: t.expectedDate ? new Date(t.expectedDate) : null,
                  status: 'Pending'
                }))
              }
        },
        include: {
          tranches: true,
          application: {
            select: {
              startupName: true,
              applicationNo: true
            }
          },
          grant: {
            select: {
              name: true
            }
          }
        }

      });

      // Auto-assign milestone templates for this startup (non-blocking — failure does not roll back allocation)
      try {
        const startupUserId = application.userId;
        const tranchesForAssign = allocation.tranches.map((t: any) => ({
          id: t.id,
          installmentNo: t.installmentNo,
          amount: t.amount,
        }));
        await milestoneService.autoAssignFromTemplates(
          startupUserId,
          grantId,
          parsedDate,
          tranchesForAssign
        );
      } catch (err) {
        // Log but do not fail the allocation — templates may not exist yet
        console.warn('[MilestoneAutoAssign] Could not auto-assign templates:', err);
      }

      return allocation;
    });
  }

  /**
   * Lists all allocations
   */
  static async getAllAllocations() {
    return await prisma.startupGrantAllocation.findMany({
      include: {
        application: {
          select: {
            startupName: true,
            applicationNo: true,
            dpiitNumber: true,
            mainSector: true,
            subSectors: true,
            fullName: true,
            email: true,
            mobile: true,
            stage: true,
            city: true,
            district: true,
            state: true,
            legalStatus: true,
            cin: true,
            pan: true,
            gstin: true
          }
        },
        grant: {
          select: {
            name: true,
            code: true,
            type: true,
            source: true,
            agency: true
          }
        },
        tranches: {
          include: {
            milestones: true
          },
          orderBy: {
            installmentNo: 'asc'
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }


  /**
   * Gets a single allocation with full details
   */
  static async getAllocationById(id: string) {
    const allocation = await prisma.startupGrantAllocation.findUnique({
      where: { id },
      include: {
        application: true,
        grant: true,
        tranches: {
          include: {
            milestones: true
          },
          orderBy: {
            installmentNo: 'asc'
          }
        }
      }
    });

    if (!allocation) throw new NotFoundError('Allocation not found');
    return allocation;
  }

  /**
   * Updates a specific tranche (e.g., recording a payment/receipt)
   */
  static async updateTranche(id: string, data: any) {
    const tranche = await prisma.startupGrantTranche.findUnique({
      where: { id },
      include: { allocation: true }
    });

    if (!tranche) throw new NotFoundError('Tranche not found');

    const updateData: any = { ...data };
    
    // Parse dates if provided as strings
    if (data.expectedDate) updateData.expectedDate = new Date(data.expectedDate);
    if (data.paymentDate) updateData.paymentDate = new Date(data.paymentDate);

    // Auto-update status if UTR is provided
    if (data.utr && (tranche.status === 'Pending' || tranche.status === 'Eligible')) {
      updateData.status = 'Released';
      if (!updateData.paymentDate) updateData.paymentDate = new Date();
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Update the tranche
      const updatedTranche = await tx.startupGrantTranche.update({
        where: { id },
        data: updateData
      });

      // 2. Recalculate totals for the parent allocation
      const allTranches = await tx.startupGrantTranche.findMany({
        where: { allocationId: tranche.allocationId }
      });

      const totalReleased = allTranches
        .filter(t => t.status?.toUpperCase() === 'RELEASED')
        .reduce((sum, t) => sum + t.amount, 0);

      // Note: totalUtilised logic can be added here if tranches have utilization data
      // For now, we update totalReleased based on tranche status
      await tx.startupGrantAllocation.update({
        where: { id: tranche.allocationId },
        data: { 
          totalReleased
          // totalUtilised would be updated here too if tracked per tranche
        }
      });

      return updatedTranche;
    });
  }

  /**
   * Updates an existing startup grant allocation (only allowed if status is 'Draft')
   */
  static async updateAllocation(id: string, data: any) {
    const { tranches, ...rest } = data;

    const existing = await prisma.startupGrantAllocation.findUnique({
      where: { id },
      include: { tranches: true }
    });

    if (!existing) throw new NotFoundError('Allocation not found');
    if (existing.status !== 'Draft') {
      throw new BadRequestError('Only draft allocations can be edited');
    }

    const parsedAmount = rest.sanctionedAmount !== undefined ? parseFloat(String(rest.sanctionedAmount)) || 0 : existing.sanctionedAmount;
    const parsedDate = rest.sanctionDate ? new Date(rest.sanctionDate) : existing.sanctionDate;

    return await prisma.$transaction(async (tx) => {
      // 1. Delete existing tranches to reconcile completely
      if (tranches) {
        await tx.startupGrantTranche.deleteMany({
          where: { allocationId: id }
        });
      }

      // 2. Update parent allocation and recreate tranches
      const updated = await tx.startupGrantAllocation.update({
        where: { id },
        data: {
          sanctionedAmount: parsedAmount,
          sanctionDate: parsedDate,
          approvalCommittee: rest.approvalCommittee !== undefined ? rest.approvalCommittee : existing.approvalCommittee,
          remarks: rest.remarks !== undefined ? rest.remarks : existing.remarks,
          status: rest.status || existing.status,
          ...(tranches && {
            tranches: {
              create: tranches.map((t: any, index: number) => ({
                installmentNo: t.installmentNo || index + 1,
                amount: parseFloat(String(t.amount)) || 0,
                releaseCondition: t.releaseCondition,
                expectedDate: t.expectedDate ? new Date(t.expectedDate) : null,
                status: 'Pending'
              }))
            }
          })
        },
        include: {
          tranches: {
            orderBy: { installmentNo: 'asc' }
          },
          application: {
            select: {
              startupName: true,
              applicationNo: true
            }
          },
          grant: {
            select: {
              name: true
            }
          }
        }
      });

      return updated;
    });
  }

  /**
   * Manually re-triggers milestone auto-assign for an existing allocation
   */
  static async retriggerMilestones(allocationId: string) {
    const allocation = await prisma.startupGrantAllocation.findUnique({
      where: { id: allocationId },
      include: {
        application: true,
        tranches: true,
      },
    });

    if (!allocation) throw new Error('Allocation not found');

    const startupUserId = allocation.application.userId;
    const tranchesForAssign = allocation.tranches.map((t: any) => ({
      id: t.id,
      installmentNo: t.installmentNo,
      amount: t.amount,
    }));

    console.log('[RetriggerMilestones] allocationId:', allocationId, 'grantId:', allocation.grantId, 'startupUserId:', startupUserId, 'tranches:', tranchesForAssign);
    return await milestoneService.autoAssignFromTemplates(
      startupUserId,
      allocation.grantId,
      allocation.sanctionDate,
      tranchesForAssign
    );
  }

  /**
   * Gets allocation for a specific application (Startup Portal)
   */
  static async getAllocationByApplicationId(applicationId: string) {
    const allocation = await prisma.startupGrantAllocation.findUnique({
      where: { applicationId },
      include: {
        grant: true,
        tranches: {
          include: {
            milestones: true
          },
          orderBy: {
            installmentNo: 'asc'
          }
        }
      }
    });

    if (allocation && allocation.status === 'Draft') {
      return null;
    }

    return allocation;
  }

  /**
   * Gets allocation for a specific startup (by user ID)
   */
  static async getAllocationByUserId(userId: string) {
    const application = await prisma.startupApplication.findFirst({
      where: { userId }
    });

    if (!application) return null;

    return await this.getAllocationByApplicationId(application.id);
  }
}
