import { Request, Response } from 'express';
import { EvaluatorAccessService } from './evaluator-access.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class EvaluatorAccessController {
  // ── Administrator side ────────────────────────────────────────────────────

  static grant = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorAccessService.grant(String(req.params.id), {
      notify: req.body?.notify !== false,
    });
    res.json({ success: true, data });
  });

  static revoke = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorAccessService.revoke(String(req.params.id));
    res.json({ success: true, data });
  });

  // ── The evaluator's own profile ───────────────────────────────────────────

  static getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorAccessService.getMyProfile((req as any).user.id);
    res.json({ success: true, data });
  });

  static updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorAccessService.updateMyProfile((req as any).user.id, req.body);
    res.json({ success: true, data });
  });

  static saveMyBankDetail = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorAccessService.saveMyBankDetail((req as any).user.id, req.body);
    res.json({ success: true, data });
  });

  static addMyDocument = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorAccessService.addMyDocument((req as any).user.id, req.body);
    res.status(201).json({ success: true, data });
  });

  static removeMyDocument = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorAccessService.removeMyDocument(
      (req as any).user.id,
      String(req.params.documentId),
    );
    res.json({ success: true, data });
  });
}

export default EvaluatorAccessController;
