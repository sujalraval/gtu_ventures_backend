import { Router } from 'express';
import { ScreeningService } from './screening.service';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import asyncHandler from '../../common/utils/asyncHandler';

const router = Router({ mergeParams: true });
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
// Judges need the board to follow the round; only admins change anything.
const PANEL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MENTOR', 'STAFF', 'EXPERT'];

/** Applications waiting to be screened — not scoped to one event. */
router.get(
  '/awaiting',
  authenticate,
  authorize(ADMIN_ROLES),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await ScreeningService.getAwaitingScreening() });
  }),
);

/** Panel management. Guest judges are created here, never by self sign-up. */
router.get(
  '/judges',
  authenticate,
  authorize(PANEL_ROLES),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await ScreeningService.listJudges(req.params['eventId'] as string) });
  }),
);

router.post(
  '/judges',
  authenticate,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await ScreeningService.inviteJudge(req.params['eventId'] as string, req.body);
    res.status(201).json({ success: true, data });
  }),
);

router.delete(
  '/judges/:assignmentId',
  authenticate,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await ScreeningService.removeJudge(
      req.params['eventId'] as string,
      req.params['assignmentId'] as string,
    );
    res.json({ success: true, data });
  }),
);

router.get(
  '/candidates',
  authenticate,
  authorize(PANEL_ROLES),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await ScreeningService.listCandidates(req.params['eventId'] as string) });
  }),
);

router.post(
  '/candidates',
  authenticate,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await ScreeningService.addCandidates(
      req.params['eventId'] as string,
      req.body.applicationIds,
    );
    res.status(201).json({ success: true, data });
  }),
);

router.delete(
  '/candidates/:candidateId',
  authenticate,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await ScreeningService.removeCandidate(
      req.params['eventId'] as string,
      req.params['candidateId'] as string,
    );
    res.json({ success: true, data });
  }),
);

router.post(
  '/reorder',
  authenticate,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await ScreeningService.reorder(
      req.params['eventId'] as string,
      req.body.candidateIds || [],
    );
    res.json({ success: true, data });
  }),
);

/** Live control — which candidate is on stage. Pass null to clear. */
router.post(
  '/presenting',
  authenticate,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const data = await ScreeningService.setPresenting(
      req.params['eventId'] as string,
      req.body.candidateId ?? null,
    );
    res.json({ success: true, data });
  }),
);

router.post(
  '/candidates/:candidateId/outcome',
  authenticate,
  authorize(ADMIN_ROLES),
  asyncHandler(async (req, res) => {
    const adminId = (req as any).user.id;
    const data = await ScreeningService.recordOutcome(
      req.params['eventId'] as string,
      req.params['candidateId'] as string,
      req.body,
      adminId,
    );
    res.json({ success: true, data });
  }),
);

/** Candidates with aggregated scores and rank. */
router.get(
  '/board',
  authenticate,
  authorize(PANEL_ROLES),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await ScreeningService.getBoard(req.params['eventId'] as string) });
  }),
);

export default router;
