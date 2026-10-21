import { z } from 'zod';

const STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'CANCELLED'] as const;

const optText = (max: number) => z.string().max(max).nullable().optional();
const amount = z.number().nonnegative('Amounts cannot be negative').nullable().optional();

export const createHonorariumRouteSchema = z.object({
  body: z.object({
    evaluatorId: z.string().uuid('Select an evaluator'),
    schemeId: z.string().uuid().nullable().optional(),
    panelId: z.string().uuid().nullable().optional(),
    pitchDate: z.string().nullable().optional(),
    applicationsEvaluated: z.number().int().min(0).nullable().optional(),
    honorariumAmount: amount,
    travelAllowance: amount,
    otherAllowance: amount,
    remarks: optText(2000),
  }),
});

export const updateHonorariumRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid payment id') }),
  body: z.object({
    schemeId: z.string().uuid().nullable().optional(),
    panelId: z.string().uuid().nullable().optional(),
    pitchDate: z.string().nullable().optional(),
    applicationsEvaluated: z.number().int().min(0).nullable().optional(),
    honorariumAmount: amount,
    travelAllowance: amount,
    otherAllowance: amount,
    remarks: optText(2000),
  }),
});

/** A transaction reference is additionally required for PAID, in the service. */
export const honorariumStatusRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid payment id') }),
  body: z.object({
    status: z.enum(STATUSES),
    paymentDate: z.string().nullable().optional(),
    transactionRef: optText(100),
  }),
});

export const honorariumIdRouteSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid payment id') }),
});

export const evaluatorActivityRouteSchema = z.object({
  params: z.object({ evaluatorId: z.string().uuid('Invalid evaluator id') }),
});
