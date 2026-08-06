// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

class MentorsController {
  async getAll(req: Request, res: Response) {
    try {
      const mentors = await prisma.webMentor.findMany({
        orderBy: { id: 'desc' }
      });
      res.json(mentors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const mentor = await prisma.webMentor.findUnique({ where: { id: parseInt(id) } });
      if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
      res.json(mentor);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const data = { ...req.body };
      const mentor = await prisma.webMentor.create({ data });
      res.status(201).json(mentor);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      (req as any).auditBefore = await prisma.webMentor.findUnique({ where: { id: parseInt(id) } });
      
      const mentor = await prisma.webMentor.update({
        where: { id: parseInt(id) },
        data: req.body
      });
      res.json(mentor);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.webMentor.delete({ where: { id: parseInt(id) } });
      res.json({ message: 'Mentor deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new MentorsController();
