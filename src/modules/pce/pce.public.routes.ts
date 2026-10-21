import { Router } from 'express';
import { PanelInvitationsController } from './sessions.controller';
import { validate } from '../../common/middleware/validate.middleware';
import {
  invitationRespondRouteSchema,
  invitationTokenRouteSchema,
} from './sessions.schema';

/**
 * The evaluator's invitation link, with no authentication.
 *
 * The token in the URL is the whole credential, so these two routes are
 * deliberately the only unauthenticated surface in the module:
 *
 *   GET  describes the invitation. Read-only, because Outlook Safe Links and
 *        Gmail prefetch URLs in email - anything that recorded a decision here
 *        would be answered by a scanner before the evaluator saw it.
 *   POST records the answer, sent from the page the GET rendered.
 *
 * Rate limited where it is mounted, since an unauthenticated endpoint keyed on a
 * secret is worth making expensive to probe.
 */
const publicRouter = Router();

publicRouter.get(
  '/invitation/:token',
  validate(invitationTokenRouteSchema),
  PanelInvitationsController.describe,
);
publicRouter.post(
  '/invitation/:token/respond',
  validate(invitationRespondRouteSchema),
  PanelInvitationsController.respond,
);

export default publicRouter;
