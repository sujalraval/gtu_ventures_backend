import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AnnouncementTypeService } from './announcement-type.service';
import { BadRequestError } from '../../common/utils/apiError';

const COLORS = ['purple', 'blue', 'green', 'gray', 'red', 'amber', 'indigo', 'pink', 'teal', 'orange'];

const createSchema = z.object({
  value: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
  color: z.string().refine(v => COLORS.includes(v), { message: `Color must be one of: ${COLORS.join(', ')}` }).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(200).optional(),
  color: z.string().refine(v => COLORS.includes(v), { message: `Color must be one of: ${COLORS.join(', ')}` }).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export class AnnouncementTypeController {
  static async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnnouncementTypeService.getAll();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid input');
      const data = await AnnouncementTypeService.create(parsed.data);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid input');
      const data = await AnnouncementTypeService.update(req.params['id'] as string, parsed.data);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await AnnouncementTypeService.delete(req.params['id'] as string);
      res.json({ success: true });
    } catch (err) { next(err); }
  }
}
