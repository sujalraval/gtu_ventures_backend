import { Request, Response } from 'express';
import { HonorariumService } from './honorarium.service';
import { ReportsService } from './reports.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class HonorariumController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await HonorariumService.list(req.query as any);
    res.json({ success: true, data });
  });

  /** Suggests the figure rather than having it typed from memory. */
  static evaluatedCount = asyncHandler(async (req: Request, res: Response) => {
    const { evaluatorId, panelId, schemeId } = req.query as any;
    const data = await HonorariumService.evaluatedCount({ evaluatorId, panelId, schemeId });
    res.json({ success: true, data });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const data = await HonorariumService.create(req.body, (req as any).user.id);
    res.status(201).json({ success: true, data });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const data = await HonorariumService.update(String(req.params.id), req.body);
    res.json({ success: true, data });
  });

  static setStatus = asyncHandler(async (req: Request, res: Response) => {
    const data = await HonorariumService.setStatus(String(req.params.id), req.body);
    res.json({ success: true, data });
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    const data = await HonorariumService.remove(String(req.params.id));
    res.json({ success: true, data });
  });

  /** Section 33. */
  static activity = asyncHandler(async (req: Request, res: Response) => {
    const data = await HonorariumService.activity(String(req.params.evaluatorId));
    res.json({ success: true, data });
  });
}

export class ReportsController {
  static catalogue = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: ReportsService.catalogue() });
  });

  static run = asyncHandler(async (req: Request, res: Response) => {
    const { from, to, schemeId, panelId } = req.query as any;
    const data = await ReportsService.run(String(req.params.key), {
      from,
      to,
      schemeId,
      panelId,
    });
    res.json({ success: true, data });
  });
}
