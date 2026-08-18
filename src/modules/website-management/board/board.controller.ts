// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

const boardOrder = [{ order: 'asc' }, { id: 'asc' }];

class BoardController {
  async getAll(req: Request, res: Response) {
    try {
      const members = await prisma.webBoardMember.findMany({ orderBy: boardOrder });
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const member = await prisma.webBoardMember.findUnique({
        where: { id: parseInt(req.params.id as string) },
      });
      if (!member) return res.status(404).json({ error: 'Not found' });
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const member = await prisma.webBoardMember.create({ data: sanitise(req.body) });
      res.status(201).json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const member = await prisma.webBoardMember.update({
        where: { id: parseInt(req.params.id as string) },
        data: sanitise(req.body),
      });
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      await prisma.webBoardMember.delete({
        where: { id: parseInt(req.params.id as string) },
      });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // Accepts { ids: [] } in the desired display order.
  async reorder(req: Request, res: Response) {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (!ids.length) return res.status(400).json({ error: 'ids array required' });
      await prisma.$transaction(
        ids.map((id: any, index: number) =>
          prisma.webBoardMember.update({
            where: { id: Number(id) },
            data: { order: index + 1 },
          })
        )
      );
      res.json({ success: true, count: ids.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

function sanitise(body: any = {}) {
  const out: any = {};
  if (body.title !== undefined) out.title = String(body.title);
  if (body.role !== undefined) out.role = body.role || null;
  if (body.description !== undefined) out.description = body.description || null;
  if (body.photo !== undefined) out.photo = body.photo || null;
  if (body.initials !== undefined) out.initials = body.initials || null;
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.publishState !== undefined) out.publishState = body.publishState || 'PUBLISHED';
  return out;
}

export default new BoardController();
