import { Request, Response } from 'express';
import { PitchDeckService } from './pitchdeck.service';
import asyncHandler from '../../common/utils/asyncHandler';
import { PitchDeckStatus } from '@prisma/client';
import path from 'path';
import fs from 'fs';

export class PitchDeckController {

  // Startup: submit a new deck (creates new version)
  static submit = asyncHandler(async (req: Request, res: Response) => {
    const startupId = (req as any).user?.id;
    const file = req.file as Express.Multer.File;
    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }
    const data = await PitchDeckService.submit(req.params['eventId'] as string, startupId, file);
    res.status(201).json({ success: true, data });
  });

  // Admin: all submissions for an event (grouped)
  static getByEvent = asyncHandler(async (req: Request, res: Response) => {
    const active = req.query['active'] === 'true';
    const data = active
      ? await PitchDeckService.getActiveByEvent(req.params['eventId'] as string)
      : await PitchDeckService.getByEvent(req.params['eventId'] as string);
    res.json({ success: true, data });
  });

  // Admin: stats
  static getStats = asyncHandler(async (req: Request, res: Response) => {
    const data = await PitchDeckService.getStats(req.params['eventId'] as string);
    res.json({ success: true, data });
  });

  // Startup: my version history for a specific event
  static getVersionHistory = asyncHandler(async (req: Request, res: Response) => {
    const startupId = (req as any).user?.id;
    const data = await PitchDeckService.getVersionHistory(
      req.params['eventId'] as string,
      startupId,
    );
    res.json({ success: true, data });
  });

  // Startup: all my submissions across all events
  static getMySubmissions = asyncHandler(async (req: Request, res: Response) => {
    const startupId = (req as any).user?.id;
    const data = await PitchDeckService.getMySubmissions(startupId);
    res.json({ success: true, data });
  });

  // Admin: review / change status
  static review = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.id;
    const { status, notes } = req.body as { status: PitchDeckStatus; notes?: string };
    const data = await PitchDeckService.review(
      req.params['submissionId'] as string,
      adminId,
      status,
      notes,
    );
    res.json({ success: true, data });
  });

  // Startup: restore a previous version
  static setActive = asyncHandler(async (req: Request, res: Response) => {
    const startupId = (req as any).user?.id;
    const data = await PitchDeckService.setActiveVersion(
      req.params['submissionId'] as string,
      startupId,
    );
    res.json({ success: true, data });
  });

  // Startup: delete a non-active version
  static deleteVersion = asyncHandler(async (req: Request, res: Response) => {
    const startupId = (req as any).user?.id;
    await PitchDeckService.deleteVersion(req.params['submissionId'] as string, startupId);
    res.json({ success: true, message: 'Version deleted' });
  });

  // Serve file download (protected)
  static download = asyncHandler(async (req: Request, res: Response) => {
    const filename = req.params['filename'] as string;
    const filePath = path.join(process.cwd(), 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }
    res.download(filePath);
  });
}
