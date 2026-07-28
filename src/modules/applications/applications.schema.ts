import { z } from 'zod';

export const ApplicationFounderSchema = z.object({
  name: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  mobile: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  aadhaar: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  // Education Details
  lastEducation: z.string().optional().nullable(),
  degreeName: z.string().optional().nullable(),
  universityName: z.string().optional().nullable(),
  passingYear: z.string().optional().nullable(),
  marksheet: z.string().optional().nullable(),
  degreeCertificate: z.string().optional().nullable(),
  // Documents
  photo: z.string().optional().nullable(),
  addressProof: z.string().optional().nullable(),
  govtId: z.string().optional().nullable(),
  panCard: z.string().optional().nullable(),
  linkedIn: z.string().optional().nullable(),
  priorVentures: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  differentlyAbled: z.boolean().optional().nullable(),
  firstGenEntrepreneur: z.boolean().optional().nullable(),
});

export const ApplicationFundingSchema = z.object({
  roundType: z.enum(['bootstrapped', 'f_f', 'angel', 'seed', 'pre_series_a']).or(z.literal('')).optional().nullable(),
  amountInr: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional().nullable(),
  fundingDate: z.string().optional().nullable().transform(val => (val && val.trim() !== '') ? new Date(val) : null),
  investors: z.string().optional().nullable(),
});

export const ApplicationIPSchema = z.object({
  type: z.enum(['patent', 'trademark', 'copyright', 'design']).or(z.literal('')).optional().nullable(),
  title: z.string().optional().nullable(),
  registrationNo: z.string().optional().nullable(),
  status: z.enum(['filed', 'published', 'granted']).or(z.literal('')).optional().nullable(),
  filingDate: z.string().optional().nullable().transform(val => (val && val.trim() !== '') ? new Date(val) : null),
});

export const ApplicationAwardSchema = z.object({
  name: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  year: z.string().optional().nullable(),
  prize: z.string().optional().nullable(),
});

export const ApplicationShareholderSchema = z.object({
  name: z.string().optional().nullable(),
  type: z.enum(['founder', 'co-founder', 'investor', 'esop', 'other']).or(z.literal('')).optional().nullable(),
  shares: z.string().optional().nullable(),
  percentage: z.preprocess((val) => (val === '' || val === null || val === undefined) ? 0 : parseFloat(val as string), z.number().min(0).max(100).optional().nullable()),
  certificate: z.string().optional().nullable(),
});

export const SubmitFormBSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  
  // Core Startup Info (for syncing)
  startupName: z.string().optional().nullable(),
  cin: z.string().optional().nullable(),
  incorporationDate: z.string().optional().nullable(),
  registeredAddress: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  sector: z.string().optional().nullable(),
  stage: z.string().optional().nullable(),

  // Basic Info
  operationalAddress: z.string().optional().nullable(),
  
  // Signing Authority
  authorityName: z.string().optional().nullable(),
  authorityDesignation: z.string().optional().nullable(),
  authorityEmail: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  authorityMobile: z.string().optional().nullable(),
  authorityPan: z.string().optional().nullable(),
  
  // Bank Details
  bankName: z.string().optional().nullable(),
  branchName: z.string().optional().nullable(),
  accountNo: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
  accountType: z.string().optional().nullable(),
  accountHolderName: z.string().optional().nullable(),
  
  // Documents
  coi: z.string().optional().nullable(),
  moa: z.string().optional().nullable(),
  aoa: z.string().optional().nullable(),
  gstCert: z.string().optional().nullable(),
  panCard: z.string().optional().nullable(),
  cancelledCheque: z.string().optional().nullable(),

  // Previous History
  previousIncubation: z.string().optional().default('no'),
  previousIncubatorName: z.string().optional().nullable(),
  previousIncubationPeriod: z.string().optional().nullable(),
  govtSchemes: z.string().optional().default('no'),
  govtSchemeDetails: z.string().optional().nullable(),
  
  // Declarations
  declaration1: z.boolean().optional().default(false),
  declaration2: z.boolean().optional().default(false),
  declaration3: z.boolean().optional().default(false),
  
  // Relations
  founders: z.array(ApplicationFounderSchema),
  ipRecords: z.array(ApplicationIPSchema).optional().default([]),
  fundingRecords: z.array(ApplicationFundingSchema).optional().default([]),
  awards: z.array(ApplicationAwardSchema).optional().default([]),
  shareholders: z.array(ApplicationShareholderSchema).optional().default([]),
  isDraft: z.boolean().optional().default(false),
});


export const SubmitFormCSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  
  // Agreement Metadata
  agreementDate: z.string().optional().nullable(),
  agreementDuration: z.number().optional().nullable(),
  agreementType: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  
  // Incubation Support
  incubationType: z.string().optional().nullable(),
  incubationStartDate: z.string().optional().nullable(),
  incubationLocation: z.string().optional().nullable(),
  incubationFacilities: z.array(z.string()).optional().default([]),
  
  // Grant Overview
  grantType: z.string().optional().nullable(),
  sanctionedAmount: z.number().optional().nullable(),
  disbursementMode: z.string().optional().nullable(),
  ucRequired: z.boolean().optional().default(true),
  
  // Reporting & Compliance
  reportFrequency: z.string().optional().nullable(),
  reviewCommittee: z.string().optional().nullable(),
  auditRequired: z.boolean().optional().default(true),
  kpiParameters: z.array(z.string()).optional().default([]),
  
  // IP & Legal
  ipOwnership: z.string().optional().nullable(),
  ndaObligations: z.string().optional().nullable(),
  publicationPolicy: z.string().optional().nullable(),
  governingLaw: z.string().optional().default('Laws of India'),
  jurisdiction: z.string().optional().default('Courts of Ahmedabad, Gujarat'),
  
  // Signatures & Undertaking
  isUndertakingSigned: z.boolean().optional().default(false),
});
