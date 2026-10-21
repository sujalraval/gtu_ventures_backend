import { z } from 'zod';

/** Section 2: how an assignment is being made. */
const MODES = ['SUGGEST', 'PROVISIONAL', 'ASSIGN', 'CONFIRM', 'FINAL_APPROVE'] as const;

const applicationIds = z
  .array(z.string().uuid('Invalid application id'))
  // No upper bound: the admin decides the batch size, and section 6 explicitly
  // expects "select multiple applications" with no stated limit.
  .min(1, 'Select at least one application');

export const AssignSchemeSchema = z.object({
  applicationIds,
  schemeId: z.string().uuid('Select a scheme'),
  mode: z.enum(MODES).optional(),
  remarks: z.string().max(2000).nullable().optional(),
  /** Required by the caller only when the eligibility check hard-failed. */
  overrideReason: z.string().max(2000).nullable().optional(),
});

export const assignSchemeRouteSchema = z.object({ body: AssignSchemeSchema });

export const ChangeSchemeSchema = z.object({
  applicationIds,
  schemeId: z.string().uuid('Select a scheme'),
  // Section 7 makes this mandatory, so it is enforced here as well as in the
  // service - a change with no recorded reason is the thing the history is
  // meant to prevent.
  reason: z.string().trim().min(3, 'A reason for the change is required').max(2000),
  remarks: z.string().max(2000).nullable().optional(),
  asFinal: z.boolean().optional(),
});

export const changeSchemeRouteSchema = z.object({ body: ChangeSchemeSchema });

export const EligibilitySchema = z.object({
  params: z.object({ applicationId: z.string().uuid('Invalid application id') }),
  query: z.object({ schemeId: z.string().uuid('Select a scheme') }),
});
