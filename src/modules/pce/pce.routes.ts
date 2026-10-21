import { Router } from 'express';
import { PceController } from './pce.controller';
import { SchemeAssignmentController } from './scheme-assignment.controller';
import { CommitteesController } from './committees.controller';
import { EvaluatorsController } from './evaluators.controller';
import { SchedulingController, PanelsController } from './scheduling.controller';
import { EvaluationsController } from './evaluations.controller';
import {
  FinalSelectionController,
  OnboardingController,
} from './final-selection.controller';
import { HonorariumController, ReportsController } from './reports.controller';
import { MandatesController } from './mandates.controller';
import { EvaluatorAccessController } from './evaluator-access.controller';
import {
  SessionsController,
  PanelInvitationsController,
} from './sessions.controller';
import {
  assignToSessionRouteSchema,
  createSessionRouteSchema,
  detachScheduleRouteSchema,
  invitePanelRouteSchema,
  panelIdOnlyRouteSchema,
  sessionIdRouteSchema,
  updateSessionRouteSchema,
} from './sessions.schema';
import {
  authenticate,
  authorize,
  authorizePermission,
} from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { authorizePce } from './pce.authorize';
import { dashboardQuerySchema, dashboardListQuerySchema } from './dashboard.schema';
import {
  assignSchemeRouteSchema,
  changeSchemeRouteSchema,
  EligibilitySchema,
} from './scheme-assignment.schema';
import {
  addMembersRouteSchema,
  committeeIdRouteSchema,
  createCommitteeRouteSchema,
  memberIdRouteSchema,
  updateCommitteeRouteSchema,
  updateMemberRouteSchema,
} from './committees.schema';
import {
  addDocumentRouteSchema,
  bankDetailRouteSchema,
  createEvaluatorRouteSchema,
  documentIdRouteSchema,
  evaluatorIdRouteSchema,
  updateEvaluatorRouteSchema,
} from './evaluators.schema';
import {
  allocateRouteSchema,
  allocationIdRouteSchema,
  cancelRouteSchema,
  conflictCheckRouteSchema,
  createPanelRouteSchema,
  panelIdRouteSchema,
  panelMemberIdRouteSchema,
  panelMembersRouteSchema,
  rescheduleRouteSchema,
  scheduleIdRouteSchema,
  scheduleRouteSchema,
  sendInvitationRouteSchema,
  updatePanelMemberRouteSchema,
  updatePanelRouteSchema,
  updateScheduleRouteSchema,
} from './scheduling.schema';
import {
  applicationIdRouteSchema,
  evaluationIdRouteSchema,
  reopenEvaluationRouteSchema,
  saveEvaluationRouteSchema,
  submitEvaluationRouteSchema,
} from './evaluations.schema';
import {
  addOnboardingDocumentRouteSchema,
  applicationScopedRouteSchema,
  confirmSchemeRouteSchema,
  onboardingDocumentIdRouteSchema,
  recordDecisionRouteSchema,
  updateOnboardingDocumentRouteSchema,
  updateOnboardingRouteSchema,
} from './final-selection.schema';
import {
  createHonorariumRouteSchema,
  evaluatorActivityRouteSchema,
  honorariumIdRouteSchema,
  honorariumStatusRouteSchema,
  updateHonorariumRouteSchema,
} from './honorarium.schema';
import {
  copyMandatesRouteSchema,
  createMandateRouteSchema,
  mandateIdRouteSchema,
  updateMandateRouteSchema,
} from './mandates.schema';

const router = Router();

/**
 * Every admin-facing PCE route.
 *
 * STAFF is included because the eighteen `pce_*` keys exist precisely so rights
 * can be delegated; excluding the role made them unreachable for the people they
 * were meant for. `authorizePce` then derives the key from the path, so a staff
 * member sees only what their role was actually granted, and an ADMIN is held to
 * the same map rather than waved through. SUPER_ADMIN still bypasses.
 */
const admin = [
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']),
  authorizePce,
] as const;

// Section 1: the complete-process dashboard.
router.get('/dashboard', ...admin, PceController.getDashboard);

