import { z } from 'zod';

const RECOMMENDATIONS = [
  'HIGHLY_RECOMMENDED',
  'RECOMMENDED',
  'RECOMMENDED_WITH_CONDITIONS',
  'RECOMMENDED_FOR_INCUBATION',
  'RE_PRESENTATION_REQUIRED',
  'HOLD_FOR_REVIEW',
  'WAITLISTED',
  'NOT_RECOMMENDED',
] as const;

const optText = (max: number) => z.string().max(max).nullable().optional();

/**
 * Section 22: the seven criteria.
 *
 * Each is capped at its own maximum here as well as in the service. The
 * service is the authority - it clamps and recomputes the total regardless of
 * what arrives - but rejecting 25 out of 20 at the edge gives a clearer error
 * than silently storing 20.
 */
const mark = (max: number) =>
  z.number().min(0, 'Marks cannot be negative').max(max, `Maximum is ${max}`).optional();

const EvaluationFields = z.object({
  applicationId: z.string().uuid('Invalid application id'),
  /** Admins only; ignored when sent by anyone else. */
  evaluatorId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().nullable().optional(),

  needOfInnovationScore: mark(20),
  feasibilityScore: mark(20),
  potentialImpactScore: mark(20),
  noveltyScore: mark(20),
  teamScore: mark(10),
  fundUtilizationScore: mark(5),
  presentationScore: mark(5),

  /** Per-criterion remarks, keyed by criterion. */
  criteriaRemarks: z.record(z.string(), z.string().max(2000)).nullable().optional(),

  // Section 23
  recommendation: z.enum(RECOMMENDATIONS).nullable().optional(),
  strengths: optText(4000),
  weaknesses: optText(4000),
  risks: optText(4000),
  suggestions: optText(4000),
  conditions: optText(4000),
  finalNote: optText(4000),
  remarks: optText(4000),

  // Section 24 — advisory only.
  recommendedSchemeId: z.string().uuid().nullable().optional(),
  alternativeSchemeId: z.string().uuid().nullable().optional(),
  schemeRecommendationRemarks: optText(2000),

  // Section 25 — advisory only.
  grantRecommended: z.boolean().optional(),
  recommendedGrantAmount: z.number().nonnegative().nullable().optional(),
  grantPurpose: optText(4000),
  fundUtilizationRemarks: optText(4000),
  grantConditions: optText(4000),
});

export const saveEvaluationRouteSchema = z.object({ body: EvaluationFields });

export const submitEvaluationRouteSchema = z.object({
  body: EvaluationFields.extend({
    // Section 23 makes the recommendation the one thing a submission cannot
    // omit, so it is required here rather than only checked in the service.
    recommendation: z.enum(RECOMMENDATIONS, {
      message: 'A recommendation is required before submitting',
    }),
  }),
});

export const reopenEvaluationRouteSchema = z.object({
  params: z.object({ evaluationId: z.string().uuid('Invalid evaluation id') }),
  body: z.object({
    reason: z.string().trim().min(3, 'A reason for reopening is required').max(2000),
  }),
});

export const evaluationIdRouteSchema = z.object({
  params: z.object({ evaluationId: z.string().uuid('Invalid evaluation id') }),
});

export const applicationIdRouteSchema = z.object({
  params: z.object({ applicationId: z.string().uuid('Invalid application id') }),
});
