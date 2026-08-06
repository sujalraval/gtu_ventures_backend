// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

class StartupsController {
  async getAll(req: Request, res: Response) {
    try {
      const startups = await prisma.webStartup.findMany({
        orderBy: { createdAt: 'desc' }
      });
      res.json(startups);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const startup = await prisma.webStartup.findUnique({ where: { id: parseInt(id) } });
      if (!startup) return res.status(404).json({ error: 'Startup not found' });
      res.json(startup);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const data = { ...req.body };
      const startup = await prisma.webStartup.create({ data });
      res.status(201).json(startup);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      (req as any).auditBefore = await prisma.webStartup.findUnique({ where: { id: parseInt(id) } });
      
      const startup = await prisma.webStartup.update({
        where: { id: parseInt(id) },
        data: req.body
      });
      res.json(startup);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.webStartup.delete({ where: { id: parseInt(id) } });
      res.json({ message: 'Startup deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new StartupsController();
