import { Request, Response } from 'express';
import { EvaluatorsService } from './evaluators.service';
import asyncHandler from '../../common/utils/asyncHandler';

/**
 * Section 13: whether the caller may see bank and payment details.
 *
 * Mirrors authorizePermission, deliberately: the bank detail is read as part
 * of fetching an evaluator, so this has to be answerable inside the handler
 * rather than only as route middleware. Super admin bypasses, matching the
 * rest of the system.
 */
const canSeeBank = (req: Request): boolean => {
  const user = (req as any).user;
  if (user?.role === 'SUPER_ADMIN' || user?.roles?.includes?.('SUPER_ADMIN')) return true;
  const actions = user?.permissions?.['pce_evaluator_bank'] ?? [];
  return Array.isArray(actions) && actions.includes('view');
};

export class EvaluatorsController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorsService.list(req.query as any);
    res.json({ success: true, data });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorsService.getById(String(req.params.id), canSeeBank(req));
    res.json({ success: true, data });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await EvaluatorsService.create(req.body, actorId);
    res.status(201).json({ success: true, data });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorsService.update(String(req.params.id), req.body);
    res.json({ success: true, data });
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorsService.remove(String(req.params.id));
    res.json({ success: true, data });
  });

  // ── Section 13 ────────────────────────────────────────────────────────────

  static getBankDetail = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorsService.getBankDetail(String(req.params.id), canSeeBank(req));
    res.json({ success: true, data });
  });

  static saveBankDetail = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await EvaluatorsService.upsertBankDetail(
      String(req.params.id),
      req.body,
      actorId,
    );
    res.json({ success: true, data });
  });

  // ── Section 14 ────────────────────────────────────────────────────────────

  static listDocuments = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorsService.listDocuments(req.query as any);
    res.json({ success: true, data });
  });

  static addDocument = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await EvaluatorsService.addDocument(String(req.params.id), req.body, actorId);
    res.status(201).json({ success: true, data });
  });

  static removeDocument = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluatorsService.removeDocument(String(req.params.documentId));
    res.json({ success: true, data });
  });
}

export default EvaluatorsController;
