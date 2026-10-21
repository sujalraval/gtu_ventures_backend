import { z } from 'zod';
import { EXPERT_CATEGORY_KEYS } from './expertCategories';

const EVALUATOR_TYPES = [
  'INTERNAL_EXPERT',
  'EXTERNAL_EXPERT',
  'JURY_MEMBER',
  'INDUSTRY_EXPERT',
  'TECHNICAL_EXPERT',
  'FINANCIAL_EXPERT',
  'MENTOR',
  'ACADEMIC_EXPERT',
  'SUBJECT_EXPERT',
  'COMMITTEE_MEMBER',
  'OTHER',
] as const;

const AFFILIATIONS = ['INTERNAL', 'EXTERNAL'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'BLACKLISTED'] as const;

const DOCUMENT_TYPES = [
  'CV',
  'PAN_CARD',
  'CANCELLED_CHEQUE',
  'BANK_PROOF',
  'GST_CERTIFICATE',
  'ID_PROOF',
  'APPOINTMENT_LETTER',
  'INVITATION_LETTER',
  'CONSENT_LETTER',
  'OTHER',
] as const;

/** Optional free text that may legitimately be cleared. */
const optText = (max: number) => z.string().max(max).nullable().optional();

const EvaluatorFields = z.object({
  code: z.string().trim().max(50).nullable().optional(),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  middleName: optText(100),
  lastName: optText(100),

  mobile: optText(20),
  // Not .email(): these are optional and an empty string arriving from a
  // cleared field would otherwise be rejected rather than treated as absent.
  personalEmail: optText(200),
  officialEmail: optText(200),

  organization: optText(200),
  designation: optText(200),
  affiliation: z.enum(AFFILIATIONS).optional(),
  type: z.enum(EVALUATOR_TYPES).optional(),

  city: optText(100),
  state: optText(100),
  country: optText(100),

  sectors: z.array(z.string().max(100)).optional(),
  /**
   * Mandate categories this expert counts towards. Rejected at the edge rather
   * than silently dropped, so a typo is visible instead of producing an expert
   * who satisfies no requirement.
   */
  expertCategories: z.array(z.enum(EXPERT_CATEGORY_KEYS as [string, ...string[]])).optional(),
  areaOfExpertise: optText(4000),
  industryExperience: optText(200),
  academicExpertise: optText(4000),
  specialization: optText(4000),
  shortProfile: optText(8000),

  status: z.enum(STATUSES).optional(),
  remarks: optText(4000),
});

export const createEvaluatorRouteSchema = z.object({ body: EvaluatorFields });

export const updateEvaluatorRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid evaluator id') }),
  body: EvaluatorFields.partial(),
});

export const evaluatorIdRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid evaluator id') }),
});

/**
 * Section 13. Account number is confirmed on the form, not here - the
 * confirmation field exists to catch a typo at entry and is not something to
 * store, so it never reaches the API.
 */
export const bankDetailRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid evaluator id') }),
  body: z.object({
    accountHolderName: optText(200),
    bankName: optText(200),
    accountNumber: optText(50),
    ifscCode: optText(20),
    branch: optText(200),
    accountType: optText(50),
    pan: optText(20),
    gstNumber: optText(30),
    upiId: optText(100),
    paymentRemarks: optText(2000),
  }),
});

export const addDocumentRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid evaluator id') }),
  body: z.object({
    type: z.enum(DOCUMENT_TYPES).optional(),
    title: optText(200),
    fileName: optText(300),
    fileUrl: z.string().trim().min(1, 'Upload a file first').max(1000),
    fileSize: z.number().int().nonnegative().nullable().optional(),
    mimeType: optText(200),
  }),
});

export const documentIdRouteSchema = z.object({
  params: z.object({ documentId: z.string().uuid('Invalid document id') }),
});
