import { z } from 'zod';
import { STAGES } from './dashboard.constants';

/**
 * The dashboard's query string.
 *
 * Every field is optional and every one is a filter. Loose on the enum-ish
 * fields on purpose: the service casts them to Prisma enums, and a value that
 * is not a member simply matches nothing rather than erroring, which is the
 * right behaviour for a dashboard someone has bookmarked with a stale filter.
 * `stage` is the exception - it drives a derived comparison rather than a
 * database predicate, so a typo there would silently show everything, and that
 * is worth a 400.
 */
const optStr = z.string().trim().max(200).optional();
const optId = z.string().trim().max(100).optional();

export const dashboardQuerySchema = z.object({
  query: z.object({
    from: optStr,
    to: optStr,
    schemeId: optId,
    cohortId: optId,
    sector: optStr,
    status: optStr,
    pitchStatus: optStr,
    evaluationStatus: optStr,
    onboardingStatus: optStr,
    schemeStatus: optStr,
    finalDecision: optStr,
    committeeId: optId,
    panelId: optId,
    evaluatorId: optId,
    expertId: optId,
    sessionId: optId,
    stage: z.enum(STAGES).optional(),
  }),
});

export const dashboardListQuerySchema = z.object({
  query: dashboardQuerySchema.shape.query.extend({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(200).optional(),
  }),
});