// The management dashboard and the drill-down behind every figure on it. Both
// take the same filters, so a card and the list it opens cannot disagree.
router.get(
  '/dashboard/overview',
  ...admin,
  validate(dashboardQuerySchema),
  PceController.getOverview,
);
router.get(
  '/dashboard/applications',
  ...admin,
  validate(dashboardListQuerySchema),
  PceController.listDashboardApplications,
);

// ── Sections 2, 6-10: scheme assignment ─────────────────────────────────────

// Static paths before parameterised ones, so "history" is not read as an id.
router.get('/scheme-assignment/applications', ...admin, SchemeAssignmentController.list);
router.get('/scheme-assignment/history', ...admin, SchemeAssignmentController.history);
router.get('/scheme-assignment/overview', ...admin, SchemeAssignmentController.overview);

router.get(
  '/scheme-assignment/:applicationId/eligibility',
  ...admin,
  validate(EligibilitySchema),
  SchemeAssignmentController.eligibility,
);

router.post(
  '/scheme-assignment/assign',
  ...admin,
  validate(assignSchemeRouteSchema),
  SchemeAssignmentController.assign,
);

router.post(
  '/scheme-assignment/change',
  ...admin,
  validate(changeSchemeRouteSchema),
  SchemeAssignmentController.change,
);

// ── Section 11: committees ──────────────────────────────────────────────────

router.get('/committees', ...admin, CommitteesController.list);
router.post(
  '/committees',
  ...admin,
  validate(createCommitteeRouteSchema),
  CommitteesController.create,
);

// Member routes are declared before /committees/:id so "members" is never
// matched as a committee id.
router.patch(
  '/committees/members/:memberId',
  ...admin,
  validate(updateMemberRouteSchema),
  CommitteesController.updateMember,
);
router.delete(
  '/committees/members/:memberId',
  ...admin,
  validate(memberIdRouteSchema),
  CommitteesController.removeMember,
);

router.get(
  '/committees/:id',
  ...admin,
  validate(committeeIdRouteSchema),
  CommitteesController.getById,
);
router.patch(
  '/committees/:id',
  ...admin,
  validate(updateCommitteeRouteSchema),
  CommitteesController.update,
);
router.delete(
  '/committees/:id',
  ...admin,
  validate(committeeIdRouteSchema),
  CommitteesController.remove,
);
router.post(
  '/committees/:id/members',
  ...admin,
  validate(addMembersRouteSchema),
  CommitteesController.addMembers,
);

// ── The evaluator's own profile ──────────────────────────────────────────────

/**
 * Authenticated but deliberately not behind authorize(): an external expert is
 * not an ADMIN, and the service authorises them by finding the Evaluator record
 * linked to their user.
 *
 * These must precede the /evaluators/:id routes below. "me" would otherwise be
 * matched as an evaluator id by PUT /evaluators/:id/bank and
 * POST /evaluators/:id/documents, and fail uuid validation.
 */
router.get('/evaluators/me/profile', authenticate, EvaluatorAccessController.getMyProfile);
router.patch('/evaluators/me/profile', authenticate, EvaluatorAccessController.updateMyProfile);
router.put('/evaluators/me/bank', authenticate, EvaluatorAccessController.saveMyBankDetail);
router.post('/evaluators/me/documents', authenticate, EvaluatorAccessController.addMyDocument);
router.delete(
  '/evaluators/me/documents/:documentId',
  authenticate,
  EvaluatorAccessController.removeMyDocument,
);

// ── Sections 12-14: evaluator / expert master ───────────────────────────────

router.get('/evaluators', ...admin, EvaluatorsController.list);
// Before /evaluators/:id, so "documents" is not taken for an id.
router.get('/evaluators/documents', ...admin, EvaluatorsController.listDocuments);
router.post(
  '/evaluators',
  ...admin,
  validate(createEvaluatorRouteSchema),
  EvaluatorsController.create,
);

router.get(
  '/evaluators/:id',
  ...admin,
  validate(evaluatorIdRouteSchema),
  EvaluatorsController.getById,
);
router.patch(
  '/evaluators/:id',
  ...admin,
  validate(updateEvaluatorRouteSchema),
  EvaluatorsController.update,
);
router.delete(
  '/evaluators/:id',
  ...admin,
  validate(evaluatorIdRouteSchema),
  EvaluatorsController.remove,
);

/**
 * Section 13: bank and payment details.
 *
 * Guarded by their own permission rather than by "can edit an evaluator".
 * Reading is additionally masked inside the controller, because the detail is
 * also reachable through GET /evaluators/:id.
 */
