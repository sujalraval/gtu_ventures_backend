import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';

export class InventoryService {
  // --- Asset Directory Services ---
  
  static async getAllItems(filters: { category?: string; status?: string; search?: string }) {
    const whereClause: any = {};

    if (filters.category && filters.category !== 'ALL') {
      whereClause.category = filters.category;
    }

    if (filters.status && filters.status !== 'ALL') {
      whereClause.status = filters.status;
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      whereClause.OR = [
        { name: { contains: searchLower, mode: 'insensitive' } },
        { brand: { contains: searchLower, mode: 'insensitive' } },
        { serialNumber: { contains: searchLower, mode: 'insensitive' } },
        { location: { contains: searchLower, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      include: {
        allocations: {
          where: { returnedAt: null }, // Fetch only active allocations
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                startupProfile: {
                  select: {
                    companyName: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format the items to flatten assignee details to match the frontend expectations
    return items.map(item => {
      const activeAllocation = item.allocations[0];
      return {
        id: item.id,
        name: item.name,
        brand: item.brand,
        serialNumber: item.serialNumber,
        category: item.category,
        status: item.status,
        location: item.location,
        purchaseDate: item.purchaseDate ? item.purchaseDate.toISOString().split('T')[0] : null,
        purchaseCost: item.purchaseCost,
        remarks: item.remarks,
        assigneeId: activeAllocation?.user?.id || '',
        assigneeName: activeAllocation?.user?.startupProfile?.companyName || activeAllocation?.user?.name || '',
        assigneeType: activeAllocation?.user?.role || '',
        allocationId: activeAllocation?.id || '',
      };
    });
  }

  static async createItem(data: {
    name: string;
    brand?: string;
    serialNumber?: string;
    category: string;
    location?: string;
    purchaseDate?: string;
    purchaseCost?: number;
    remarks?: string;
  }) {
    if (data.serialNumber) {
      const existing = await prisma.inventoryItem.findUnique({
        where: { serialNumber: data.serialNumber }
      });
      if (existing) {
        throw new BadRequestError(`An asset with serial number "${data.serialNumber}" already exists.`);
      }
    }

    return prisma.inventoryItem.create({
      data: {
        name: data.name,
        brand: data.brand || 'Generic',
        serialNumber: data.serialNumber || `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        category: data.category,
        status: 'AVAILABLE',
        location: data.location || 'Central Storage',
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchaseCost: data.purchaseCost || 0,
        remarks: data.remarks,
      }
    });
  }

  static async updateItemStatus(id: string, status: string) {
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Asset not found.');

    return prisma.inventoryItem.update({
      where: { id },
      data: { status }
    });
  }

  // --- Allocation Management Services ---

  static async createAllocation(data: {
    itemId: string;
    userId: string;
    expectedReturnDate?: string;
    checkoutCondition?: string;
    remarks?: string;
    verifiedByAdmin?: boolean;
  }) {
    const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
    if (!item) throw new NotFoundError('Asset not found.');
    if (item.status !== 'AVAILABLE') {
      throw new BadRequestError(`Asset cannot be allocated. Current status is ${item.status}.`);
    }

    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new NotFoundError('Assignee user profile not found.');

    // Transaction to create allocation and mark item as ALLOCATED
    return prisma.$transaction(async (tx) => {
      const allocation = await tx.inventoryAllocation.create({
        data: {
          itemId: data.itemId,
          userId: data.userId,
          expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
          checkoutCondition: data.checkoutCondition || 'Good',
          remarks: data.remarks,
          verifiedByAdmin: data.verifiedByAdmin !== undefined ? data.verifiedByAdmin : true,
        }
      });

      await tx.inventoryItem.update({
        where: { id: data.itemId },
        data: { status: 'ALLOCATED' }
      });

      return allocation;
    });
  }

  static async returnAllocation(data: {
    allocationId: string;
    returnCondition: string;
    remarks?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const alloc = await tx.inventoryAllocation.findUnique({
        where: { id: data.allocationId }
      });
      if (!alloc) throw new NotFoundError('Active allocation record not found.');
      if (alloc.returnedAt) throw new BadRequestError('Asset has already been checked back in.');

      const isDamaged = data.returnCondition.includes('Damaged') || data.returnCondition.includes('Repair');
      const nextStatus = isDamaged ? 'MAINTENANCE' : 'AVAILABLE';

      // Update allocation check-in timestamps
      const updatedAllocation = await tx.inventoryAllocation.update({
        where: { id: data.allocationId },
        data: {
          returnedAt: new Date(),
          returnCondition: data.returnCondition,
          remarks: data.remarks,
        }
      });

      // Update item status
      await tx.inventoryItem.update({
        where: { id: alloc.itemId },
        data: { status: nextStatus }
      });

      // If damaged, automatically create an active maintenance work order ticket
      if (isDamaged) {
        await tx.inventoryMaintenance.create({
          data: {
            itemId: alloc.itemId,
            vendor: 'Pending Diagnostic Vendor',
            cost: 0,
            status: 'IN_REPAIR',
            remarks: `Auto-created via damaged check-in. Notes: ${data.remarks || 'No notes left'}`
          }
        });
      }

      return updatedAllocation;
    });
  }

  static async getItemHistory(itemId: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId }
    });
    if (!item) throw new NotFoundError('Asset not found.');

    const allocations = await prisma.inventoryAllocation.findMany({
      where: { itemId },
      include: {
        user: {
          select: {
            name: true,
            startupProfile: { select: { companyName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const repairs = await prisma.inventoryMaintenance.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' }
    });

    return {
      item,
      allocations: allocations.map(a => ({
        id: a.id,
        allocatedAt: a.allocatedAt.toISOString().split('T')[0],
        returnedAt: a.returnedAt ? a.returnedAt.toISOString().split('T')[0] : null,
        assigneeName: a.user?.startupProfile?.companyName || a.user?.name || 'Unknown',
        checkoutCondition: a.checkoutCondition,
        returnCondition: a.returnCondition,
        remarks: a.remarks,
      })),
      repairs: repairs.map(r => ({
        id: r.id,
        vendor: r.vendor,
        cost: r.cost,
        status: r.status,
        expectedReturnDate: r.expectedReturnDate ? r.expectedReturnDate.toISOString().split('T')[0] : null,
        remarks: r.remarks,
        date: r.createdAt.toISOString().split('T')[0],
      }))
    };
  }

  // --- Consumables & Office Supplies Services ---

  static async getAllConsumables() {
    return prisma.inventoryConsumable.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createConsumable(data: {
    name: string;
    category: string;
    stock: number;
    alertPoint?: number;
    price?: number;
    location?: string;
  }) {
    return prisma.inventoryConsumable.create({
      data: {
        name: data.name,
        category: data.category,
        stock: data.stock,
        alertPoint: data.alertPoint !== undefined ? data.alertPoint : 5,
        price: data.price || 0,
        location: data.location || 'Supply Cabinet',
      }
    });
  }

  static async adjustConsumableStock(id: string, data: { adjustment: number }) {
    const consumable = await prisma.inventoryConsumable.findUnique({ where: { id } });
    if (!consumable) throw new NotFoundError('Consumable item not found.');

    const nextStock = Math.max(0, consumable.stock + data.adjustment);

    return prisma.inventoryConsumable.update({
      where: { id },
      data: { stock: nextStock }
    });
  }

  // --- Maintenance & Repair Queue Services ---

  static async getAllMaintenanceTickets() {
    return prisma.inventoryMaintenance.findMany({
      include: {
        item: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createMaintenanceTicket(data: {
    itemId: string;
    vendor: string;
    cost?: number;
    expectedReturnDate?: string;
    remarks?: string;
  }) {
    const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } });
    if (!item) throw new NotFoundError('Asset not found.');

    return prisma.$transaction(async (tx) => {
      // Create repair ticket
      const ticket = await tx.inventoryMaintenance.create({
        data: {
          itemId: data.itemId,
          vendor: data.vendor,
          cost: data.cost || 0,
          expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
          remarks: data.remarks,
          status: 'IN_REPAIR'
        }
      });

      // Update asset status to MAINTENANCE
      await tx.inventoryItem.update({
        where: { id: data.itemId },
        data: { status: 'MAINTENANCE' }
      });

      return ticket;
    });
  }

  static async resolveMaintenanceTicket(ticketId: string, status: string = 'RESOLVED') {
    const ticket = await prisma.inventoryMaintenance.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundError('Maintenance ticket not found.');

    return prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.inventoryMaintenance.update({
        where: { id: ticketId },
        data: { status }
      });

      // Restore item back to AVAILABLE stock
      await tx.inventoryItem.update({
        where: { id: ticket.itemId },
        data: { status: 'AVAILABLE' }
      });

      return updatedTicket;
    });
  }

  // --- Dropdown Target Helper ---
  
  static async getCheckoutTargets() {
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['STARTUP', 'STAFF', 'ADMIN', 'SUPER_ADMIN'] },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        role: true,
        startupProfile: {
          select: {
            companyName: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return users.map(u => ({
      id: u.id,
      name: u.startupProfile?.companyName || u.name || 'Staff User',
      type: u.role === 'STARTUP' ? 'STARTUP' : 'STAFF'
    }));
  }

  // --- Unified Activity Log Feed ---

  static async getUnifiedHistoryFeed() {
    const allocations = await prisma.inventoryAllocation.findMany({
      include: {
        item: { select: { name: true } },
        user: {
          select: {
            name: true,
            startupProfile: { select: { companyName: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const repairs = await prisma.inventoryMaintenance.findMany({
      include: {
        item: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const logs: any[] = [];

    allocations.forEach(a => {
      const assigneeName = a.user?.startupProfile?.companyName || a.user?.name || 'User';
      // Checkout log
      logs.push({
        date: a.allocatedAt.toISOString().split('T')[0],
        type: 'ALLOCATE',
        text: `${a.item.name} (${a.itemId}) allocated to ${assigneeName} in condition "${a.checkoutCondition}"`
      });

      // Return log (if returned)
      if (a.returnedAt) {
        logs.push({
          date: a.returnedAt.toISOString().split('T')[0],
          type: 'RETURN',
          text: `${a.item.name} (${a.itemId}) returned by ${assigneeName}. Condition: "${a.returnCondition || 'Good'}"`
        });
      }
    });

    repairs.forEach(r => {
      logs.push({
        date: r.createdAt.toISOString().split('T')[0],
        type: 'MAINTENANCE',
        text: `${r.item.name} (${r.itemId}) routed to Maintenance under repair vendor "${r.vendor}"`
      });

      if (r.status === 'RESOLVED') {
        logs.push({
          date: r.updatedAt.toISOString().split('T')[0],
          type: 'RETURN',
          text: `Maintenance repair resolved for ${r.item.name} (${r.itemId}). Restored to AVAILABLE stock.`
        });
      }
    });

    // Sort combined feed chronologically descending
    return logs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  }
}
