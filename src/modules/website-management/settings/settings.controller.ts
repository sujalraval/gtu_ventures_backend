// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

class SettingsController {
  async getAll(req: Request, res: Response) {
    try {
      const settings = await prisma.webSetting.findMany();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      
      // We need before state for audit log
      (req as any).auditBefore = await prisma.webSetting.findUnique({ where: { key } });

      const setting = await prisma.webSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(value), description },
        create: { key, value: JSON.stringify(value), description }
      });
      
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new SettingsController();
