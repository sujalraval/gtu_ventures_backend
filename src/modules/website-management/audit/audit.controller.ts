// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

class AuditController {
  async getAll(req: Request, res: Response) {
    try {
      const logs = await prisma.webAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { email: true, role: true }
          }
        },
        take: 100 // Limit for performance, in reality we'd paginate
      });
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new AuditController();
