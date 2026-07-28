import { Router } from 'express';
import { alumniController } from './alumni.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// ── Directory (public to all authenticated) ──────────────────────────────────
// NOTE: specific paths must be registered BEFORE /:id to avoid being swallowed
router.get('/directory/stats', authenticate, alumniController.getDirectoryStats);
router.get('/directory', authenticate, alumniController.getDirectory);
router.get('/my-profile', authenticate, alumniController.getMyAlumniProfile);

// ── Referral Pipeline ─────────────────────────────────────────────────────────
router.get('/referrals', authenticate, authorize(ADMIN_ROLES), alumniController.getReferrals);
router.post('/referrals', authenticate, authorize(ADMIN_ROLES), alumniController.submitReferral);
router.post('/referrals/my', authenticate, alumniController.submitMyReferral);
router.patch('/referrals/:id/status', authenticate, authorize(ADMIN_ROLES), alumniController.updateReferralStatus);

// ── Success Stories ───────────────────────────────────────────────────────────
router.get('/success-stories/my', authenticate, alumniController.getMySuccessStories);
router.get('/success-stories', authenticate, alumniController.getSuccessStories);
router.post('/success-stories', authenticate, authorize(ADMIN_ROLES), alumniController.createSuccessStory);
router.put('/success-stories/:id', authenticate, authorize(ADMIN_ROLES), alumniController.updateSuccessStory);
router.delete('/success-stories/:id', authenticate, authorize(ADMIN_ROLES), alumniController.deleteSuccessStory);

// ── Re-engagement ─────────────────────────────────────────────────────────────
router.get('/engagement', authenticate, authorize(ADMIN_ROLES), alumniController.getEngagementFlags);
router.post('/engagement', authenticate, authorize(ADMIN_ROLES), alumniController.flagForEngagement);
router.patch('/engagement/:id', authenticate, authorize(ADMIN_ROLES), alumniController.updateEngagementStatus);
router.post('/engagement/:id/activity', authenticate, authorize(ADMIN_ROLES), alumniController.logEngagementActivity);
router.delete('/engagement/:id/activity/:activityIndex', authenticate, authorize(ADMIN_ROLES), alumniController.deleteEngagementActivity);

// ── Longitudinal KPI Tracking ─────────────────────────────────────────────────
router.get('/kpi-snapshots', authenticate, authorize(ADMIN_ROLES), alumniController.getAllKpiSnapshots);
router.post('/kpi-snapshots/request', authenticate, authorize(ADMIN_ROLES), alumniController.requestKpiSubmission);
router.post('/kpi-snapshots/my', authenticate, alumniController.submitMyKpiSnapshot);
router.post('/kpi-snapshots', authenticate, authorize(ADMIN_ROLES), alumniController.submitKpiSnapshot);
router.put('/kpi-snapshots/:id', authenticate, authorize(ADMIN_ROLES), alumniController.updateKpiSnapshot);

// ── Single alumni detail — MUST be last among GET routes to avoid eating named paths ──
router.get('/:alumniId/kpi-snapshots', authenticate, alumniController.getKpiSnapshotsByAlumni);
router.get('/:id', authenticate, alumniController.getAlumniById);

export default router;
