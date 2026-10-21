import { z } from 'zod';
import { EXPERT_CATEGORY_KEYS } from './expertCategories';

const SESSIONS = ['MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM'] as const;
const MODES = ['ONLINE', 'OFFLINE', 'HYBRID'] as const;
const PANEL_ROLES = ['CHAIRPERSON', 'MEMBER', 'OBSERVER'] as const;
const PANEL_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
const RECIPIENT_TYPES = [
  'FOUNDER',
  'CO_FOUNDER',
  'EVALUATOR',
  'PANEL_MEMBER',
  'COMMITTEE_CHAIRPERSON',
] as const;

const optText = (max: number) => z.string().max(max).nullable().optional();
const applicationIds = z
  .array(z.string().uuid('Invalid application id'))
  .min(1, 'Select at least one application');

// ── Section 15: panels ──────────────────────────────────────────────────────

const PanelMemberSchema = z.object({
  evaluatorId: z.string().uuid('Invalid evaluator id'),
  role: z.enum(PANEL_ROLES).optional(),
  /** The one or two categories this person counts towards on this panel. */
  expertCategories: z
    .array(z.enum(EXPERT_CATEGORY_KEYS as [string, ...string[]]))
    .min(1, 'Select at least one expert category')
    .max(2, 'Select at most two expert categories')
    .optional(),
});

export const CreatePanelSchema = z.object({
  name: z.string().trim().min(2, 'Panel name is required').max(200),
  schemeId: z.string().uuid().nullable().optional(),
  /** The mandate this panel's composition is checked against. */
  mandateId: z.string().uuid().nullable().optional(),
  /**
   * The pitching session this panel sits on.
   *
   * Without it a session reports no panels and the session-filtered
   * invitation dashboard is empty, because both read this column.
   */
  sessionId: z.string().uuid().nullable().optional(),
  /**
   * Acceptances needed before the panel counts as confirmed. Falls back to
   * the mandate's minimum when not given.
   */
  requiredEvaluators: z.number().int().min(1).max(50).nullable().optional(),
  evaluationStage: optText(200),
  pitchDate: z.string().nullable().optional(),
  session: z.enum(SESSIONS).nullable().optional(),
  sectors: z.array(z.string().max(100)).optional(),
  status: z.enum(PANEL_STATUSES).optional(),
  remarks: optText(4000),
  members: z.array(PanelMemberSchema).optional(),
});

export const createPanelRouteSchema = z.object({ body: CreatePanelSchema });

export const updatePanelRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid panel id') }),
  body: CreatePanelSchema.partial().omit({ members: true }),
});

export const panelIdRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid panel id') }),
});

export const panelMembersRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid panel id') }),
  body: z.object({ members: z.array(PanelMemberSchema).min(1, 'Select at least one evaluator') }),
});

export const panelMemberIdRouteSchema = z.object({
  params: z.object({ memberId: z.string().uuid('Invalid member id') }),
});

export const updatePanelMemberRouteSchema = z.object({
  params: z.object({ memberId: z.string().uuid('Invalid member id') }),
  body: z.object({ role: z.enum(PANEL_ROLES).optional() }),
});

export const allocateRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid panel id') }),
  body: z.object({ applicationIds, remarks: optText(2000) }),
});

export const allocationIdRouteSchema = z.object({
  params: z.object({ allocationId: z.string().uuid('Invalid allocation id') }),
});

// ── Sections 18-19: scheduling ──────────────────────────────────────────────

/**
 * Times are full timestamps, not clock strings.
 *
 * Overlap detection compares instants, so the caller combines the
 * presentation date with the chosen time before sending. A bare "10:00" would
 * have to be recombined here against a date that may be in another timezone.
 */
export const ScheduleSchema = z.object({
  applicationIds,
  schemeId: z.string().uuid().nullable().optional(),
  panelId: z.string().uuid().nullable().optional(),
  presentationDate: z.string().min(1, 'Presentation date is required'),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  durationMins: z.number().int().positive().max(600).nullable().optional(),
  reportingTime: z.string().nullable().optional(),
  session: z.enum(SESSIONS).nullable().optional(),
  mode: z.enum(MODES).optional(),
  venue: optText(500),
  meetingLink: optText(1000),
  instructions: optText(4000),
  remarks: optText(4000),
  /** Minutes between consecutive slots when scheduling several at once. */
  gapMins: z.number().int().min(0).max(240).nullable().optional(),
  /** Required by the service when an overridable conflict was reported. */
  overrideReason: optText(2000),
});

export const scheduleRouteSchema = z.object({ body: ScheduleSchema });

export const conflictCheckRouteSchema = z.object({
  body: z.object({
    applicationId: z.string().uuid('Invalid application id'),
    presentationDate: z.string().min(1, 'Presentation date is required'),
    startTime: z.string().nullable().optional(),
    endTime: z.string().nullable().optional(),
    durationMins: z.number().int().positive().max(600).nullable().optional(),
    session: z.enum(SESSIONS).nullable().optional(),
    panelId: z.string().uuid().nullable().optional(),
    venue: optText(500),
    mode: z.enum(MODES).optional(),
    excludeScheduleId: z.string().uuid().nullable().optional(),
  }),
});

export const rescheduleRouteSchema = z.object({
  params: z.object({ scheduleId: z.string().uuid('Invalid schedule id') }),
  body: ScheduleSchema.omit({ applicationIds: true, gapMins: true, schemeId: true }).extend({
    // Section 20 treats a move as an action needing a reason, not a silent edit.
    reason: z.string().trim().min(3, 'A reason for rescheduling is required').max(2000),
  }),
});

export const cancelRouteSchema = z.object({
  params: z.object({ scheduleId: z.string().uuid('Invalid schedule id') }),
  body: z.object({
    reason: z.string().trim().min(3, 'A reason for cancelling is required').max(2000),
  }),
});

export const scheduleIdRouteSchema = z.object({
  params: z.object({ scheduleId: z.string().uuid('Invalid schedule id') }),
});

export const updateScheduleRouteSchema = z.object({
  params: z.object({ scheduleId: z.string().uuid('Invalid schedule id') }),
  body: z.object({
    venue: optText(500),
    meetingLink: optText(1000),
    instructions: optText(4000),
    remarks: optText(4000),
    panelId: z.string().uuid().nullable().optional(),
  }),
});

// ── Section 21: invitations ─────────────────────────────────────────────────

export const sendInvitationRouteSchema = z.object({
  params: z.object({ scheduleId: z.string().uuid('Invalid schedule id') }),
  body: z.object({
    emails: z.array(z.string().max(200)).optional(),
    recipientTypes: z.array(z.enum(RECIPIENT_TYPES)).optional(),
    contactPerson: optText(200),
    resend: z.boolean().optional(),
  }),
});
