// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

class PartnersController {
  async getAll(req: Request, res: Response) {
    try {
      const { type } = req.query;
      const filter = type ? { type } : {};
      
      const partners = await prisma.webPartner.findMany({
        where: filter,
        orderBy: { id: 'desc' }
      });
      res.json(partners);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const partner = await prisma.webPartner.findUnique({ where: { id: parseInt(id) } });
      if (!partner) return res.status(404).json({ error: 'Partner not found' });
      res.json(partner);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const data = { ...req.body };
      const partner = await prisma.webPartner.create({ data });
      res.status(201).json(partner);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      (req as any).auditBefore = await prisma.webPartner.findUnique({ where: { id: parseInt(id) } });
      
      const partner = await prisma.webPartner.update({
        where: { id: parseInt(id) },
        data: req.body
      });
      res.json(partner);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.webPartner.delete({ where: { id: parseInt(id) } });
      res.json({ message: 'Partner deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new PartnersController();
