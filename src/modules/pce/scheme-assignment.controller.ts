import { Request, Response } from 'express';
import { SchemeAssignmentService } from './scheme-assignment.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class SchemeAssignmentController {
  // Section 2: the Assign Scheme listing.
  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await SchemeAssignmentService.listApplications(req.query as any);
    res.json({ success: true, data });
  });

  // Sections 2 and 6: assign one or many.
  static assign = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await SchemeAssignmentService.assign(req.body, actorId);
    res.json({ success: true, data });
  });

  // Section 7: change an already-assigned scheme, with a reason.
  static change = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await SchemeAssignmentService.changeScheme(req.body, actorId);
    res.json({ success: true, data });
  });

  // Section 8: the permanent assignment record.
  static history = asyncHandler(async (req: Request, res: Response) => {
    const { applicationId, schemeId, limit } = req.query as any;
    const data = await SchemeAssignmentService.history({ applicationId, schemeId, limit });
    res.json({ success: true, data });
  });

  // Section 9: eligibility against a specific scheme.
  static eligibility = asyncHandler(async (req: Request, res: Response) => {
    const data = await SchemeAssignmentService.checkEligibility(
      String(req.params.applicationId),
      String(req.query.schemeId),
    );
    res.json({ success: true, data });
  });

  // Section 10: per-scheme totals across the journey.
  static overview = asyncHandler(async (_req: Request, res: Response) => {
    const data = await SchemeAssignmentService.schemeOverview();
    res.json({ success: true, data });
  });
}

export default SchemeAssignmentController;
