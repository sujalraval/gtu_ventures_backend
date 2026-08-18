// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

const catOrder = [{ order: 'asc' }, { id: 'asc' }];
const itemOrder = [{ order: 'asc' }, { id: 'asc' }];

class InventoryController {
  // ── Whole tree — what the public page renders in a single call ────────────
  async getTree(req: Request, res: Response) {
    try {
      const categories = await prisma.webInventoryCategory.findMany({
        orderBy: catOrder,
        include: { items: { orderBy: itemOrder } },
      });
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ── Categories ───────────────────────────────────────────────────────────
  async getCategories(req: Request, res: Response) {
    try {
      const items = await prisma.webInventoryCategory.findMany({
        orderBy: catOrder,
        include: { _count: { select: { items: true } } },
      });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getCategoryById(req: Request, res: Response) {
    try {
      const item = await prisma.webInventoryCategory.findUnique({
        where: { id: parseInt(req.params.id as string) },
        include: { items: { orderBy: itemOrder } },
      });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const item = await prisma.webInventoryCategory.create({
        data: sanitiseCategory(req.body),
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const item = await prisma.webInventoryCategory.update({
        where: { id: parseInt(req.params.id as string) },
        data: sanitiseCategory(req.body),
      });
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      // items survive with categoryId = null (onDelete: SetNull)
      await prisma.webInventoryCategory.delete({
        where: { id: parseInt(req.params.id as string) },
      });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ── Items ────────────────────────────────────────────────────────────────
  async getItems(req: Request, res: Response) {
    try {
      const where: any = {};
      if (req.query.categoryId) where.categoryId = parseInt(req.query.categoryId as string);
      const items = await prisma.webInventoryItem.findMany({
        where,
        orderBy: itemOrder,
        include: { category: { select: { id: true, name: true } } },
      });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getItemById(req: Request, res: Response) {
    try {
      const item = await prisma.webInventoryItem.findUnique({
        where: { id: parseInt(req.params.id as string) },
        include: { category: { select: { id: true, name: true } } },
      });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async createItem(req: Request, res: Response) {
    try {
      const item = await prisma.webInventoryItem.create({ data: sanitiseItem(req.body) });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateItem(req: Request, res: Response) {
    try {
      const item = await prisma.webInventoryItem.update({
        where: { id: parseInt(req.params.id as string) },
        data: sanitiseItem(req.body),
      });
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteItem(req: Request, res: Response) {
    try {
      await prisma.webInventoryItem.delete({
        where: { id: parseInt(req.params.id as string) },
      });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ── Bulk reorder — drag-and-drop saves the whole order in one call ────────
  async reorderItems(req: Request, res: Response) {
    try {
      const ids: number[] = req.body?.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.webInventoryItem.update({
            where: { id: Number(id) },
            data: { order: index },
          })
        )
      );
      res.json({ success: true, count: ids.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async reorderCategories(req: Request, res: Response) {
    try {
      const ids: number[] = req.body?.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids must be a non-empty array' });
      }
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.webInventoryCategory.update({
            where: { id: Number(id) },
            data: { order: index },
          })
        )
      );
      res.json({ success: true, count: ids.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

// Only accept columns that exist, so a stray key cannot break the request.
function sanitiseCategory(body: any = {}) {
  const out: any = {};
  if (body.name !== undefined) out.name = String(body.name);
  if (body.slug !== undefined) out.slug = body.slug ? String(body.slug) : null;
  if (body.description !== undefined) out.description = body.description || null;
  if (body.icon !== undefined) out.icon = body.icon || null;
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.publishState !== undefined) out.publishState = body.publishState || 'PUBLISHED';
  return out;
}

function sanitiseItem(body: any = {}) {
  const out: any = {};
  if (body.name !== undefined) out.name = String(body.name);
  if (body.categoryId !== undefined)
    out.categoryId = body.categoryId === '' || body.categoryId === null
      ? null
      : Number(body.categoryId);
  if (body.imagePath !== undefined) out.imagePath = body.imagePath || null;
  if (body.description !== undefined) out.description = body.description || null;
  if (body.specification !== undefined) out.specification = body.specification || null;
  if (body.quantity !== undefined) out.quantity = body.quantity || null;
  if (body.make !== undefined) out.make = body.make || null;
  // Json? columns: store [] rather than null so Prisma never sees an ambiguous
  // null for a nullable Json field. Blank rows are dropped here, not in the UI.
  if (body.specs !== undefined)
    out.specs = Array.isArray(body.specs)
      ? body.specs
          .map((r: any) => ({ label: String(r?.label ?? '').trim(), value: String(r?.value ?? '').trim() }))
          .filter((r: any) => r.label || r.value)
      : [];
  if (body.applications !== undefined)
    out.applications = Array.isArray(body.applications)
      ? body.applications.map((a: any) => String(a ?? '').trim()).filter(Boolean)
      : [];
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.publishState !== undefined) out.publishState = body.publishState || 'PUBLISHED';
  return out;
}

export default new InventoryController();
