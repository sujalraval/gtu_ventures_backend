import { Request, Response, NextFunction } from 'express';
import { ScheduleService } from './schedule.service';

export class ScheduleController {

  static async getSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const data = await ScheduleService.getSchedule(eventId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getEligibleStartups(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const data = await ScheduleService.getEligibleStartups(eventId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async addSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const data = await ScheduleService.addSlot(eventId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async updateSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const slotId = req.params['slotId'] as string;
      const data = await ScheduleService.updateSlot(slotId, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async reorder(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const { slotIds } = req.body as { slotIds: string[] };
      const data = await ScheduleService.reorder(eventId, slotIds);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async removeSlot(req: Request, res: Response, next: NextFunction) {
    try {
      const slotId = req.params['slotId'] as string;
      await ScheduleService.removeSlot(slotId);
      res.json({ success: true, message: 'Slot removed' });
    } catch (err) { next(err); }
  }

  static async autoSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const data = await ScheduleService.autoSchedule(eventId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async sendEmails(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const results = await ScheduleService.sendScheduleEmails(eventId);
      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;
      res.json({ success: true, data: { results, sent, failed } });
    } catch (err) { next(err); }
  }
}
