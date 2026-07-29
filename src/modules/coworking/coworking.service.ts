import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';
import { CoworkingResourceType } from '@prisma/client';
import { sendEmail } from '../../common/utils/mailer';

export class CoworkingService {
  // --- Building Management ---

  static async getAllBuildings() {
    try {
      return await prisma.coworkingBuilding.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Error in getAllBuildings:', error);
      throw error;
    }
  }

  static async getBuildingById(id: string, tx?: any) {
    try {
      const client = tx || prisma;
      const building = await client.coworkingBuilding.findUnique({
        where: { id },
        include: {
          floors: {
            orderBy: { level: 'asc' },
          }
        }
      });
      if (!building) throw new NotFoundError('Building not found');
      return building;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      console.error('Error in getBuildingById:', error);
      throw error;
    }
  }

  static async createBuilding(data: any) {
    return await prisma.$transaction(async (tx) => {
      const buildingCode = (data.code || 'BLDG').toUpperCase();
      
      const building = await tx.coworkingBuilding.create({
        data: {
          name: data.name,
          code: buildingCode,
          address: data.address,
          status: (data.status || 'ACTIVE') as any,
          amenities: data.amenities || [],
          metadata: data.metadata || {},
        }
      });

      // 2. Create initial floors if provided
      if (data.floors && data.floors.length > 0) {
        await tx.coworkingFloor.createMany({
          data: data.floors.map((f: any, index: number) => ({
            buildingId: building.id,
            name: f.name,
            level: f.level ?? index,
            type: (f.type || 'MIXED') as any,
            capacity: f.capacity || 0,
            metadata: f.metadata || {},
          }))
        });
      }

      return this.getBuildingById(building.id, tx);
    });
  }

