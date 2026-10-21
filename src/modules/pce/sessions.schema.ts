import { z } from 'zod';

/**
 * Validation for the pitching calendar and panel invitations.
 *
 * Added to match the rest of the module: every other write path validates at the
 * edge, so a bad payload gives a clear message instead of a Prisma error or a
 * silently coerced value.
 */

const SESSIONS = ['MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM'] as const;
const MODES = ['ONLINE', 'OFFLINE', 'HYBRID'] as const;
const SESSION_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

const optText = (max: number) => z.string().max(max).nullable().optional();

const SessionFields = z.object({
  schemeId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2, 'A session name is required').max(200),
  round: optText(100),
  presentationDate: z.string().min(1, 'A presentation date is required'),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  session: z.enum(SESSIONS).nullable().optional(),
  reportingTime: z.string().nullable().optional(),
  mode: z.enum(MODES).optional(),
  venue: optText(500),
  meetingLink: optText(1000),
  /** Null means no limit; zero would mean a session nothing can enter. */
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  instructions: optText(4000),
  remarks: optText(4000),
  status: z.enum(SESSION_STATUSES).optional(),
});

export const createSessionRouteSchema = z.object({ body: SessionFields });

export const updateSessionRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid session id') }),
  body: SessionFields.partial(),
});

export const sessionIdRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid session id') }),
});

export const assignToSessionRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid session id') }),
  body: z.object({
    applicationIds: z
      .array(z.string().uuid('Invalid application id'))
      .min(1, 'Select at least one application'),
    panelId: z.string().uuid().nullable().optional(),
    gapMins: z.number().int().min(0).max(240).nullable().optional(),
    overrideReason: optText(2000),
  }),
});

export const detachScheduleRouteSchema = z.object({
  params: z.object({ scheduleId: z.string().uuid('Invalid booking id') }),
});

// ── Panel invitations ───────────────────────────────────────────────────────

export const panelIdOnlyRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid panel id') }),
});

export const invitePanelRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid panel id') }),
  body: z.object({
    /** Omitted means every seated evaluator on the panel. */
    evaluatorIds: z.array(z.string().uuid('Invalid evaluator id')).optional(),
    contactPerson: optText(200),
  }),
});

/**
 * The public response.
 *
 * `accept` is required and strictly boolean: defaulting it either way would
 * decide for the evaluator if a client sent a malformed body.
 */
export const invitationRespondRouteSchema = z.object({
  params: z.object({ token: z.string().min(16, 'Invalid invitation link').max(200) }),
  body: z.object({
    accept: z.boolean({ message: 'Choose accept or decline' }),
    note: optText(2000),
  }),
});

export const invitationTokenRouteSchema = z.object({
  params: z.object({ token: z.string().min(16, 'Invalid invitation link').max(200) }),
});
