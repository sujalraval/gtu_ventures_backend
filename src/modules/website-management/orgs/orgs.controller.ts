// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

class OrgsController {
  async getAll(req: Request, res: Response) {
    try {
      const items = await prisma.webOrg.findMany({ orderBy: { id: 'desc' } });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const item = await prisma.webOrg.findUnique({
        where: { id: parseInt(req.params.id as string) }
      });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const item = await prisma.webOrg.create({ data: req.body });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const item = await prisma.webOrg.update({
        where: { id: parseInt(req.params.id as string) },
        data: req.body
      });
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await prisma.webOrg.delete({
        where: { id: parseInt(req.params.id as string) }
      });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export default new OrgsController();
