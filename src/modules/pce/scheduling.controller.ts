import { Request, Response } from 'express';
import { SchedulingService } from './scheduling.service';
import { PanelsService } from './panels.service';
import { InvitationsService } from './invitations.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class SchedulingController {
  // ── Section 17 ────────────────────────────────────────────────────────────

  static selectedForPitch = asyncHandler(async (req: Request, res: Response) => {
    const data = await SchedulingService.selectedForPitch(req.query as any);
    res.json({ success: true, data });
  });

  // ── Sections 18-19 ────────────────────────────────────────────────────────

  /**
   * Conflicts for a proposed booking, without writing anything.
   *
   * Lets the form warn before the admin commits, rather than the first they
   * hear of a clash being a rejected submit.
   */
  static checkConflicts = asyncHandler(async (req: Request, res: Response) => {
    const b = req.body;
    const conflicts = await SchedulingService.detectConflicts({
      applicationId: b.applicationId,
      presentationDate: new Date(b.presentationDate),
      startTime: b.startTime ? new Date(b.startTime) : null,
      endTime: b.endTime ? new Date(b.endTime) : null,
      durationMins: b.durationMins ?? null,
      session: b.session ?? null,
      panelId: b.panelId ?? null,
      venue: b.venue ?? null,
      mode: b.mode ?? null,
      excludeScheduleId: b.excludeScheduleId ?? null,
    });
    res.json({
      success: true,
      data: {
        conflicts,
        blocking: conflicts.some((c) => !c.overridable),
        overridable: conflicts.length > 0 && conflicts.every((c) => c.overridable),
      },
    });
  });

  static schedule = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await SchedulingService.schedule(req.body, actorId);
    res.json({ success: true, data });
  });

  static reschedule = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await SchedulingService.reschedule(
      String(req.params.scheduleId),
      req.body,
      actorId,
    );
    res.json({ success: true, data });
  });

  static cancel = asyncHandler(async (req: Request, res: Response) => {
    const data = await SchedulingService.cancel(String(req.params.scheduleId), req.body.reason);
    res.json({ success: true, data });
  });

  static markCompleted = asyncHandler(async (req: Request, res: Response) => {
    const data = await SchedulingService.markCompleted(String(req.params.scheduleId));
    res.json({ success: true, data });
  });

  static updateSchedule = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await SchedulingService.updateSchedule(
      String(req.params.scheduleId),
      req.body,
      actorId,
    );
    res.json({ success: true, data });
  });

  // ── Section 20 ────────────────────────────────────────────────────────────

  static calendar = asyncHandler(async (req: Request, res: Response) => {
    const data = await SchedulingService.calendar(req.query as any);
    res.json({ success: true, data });
  });

  static getSchedule = asyncHandler(async (req: Request, res: Response) => {
    const data = await SchedulingService.getSchedule(String(req.params.scheduleId));
    res.json({ success: true, data });
  });

  static scheduleHistory = asyncHandler(async (req: Request, res: Response) => {
    const data = await SchedulingService.scheduleHistory(String(req.params.applicationId));
    res.json({ success: true, data });
  });

  // ── Section 21 ────────────────────────────────────────────────────────────

  static invitationRecipients = asyncHandler(async (req: Request, res: Response) => {
    const data = await InvitationsService.buildRecipients(String(req.params.scheduleId));
    res.json({ success: true, data });
  });

  static sendInvitation = asyncHandler(async (req: Request, res: Response) => {
    const data = await InvitationsService.send(String(req.params.scheduleId), req.body);
    res.json({ success: true, data });
  });

  static invitationStatus = asyncHandler(async (req: Request, res: Response) => {
    const data = await InvitationsService.status(String(req.params.scheduleId));
    res.json({ success: true, data });
  });
}

export class PanelsController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelsService.list(req.query as any);
    res.json({ success: true, data });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelsService.getById(String(req.params.id));
    res.json({ success: true, data });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await PanelsService.create(req.body, actorId);
    res.status(201).json({ success: true, data });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelsService.update(String(req.params.id), req.body);
    res.json({ success: true, data });
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelsService.remove(String(req.params.id));
    res.json({ success: true, data });
  });

  static addMembers = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelsService.addMembers(String(req.params.id), req.body.members);
    res.json({ success: true, data });
  });

  static updateMember = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelsService.updateMember(String(req.params.memberId), req.body);
    res.json({ success: true, data });
  });

  static removeMember = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelsService.removeMember(String(req.params.memberId));
    res.json({ success: true, data });
  });

  static allocate = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await PanelsService.allocate(
      String(req.params.id),
      req.body.applicationIds,
      actorId,
      req.body.remarks,
    );
    res.json({ success: true, data });
  });

  static deallocate = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelsService.deallocate(String(req.params.allocationId));
    res.json({ success: true, data });
  });
}
