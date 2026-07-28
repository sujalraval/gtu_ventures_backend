import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EventAnnouncementService } from './event-announcement.service';
import { BadRequestError } from '../../common/utils/apiError';
import { ANNOUNCEMENT_TYPE_VALUES } from './announcement-types.config';

// ── Validation schemas ─────────────────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  type: z.string().refine(v => ANNOUNCEMENT_TYPE_VALUES.includes(v), { message: 'Invalid announcement type' }),
  scheduledAt: z.string().nullable().optional(),
  durationMin: z.number().int().positive().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  isVirtual: z.boolean().optional(),
  maxSeats: z.number().int().positive().nullable().optional(),
  targetCohort: z.string().max(100).nullable().optional(),
  speakerName: z.string().max(200).nullable().optional(),
});

const rsvpSchema = z.object({
  status: z.enum(['GOING', 'MAYBE', 'NOT_GOING']),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  startupName: z.string().min(1),
});

// ── Admin controller ───────────────────────────────────────────────────────────

export class EventAnnouncementAdminController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, Number(req.query['page']) || 1);
      const limit = Math.min(100, Number(req.query['limit']) || 20);
      const type = req.query['type'] as string | undefined;
      const data = await EventAnnouncementService.getAll(page, limit, type);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventAnnouncementService.getById(req.params['id'] as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.issues.map((e: any) => e.message).join(', '));
      const createdBy = (req as any).user.id;
      const data = await EventAnnouncementService.create(createdBy, parsed.data as any);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createSchema.partial().safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.issues.map((e: any) => e.message).join(', '));
      const data = await EventAnnouncementService.update(req.params['id'] as string, parsed.data as any);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await EventAnnouncementService.delete(req.params['id'] as string);
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  static async markAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { announcementId, startupId } = req.params as any;
      const attended = req.body.attended;
      if (typeof attended !== 'boolean') throw new BadRequestError('attended must be a boolean');
      const data = await EventAnnouncementService.markAttendance(announcementId, startupId, attended);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await EventAnnouncementService.getStats();
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

// ── Startup controller ─────────────────────────────────────────────────────────

export class EventAnnouncementStartupController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const page = Math.max(1, Number(req.query['page']) || 1);
      const limit = Math.min(100, Number(req.query['limit']) || 30);
      const type = req.query['type'] as string | undefined;
      const data = await EventAnnouncementService.getForStartup(userId, page, limit, type);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async rsvp(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const announcementId = req.params['id'] as string;
      const parsed = rsvpSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid status');
      const data = await EventAnnouncementService.rsvp(announcementId, userId, parsed.data.status);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async cancelRsvp(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const announcementId = req.params['id'] as string;
      await EventAnnouncementService.cancelRsvp(announcementId, userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  static async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const announcementId = req.params['id'] as string;
      const parsed = feedbackSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.issues[0]?.message ?? 'Invalid feedback');
      const data = await EventAnnouncementService.submitFeedback(
        announcementId,
        userId,
        parsed.data.startupName,
        parsed.data.rating,
        parsed.data.comment,
      );
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}
