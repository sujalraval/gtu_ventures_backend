import { Request, Response, NextFunction } from 'express';
import { authorizePermission } from '../../common/middleware/auth.middleware';

/**
 * Permission enforcement for the PCE module.
 *
 * Why this is one middleware and not 109 route edits: every PCE route shared a
 * `[authenticate, authorize(['SUPER_ADMIN','ADMIN'])]` pair and nothing else, so
 * the eighteen `pce_*` permission keys registered in Role Rights were enforced
 * nowhere. Ticking or unticking them changed nothing on the server, and a STAFF
 * user granted PCE rights saw the menu but got 403 from every call. Spelling the
 * right key onto each of 109 routes by hand is where that sort of mistake is
 * made a second time, so the key is derived from the path instead, through one
 * table that can be read in full.
 *
 * Action follows the convention already used elsewhere in this codebase
 * (see applications.routes.ts): GET reads, anything else writes.
 */

/** First path segment -> the permission module that governs it. */
const MODULE_BY_SEGMENT: Record<string, string> = {
  dashboard: 'pce_dashboard',
  'scheme-assignment': 'pce_scheme_assignment',
  'selected-for-pitch': 'pce_selected_for_pitch',
  committees: 'pce_committees',
  mandates: 'pce_committees',
  evaluators: 'pce_evaluators',
  panels: 'pce_panels',
  'panel-invitations': 'pce_panels',
  schedules: 'pce_schedule',
  calendar: 'pce_calendar',
  sessions: 'pce_calendar',
  evaluations: 'pce_evaluations',
  'final-selection': 'pce_final_selection',
  onboarding: 'pce_onboarding',
  honorarium: 'pce_honorarium',
  reports: 'pce_reports',
};

/**
 * Routes an evaluator uses about themselves, which must not require an admin
 * permission: the whole point is that the person is not an administrator. These
 * carry their own authorisation inside the service, which checks that the
 * caller's user is linked to an Evaluator record.
 */
const SELF_SERVICE = ['/my-evaluations', '/evaluators/me'];

const firstSegment = (path: string) => path.split('/').filter(Boolean)[0] ?? '';

/**
 * Checks the `pce_*` permission implied by the request path.
 *
 * An unmapped path is refused rather than allowed. A new route group added
 * without a key here is a 403 in testing, which is noticed; the alternative
 * default would ship it ungoverned, which is not.
 */
export const authorizePce = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path || '';

  if (SELF_SERVICE.some((p) => path.startsWith(p))) return next();

  const moduleKey = MODULE_BY_SEGMENT[firstSegment(path)];
  if (!moduleKey) {
    return res.status(403).json({
      message: 'Forbidden: this route has no permission module mapped for it',
    });
  }

  const action = req.method === 'GET' ? 'view' : 'edit';
  return authorizePermission(moduleKey, action)(req, res, next);
};

/** Exported for the test that asserts every route group is mapped. */
export const PCE_PERMISSION_MAP = MODULE_BY_SEGMENT;
export const PCE_SELF_SERVICE_PREFIXES = SELF_SERVICE;
