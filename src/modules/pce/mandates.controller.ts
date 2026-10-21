import { Request, Response } from 'express';
import { MandatesService } from './mandates.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class MandatesController {
  /** The expert-category vocabulary a mandate draws its requirements from. */
  static categories = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: MandatesService.categories() });
  });

  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.list(req.query as any);
    res.json({ success: true, data });
  });

  /** How many committees each scheme requires against how many exist. */
  static rollup = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.schemeRollup(req.query.schemeId as string);
    res.json({ success: true, data });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.getById(String(req.params.id));
    res.json({ success: true, data });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.create(req.body, (req as any).user.id);
    res.status(201).json({ success: true, data });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.update(String(req.params.id), req.body);
    res.json({ success: true, data });
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.remove(String(req.params.id));
    res.json({ success: true, data });
  });

  /** Schemes in one programme usually share a structure; copying avoids re-entry. */
  static copy = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.copyToScheme(
      req.body.fromSchemeId,
      req.body.toSchemeId,
      (req as any).user.id,
    );
    res.json({ success: true, data });
  });

  // ── Compliance ────────────────────────────────────────────────────────────

  static committeeCompliance = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.committeeCompliance(String(req.params.id));
    res.json({ success: true, data });
  });

  static panelCompliance = asyncHandler(async (req: Request, res: Response) => {
    const data = await MandatesService.panelCompliance(String(req.params.id), {
      // Assigned membership by default; confirmed-only is what panel readiness
      // actually turns on, so the caller asks for it explicitly.
      confirmedOnly: req.query.confirmedOnly === 'true',
    });
    res.json({ success: true, data });
  });
}

export default MandatesController;
