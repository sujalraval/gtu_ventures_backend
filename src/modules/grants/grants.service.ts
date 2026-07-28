import prisma from '../../lib/prisma';
import { NotFoundError } from '../../common/utils/apiError';

export class GrantsService {
  static async getAllGrants() {
    try {
      return await prisma.grant.findMany({
        where: { deletedAt: null },
        include: {
          scheme: {
            select: {
              name: true,
              code: true
            }
          },
          tranches: {
            orderBy: {
              order: 'asc'
            }
          },
          receipts: {
            where: { deletedAt: null },
            orderBy: { date: 'desc' }
          },
          allocations: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' }
          },
          ucBudgetHeads: true
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: any) {
      console.error('Error in getAllGrants:', error);
      throw error;
    }
  }

  static async getGrantById(id: string) {
    const grant = await prisma.grant.findUnique({
      where: { id, deletedAt: null },
      include: {
        scheme: true,
        tranches: {
          orderBy: {
            order: 'asc'
          }
        },
        receipts: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' }
        },
        allocations: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' }
        },
        ucBudgetHeads: true
      }
    });
    if (!grant) throw new NotFoundError('Grant not found');
    return grant;
  }

  static async generateGrantCode() {
    const currentYear = new Date().getFullYear();
    const prefix = `GRT-${currentYear}`;
    
    const latestGrant = await prisma.grant.findFirst({
      where: {
        code: {
          startsWith: prefix
        }
      },
      orderBy: {
        code: 'desc'
      }
    });

    let nextNumber = 1;
    if (latestGrant) {
      const parts = latestGrant.code.split('-');
      const lastNumber = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
  }

  static async createGrant(data: any) {
    const generatedCode = await this.generateGrantCode();
    
    // Extract nested tranches if any
    const { tranches, ucBudgetHeads, ...grantData } = data;

    // Convert string dates to Date objects if they are strings
    if (grantData.startDate) grantData.startDate = new Date(grantData.startDate);
    if (grantData.endDate) grantData.endDate = new Date(grantData.endDate);
    if (grantData.approvalDate) grantData.approvalDate = new Date(grantData.approvalDate);
    if (grantData.closureDate) grantData.closureDate = new Date(grantData.closureDate);

    // Parse numeric fields safely to prevent Prisma validation errors when empty strings are sent
    if (grantData.utilisationPeriod !== undefined && grantData.utilisationPeriod !== "") {
      grantData.utilisationPeriod = parseInt(String(grantData.utilisationPeriod), 10);
    } else {
      delete grantData.utilisationPeriod; // Allow Prisma to use the default values
    }

    if (grantData.totalAmount !== undefined && grantData.totalAmount !== "") {
      const parsed = parseFloat(String(grantData.totalAmount));
      grantData.totalAmount = isNaN(parsed) ? 0 : parsed;
    }

    if (grantData.maxPerStartup !== undefined && grantData.maxPerStartup !== "") {
      const parsed = parseFloat(String(grantData.maxPerStartup));
      grantData.maxPerStartup = isNaN(parsed) ? 0 : parsed;
    }

    return await prisma.grant.create({
      data: {
        ...grantData,
        code: generatedCode,
        tranches: tranches ? {
          create: tranches.map((t: any, index: number) => ({
            milestone: t.milestone,
            percentage: parseFloat(t.percentage),
            amount: parseFloat(t.amount),
            status: t.status || 'Pending',
            order: index
          }))
        } : undefined,
        ucBudgetHeads: ucBudgetHeads ? {
          create: ucBudgetHeads.map((h: any) => ({
            name: h.name,
            allocatedAmount: parseFloat(h.allocatedAmount) || null,
            allocatedPercentage: parseFloat(h.allocatedPercentage) || null,
            isFlexible: h.isFlexible || false,
            description: h.description,
          }))
        } : undefined
      },
      include: {
        tranches: true,
        ucBudgetHeads: true
      }
    });
  }

  static async updateGrant(id: string, data: any) {
    const existing = await this.getGrantById(id);

    const { tranches, ucBudgetHeads, ...grantData } = data;

    // Filter and transform update data
    const updateData: any = { ...grantData };

    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
    if (updateData.approvalDate) updateData.approvalDate = new Date(updateData.approvalDate);
    if (updateData.closureDate) updateData.closureDate = new Date(updateData.closureDate);

    // Parse numeric fields safely
    if (updateData.utilisationPeriod !== undefined) {
      if (updateData.utilisationPeriod === "" || updateData.utilisationPeriod === null) {
        delete updateData.utilisationPeriod;
      } else {
        updateData.utilisationPeriod = parseInt(String(updateData.utilisationPeriod), 10);
      }
    }

    if (updateData.totalAmount !== undefined && updateData.totalAmount !== "" && updateData.totalAmount !== null) {
      const parsed = parseFloat(String(updateData.totalAmount));
      updateData.totalAmount = isNaN(parsed) ? 0 : parsed;
    }

    if (updateData.maxPerStartup !== undefined && updateData.maxPerStartup !== "" && updateData.maxPerStartup !== null) {
      const parsed = parseFloat(String(updateData.maxPerStartup));
      updateData.maxPerStartup = isNaN(parsed) ? 0 : parsed;
    }

    // If tranches are provided, we'll replace existing ones
    if (tranches) {
      return await prisma.$transaction(async (tx) => {
        // Delete old tranches
        await tx.grantTranche.deleteMany({
          where: { grantId: id }
        });

        // Update grant and create new tranches
        return await tx.grant.update({
          where: { id },
          data: {
            ...updateData,
            tranches: {
              create: tranches.map((t: any, index: number) => ({
                milestone: t.milestone,
                percentage: parseFloat(t.percentage) || 0,
                amount: parseFloat(t.amount) || 0,
                status: t.status || 'Pending',
                order: index
              }))
            },
            ucBudgetHeads: ucBudgetHeads ? {
              deleteMany: {},
              create: ucBudgetHeads.map((h: any) => ({
                name: h.name,
                allocatedAmount: parseFloat(h.allocatedAmount) || null,
                allocatedPercentage: parseFloat(h.allocatedPercentage) || null,
                isFlexible: h.isFlexible || false,
                description: h.description,
              }))
            } : undefined
          },
          include: {
            tranches: true,
            ucBudgetHeads: true
          }
        });
      });
    }

    return await prisma.grant.update({
      where: { id },
      data: {
        ...updateData,
        ucBudgetHeads: ucBudgetHeads ? {
          deleteMany: {},
          create: ucBudgetHeads.map((h: any) => ({
            name: h.name,
            allocatedAmount: parseFloat(h.allocatedAmount) || null,
            allocatedPercentage: parseFloat(h.allocatedPercentage) || null,
            isFlexible: h.isFlexible || false,
            description: h.description,
          }))
        } : undefined
      },
      include: {
        tranches: true,
        ucBudgetHeads: true
      }
    });
  }

  static async deleteGrant(id: string) {
    await this.getGrantById(id);
    return await prisma.grant.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  static async generateReceiptCode() {
    const currentYear = new Date().getFullYear();
    const prefix = `REC-${currentYear}`;
    
    const latest = await prisma.grantReceipt.findFirst({
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

  static async generateAllocationCode() {
    const currentYear = new Date().getFullYear();
    const prefix = `ALC-${currentYear}`;
    
    const latest = await prisma.grantAllocation.findFirst({
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

  // --- Grant Receipt Methods ---
  static async addReceipt(grantId: string, data: any) {
    try {
      // Create a clean copy of the data without potentially conflicting fields
      const { grantId: _gid, ...receiptData } = data;
      
      if (receiptData.date) receiptData.date = new Date(receiptData.date);
      if (receiptData.amount) receiptData.amount = parseFloat(String(receiptData.amount));
      
      const code = await this.generateReceiptCode();

      return await prisma.grantReceipt.create({
        data: {
          ...receiptData,
          grantId,
          code
        }
      });
    } catch (error) {
      console.error('Error adding receipt:', error);
      throw error;
    }
  }

  static async getReceiptsByGrant(grantId: string) {
    return await prisma.grantReceipt.findMany({
      where: { grantId, deletedAt: null },
      orderBy: { date: 'desc' }
    });
  }

  static async updateReceipt(id: string, data: any) {
    const { id: _id, grantId: _gid, ...receiptData } = data;
    
    if (receiptData.date) receiptData.date = new Date(receiptData.date);
    if (receiptData.amount) receiptData.amount = parseFloat(String(receiptData.amount));
    
    return await prisma.grantReceipt.update({
      where: { id },
      data: receiptData
    });
  }

  static async deleteReceipt(id: string) {
    return await prisma.grantReceipt.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  // --- Grant Allocation Methods ---
  static async addAllocation(grantId: string, data: any) {
    try {
      const { id: _id, grantId: _gid, ...allocationData } = data;
      const amount = parseFloat(String(allocationData.amount)) || 0;
      const utilized = parseFloat(String(allocationData.utilized)) || 0;

      // Validation: Total allocation cannot exceed sanctioned amount
      const grant = await prisma.grant.findUnique({
        where: { id: grantId },
        include: { allocations: true }
      });

      if (!grant) throw new Error('Grant not found');

      const totalAllocated = grant.allocations.reduce((s, a) => s + a.amount, 0);
      if (totalAllocated + amount > grant.totalAmount) {
        throw new Error(`Insufficient grant budget. Max available for allocation: ₹${grant.totalAmount - totalAllocated}`);
      }

      const code = await this.generateAllocationCode();

      return await prisma.grantAllocation.create({
        data: {
          ...allocationData,
          amount,
          utilized,
          grantId,
          code
        }
      });
    } catch (error) {
      console.error('Error adding allocation:', error);
      throw error;
    }
  }

  static async getAllocationsByGrant(grantId: string) {
    return await prisma.grantAllocation.findMany({
      where: { grantId, deletedAt: null },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async updateAllocation(id: string, data: any) {
    const { id: _id, grantId: _gid, ...allocationData } = data;
    
    if (allocationData.amount !== undefined) {
      const newAmount = parseFloat(String(allocationData.amount));
      
      // Validation
      const currentAllocation = await prisma.grantAllocation.findUnique({
        where: { id },
        include: { grant: { include: { allocations: true } } }
      });

      if (!currentAllocation) throw new Error('Allocation not found');

      const otherAllocations = currentAllocation.grant.allocations.filter(a => a.id !== id);
      const totalOtherAllocated = otherAllocations.reduce((s, a) => s + a.amount, 0);

      if (totalOtherAllocated + newAmount > currentAllocation.grant.totalAmount) {
        throw new Error(`Insufficient grant budget. Max available for this allocation: ₹${currentAllocation.grant.totalAmount - totalOtherAllocated}`);
      }
      
      allocationData.amount = newAmount;
    }

    if (allocationData.utilized !== undefined) {
      allocationData.utilized = parseFloat(String(allocationData.utilized));
    }
    
    return await prisma.grantAllocation.update({
      where: { id },
      data: allocationData
    });
  }


  static async deleteAllocation(id: string) {
    return await prisma.grantAllocation.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
