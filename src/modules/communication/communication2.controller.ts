import { Request, Response, NextFunction } from 'express';
import { AnnouncementService } from './announcement.service';
import { TemplateService } from './template.service';
import { NotificationLogService } from './notification-log.service';

// ── Announcements ──────────────────────────────────────────────────────────────

export class AnnouncementController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query['page']) || 1;
      const limit = Number(req.query['limit']) || 20;
      const data = await AnnouncementService.getAll(page, limit);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnnouncementService.getById(req.params['id'] as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async send(req: Request, res: Response, next: NextFunction) {
    try {
      const senderId = (req as any).user.id;
      const data = await AnnouncementService.send(senderId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  // In-app feed for logged-in user
  static async getMyFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const page = Number(req.query['page']) || 1;
      const data = await AnnouncementService.getInAppFeed(userId, page);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await AnnouncementService.markRead(req.params['logId'] as string, userId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const count = await AnnouncementService.getUnreadCount(userId);
      res.json({ success: true, data: { count } });
    } catch (err) { next(err); }
  }

  // Preview recipients count before sending
  static async previewAudience(req: Request, res: Response, next: NextFunction) {
    try {
      const { audience, cohortId, schemeId } = req.body;
      // Reuse the resolver inline - just count
      const where: any = { deletedAt: null };
      let count = 0;
      const p = (await import('../../lib/prisma')).default;

      if (audience === 'ALL') {
        count = await p.user.count({ where });
      } else if (audience === 'ALL_STARTUPS') {
        count = await p.user.count({ where: { ...where, role: 'STARTUP' } });
      } else if (audience === 'ALL_MENTORS') {
        count = await p.user.count({ where: { ...where, role: 'MENTOR' } });
      } else if (audience === 'ALL_STAFF') {
        count = await p.user.count({ where: { ...where, role: { in: ['ADMIN', 'STAFF'] } } });
      } else if (audience === 'SPECIFIC_COHORT' && cohortId) {
        const apps = await p.startupApplication.findMany({ where: { cohortId }, select: { userId: true } });
        count = apps.length;
      } else if (audience === 'SPECIFIC_SCHEME' && schemeId) {
        const apps = await p.startupApplication.findMany({ where: { schemeId }, select: { userId: true } });
        count = apps.length;
      }

      res.json({ success: true, data: { count } });
    } catch (err) { next(err); }
  }
}

// ── Templates ──────────────────────────────────────────────────────────────────

export class TemplateController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await TemplateService.getAll() });
    } catch (err) { next(err); }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await TemplateService.getById(req.params['id'] as string) });
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const data = await TemplateService.create(userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await TemplateService.update(req.params['id'] as string, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await TemplateService.delete(req.params['id'] as string);
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  static async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const { sampleData, testEmail } = req.body;
      const data = await TemplateService.preview(req.params['id'] as string, sampleData, testEmail);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}

// ── Notification logs ─────────────────────────────────────────────────────────

export class NotificationLogController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await NotificationLogService.getAll({
        status: req.query['status'] as string,
        channel: req.query['channel'] as string,
        page: Number(req.query['page']) || 1,
        limit: Number(req.query['limit']) || 50,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await NotificationLogService.getStats() });
    } catch (err) { next(err); }
  }
}
