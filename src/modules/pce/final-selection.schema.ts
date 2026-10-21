import { z } from 'zod';

const DECISIONS = [
  'APPROVED_FOR_INCUBATION',
  'APPROVED_WITH_GRANT',
  'APPROVED_WITHOUT_GRANT',
  'APPROVED_WITH_CONDITIONS',
  'RE_PRESENTATION_REQUIRED',
  'WAITLISTED',
  'REJECTED',
] as const;

const ONBOARDING_STATUSES = [
  'NOT_STARTED',
  'SELECTED',
  'SCHEME_CONFIRMED',
  'DOCUMENTS_PENDING',
  'VERIFICATION_PENDING',
  'AGREEMENT_PENDING',
  'FINAL_APPROVAL_PENDING',
  'COMPLETED',
] as const;

const optText = (max: number) => z.string().max(max).nullable().optional();

// ── Section 29 ──────────────────────────────────────────────────────────────

export const confirmSchemeRouteSchema = z.object({
  params: z.object({ applicationId: z.string().uuid('Invalid application id') }),
  body: z.object({
    schemeId: z.string().uuid('Select a scheme'),
    /**
     * Required by the service only when the committee is approving a scheme
     * different from the one already assigned - that is a reassignment, and
     * section 29 requires a reason for it.
     */
    reason: optText(2000),
    remarks: optText(2000),
  }),
});

// ── Section 30 ──────────────────────────────────────────────────────────────

export const recordDecisionRouteSchema = z.object({
  params: z.object({ applicationId: z.string().uuid('Invalid application id') }),
  body: z.object({
    decision: z.enum(DECISIONS),
    committeeRemarks: optText(4000),
    finalScore: z.number().min(0).max(100).nullable().optional(),
    grantApproved: z.boolean().optional(),
    sanctionedGrantAmount: z.number().nonnegative().nullable().optional(),
    grantConditions: optText(4000),
    rePresentationRequired: z.boolean().optional(),
  }),
});

// ── Section 31 ──────────────────────────────────────────────────────────────

export const applicationScopedRouteSchema = z.object({
  params: z.object({ applicationId: z.string().uuid('Invalid application id') }),
});

export const updateOnboardingRouteSchema = z.object({
  params: z.object({ applicationId: z.string().uuid('Invalid application id') }),
  body: z.object({
    // COMPLETED is rejected by the service: completion runs its own checks.
    status: z.enum(ONBOARDING_STATUSES).optional(),
    incubationStartDate: z.string().nullable().optional(),
    mentorId: z.string().uuid().nullable().optional(),
    agreementStatus: optText(100),
    kycVerified: z.boolean().optional(),
    bankDetailsVerified: z.boolean().optional(),
    registrationVerified: z.boolean().optional(),
    remarks: optText(4000),
  }),
});

export const addOnboardingDocumentRouteSchema = z.object({
  params: z.object({ applicationId: z.string().uuid('Invalid application id') }),
  body: z.object({
    name: z.string().trim().min(1, 'A document name is required').max(200),
    fileUrl: optText(1000),
    fileName: optText(300),
    isRequired: z.boolean().optional(),
  }),
});

export const updateOnboardingDocumentRouteSchema = z.object({
  params: z.object({ documentId: z.string().uuid('Invalid document id') }),
  body: z.object({
    fileUrl: optText(1000),
    fileName: optText(300),
    isVerified: z.boolean().optional(),
    remarks: optText(2000),
  }),
});

export const onboardingDocumentIdRouteSchema = z.object({
  params: z.object({ documentId: z.string().uuid('Invalid document id') }),
});