  static async updateBuilding(id: string, data: any) {
    return await prisma.coworkingBuilding.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code?.toUpperCase(),
        address: data.address,
        status: data.status,
        amenities: data.amenities,
        metadata: data.metadata,
      }
    });
  }

  static async deleteBuilding(id: string) {
    return await prisma.coworkingBuilding.delete({
      where: { id }
    });
  }

  // --- Floor & Zone Management ---

  static async getFloorDetails(floorId: string) {
    const floor = await prisma.coworkingFloor.findUnique({
      where: { id: floorId },
      include: {
        zones: {
          include: {
            _count: { select: { resources: true } }
          }
        }
      }
    });
    if (!floor) throw new NotFoundError('Floor not found');
    return floor;
  }

  static async updateFloor(id: string, data: any) {
    return await prisma.coworkingFloor.update({
      where: { id },
      data: {
        name: data.name,
        level: data.level,
        type: data.type,
        capacity: data.capacity,
        status: data.status,
        metadata: data.metadata,
      }
    });
  }

  static async deleteFloor(id: string) {
    return await prisma.coworkingFloor.delete({
      where: { id }
    });
  }

  static async createFloor(buildingId: string, data: any) {
    try {
      const building = await prisma.coworkingBuilding.findUnique({ where: { id: buildingId } });
      if (!building) throw new NotFoundError('Building not found');

      let level = Number(data.level);
      if (isNaN(level)) {
        const floorCount = await prisma.coworkingFloor.count({ where: { buildingId } });
        level = floorCount;
      }

      return await prisma.coworkingFloor.create({
        data: {
          buildingId,
          name: data.name || `Floor ${level}`,
          level,
          type: (data.type || 'MIXED') as any,
          capacity: Number(data.capacity) || 0,
          status: data.status || 'AVAILABLE',
          metadata: data.metadata || {}
        }
      });
    } catch (error) {
      console.error('Error in createFloor:', error);
      throw error;
    }
  }

  static async createZone(floorId: string, data: any) {
    return await prisma.$transaction(async (tx) => {
      // 1. Get building/floor info for ID generation
      const floor = await tx.coworkingFloor.findUnique({
        where: { id: floorId },
        include: { building: true }
      });
      if (!floor) throw new NotFoundError('Floor not found');

      // 2. Create the Zone
      const zone = await tx.coworkingZone.create({
        data: {
          floorId,
          name: data.name,
          type: (data.type || 'OPEN_WORKSPACE') as any,
          capacity: data.capacity || 0,
          metadata: data.metadata || {},
        }
      });

      // 3. Auto-populate Resources if capacity is provided
      const capacity = parseInt(data.capacity) || 0;
      if (capacity > 0) {
        const resourceData = [];
        const prefix = data.type === 'MEETING_ZONE' ? 'M' : 
                       data.type === 'PRIVATE_OFFICE' ? 'C' : 'D';
        
        for (let i = 1; i <= capacity; i++) {
          const seatCode = `${floor.building.code}-${floor.level}-${zone.name.substring(0, 3).toUpperCase()}-${prefix}${i.toString().padStart(3, '0')}`;
          resourceData.push({
            zoneId: zone.id,
            code: seatCode,
            type: (data.type === 'MEETING_ZONE' ? 'MEETING_ROOM' : 'DESK') as any,
            status: 'AVAILABLE' as any,
            metadata: {},
          });
        }

        await tx.coworkingResource.createMany({
          data: resourceData,
          skipDuplicates: true
        });
      }

      return zone;
    });
  }

  static async updateZone(id: string, data: any) {
    return await prisma.coworkingZone.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        capacity: data.capacity,
        metadata: data.metadata,
      }
    });
  }

  static async deleteZone(id: string) {
    return await prisma.coworkingZone.delete({
      where: { id }
    });
  }

  // --- Resource (Seat/Desk) Management ---

  static async getZoneResources(zoneId: string) {
    return await prisma.coworkingResource.findMany({
      where: { zoneId },
      include: {
        allocations: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { id: true, name: true, email: true, startupProfile: { select: { companyName: true } } } }
          },
          take: 1
        }
      },
      orderBy: { code: 'asc' }
    });
  }

  /**
   * Bulk generate resources for a zone
   */
  static async bulkGenerateResources(zoneId: string, data: { count: number; prefix: string; type: string }) {
    const zone = await prisma.coworkingZone.findUnique({
      where: { id: zoneId },
      include: { floor: { include: { building: true } } }
    });
    if (!zone) throw new NotFoundError('Zone not found');

    const existingCount = await prisma.coworkingResource.count({ where: { zoneId } });
    
    const resourceData = [];
    for (let i = 1; i <= data.count; i++) {
      const index = existingCount + i;
      const zonePrefix = (zone.name || 'ZON').substring(0, 3).toUpperCase();
      const seatCode = `${zone.floor.building.code}-${zone.floor.level}-${zonePrefix}-${data.prefix}${index.toString().padStart(3, '0')}`;
      
      resourceData.push({
        zoneId,
        code: seatCode,
        type: (data.type || 'DESK') as any,
        status: 'AVAILABLE' as any,
        metadata: {},
      });
    }

    return await prisma.coworkingResource.createMany({
      data: resourceData,
      skipDuplicates: true
    });
  }

  static async updateResourceStatus(resourceId: string, status: string) {
    return await prisma.coworkingResource.update({
      where: { id: resourceId },
      data: { status: status as any }
    });
  }

  // --- Allocation Management ---

  static async getAllAllocations() {
    return await prisma.coworkingAllocation.findMany({
      include: {
        resource: {
          include: { zone: { include: { floor: { include: { building: true } } } } }
        },
        user: { 
          select: { 
            id: true, 
            name: true, 
            email: true, 
            startupProfile: { select: { companyName: true } } 
          } 
        },
        costPlan: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createAllocation(data: any) {
    return await prisma.$transaction(async (tx) => {
      const allocation = await tx.coworkingAllocation.create({
        data: {
          resourceId: data.resourceId,
          userId: data.userId,
          costPlanId: data.costPlanId,
          type: data.type || 'PAID',
          category: data.category,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          status: data.status || 'PENDING',
          totalCost: data.totalCost || 0,
          remarks: data.remarks
        }
      });

      if (allocation.status === 'ACTIVE') {
        await tx.coworkingResource.update({
          where: { id: data.resourceId },
          data: { status: 'OCCUPIED' }
        });
      }

      if (data.coworkingCredits !== undefined || data.coworkingDailyLimit !== undefined) {
        const updateData: any = {};
        if (data.coworkingCredits !== undefined) updateData.coworkingCredits = Number(data.coworkingCredits);
        if (data.coworkingDailyLimit !== undefined) updateData.coworkingDailyLimit = Number(data.coworkingDailyLimit);
        await tx.user.update({
          where: { id: data.userId },
          data: updateData
        });
      }

      return allocation;
    });
  }

  static async createBatchAllocation(data: any) {
    return await prisma.$transaction(async (tx) => {
      const allocations = [];
      const timestamp = Date.now().toString().slice(-4);
      
      const costPlan = data.costPlanId ? await tx.coworkingCostPlan.findUnique({ where: { id: data.costPlanId } }) : null;
      
      let calculatedTotal = 0;
      if (costPlan && data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let periods = 1;
        if (costPlan.billedPer === 'MONTH') periods = Math.max(1, Math.ceil(diffDays / 30));
        else if (costPlan.billedPer === 'DAY') periods = diffDays;
        
        const base = costPlan.rate * periods;
        calculatedTotal = base + (base * (costPlan.gstPercent / 100));
      }

      for (let i = 0; i < data.resourceIds.length; i++) {
        const resourceId = data.resourceIds[i];
        const allocCode = `G-ALLOC-${new Date().getFullYear()}-${timestamp}${i}`;
        
        const allocation = await tx.coworkingAllocation.create({
          data: {
            code: allocCode,
            resourceId,
            userId: data.userId,
            costPlanId: data.costPlanId || null,
            type: data.type || 'PAID',
            category: data.category || 'GENERAL',
            startDate: new Date(data.startDate),
            endDate: data.endDate ? new Date(data.endDate) : null,
            status: 'ACTIVE',
            totalCost: calculatedTotal, 
            securityDeposit: data.deposit || 0,
            remarks: data.remarks
          }
        });

        await tx.coworkingResource.update({
          where: { id: resourceId },
          data: { status: 'OCCUPIED' }
        });

        allocations.push(allocation);
      }

      if (data.coworkingCredits !== undefined || data.coworkingDailyLimit !== undefined) {
        const updateData: any = {};
        if (data.coworkingCredits !== undefined) updateData.coworkingCredits = Number(data.coworkingCredits);
        if (data.coworkingDailyLimit !== undefined) updateData.coworkingDailyLimit = Number(data.coworkingDailyLimit);
        await tx.user.update({
          where: { id: data.userId },
          data: updateData
        });
      }

      return allocations;
    });
  }

  static async updateAllocation(id: string, data: any) {
    const costPlan = data.costPlanId ? await prisma.coworkingCostPlan.findUnique({ where: { id: data.costPlanId } }) : null;
    
    let calculatedTotal = data.totalCost || 0;
    if (costPlan && data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let periods = 1;
      if (costPlan.billedPer === 'MONTH') periods = Math.max(1, Math.ceil(diffDays / 30));
      else if (costPlan.billedPer === 'DAY') periods = diffDays;
      
      const base = costPlan.rate * periods;
      calculatedTotal = base + (base * (costPlan.gstPercent / 100));
    }

    return await prisma.coworkingAllocation.update({
      where: { id },
      data: {
        userId: data.userId,
        resourceId: data.resourceId,
        costPlanId: data.costPlanId || null,
        type: data.type,
        category: data.category,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: data.status,
        totalCost: calculatedTotal,
        securityDeposit: data.securityDeposit || 0,
        remarks: data.remarks
      },
      include: {
        resource: true,
        user: true,
        costPlan: true
      }
    });
  }

  static async updateAllocationStatus(id: string, status: string) {
    return await prisma.$transaction(async (tx) => {
      const allocation = await tx.coworkingAllocation.update({
        where: { id },
        data: { status: status as any },
        include: { resource: true }
      });

      const upperStatus = status.toUpperCase();

      if (upperStatus === 'ACTIVE') {
        await tx.coworkingResource.update({
          where: { id: allocation.resourceId },
          data: { status: 'OCCUPIED' }
        });
      } else if (upperStatus === 'RELEASED' || upperStatus === 'EXPIRED' || upperStatus === 'REJECTED' || upperStatus === 'CANCELLED') {
        await tx.coworkingResource.update({
          where: { id: allocation.resourceId },
          data: { status: 'AVAILABLE' }
        });
      }

      return allocation;
    });
  }

  // --- Cost Plan Management ---

  static async getAllCostPlans() {
    const plans = await prisma.coworkingCostPlan.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    // Auto-seed default plans if empty
    if (plans.length === 0) {
      const defaults = [
        { name: 'Standard Desk (Monthly)', spaceType: 'DESK', billedPer: 'MONTH', rate: 3000 },
        { name: 'Economy Desk (Daily)', spaceType: 'DESK', billedPer: 'DAY', rate: 200 },
        { name: 'Premium Cabin (Monthly)', spaceType: 'CABIN', billedPer: 'MONTH', rate: 15000 },
        { name: 'Meeting Room (Hourly)', spaceType: 'MEETING_ROOM', billedPer: 'HOUR', rate: 500 }
      ];

      await prisma.coworkingCostPlan.createMany({
        data: defaults.map(p => ({ 
          ...p, 
          isActive: true, 
          gstPercent: 18,
          spaceType: p.spaceType as CoworkingResourceType 
        }))
      });

      return await prisma.coworkingCostPlan.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });
    }

    return plans;
  }

  static async createCostPlan(data: any) {
    return await prisma.coworkingCostPlan.create({
      data: {
        name: data.name,
        spaceType: data.spaceType as any,
        billedPer: data.billedPer,
        rate: data.rate,
        gstPercent: data.gstPercent || 18,
      }
    });
  }

  static async updateCostPlan(id: string, data: any) {
    return await prisma.coworkingCostPlan.update({
      where: { id },
      data: {
        name: data.name,
        spaceType: data.spaceType as any,
        billedPer: data.billedPer,
        rate: data.rate,
        gstPercent: data.gstPercent || 18,
        isActive: data.isActive,
      }
    });
  }

  static async deleteCostPlan(id: string) {
    return await prisma.coworkingCostPlan.delete({
      where: { id }
    });
  }

  static async getStartupUsers() {
    const users = await prisma.user.findMany({
      where: { role: 'STARTUP' },
      include: { startupProfile: true }
    });

    return users.map(u => ({
      id: u.id,
      name: (u as any).startupProfile?.companyName || u.name || 'Unknown Startup',
      email: u.email
    }));
  }

  static async deleteAllocation(id: string) {
    return await prisma.$transaction(async (tx) => {
      const allocation = await tx.coworkingAllocation.findUnique({
        where: { id }
      });
      if (!allocation) throw new NotFoundError('Allocation not found');

      // Release the seat if it was active
      await tx.coworkingResource.update({
        where: { id: allocation.resourceId },
        data: { status: 'AVAILABLE' }
      });

      return await tx.coworkingAllocation.delete({
        where: { id }
      });
    });
  }

  // --- Booking & Credits Management ---

  static async getUserMonthlyCreditsAndUsage(userId: string, dateInput?: string | Date) {
    try {
      const date = dateInput ? new Date(dateInput) : new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const billingMonth = `${year}-${month}`;

      const firstDay = new Date(year, date.getMonth(), 1);
      const lastDay = new Date(year, date.getMonth() + 1, 0, 23, 59, 59, 999);

      // Fetch user to ensure they exist
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { startupProfile: true }
      });
      if (!user) throw new NotFoundError('Startup User not found');

      // Fetch all active seat allocations (DESK or CABIN) for this user that overlap with the current month
      const activeSeatAllocations = await prisma.coworkingAllocation.findMany({
        where: {
          userId,
          status: 'ACTIVE',
          startDate: { lte: lastDay },
          OR: [
            { endDate: null },
            { endDate: { gte: firstDay } }
          ],
          resource: {
            type: { in: ['DESK', 'CABIN'] }
          }
        },
        include: { resource: true }
      });

      const activeSeatsCount = activeSeatAllocations.length;
      const creditMultiplier = 2; // 2 hours of credits per allocated seat per month
      const creditsSeat = activeSeatsCount * creditMultiplier;

      // Fetch manual admin quota overrides for this month
      const quotaOverride = await prisma.coworkingQuota.findUnique({
        where: {
          userId_billingMonth: { userId, billingMonth }
        }
      });
      const creditsAdmin = quotaOverride ? quotaOverride.additionalCredits : 0;
      const adminRemarks = quotaOverride ? quotaOverride.remarks : null;

      // If user has set coworkingCredits, use it as baseline. Else fallback to creditsSeat.
      const creditsBase = user.coworkingCredits ?? creditsSeat;
      const creditsTotal = creditsBase + creditsAdmin;

      // Sum the duration of all confirmed bookings of MEETING_ROOMs for this user in this calendar month
      const bookingsInMonth = await prisma.coworkingBooking.findMany({
        where: {
          userId,
          status: 'CONFIRMED',
          startTime: { gte: firstDay, lte: lastDay },
          resource: { type: 'MEETING_ROOM' }
        }
      });

      const creditsUsed = bookingsInMonth.reduce((sum, b) => sum + b.duration, 0);
      const creditsRemaining = Math.max(0, creditsTotal - creditsUsed);

      return {
        billingMonth,
        creditsTotal,
        totalCredits: creditsTotal, // compatible key
        baseCredits: creditsBase,
        creditsSeat,
        creditsAdmin,
        adminCredits: creditsAdmin, // compatible key
        adminRemarks,
        creditsUsed,
        usedCredits: creditsUsed, // compatible key
        creditsRemaining,
        remainingCredits: creditsRemaining, // compatible key
        activeSeatsCount,
        activeSeats: activeSeatsCount, // compatible key
        coworkingDailyLimit: user.coworkingDailyLimit ?? 4,
        activeAllocations: activeSeatAllocations.map(a => ({
          id: a.id,
          code: a.code,
          resourceCode: a.resource.code,
          resourceType: a.resource.type,
          startDate: a.startDate,
          endDate: a.endDate,
        }))
      };
    } catch (error) {
      console.error('Error in getUserMonthlyCreditsAndUsage:', error);
      throw error;
    }
  }

  static async grantAdminCredits(userId: string, billingMonth: string, additionalCredits: number, remarks?: string) {
    try {
      if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
        throw new BadRequestError('Invalid month format. Please use YYYY-MM.');
      }
      if (additionalCredits < 0) {
        throw new BadRequestError('Credits cannot be negative.');
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');

      return await prisma.coworkingQuota.upsert({
        where: {
          userId_billingMonth: { userId, billingMonth }
        },
        update: { additionalCredits, remarks },
        create: { userId, billingMonth, additionalCredits, remarks }
      });
    } catch (error) {
      console.error('Error in grantAdminCredits:', error);
      throw error;
    }
  }

  static async getQuotaHistory(userId: string) {
    try {
      return await prisma.coworkingQuota.findMany({
        where: { userId },
        orderBy: { billingMonth: 'desc' }
      });
    } catch (error) {
      console.error('Error in getQuotaHistory:', error);
      throw error;
    }
  }

  static async createMeetingRoomBooking(userId: string, data: { resourceId: string; startTime: string; endTime: string; purpose?: string }) {
    try {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestError('Invalid booking dates provided.');
      }
      if (start >= end) {
        throw new BadRequestError('Start time must be before end time.');
      }

      const durationMs = end.getTime() - start.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      if (durationHours < 0.25) {
        throw new BadRequestError('Booking must be at least 15 minutes long.');
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('Startup user not found');

      const resource = await prisma.coworkingResource.findUnique({
        where: { id: data.resourceId }
      });
      if (!resource) throw new NotFoundError('Meeting room resource not found');
      if (resource.type !== 'MEETING_ROOM') {
         throw new BadRequestError('Resource must be a meeting room to book.');
      }

      const conflictingBooking = await prisma.coworkingBooking.findFirst({
        where: {
          resourceId: data.resourceId,
          status: 'CONFIRMED',
          startTime: { lt: end },
          endTime: { gt: start }
        }
      });
      if (conflictingBooking) {
        throw new BadRequestError('Meeting room is already booked during this time slot.');
      }

      // Check daily booking limit for the startup
      const bookingDayStart = new Date(start);
      bookingDayStart.setHours(0, 0, 0, 0);

      const bookingDayEnd = new Date(start);
      bookingDayEnd.setHours(23, 59, 59, 999);

      const bookingsOnDay = await prisma.coworkingBooking.findMany({
        where: {
          userId,
          status: 'CONFIRMED',
          startTime: { gte: bookingDayStart, lte: bookingDayEnd },
          resource: { type: 'MEETING_ROOM' }
        }
      });

      const hoursBookedOnDay = bookingsOnDay.reduce((sum, b) => sum + b.duration, 0);
      const dailyLimit = user.coworkingDailyLimit ?? 4;

      if (hoursBookedOnDay + durationHours > dailyLimit) {
        throw new BadRequestError(`Booking Blocked: You have reached your daily limit for meeting room bookings. You can book a maximum of ${dailyLimit} hours per day. Hours already booked today: ${hoursBookedOnDay.toFixed(1)} hours. Requested booking: ${durationHours.toFixed(1)} hours.`);
      }

      const quota = await this.getUserMonthlyCreditsAndUsage(userId, start);
      if (quota.creditsUsed + durationHours > quota.creditsTotal) {
        throw new BadRequestError(`Booking Blocked: You have reached your monthly meeting room credit limit. Remaining credit: ${quota.creditsRemaining.toFixed(1)} hours. Requested: ${durationHours.toFixed(1)} hours.`);
      }

      return await prisma.coworkingBooking.create({
        data: {
          resourceId: data.resourceId,
          userId,
          startTime: start,
          endTime: end,
          duration: durationHours,
          purpose: data.purpose,
          status: 'CONFIRMED'
        },
        include: { resource: true }
      });
    } catch (error) {
      console.error('Error in createMeetingRoomBooking:', error);
      throw error;
    }
  }

  static async updateUserCoworkingLimits(userId: string, data: { coworkingCredits: number; coworkingDailyLimit: number }) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');

      return await prisma.user.update({
        where: { id: userId },
        data: {
          coworkingCredits: Number(data.coworkingCredits),
          coworkingDailyLimit: Number(data.coworkingDailyLimit)
        }
      });
    } catch (error) {
      console.error('Error in updateUserCoworkingLimits:', error);
      throw error;
    }
  }

  static async cancelMeetingRoomBooking(userId: string, bookingId: string) {
    try {
      const booking = await prisma.coworkingBooking.findFirst({
        where: { id: bookingId, userId }
      });
      if (!booking) throw new NotFoundError('Booking not found or access denied');
      if (booking.status === 'CANCELLED') {
        throw new BadRequestError('Booking is already cancelled');
      }

      return await prisma.coworkingBooking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' }
      });
    } catch (error) {
      console.error('Error in cancelMeetingRoomBooking:', error);
      throw error;
    }
  }

  static async getMeetingRoomBookings(filters?: { userId?: string; resourceId?: string; month?: string }) {
    try {
      const whereClause: any = {};
      if (filters?.userId) whereClause.userId = filters.userId;
      if (filters?.resourceId) whereClause.resourceId = filters.resourceId;
      
      if (filters?.month) {
        if (!/^\d{4}-\d{2}$/.test(filters.month)) {
          throw new BadRequestError('Invalid month format. Please use YYYY-MM.');
        }
        const [year, month] = filters.month.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0, 23, 59, 59, 999);
        whereClause.startTime = { gte: firstDay, lte: lastDay };
      }

      return await prisma.coworkingBooking.findMany({
        where: whereClause,
        include: {
          resource: {
            include: { zone: { include: { floor: { include: { building: true } } } } }
          },
          user: {
            select: { id: true, name: true, email: true, startupProfile: { select: { companyName: true } } }
          }
        },
        orderBy: { startTime: 'desc' }
      });
    } catch (error) {
      console.error('Error in getMeetingRoomBookings:', error);
      throw error;
    }
  }

  // --- Monthly Invoicing Engine ---

  static async getInvoices(filters?: { userId?: string; month?: string }) {
    try {
      const whereClause: any = {};
      if (filters?.userId) whereClause.userId = filters.userId;
      if (filters?.month) whereClause.billingMonth = filters.month;

      const invoices = await prisma.coworkingInvoice.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, name: true, email: true, startupProfile: { select: { companyName: true } } }
          }
        },
        orderBy: { billingMonth: 'desc' }
      });

      return invoices.map(inv => {
        let displayStatus = inv.status;
        if (inv.status === 'DRAFT' || inv.status === 'SENT') {
          displayStatus = 'UNPAID';
        }
        return {
          ...inv,
          invoiceNo: inv.invoiceNumber,
          baseAmount: inv.totalCost,
          totalAmount: inv.grandTotal,
          status: displayStatus as any
        };
      });
    } catch (error) {
      console.error('Error in getInvoices:', error);
      throw error;
    }
  }

  static async generateMonthlyInvoicesForMonth(billingMonth: string) {
    try {
      if (!/^\d{4}-\d{2}$/.test(billingMonth)) {
        throw new BadRequestError('Invalid month format. Use YYYY-MM.');
      }
      const [year, month] = billingMonth.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0, 23, 59, 59, 999);
      const daysInMonth = lastDay.getDate();

      const activeAllocations = await prisma.coworkingAllocation.findMany({
        where: {
          status: 'ACTIVE',
          startDate: { lte: lastDay },
          OR: [
            { endDate: null },
            { endDate: { gte: firstDay } }
          ],
          resource: {
            type: { in: ['DESK', 'CABIN'] }
          }
        },
        include: {
          user: {
            include: { startupProfile: true }
          },
          costPlan: true,
          resource: true
        }
      });

      const userAllocationsMap = new Map<string, any[]>();
      for (const alloc of activeAllocations) {
        const list = userAllocationsMap.get(alloc.userId) || [];
        list.push(alloc);
        userAllocationsMap.set(alloc.userId, list);
      }

      const generatedInvoices = [];

      for (const [userId, allocs] of userAllocationsMap.entries()) {
        let seatsCost = 0;

        for (const alloc of allocs) {
          const startActive = alloc.startDate > firstDay ? alloc.startDate : firstDay;
          const endActive = (alloc.endDate === null || alloc.endDate > lastDay) ? lastDay : alloc.endDate;

          const activeTime = endActive.getTime() - startActive.getTime();
          const activeDays = Math.ceil(activeTime / (1000 * 60 * 60 * 24)) + 1;

          const rate = alloc.costPlan ? alloc.costPlan.rate : (alloc.totalCost || 0);
          const billedPer = alloc.costPlan ? alloc.costPlan.billedPer : 'MONTH';

          if (billedPer === 'MONTH') {
            seatsCost += (rate / daysInMonth) * activeDays;
          } else if (billedPer === 'DAY') {
            seatsCost += rate * activeDays;
          } else {
            seatsCost += rate;
          }
        }

        seatsCost = Math.round(seatsCost * 100) / 100;

        if (seatsCost === 0) continue;

        const totalCost = seatsCost;
        const gstPercent = 18.0;
        const gstAmount = Math.round((totalCost * (gstPercent / 100)) * 100) / 100;
        const grandTotal = Math.round((totalCost + gstAmount) * 100) / 100;

        const invoiceNumber = `G-INV-${billingMonth.replace('-', '')}-${userId.slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const invoice = await prisma.coworkingInvoice.upsert({
          where: {
            invoiceNumber
          },
          update: {
            seatsCost,
            totalCost,
            gstPercent,
            gstAmount,
            grandTotal,
            startDate: firstDay,
            endDate: lastDay,
          },
          create: {
            invoiceNumber,
            userId,
            billingMonth,
            startDate: firstDay,
            endDate: lastDay,
            seatsCost,
            totalCost,
            gstPercent,
            gstAmount,
            grandTotal,
            status: 'DRAFT'
          },
          include: {
            user: { include: { startupProfile: true } }
          }
        });

        generatedInvoices.push(invoice);
      }

      return generatedInvoices.map(inv => {
        let displayStatus = inv.status;
        if (inv.status === 'DRAFT' || inv.status === 'SENT') {
          displayStatus = 'UNPAID';
        }
        return {
          ...inv,
          invoiceNo: inv.invoiceNumber,
          baseAmount: inv.totalCost,
          totalAmount: inv.grandTotal,
          status: displayStatus as any
        };
      });
    } catch (error) {
      console.error('Error in generateMonthlyInvoicesForMonth:', error);
      throw error;
    }
  }

  static async sendInvoiceEmail(invoiceId: string) {
    try {
      const invoice = await prisma.coworkingInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          user: { include: { startupProfile: true } }
        }
      });

      if (!invoice) throw new NotFoundError('Invoice not found');

      const companyName = invoice.user.startupProfile?.companyName || invoice.user.name || 'Incubated Startup';
      const toEmail = invoice.user.email;
      const billingMonthText = new Date(invoice.startDate).toLocaleString('default', { month: 'long', year: 'numeric' });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f9fc; color: #333333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e6ebf1; }
            .header { background: linear-gradient(135deg, #0d1b2a, #1b263b); color: #ffffff; padding: 32px; text-align: center; }
            .logo { font-size: 24px; font-weight: bold; letter-spacing: 1px; color: #4fc3f7; margin-bottom: 8px; text-transform: uppercase; }
            .header h1 { font-size: 20px; margin: 0; font-weight: 500; letter-spacing: 0.5px; opacity: 0.9; }
            .content { padding: 40px 32px; }
            .greeting { font-size: 16px; margin-bottom: 24px; color: #2b3a4a; line-height: 1.5; }
            .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
            .meta-table td { padding: 8px 0; font-size: 14px; color: #4a5568; border-bottom: 1px dashed #e2e8f0; }
            .meta-table td.label { font-weight: bold; width: 40%; color: #2d3748; }
            .meta-table td.value { text-align: right; }
            .invoice-title { font-size: 16px; font-weight: bold; margin-bottom: 16px; color: #0d1b2a; border-left: 4px solid #4fc3f7; padding-left: 8px; }
            .bill-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
            .bill-table th { background-color: #f7fafc; color: #4a5568; font-weight: bold; text-align: left; padding: 12px 16px; font-size: 13px; border-bottom: 2px solid #edf2f7; text-transform: uppercase; }
            .bill-table td { padding: 16px; font-size: 14px; border-bottom: 1px solid #edf2f7; color: #4a5568; }
            .bill-table tr.total-row td { font-weight: bold; color: #2d3748; background-color: #fcfdfd; border-top: 1px solid #edf2f7; }
            .bill-table tr.grand-total-row td { font-weight: bold; font-size: 16px; color: #0d1b2a; background-color: #f7fafc; border-top: 2px solid #e2e8f0; border-bottom: 2px solid #e2e8f0; }
            .footer { background-color: #f7fafc; padding: 24px 32px; font-size: 12px; color: #718096; text-align: center; line-height: 1.5; border-top: 1px solid #edf2f7; }
            .btn { display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: bold; color: #ffffff !important; background-color: #4fc3f7; text-decoration: none; border-radius: 6px; box-shadow: 0 4px 6px rgba(79,195,247,0.25); margin: 24px 0; text-align: center; }
            .btn-accent { background: linear-gradient(135deg, #1b263b, #0d1b2a); }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">GTU Incubation ERP</div>
              <h1>Coworking Space Invoice</h1>
            </div>
            
            <div class="content">
              <p class="greeting">Dear <strong>${companyName} Team</strong>,</p>
              <p class="greeting">Please find below the detailed invoice summary for your coworking workspace allocations for <strong>${billingMonthText}</strong>.</p>
              
              <div class="invoice-title">Invoice Details</div>
              <table class="meta-table">
                <tr>
                  <td class="label">Invoice Number</td>
                  <td class="value"><strong>${invoice.invoiceNumber}</strong></td>
                </tr>
                <tr>
                  <td class="label">Billing Month</td>
                  <td class="value">${billingMonthText}</td>
                </tr>
                <tr>
                  <td class="label">Startup Name</td>
                  <td class="value">${companyName}</td>
                </tr>
                <tr>
                  <td class="label">Registered Email</td>
                  <td class="value">${toEmail}</td>
                </tr>
                <tr>
                  <td class="label">Invoice Status</td>
                  <td class="value" style="color: #dd6b20; font-weight: bold;">DRAFT / PENDING PAYMENT</td>
                </tr>
              </table>
              
              <div class="invoice-title">Charge Summary</div>
              <table class="bill-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Workspace Seats / Desk Allocations (Pro-rated rent)</td>
                    <td style="text-align: right;">₹${invoice.seatsCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr class="total-row">
                    <td>Subtotal (Taxable Value)</td>
                    <td style="text-align: right;">₹${invoice.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td>GST (${invoice.gstPercent}%)</td>
                    <td style="text-align: right;">₹${invoice.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr class="grand-total-row">
                    <td>Grand Total Payable</td>
                    <td style="text-align: right; color: #0d1b2a;">₹${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
              
              <p style="font-size: 14px; line-height: 1.5; color: #4a5568;">
                Shared meeting room bookings are dynamically credited based on your active seats allocation (2 hours/seat) and remain completely free but capped under this billing cycle.
              </p>
              
              <div style="text-align: center;">
                <a href="#" class="btn btn-accent">Pay Now / View Online Ledger</a>
              </div>
            </div>
            
            <div class="footer">
              This is an automatically generated system invoice sent by GTU Incubation Platform.<br/>
              Gujarat University Startup and Entrepreneurship Council (GTU), Ahmedabad, Gujarat.<br/>
              © 2026 GTU. All rights reserved.
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail(toEmail, `GTU Coworking Invoice - ${invoice.invoiceNumber} - ${billingMonthText}`, htmlContent);

      return await prisma.coworkingInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'SENT',
          sentAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error in sendInvoiceEmail:', error);
      throw error;
    }
  }

  static async getDashboardStats() {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const billingMonth = `${currentYear}-${currentMonth}`;

      // 1. Total resources capacity
      const totalCapacity = await prisma.coworkingResource.count();

      // If there is no physical setup in the database at all, return standard rich mock previews
      if (totalCapacity === 0) {
        return {
          totalCapacity: 320,
          occupied: 248,
          available: 52,
          blocked: 20,
          pendingApprovalsCount: 8,
          revenueMTD: 480000,
          outstandingAmount: 72400,
          overdueCount: 5,
          expiringCount: 12,
          floorOccupancy: [
            { floor: "Ground Floor", occupied: 62, available: 8, blocked: 5 },
            { floor: "1st Floor", occupied: 78, available: 12, blocked: 5 },
            { floor: "2nd Floor", occupied: 55, available: 20, blocked: 5 },
            { floor: "3rd Floor", occupied: 53, available: 12, blocked: 5 },
          ],
          spaceTypePie: [
            { name: "Open Coworking", value: 120 },
            { name: "Private Cabins", value: 45 },
            { name: "Meeting Rooms", value: 30 },
            { name: "Labs", value: 25 },
            { name: "Event Halls", value: 10 },
          ],
          pendingApprovals: [
            { id: "REQ-001", startup: "TechVenture AI", space: "Cabin #7", type: "Long-Term", date: "2026-03-28" },
            { id: "REQ-002", startup: "GreenEnergy Co", space: "Desk A12-A14", type: "Monthly", date: "2026-03-29" },
            { id: "REQ-003", startup: "HealthTech Labs", space: "Lab 2", type: "Quarterly", date: "2026-03-27" },
            { id: "REQ-004", startup: "EduSpark", space: "Meeting Room Orion", type: "Event", date: "2026-03-30" },
          ],
          expiringAllocations: [
            { startup: "DataMinds", space: "Desk B3", expires: "2026-04-02", status: "Renewal Sent" },
            { startup: "AgriBot", space: "Cabin #2", expires: "2026-04-04", status: "No Response" },
            { startup: "FinWise", space: "Desk C8", expires: "2026-04-05", status: "Renewal Sent" },
            { startup: "CloudNine", space: "Desk A1", expires: "2026-04-06", status: "Confirmed" },
          ],
          zoneUtilisation: [
            { zone: "Open Coworking – GF", used: 58, total: 70 },
            { zone: "Private Cabins – 1F", used: 12, total: 15 },
            { zone: "Open Coworking – 2F", used: 45, total: 65 },
            { zone: "Labs – 1F", used: 8, total: 10 },
            { zone: "Meeting Rooms", used: 18, total: 25 },
            { zone: "Event Halls", used: 2, total: 5 },
          ]
        };
      }

      // 2. Count occupied resources
      const occupied = await prisma.coworkingResource.count({
        where: { status: 'OCCUPIED' }
      });

      // 3. Count available resources
      const available = await prisma.coworkingResource.count({
        where: { status: 'AVAILABLE' }
      });

      // 4. Count blocked / maintenance resources
      const blocked = await prisma.coworkingResource.count({
        where: { status: { in: ['MAINTENANCE', 'RESERVED'] } }
      });

      // 5. Count pending allocation approvals
      const pendingApprovalsCount = await prisma.coworkingAllocation.count({
        where: { status: 'PENDING' }
      });

      // 6. Revenue MTD (Month-To-Date)
      const invoiceAgg = await prisma.coworkingInvoice.aggregate({
        where: { billingMonth },
        _sum: { grandTotal: true }
      });
      const invoiceSum = invoiceAgg._sum.grandTotal || 0;

      // Fallback: projected revenue from active allocations if no invoice generated
      let revenueMTD = invoiceSum;
      if (revenueMTD === 0) {
        const activeAllocationsSum = await prisma.coworkingAllocation.aggregate({
          where: { status: 'ACTIVE' },
          _sum: { totalCost: true }
        });
        revenueMTD = activeAllocationsSum._sum.totalCost || 0;
      }

      // 7. Overdue / Outstanding invoices
      const outstandingAgg = await prisma.coworkingInvoice.aggregate({
        where: { status: 'SENT' },
        _sum: { grandTotal: true }
      });
      const outstandingAmount = outstandingAgg._sum.grandTotal || 0;
      const overdueCount = await prisma.coworkingInvoice.count({
        where: { status: 'SENT' }
      });

      // 8. Expiring allocations in next 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(now.getDate() + 7);
      const expiringCount = await prisma.coworkingAllocation.count({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: now,
            lte: sevenDaysFromNow
          }
        }
      });

      // 9. Floor-wise occupancy
      const floors = await prisma.coworkingFloor.findMany({
        include: {
          zones: {
            include: {
              resources: true
            }
          }
        },
        orderBy: { level: 'asc' }
      });

      const floorOccupancyList = floors.map(floor => {
        let occ = 0;
        let avail = 0;
        let blk = 0;
        floor.zones.forEach(zone => {
          zone.resources.forEach(res => {
            if (res.status === 'OCCUPIED') occ++;
            else if (res.status === 'AVAILABLE') avail++;
            else if (res.status === 'MAINTENANCE' || res.status === 'RESERVED') blk++;
          });
        });
        return {
          floor: floor.name,
          occupied: occ,
          available: avail,
          blocked: blk
        };
      });

      // 10. Space Type Distribution
      const resourceGroups = await prisma.coworkingResource.groupBy({
        by: ['type'],
        _count: { id: true }
      });

      const typeMap: Record<string, string> = {
        DESK: 'Open Coworking',
        CABIN: 'Private Cabins',
        MEETING_ROOM: 'Meeting Rooms',
        SOFA: 'Sofa Lounge',
        STANDUP_TABLE: 'Standup Tables',
        AUDITORIUM_SEAT: 'Auditorium Seats',
        RECEPTION_DESK: 'Reception Desks'
      };

      const spaceTypePie = resourceGroups.map(rg => ({
        name: typeMap[rg.type] || rg.type,
        value: rg._count.id
      }));

      // 11. Pending Approvals list
      const pendingAllocations = await prisma.coworkingAllocation.findMany({
        where: { status: 'PENDING' },
        include: {
          resource: true,
          user: { include: { startupProfile: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      const pendingApprovalsList = pendingAllocations.map(pa => ({
        id: pa.id,
        startup: pa.user.startupProfile?.companyName || pa.user.name || 'Unknown Startup',
        space: pa.resource.code,
        type: pa.type,
        date: pa.startDate.toISOString().split('T')[0]
      }));

      // 12. Expiring soon Allocations list
      const expiringAllocations = await prisma.coworkingAllocation.findMany({
        where: {
          status: 'ACTIVE',
          endDate: {
            gte: now,
            lte: sevenDaysFromNow
          }
        },
        include: {
          resource: true,
          user: { include: { startupProfile: true } }
        },
        orderBy: { endDate: 'asc' },
        take: 5
      });

      const expiringSoonList = expiringAllocations.map(ea => ({
        startup: ea.user.startupProfile?.companyName || ea.user.name || 'Unknown Startup',
        space: ea.resource.code,
        expires: ea.endDate ? ea.endDate.toISOString().split('T')[0] : 'N/A',
        status: 'Renewal Pending'
      }));

      // 13. Zone Utilisation Overview list
      const zones = await prisma.coworkingZone.findMany({
        include: {
          resources: true,
          floor: true
        }
      });

      const zoneUtilisationList = zones.map(zone => {
        const tot = zone.resources.length;
        const usd = zone.resources.filter(r => r.status === 'OCCUPIED').length;
        return {
          zone: `${zone.name} – ${zone.floor.name}`,
          used: usd,
          total: tot
        };
      });

      return {
        totalCapacity,
        occupied,
        available,
        blocked,
        pendingApprovalsCount,
        revenueMTD,
        outstandingAmount,
        overdueCount,
        expiringCount,
        floorOccupancy: floorOccupancyList,
        spaceTypePie,
        pendingApprovals: pendingApprovalsList,
        expiringAllocations: expiringSoonList,
        zoneUtilisation: zoneUtilisationList
      };

    } catch (error) {
      console.error('Error in getDashboardStats:', error);
      throw error;
    }
  }

  // --- Space Requests Management ---

  static async createSpaceRequest(userId: string, data: any) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundError('User not found');

      return await prisma.coworkingRequest.create({
        data: {
          userId,
          spaceType: data.spaceType,
          seatsCount: Number(data.seatsCount),
          startDate: new Date(data.startDate),
          durationMonths: Number(data.durationMonths),
          justification: data.justification,
          status: 'PENDING'
        }
      });
    } catch (error) {
      console.error('Error in createSpaceRequest:', error);
      throw error;
    }
  }

  static async getMySpaceRequests(userId: string) {
    try {
      return await prisma.coworkingRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Error in getMySpaceRequests:', error);
      throw error;
    }
  }

  static async getAllSpaceRequests() {
    try {
      return await prisma.coworkingRequest.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              startupProfile: {
                select: { companyName: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Error in getAllSpaceRequests:', error);
      throw error;
    }
  }

  static async reviewSpaceRequest(id: string, data: { status: 'APPROVED' | 'REJECTED'; remarks?: string; resourceIds?: string[]; costPlanId?: string }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const request = await tx.coworkingRequest.findUnique({
          where: { id }
        });
        if (!request) throw new NotFoundError('Space request not found');

        // Update request status
        const updatedRequest = await tx.coworkingRequest.update({
          where: { id },
          data: {
            status: data.status,
            remarks: data.remarks
          }
        });

        // If approved and resource IDs are specified, allocate those specific desks/spaces!
        if (data.status === 'APPROVED' && data.resourceIds && data.resourceIds.length > 0) {
          for (const resId of data.resourceIds) {
            // Update resource status to OCCUPIED
            await tx.coworkingResource.update({
              where: { id: resId },
              data: { status: 'OCCUPIED' }
            });

            // Generate an allocation code
            const currentYear = new Date().getFullYear();
            const nextNum = Math.floor(1000 + Math.random() * 9000);
            const code = `ALC-${currentYear}-${nextNum}`;

            // Calculate pro-rated or total end date based on duration months
            const endDate = new Date(request.startDate);
            endDate.setMonth(endDate.getMonth() + request.durationMonths);

            // Create new allocation
            await tx.coworkingAllocation.create({
              data: {
                code,
                resourceId: resId,
                userId: request.userId,
                costPlanId: data.costPlanId || null,
                type: 'PAID',
                category: request.spaceType,
                startDate: request.startDate,
                endDate,
                status: 'ACTIVE',
                remarks: `Allocated via request approval: ${data.remarks || ''}`
              }
            });
          }
        }

        return updatedRequest;
      });
    } catch (error) {
      console.error('Error in reviewSpaceRequest:', error);
      throw error;
    }
  }
}
