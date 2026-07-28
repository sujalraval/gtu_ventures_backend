import { Request, Response, NextFunction } from 'express';
import { CoworkingService } from './coworking.service';
import { BadRequestError } from '../../common/utils/apiError';

export class CoworkingController {
  static getAllBuildings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buildings = await CoworkingService.getAllBuildings();
      res.json({ success: true, data: buildings });
    } catch (err) {
      next(err);
    }
  };

  static getBuildingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const building = await CoworkingService.getBuildingById(id as string);
      res.json({ success: true, data: building });
    } catch (err) {
      next(err);
    }
  };

  static createBuilding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const building = await CoworkingService.createBuilding(req.body);
      res.status(201).json({ success: true, data: building });
    } catch (err) {
      next(err);
    }
  };

  static updateBuilding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const building = await CoworkingService.updateBuilding(id as string, req.body);
      res.json({ success: true, data: building });
    } catch (err) {
      next(err);
    }
  };

  static deleteBuilding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await CoworkingService.deleteBuilding(id as string);
      res.json({ success: true, message: 'Building deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  static getFloorDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { floorId } = req.params;
      const floor = await CoworkingService.getFloorDetails(floorId as string);
      res.json({ success: true, data: floor });
    } catch (err) {
      next(err);
    }
  };

  static updateFloor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const floor = await CoworkingService.updateFloor(id as string, req.body);
      res.json({ success: true, data: floor });
    } catch (err) {
      next(err);
    }
  };

  static deleteFloor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await CoworkingService.deleteFloor(id as string);
      res.json({ success: true, message: 'Floor deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  static createFloor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { buildingId } = req.params;
      const floor = await CoworkingService.createFloor(buildingId as string, req.body);
      res.status(201).json({ success: true, message: 'Floor created successfully', data: floor });
    } catch (err) {
      next(err);
    }
  };

  static createZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { floorId } = req.params;
      const zone = await CoworkingService.createZone(floorId as string, req.body);
      res.status(201).json({ success: true, data: zone });
    } catch (err) {
      next(err);
    }
  };

  static updateZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const zone = await CoworkingService.updateZone(id as string, req.body);
      res.json({ success: true, data: zone });
    } catch (err) {
      next(err);
    }
  };

  static deleteZone = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await CoworkingService.deleteZone(id as string);
      res.json({ success: true, message: 'Zone deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  static getZoneResources = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { zoneId } = req.params;
      const resources = await CoworkingService.getZoneResources(zoneId as string);
      res.json({ success: true, data: resources });
    } catch (err) {
      next(err);
    }
  };

  static bulkGenerateResources = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { zoneId } = req.params;
      const result = await CoworkingService.bulkGenerateResources(zoneId as string, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  static updateResourceStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const resource = await CoworkingService.updateResourceStatus(id as string, status);
      res.json({ success: true, data: resource });
    } catch (err) {
      next(err);
    }
  };

  // --- Allocation Management ---

  static getAllAllocations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allocations = await CoworkingService.getAllAllocations();
      res.json({ success: true, data: allocations });
    } catch (err) {
      next(err);
    }
  };

  static createAllocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allocation = await CoworkingService.createAllocation(req.body);
      res.status(201).json({ success: true, data: allocation });
    } catch (err) {
      next(err);
    }
  };

  static createBatchAllocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await CoworkingService.createBatchAllocation(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  };

  static updateAllocationStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const allocation = await CoworkingService.updateAllocationStatus(id as string, status);
      res.json({ success: true, data: allocation });
    } catch (err) {
      next(err);
    }
  };

  static updateAllocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const allocation = await CoworkingService.updateAllocation(id as string, req.body);
      res.json({ success: true, data: allocation });
    } catch (err) {
      next(err);
    }
  };

  static deleteAllocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await CoworkingService.deleteAllocation(id as string);
      res.json({ success: true, message: 'Allocation deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  // --- Cost Plan Management ---

  static getAllCostPlans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await CoworkingService.getAllCostPlans();
      res.json({ success: true, data: plans });
    } catch (err) {
      next(err);
    }
  };

  static createCostPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await CoworkingService.createCostPlan(req.body);
      res.status(201).json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  };

  static updateCostPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const plan = await CoworkingService.updateCostPlan(id as string, req.body);
      res.json({ success: true, data: plan });
    } catch (err) {
      next(err);
    }
  };

  static deleteCostPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await CoworkingService.deleteCostPlan(id as string);
      res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  static getStartupUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await CoworkingService.getStartupUsers();
      res.json({ success: true, data: users });
    } catch (err) {
      next(err);
    }
  };

  // --- Booking & Credits Controller ---

  static getUserMonthlyCreditsAndUsage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { month } = req.query;
      const quota = await CoworkingService.getUserMonthlyCreditsAndUsage(userId as any, month as any);
      res.json({ success: true, data: quota });
    } catch (err) {
      next(err);
    }
  };

  static grantAdminCredits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, billingMonth, additionalCredits, remarks } = req.body;
      const quota = await CoworkingService.grantAdminCredits(userId as any, billingMonth as any, Number(additionalCredits), remarks as any);
      res.json({ success: true, message: 'Additional credits granted successfully', data: quota });
    } catch (err) {
      next(err);
    }
  };

  static getQuotaHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const history = await CoworkingService.getQuotaHistory(userId as any);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  };

  static createMeetingRoomBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.body.userId || (req as any).user?.id;
      if (!userId) {
        throw new BadRequestError('User ID is required to create a booking.');
      }
      const booking = await CoworkingService.createMeetingRoomBooking(userId as any, req.body);
      res.status(201).json({ success: true, data: booking });
    } catch (err) {
      next(err);
    }
  };

  static cancelMeetingRoomBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.body.userId || (req as any).user?.id;
      if (!userId) {
        throw new BadRequestError('User ID is required to cancel booking.');
      }
      const booking = await CoworkingService.cancelMeetingRoomBooking(userId as any, id as any);
      res.json({ success: true, message: 'Booking cancelled successfully', data: booking });
    } catch (err) {
      next(err);
    }
  };

  static getMeetingRoomBookings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, resourceId, month } = req.query;
      const bookings = await CoworkingService.getMeetingRoomBookings({
        userId: userId as any,
        resourceId: resourceId as any,
        month: month as any
      });
      res.json({ success: true, data: bookings });
    } catch (err) {
      next(err);
    }
  };

  // --- Monthly Invoicing Controller ---

  static getInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, month } = req.query;
      const invoices = await CoworkingService.getInvoices({
        userId: userId as any,
        month: month as any
      });
      res.json({ success: true, data: invoices });
    } catch (err) {
      next(err);
    }
  };

  static generateMonthlyInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { billingMonth } = req.body;
      const invoices = await CoworkingService.generateMonthlyInvoicesForMonth(billingMonth as any);
      res.status(201).json({
        success: true,
        message: `Successfully generated ${invoices.length} invoices for ${billingMonth}`,
        data: invoices
      });
    } catch (err) {
      next(err);
    }
  };

  static sendInvoiceEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const invoice = await CoworkingService.sendInvoiceEmail(id as any);
      res.json({ success: true, message: 'Invoice email sent successfully', data: invoice });
    } catch (err) {
      next(err);
    }
  };

  static updateUserCoworkingLimits = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { coworkingCredits, coworkingDailyLimit } = req.body;
      const user = await CoworkingService.updateUserCoworkingLimits(userId as string, {
        coworkingCredits: Number(coworkingCredits),
        coworkingDailyLimit: Number(coworkingDailyLimit)
      });
      res.json({ success: true, message: 'Coworking limits updated successfully', data: user });
    } catch (err) {
      next(err);
    }
  };

  static getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await CoworkingService.getDashboardStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  };

  // --- Space Requests Controller ---

  static createSpaceRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;
      const request = await CoworkingService.createSpaceRequest(userId, req.body);
      res.status(201).json({ success: true, message: 'Space request submitted successfully', data: request });
    } catch (err) {
      next(err);
    }
  };

  static getMySpaceRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;
      const requests = await CoworkingService.getMySpaceRequests(userId);
      res.json({ success: true, data: requests });
    } catch (err) {
      next(err);
    }
  };

  static getAllSpaceRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await CoworkingService.getAllSpaceRequests();
      res.json({ success: true, data: requests });
    } catch (err) {
      next(err);
    }
  };

  static reviewSpaceRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const request = await CoworkingService.reviewSpaceRequest(id as string, req.body);
      res.json({ success: true, message: 'Space request reviewed successfully', data: request });
    } catch (err) {
      next(err);
    }
  };
}
