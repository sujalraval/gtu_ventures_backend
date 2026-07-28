import { Request, Response, NextFunction } from 'express';
import { StartupAllocationsService } from './startup-allocations.service';
import prisma from '../../lib/prisma';

export class StartupAllocationsController {
  static async createAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StartupAllocationsService.createAllocation(req.body);
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllAllocations(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StartupAllocationsService.getAllAllocations();
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllocationById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StartupAllocationsService.getAllocationById(req.params.id as string);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateTranche(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StartupAllocationsService.updateTranche(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StartupAllocationsService.updateAllocation(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      console.log('Fetching allocation for user:', userId);

      const userApplication = await prisma.startupApplication.findFirst({
        where: { userId: userId }
      });

      console.log('User Application found:', userApplication?.id);

      if (!userApplication) {
        console.log('No application found for this user');
        return res.status(200).json({ success: true, data: null });
      }

      const result = await StartupAllocationsService.getAllocationByApplicationId(userApplication.id);
      console.log('Allocation result:', result ? 'Found' : 'Not Found');

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getMyAllocation:', error);
      next(error);
    }
  }

  static async getStartupAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const { startupId } = req.params;
      const result = await StartupAllocationsService.getAllocationByUserId(startupId as string);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async retriggerMilestones(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await StartupAllocationsService.retriggerMilestones(req.params.id as string);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