router.get(
  '/evaluators/:id/bank',
  ...admin,
  validate(evaluatorIdRouteSchema),
  EvaluatorsController.getBankDetail,
);
router.put(
  '/evaluators/:id/bank',
  ...admin,
  authorizePermission('pce_evaluator_bank', 'edit'),
  validate(bankDetailRouteSchema),
  EvaluatorsController.saveBankDetail,
);

// ── Section 14: evaluator documents ─────────────────────────────────────────

router.post(
  '/evaluators/:id/documents',
  ...admin,
  validate(addDocumentRouteSchema),
  EvaluatorsController.addDocument,
);
router.delete(
  '/evaluators/documents/:documentId',
  ...admin,
  validate(documentIdRouteSchema),
  EvaluatorsController.removeDocument,
);

// ── Section 15: evaluator / jury panels ─────────────────────────────────────

router.get('/panels', ...admin, PanelsController.list);
router.post('/panels', ...admin, validate(createPanelRouteSchema), PanelsController.create);

// Member and allocation routes first, so "members" and "allocations" are never
// matched as a panel id.
router.patch(
  '/panels/members/:memberId',
  ...admin,
  validate(updatePanelMemberRouteSchema),
  PanelsController.updateMember,
);
router.delete(
  '/panels/members/:memberId',
  ...admin,
  validate(panelMemberIdRouteSchema),
  PanelsController.removeMember,
);
router.delete(
  '/panels/allocations/:allocationId',
  ...admin,
  validate(allocationIdRouteSchema),
  PanelsController.deallocate,
);

router.get('/panels/:id', ...admin, validate(panelIdRouteSchema), PanelsController.getById);
router.patch('/panels/:id', ...admin, validate(updatePanelRouteSchema), PanelsController.update);
router.delete('/panels/:id', ...admin, validate(panelIdRouteSchema), PanelsController.remove);
router.post(
  '/panels/:id/members',
  ...admin,
  validate(panelMembersRouteSchema),
  PanelsController.addMembers,
);
router.post(
  '/panels/:id/allocations',
  ...admin,
  validate(allocateRouteSchema),
  PanelsController.allocate,
);

// ── Sections 17-20: selection, scheduling, calendar ─────────────────────────

router.get('/selected-for-pitch', ...admin, SchedulingController.selectedForPitch);
router.get('/calendar', ...admin, SchedulingController.calendar);

// Dry run: report conflicts without writing, so the form can warn first.
router.post(
  '/schedules/check-conflicts',
  ...admin,
  validate(conflictCheckRouteSchema),
  SchedulingController.checkConflicts,
);
router.post('/schedules', ...admin, validate(scheduleRouteSchema), SchedulingController.schedule);

router.get(
  '/schedules/history/:applicationId',
  ...admin,
  SchedulingController.scheduleHistory,
);

router.get(
  '/schedules/:scheduleId',
  ...admin,
  validate(scheduleIdRouteSchema),
  SchedulingController.getSchedule,
);
router.patch(
  '/schedules/:scheduleId',
  ...admin,
  validate(updateScheduleRouteSchema),
  SchedulingController.updateSchedule,
);
router.post(
  '/schedules/:scheduleId/reschedule',
  ...admin,
  validate(rescheduleRouteSchema),
  SchedulingController.reschedule,
);
router.post(
  '/schedules/:scheduleId/cancel',
  ...admin,
  validate(cancelRouteSchema),
  SchedulingController.cancel,
);
router.post(
  '/schedules/:scheduleId/complete',
  ...admin,
  validate(scheduleIdRouteSchema),
  SchedulingController.markCompleted,
);

// ── Section 21: invitations ─────────────────────────────────────────────────

router.get(
  '/schedules/:scheduleId/invitations',
  ...admin,
  validate(scheduleIdRouteSchema),
  SchedulingController.invitationStatus,
);
router.get(
  '/schedules/:scheduleId/invitations/recipients',
  ...admin,
  validate(scheduleIdRouteSchema),
  SchedulingController.invitationRecipients,
);
router.post(
  '/schedules/:scheduleId/invitations',
  ...admin,
  validate(sendInvitationRouteSchema),
  SchedulingController.sendInvitation,
);

