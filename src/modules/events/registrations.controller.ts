import { Request, Response } from 'express';
import { RegistrationsService } from './registrations.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class RegistrationsController {

  // ── Registrations ─────────────────────────────────────────────────────────

  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const data = await RegistrationsService.getRegistrations(req.params['eventId'] as string);
    res.json({ success: true, data });
  });

  static requestOtp = asyncHandler(async (req: Request, res: Response) => {
    const data = await RegistrationsService.requestEmailOtp(
      req.params['eventId'] as string,
      req.body?.email,
    );
    res.json({ success: true, data });
  });

  static verifyOtp = asyncHandler(async (req: Request, res: Response) => {
    const data = await RegistrationsService.verifyEmailOtp(
      req.params['eventId'] as string,
      req.body?.email,
      req.body?.code,
    );
    res.json({ success: true, data });
  });

  // Public: the caller must present a verification token proving the email.
  static register = asyncHandler(async (req: Request, res: Response) => {
    const data = await RegistrationsService.register(
      req.params['eventId'] as string,
      req.body,
      { requireVerifiedEmail: true },
    );
    res.status(201).json({ success: true, data });
  });

  // Staff adding an attendee by hand — already authenticated, so no OTP, and
  // the event's required extra questions are not enforced at the desk.
  static registerManual = asyncHandler(async (req: Request, res: Response) => {
    const data = await RegistrationsService.register(
      req.params['eventId'] as string,
      req.body,
      { enforceRequiredFields: false },
    );
    res.status(201).json({ success: true, data });
  });

  static cancel = asyncHandler(async (req: Request, res: Response) => {
    const data = await RegistrationsService.cancelRegistration(
      req.params['eventId'] as string,
      req.params['regId'] as string,
    );
    res.json({ success: true, data });
  });

  static getStats = asyncHandler(async (req: Request, res: Response) => {
    const data = await RegistrationsService.getStats(req.params['eventId'] as string);
    res.json({ success: true, data });
  });

  // ── QR Check-in ──────────────────────────────────────────────────────────

  static checkInQr = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.id;
    const { qrToken } = req.body;
    const result = await RegistrationsService.checkInByQr(qrToken, adminId);
    res.json({ success: true, ...result });
  });

  static checkInManual = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.id;
    const result = await RegistrationsService.checkInManual(
      req.params['regId'] as string,
      adminId,
    );
    res.json({ success: true, ...result });
  });

  // ── Invites ───────────────────────────────────────────────────────────────

  static getInvites = asyncHandler(async (req: Request, res: Response) => {
    const data = await RegistrationsService.getInvites(req.params['eventId'] as string);
    res.json({ success: true, data });
  });

  static addInvites = asyncHandler(async (req: Request, res: Response) => {
    const { invites } = req.body as { invites: { email: string; name?: string }[] };
    const result = await RegistrationsService.addInvites(
      req.params['eventId'] as string,
      invites,
    );
    res.status(201).json({ success: true, data: result });
  });

  static removeInvite = asyncHandler(async (req: Request, res: Response) => {
    await RegistrationsService.removeInvite(
      req.params['eventId'] as string,
      req.params['inviteId'] as string,
    );
    res.json({ success: true, message: 'Invite removed' });
  });
}
