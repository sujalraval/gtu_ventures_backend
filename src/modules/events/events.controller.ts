import { Request, Response } from 'express';
import { EventsService } from './events.service';
import asyncHandler from '../../common/utils/asyncHandler';
import { NotFoundError } from '../../common/utils/apiError';

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

  static getPublicList = asyncHandler(async (_req: Request, res: Response) => {
    const events = await EventsService.getPublicEvents();
    res.json({ success: true, data: events });
  });

  static getPublicDetails = asyncHandler(async (req: Request, res: Response) => {
    const event = await EventsService.getEventById(req.params['id'] as string);

    // This route is unauthenticated, so an event that has not been announced
    // must not leak its venue, agenda or organiser contact to anyone holding
    // the id. Invite-only events are addressed by email, not by this page.
    const readable = ['PUBLISHED', 'ONGOING', 'COMPLETED'];
    if (!event.isPublic || !readable.includes(event.status)) {
      throw new NotFoundError('Event not found');
    }

    const publicDetails = {
      id: event.id,
      title: event.title,
      type: event.type,
      status: event.status,
      mode: event.mode,
      description: event.description,
      venue: event.venue,
      virtualLink: event.virtualLink,
      startDate: event.startDate,
      endDate: event.endDate,
      registrationDeadline: event.registrationDeadline,
      maxAttendees: event.maxAttendees,
      isPublic: event.isPublic,
      coverImage: event.coverImage,
      tags: event.tags,
      agenda: event.agenda,
      registrationFields: event.registrationFields ?? [],
      // Defaults keep the built-in fields visible on events created before
      // these toggles existed.
      registrationOptions: {
        phone: true,
        organization: true,
        designation: true,
        ...(event.registrationOptions && typeof event.registrationOptions === 'object'
          ? (event.registrationOptions as any)
          : {}),
      },
      organiserName: event.organiserName,
      organiserEmail: event.organiserEmail,
    };
    res.json({ success: true, data: publicDetails });
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
