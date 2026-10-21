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

const COMMITTEE_STATUSES = ['ACTIVE', 'INACTIVE', 'EXPIRED'] as const;
const PANEL_ROLES = ['CHAIRPERSON', 'MEMBER', 'OBSERVER'] as const;

const MemberSchema = z.object({
  evaluatorId: z.string().uuid('Invalid evaluator id'),
  role: z.enum(PANEL_ROLES).optional(),
  remarks: z.string().max(1000).nullable().optional(),
  /**
   * The one or two categories this person serves as on this committee.
   * Optional here so an existing member can be edited without resending it;
   * the service requires it when a membership is created.
   */
  expertCategories: z
    .array(z.enum(EXPERT_CATEGORY_KEYS as [string, ...string[]]))
    .min(1, 'Select at least one expert category')
    .max(2, 'Select at most two expert categories')
    .optional(),
});

export const CreateCommitteeSchema = z.object({
  name: z.string().trim().min(2, 'Committee name is required').max(200),
  type: z.enum(COMMITTEE_TYPES),
  // Optional: the spec says a committee is "preferably" scheme-linked, and a
  // Final Selection committee can legitimately span schemes.
  schemeId: z.string().uuid().nullable().optional(),
  /// The scheme mandate this committee must satisfy, when formed against one.
  mandateId: z.string().uuid().nullable().optional(),
  purpose: z.string().max(4000).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  remarks: z.string().max(4000).nullable().optional(),
  status: z.enum(COMMITTEE_STATUSES).optional(),
  members: z.array(MemberSchema).optional(),
});

export const createCommitteeRouteSchema = z.object({ body: CreateCommitteeSchema });

export const updateCommitteeRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid committee id') }),
  body: CreateCommitteeSchema.partial().omit({ members: true }),
});

export const addMembersRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid committee id') }),
  body: z.object({ members: z.array(MemberSchema).min(1, 'Select at least one member') }),
});

export const updateMemberRouteSchema = z.object({
  params: z.object({ memberId: z.string().uuid('Invalid member id') }),
  body: z.object({
    role: z.enum(PANEL_ROLES).optional(),
    remarks: z.string().max(1000).nullable().optional(),
  }),
});

export const committeeIdRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid committee id') }),
});

export const memberIdRouteSchema = z.object({
  params: z.object({ memberId: z.string().uuid('Invalid member id') }),
});