// ── Sections 16, 22-28: pitch evaluation ────────────────────────────────────

/**
 * The evaluator's own portal.
 *
 * Authenticated but deliberately not behind authorize(): an external jury
 * member is not an ADMIN, and the service authorises them by finding the
 * Evaluator record linked to their user, then scopes what they see to the
 * applications allocated to their panels.
 */
router.get('/my-evaluations', authenticate, EvaluationsController.myAssignments);
router.get('/evaluations/criteria', authenticate, EvaluationsController.criteria);

// Saving and submitting are open to any authenticated caller; the service
// decides whether they are acting as themselves or, for an admin, on behalf of
// a named evaluator.
router.post(
  '/evaluations/draft',
  authenticate,
  validate(saveEvaluationRouteSchema),
  EvaluationsController.saveDraft,
);
router.post(
  '/evaluations/submit',
  authenticate,
  validate(submitEvaluationRouteSchema),
  EvaluationsController.submit,
);

router.get('/evaluations', ...admin, EvaluationsController.listForAdmin);
router.get('/evaluations/consolidated', ...admin, EvaluationsController.consolidated);
router.get(
  '/evaluations/application/:applicationId',
  ...admin,
  validate(applicationIdRouteSchema),
  EvaluationsController.forApplication,
);

// Section 27: reopening is an administrative act, so this one is gated.
router.post(
  '/evaluations/:evaluationId/reopen',
  ...admin,
  validate(reopenEvaluationRouteSchema),
  EvaluationsController.reopen,
);
router.get(
  '/evaluations/:evaluationId/revisions',
  ...admin,
  validate(evaluationIdRouteSchema),
  EvaluationsController.revisions,
);

// ── Sections 29-30: final scheme confirmation and the committee decision ────

router.get('/final-selection', ...admin, FinalSelectionController.list);
router.get(
  '/final-selection/:applicationId/context',
  ...admin,
  validate(applicationScopedRouteSchema),
  FinalSelectionController.confirmationContext,
);
router.post(
  '/final-selection/:applicationId/confirm-scheme',
  ...admin,
  validate(confirmSchemeRouteSchema),
  FinalSelectionController.confirmScheme,
);
router.post(
  '/final-selection/:applicationId/decision',
  ...admin,
  validate(recordDecisionRouteSchema),
  FinalSelectionController.recordDecision,
);

// ── Section 31: onboarding ──────────────────────────────────────────────────

router.get('/onboarding', ...admin, OnboardingController.list);
// Before /onboarding/:applicationId, so "mentor-options" is not read as an id.
router.get('/onboarding/mentor-options', ...admin, OnboardingController.mentorOptions);

// Document routes before the :applicationId ones, so "documents" is never
// matched as an application id.
router.patch(
  '/onboarding/documents/:documentId',
  ...admin,
  validate(updateOnboardingDocumentRouteSchema),
  OnboardingController.updateDocument,
);
router.delete(
  '/onboarding/documents/:documentId',
  ...admin,
  validate(onboardingDocumentIdRouteSchema),
  OnboardingController.removeDocument,
);

router.get(
  '/onboarding/:applicationId',
  ...admin,
  validate(applicationScopedRouteSchema),
  OnboardingController.getByApplication,
);
router.get(
  '/onboarding/:applicationId/outstanding',
  ...admin,
  validate(applicationScopedRouteSchema),
  OnboardingController.outstanding,
);
router.patch(
  '/onboarding/:applicationId',
  ...admin,
  validate(updateOnboardingRouteSchema),
  OnboardingController.update,
);
router.post(
  '/onboarding/:applicationId/start',
  ...admin,
  validate(applicationScopedRouteSchema),
  OnboardingController.start,
);
router.post(
  '/onboarding/:applicationId/complete',
  ...admin,
  validate(applicationScopedRouteSchema),
  OnboardingController.complete,
);
router.post(
  '/onboarding/:applicationId/documents',
  ...admin,
  validate(addOnboardingDocumentRouteSchema),
  OnboardingController.addDocument,
);

// ── Sections 32-33: evaluator payments and activity history ─────────────────

