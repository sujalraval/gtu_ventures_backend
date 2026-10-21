import { z } from 'zod';
import { EXPERT_CATEGORY_KEYS } from './expertCategories';

const COMMITTEE_TYPES = [
  'PRELIMINARY_SCREENING',
  'TECHNICAL_EVALUATION',
  'PITCH_EVALUATION',
  'JURY',
  'FINANCE',
  'FINAL_SELECTION',
  'INCUBATION_APPROVAL',
] as const;

/**
 * One category rule.
 *
 * The category is checked against the shared vocabulary here as well as in the
 * service, so a typo is a clear validation error rather than a requirement no
 * evaluator can ever satisfy.
 */
const RequirementSchema = z.object({
  category: z.enum(EXPERT_CATEGORY_KEYS as [string, ...string[]]),
  minCount: z.number().int().min(0).max(50).optional(),
  isMandatory: z.boolean().optional(),
  remarks: z.string().max(500).nullable().optional(),
});

const MandateFields = z.object({
  name: z.string().trim().min(2, 'A mandate name is required').max(200),
  type: z.enum(COMMITTEE_TYPES).optional(),
  minMembers: z.number().int().min(1).max(100).optional(),
  maxMembers: z.number().int().min(1).max(100).nullable().optional(),
  purpose: z.string().max(4000).nullable().optional(),
  remarks: z.string().max(4000).nullable().optional(),
  sequence: z.number().int().min(1).max(100).optional(),
  requirements: z.array(RequirementSchema).optional(),
});

export const createMandateRouteSchema = z.object({
  body: MandateFields.extend({ schemeId: z.string().uuid('Select a scheme') }),
});

export const updateMandateRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid mandate id') }),
  body: MandateFields.partial().extend({ isActive: z.boolean().optional() }),
});

export const mandateIdRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid mandate id') }),
});

export const copyMandatesRouteSchema = z.object({
  body: z.object({
    fromSchemeId: z.string().uuid('Select the scheme to copy from'),
    toSchemeId: z.string().uuid('Select the scheme to copy into'),
  }),
});
