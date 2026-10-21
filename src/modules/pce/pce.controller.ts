import { Request, Response } from 'express';
import { PceService } from './pce.service';
import { DashboardService } from './dashboard.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class PceController {
  static getDashboard = asyncHandler(async (req: Request, res: Response) => {
    // Section 1's filters arrive as query params and apply to every card.
    const data = await PceService.getDashboard(req.query as any);
    res.json({ success: true, data });
  });

  /**
   * The management dashboard: one lifecycle stage per application, with every
   * section derived from the same pass so no two numbers can disagree.
   */
  static getOverview = asyncHandler(async (req: Request, res: Response) => {
    const data = await DashboardService.getDashboard(req.query as any);
    res.json({ success: true, data });
  });

  /** The applications behind any number on the dashboard. */
  static listDashboardApplications = asyncHandler(async (req: Request, res: Response) => {
    const data = await DashboardService.listApplications(req.query as any);
    res.json({ success: true, data });
  });
}

export default PceController;
