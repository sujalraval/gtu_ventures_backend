import { Request, Response } from 'express';
import { SessionsService } from './sessions.service';
import { PanelInvitationsService } from './panel-invitations.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class SessionsController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await SessionsService.list(req.query as any);
    res.json({ success: true, data });
  });

  /** The rounds already in use, so the form can offer them. */
  static rounds = asyncHandler(async (_req: Request, res: Response) => {
    const data = await SessionsService.rounds();
    res.json({ success: true, data });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await SessionsService.getById(String(req.params.id));
    res.json({ success: true, data });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const data = await SessionsService.create(req.body, (req as any).user.id);
    res.status(201).json({ success: true, data });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const data = await SessionsService.update(String(req.params.id), req.body);
    res.json({ success: true, data });
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    const data = await SessionsService.remove(String(req.params.id));
    res.json({ success: true, data });
  });

  static assign = asyncHandler(async (req: Request, res: Response) => {
    const data = await SessionsService.assignApplications(
      String(req.params.id),
      req.body,
      (req as any).user.id,
    );
    res.json({ success: true, data });
  });

  static detach = asyncHandler(async (req: Request, res: Response) => {
    const data = await SessionsService.detach(String(req.params.scheduleId));
    res.json({ success: true, data });
  });
}

export class PanelInvitationsController {
  // ── Administrator side ────────────────────────────────────────────────────

  static invite = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelInvitationsService.invite(String(req.params.id), req.body ?? {});
    res.json({ success: true, data });
  });

  /** Recomputed on demand, so a stale confirmation can always be corrected. */
  static confirmation = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelInvitationsService.refreshConfirmation(String(req.params.id), {
      // Reading the state must not fire emails; notifying is its own action.
      notify: false,
    });
    res.json({ success: true, data });
  });

  static notifyStartups = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelInvitationsService.notifyStartups(String(req.params.id));
    res.json({ success: true, data });
  });

  static dashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelInvitationsService.dashboard(req.query as any);
    res.json({ success: true, data });
  });

  // ── Public: the evaluator's own invitation ────────────────────────────────

  /**
   * Read-only. Safe for a mail scanner to prefetch, which is exactly why the
   * answer is not recorded here.
   */
  static describe = asyncHandler(async (req: Request, res: Response) => {
    const data = await PanelInvitationsService.describeByToken(String(req.params.token));
    res.json({ success: true, data });
  });

  /** The answer, by POST from the invitation page. Never a link in the email. */
  static respond = asyncHandler(async (req: Request, res: Response) => {
    const accept = req.body?.accept === true;
    const data = await PanelInvitationsService.respond(
      String(req.params.token),
      accept,
      req.body?.note,
    );
    res.json({ success: true, data });
  });
}
