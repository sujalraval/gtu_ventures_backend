import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
});

export const requestOTPSchema = z.object({
  body: z.object({
    email: z.string().email(),
    portal: z.enum(['ADMIN', 'STAFF', 'STARTUP']).optional(),
  }),
});

export const verifyOTPSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6),
  }),
});

export const setPasswordSchema = z.object({
  body: z.object({
    userId: z.string(),
    password: z.string().min(6),
  }),
});

export const requestAppEmailOTPSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const verifyAppEmailOTPSchema = z.object({
  body: z.object({
    otp: z.string().length(6),
  }),
});
