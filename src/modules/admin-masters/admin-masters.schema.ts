import { z } from 'zod';

export const UpdateCenterProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Center name is required'),
    universityName: z.string().min(1, 'University name is required'),
    address: z.string().min(1, 'Address is required'),
    authorizedSignatory: z.string().min(1, 'Signatory name is required'),
    designation: z.string().min(1, 'Designation is required'),
    email: z.string().email('Invalid official email address'),
    mobile: z.string().min(10, 'Invalid contact number'),
    officialSealUrl: z.string().optional().nullable().or(z.literal('')),
    logoUrl: z.string().optional().nullable().or(z.literal('')),
    parentLogoUrl: z.string().optional().nullable().or(z.literal('')),
    parentName: z.string().optional().nullable().or(z.literal('')),
    website: z.string().optional().nullable().or(z.literal('')),
    gstin: z.string().optional().nullable().or(z.literal('')),
    pan: z.string().optional().nullable().or(z.literal('')),
  })
});
