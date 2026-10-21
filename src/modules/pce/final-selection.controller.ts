import { Request, Response } from 'express';
import { FinalSelectionService } from './final-selection.service';
import { OnboardingService } from './onboarding.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class FinalSelectionController {
  // ── Sections 29-30 ────────────────────────────────────────────────────────

  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await FinalSelectionService.list(req.query as any);
    res.json({ success: true, data });
  });

  /** Section 29: what the committee needs in order to confirm a scheme. */
  static confirmationContext = asyncHandler(async (req: Request, res: Response) => {
    const data = await FinalSelectionService.confirmationContext(
      String(req.params.applicationId),
    );
    res.json({ success: true, data });
  });

  static confirmScheme = asyncHandler(async (req: Request, res: Response) => {
    const data = await FinalSelectionService.confirmScheme(
      { applicationId: String(req.params.applicationId), ...req.body },
      (req as any).user.id,
    );
    res.json({ success: true, data });
  });

  static recordDecision = asyncHandler(async (req: Request, res: Response) => {
    const data = await FinalSelectionService.recordDecision(
      { applicationId: String(req.params.applicationId), ...req.body },
      (req as any).user.id,
    );
    res.json({ success: true, data });
  });
}

export class OnboardingController {
  // ── Section 31 ────────────────────────────────────────────────────────────

  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.list(req.query as any);
    res.json({ success: true, data });
  });

  /** Section 31: who can be named as a mentor. */
  static mentorOptions = asyncHandler(async (_req: Request, res: Response) => {
    const data = await OnboardingService.mentorOptions();
    res.json({ success: true, data });
  });

  static getByApplication = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.getByApplication(String(req.params.applicationId));
    res.json({ success: true, data });
  });

  static start = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.start(String(req.params.applicationId));
    res.json({ success: true, data });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.update(
      String(req.params.applicationId),
      req.body,
      (req as any).user.id,
    );
    res.json({ success: true, data });
  });

  /** What is still outstanding, so the UI can say so before completion fails. */
  static outstanding = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.outstanding(String(req.params.applicationId));
    res.json({ success: true, data });
  });

  static complete = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.complete(
      String(req.params.applicationId),
      (req as any).user.id,
    );
    res.json({ success: true, data });
  });

  static addDocument = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.addDocument(
      String(req.params.applicationId),
      req.body,
    );
    res.status(201).json({ success: true, data });
  });

  static updateDocument = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.updateDocument(
      String(req.params.documentId),
      req.body,
      (req as any).user.id,
    );
    res.json({ success: true, data });
  });

  static removeDocument = asyncHandler(async (req: Request, res: Response) => {
    const data = await OnboardingService.removeDocument(String(req.params.documentId));
    res.json({ success: true, data });
  });
}
