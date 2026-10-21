import { Request, Response } from 'express';
import { EvaluationsService } from './evaluations.service';
import asyncHandler from '../../common/utils/asyncHandler';

/**
 * Whether this caller may act as an administrator of evaluations.
 *
 * Decides two things: whether they can record an evaluation on behalf of a
 * named evaluator, and whether they can reopen a locked one. An evaluator
 * acting on their own behalf is neither.
 */
const isEvaluationAdmin = (req: Request): boolean => {
  const user = (req as any).user;
  if (user?.role === 'SUPER_ADMIN' || user?.roles?.includes?.('SUPER_ADMIN')) return true;
  if (user?.role === 'ADMIN' || user?.roles?.includes?.('ADMIN')) return true;
  const actions = user?.permissions?.['pce_evaluations'] ?? [];
  return Array.isArray(actions) && actions.includes('edit');
};

const actorOf = (req: Request) => ({
  userId: (req as any).user.id,
  isAdmin: isEvaluationAdmin(req),
});

export class EvaluationsController {
  /** Section 22: the criteria the form renders, from the server's own list. */
  static criteria = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: EvaluationsService.criteria() });
  });

  // ── Section 16: the evaluator's own portal ────────────────────────────────

  static myAssignments = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluationsService.myAssignments((req as any).user.id);
    res.json({ success: true, data });
  });

  // ── Sections 22-25 ────────────────────────────────────────────────────────

  static saveDraft = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluationsService.saveDraft(req.body, actorOf(req));
    res.json({ success: true, data });
  });

  static submit = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluationsService.submit(req.body, actorOf(req));
    res.json({ success: true, data });
  });

  // ── Section 27 ────────────────────────────────────────────────────────────

  static reopen = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluationsService.reopen(
      String(req.params.evaluationId),
      req.body.reason,
      (req as any).user.id,
    );
    res.json({ success: true, data });
  });

  static revisions = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluationsService.revisions(String(req.params.evaluationId));
    res.json({ success: true, data });
  });

  static listForAdmin = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluationsService.listForAdmin(req.query as any);
    res.json({ success: true, data });
  });

  // ── Sections 26 and 28 ────────────────────────────────────────────────────

  static forApplication = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluationsService.forApplication(String(req.params.applicationId));
    res.json({ success: true, data });
  });

  static consolidated = asyncHandler(async (req: Request, res: Response) => {
    const data = await EvaluationsService.consolidated(req.query as any);
    res.json({ success: true, data });
  });
}

export default EvaluationsController;
