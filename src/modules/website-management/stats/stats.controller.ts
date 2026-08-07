import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

class StatsController {
  async getDashboardStats(req: Request, res: Response) {
    try {
      const [
        totalStartups,
        activeMentors,
        corporatePartners,
        pendingReviews
      ] = await Promise.all([
        prisma.webStartup.count(),
        prisma.webMentor.count(),
        prisma.webPartner.count({ where: { type: 'CORPORATE' } }),
        prisma.startupApplication.count({ where: { status: 'UNDER_REVIEW' } })
      ]);

      res.json({
        totalStartups,
        activeMentors,
        corporatePartners,
        pendingReviews
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new StatsController();
