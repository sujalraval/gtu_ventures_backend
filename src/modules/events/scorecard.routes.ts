import { Router } from 'express';
import { ScorecardController } from './scorecard.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router({ mergeParams: true });
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const JUDGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MENTOR', 'STAFF'];

// ── Criteria (admin) ──────────────────────────────────────────────────────────
router.get('/criteria', authenticate, ScorecardController.getCriteria);
router.put('/criteria', authenticate, authorize(ADMIN_ROLES), ScorecardController.upsertCriteria);
router.delete('/criteria/:criteriaId', authenticate, authorize(ADMIN_ROLES), ScorecardController.deleteCriteria);

// ── Judges (admin assigns) ───────────────────────────────────────────────────
router.get('/judges', authenticate, authorize(ADMIN_ROLES), ScorecardController.getJudges);
router.post('/judges', authenticate, authorize(ADMIN_ROLES), ScorecardController.assignJudge);
router.delete('/judges/:assignmentId', authenticate, authorize(ADMIN_ROLES), ScorecardController.removeJudge);

// ── Startups list for judges ─────────────────────────────────────────────────
router.get('/startups', authenticate, authorize(JUDGE_ROLES), ScorecardController.getStartupsToScore);

// ── Scoring (any assigned judge) ─────────────────────────────────────────────
router.post('/score', authenticate, authorize(JUDGE_ROLES), ScorecardController.submitScore);
router.post('/score/batch', authenticate, authorize(JUDGE_ROLES), ScorecardController.submitBatchScores);
router.get('/my-scores', authenticate, authorize(JUDGE_ROLES), ScorecardController.getJudgeScores);

// ── Leaderboard ──────────────────────────────────────────────────────────────
router.get('/leaderboard', authenticate, ScorecardController.getLeaderboard);

export default router;
