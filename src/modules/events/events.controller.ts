import { Request, Response } from 'express';
import { EventsService } from './events.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class EventsController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const { type, status } = req.query as { type?: string; status?: string };
    const events = await EventsService.getAllEvents({ type, status });
    res.json({ success: true, data: events });
  });

  static getDeleted = asyncHandler(async (_req: Request, res: Response) => {
    const events = await EventsService.getDeletedEvents();
    res.json({ success: true, data: events });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const event = await EventsService.getEventById(req.params['id'] as string);
    res.json({ success: true, data: event });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const event = await EventsService.createEvent(req.body, userId);
    res.status(201).json({ success: true, data: event });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const event = await EventsService.updateEvent(req.params['id'] as string, req.body);
    res.json({ success: true, data: event });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    await EventsService.deleteEvent(req.params['id'] as string);
    res.json({ success: true, message: 'Event deleted successfully' });
  });

  static restore = asyncHandler(async (req: Request, res: Response) => {
    await EventsService.restoreEvent(req.params['id'] as string);
    res.json({ success: true, message: 'Event restored successfully' });
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    const event = await EventsService.updateStatus(req.params['id'] as string, status);
    res.json({ success: true, data: event });
  });
}