router.get('/honorarium', ...admin, HonorariumController.list);
router.get('/honorarium/evaluated-count', ...admin, HonorariumController.evaluatedCount);
router.post(
  '/honorarium',
  ...admin,
  validate(createHonorariumRouteSchema),
  HonorariumController.create,
);
router.patch(
  '/honorarium/:id',
  ...admin,
  validate(updateHonorariumRouteSchema),
  HonorariumController.update,
);
router.post(
  '/honorarium/:id/status',
  ...admin,
  validate(honorariumStatusRouteSchema),
  HonorariumController.setStatus,
);
router.delete(
  '/honorarium/:id',
  ...admin,
  validate(honorariumIdRouteSchema),
  HonorariumController.remove,
);

// Section 33: one evaluator's whole involvement.
router.get(
  '/evaluators/:evaluatorId/activity',
  ...admin,
  validate(evaluatorActivityRouteSchema),
  HonorariumController.activity,
);

// ── Section 35: reports ─────────────────────────────────────────────────────

router.get('/reports', ...admin, ReportsController.catalogue);
router.get('/reports/:key', ...admin, ReportsController.run);

// ── Scheme committee mandates ───────────────────────────────────────────────

// Static paths before the parameterised one.
router.get('/mandates/categories', ...admin, MandatesController.categories);
router.get('/mandates/rollup', ...admin, MandatesController.rollup);
router.get('/mandates', ...admin, MandatesController.list);
router.post('/mandates', ...admin, validate(createMandateRouteSchema), MandatesController.create);
router.post(
  '/mandates/copy',
  ...admin,
  validate(copyMandatesRouteSchema),
  MandatesController.copy,
);

router.get('/mandates/:id', ...admin, validate(mandateIdRouteSchema), MandatesController.getById);
router.patch(
  '/mandates/:id',
  ...admin,
  validate(updateMandateRouteSchema),
  MandatesController.update,
);
router.delete(
  '/mandates/:id',
  ...admin,
  validate(mandateIdRouteSchema),
  MandatesController.remove,
);

// Compliance of an actual membership against its mandate.
router.get(
  '/committees/:id/compliance',
  ...admin,
  validate(mandateIdRouteSchema),
  MandatesController.committeeCompliance,
);
router.get(
  '/panels/:id/compliance',
  ...admin,
  validate(mandateIdRouteSchema),
  MandatesController.panelCompliance,
);

// Granting a login is an administrative act. Three segments ending in
// "access", so it does not collide with the routes above.
router.post('/evaluators/:id/access', ...admin, EvaluatorAccessController.grant);
router.delete('/evaluators/:id/access', ...admin, EvaluatorAccessController.revoke);

// ── Pitching calendar: sessions ─────────────────────────────────────────────

router.get('/sessions', ...admin, SessionsController.list);
// Before /sessions/:id, so "rounds" is not read as an id.
router.get('/sessions/rounds', ...admin, SessionsController.rounds);
router.post(
  '/sessions',
  ...admin,
  validate(createSessionRouteSchema),
  SessionsController.create,
);

// Detaching is addressed by the booking, not the session, so it sits above the
// parameterised session routes.
router.delete(
  '/sessions/schedules/:scheduleId',
  ...admin,
  validate(detachScheduleRouteSchema),
  SessionsController.detach,
);

router.get('/sessions/:id', ...admin, validate(sessionIdRouteSchema), SessionsController.getById);
router.patch(
  '/sessions/:id',
  ...admin,
  validate(updateSessionRouteSchema),
  SessionsController.update,
);
router.delete('/sessions/:id', ...admin, validate(sessionIdRouteSchema), SessionsController.remove);
router.post(
  '/sessions/:id/applications',
  ...admin,
  validate(assignToSessionRouteSchema),
  SessionsController.assign,
);

// ── Panel invitations, confirmation and startup notification ────────────────

router.get('/panel-invitations', ...admin, PanelInvitationsController.dashboard);
router.post(
  '/panels/:id/invitations',
  ...admin,
  validate(invitePanelRouteSchema),
  PanelInvitationsController.invite,
);
router.get(
  '/panels/:id/confirmation',
  ...admin,
  validate(panelIdOnlyRouteSchema),
  PanelInvitationsController.confirmation,
);
router.post(
  '/panels/:id/notify-startups',
  ...admin,
  validate(panelIdOnlyRouteSchema),
  PanelInvitationsController.notifyStartups,
);

export default router;
