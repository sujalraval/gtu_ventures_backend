import { z } from "zod";

export const CreateUserSchema = z.object({
  // Tab 1: Personal
  personal: z.object({
    title: z.enum(["mr", "ms", "dr", "prof"]).optional(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    gender: z.enum(["male", "female", "other"]),
    dob: z.string().min(1, "Date of birth is required"), // Will be converted to Date
    pob: z.string().optional(),
    maritalStatus: z.enum(["single", "married"]).optional(),
    category: z.enum(["gen", "obc", "sc", "st"]).optional(),
    bloodGroup: z.string().optional(),
    pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$|^[A-Z]{5}\s[0-9]{4}\s[A-Z]{1}$/, "Invalid PAN format").optional(),
    aadhaar: z.string().regex(/^[0-9]{12}$|^[0-9]{4}\s[0-9]{4}\s[0-9]{4}$/, "Invalid Aadhaar format").optional(),
    fatherSpouseName: z.string().optional(),
    email: z.string().email("Invalid email format"),
    phone: z.string().min(10, "Invalid phone number"),
    staffCode: z.string().optional(),
    punchId: z.string().optional(),
    shift: z.string().optional(),
    policy: z.string().optional(),
    status: z.enum(["active", "inactive"]).default("active"),
    isPartTime: z.boolean().default(false),
    isExternalStaff: z.boolean().default(false),
  }),

  // Tab 2: Department
  department: z.object({
    institutionId: z.string().uuid("Invalid institution ID"),
    departmentId: z.string().uuid("Invalid department ID"),
    designationId: z.string().uuid("Invalid designation ID"),
    dateOfJoining: z.string().min(1, "Date of joining is required"),
    leaveDate: z.string().nullable().optional(),
    isDefault: z.boolean().default(true),
  }),

  // Tab 3: Roles & Reporting
  roles: z.object({
    roleId: z.string().min(1, "Role is required"),
    reportLevel1: z.string().min(1, "Reporting level 1 is required"),
    reportLevel2: z.string().min(1, "Reporting level 2 is required"),
    reportLevel3: z.string().min(1, "Reporting level 3 is required"),
    reportLevel4: z.string().nullable().optional(),
    reportLevel5: z.string().nullable().optional(),
    reportLevel6: z.string().nullable().optional(),
    reportLevel7: z.string().nullable().optional(),
    reportLevel8: z.string().nullable().optional(),
    isDefault: z.boolean().default(true),
  }),

  // Tab 4: Bank
  bank: z.object({
    bankName: z.string().min(1, "Bank name is required"),
    accountHolder: z.string().min(1, "Account holder name is required"),
    accountNo: z.string().min(1, "Account number is required"),
    ifsc: z.string().min(1, "IFSC code is required"),
    branchName: z.string().min(1, "Branch name is required"),
    status: z.enum(["active", "inactive"]).default("active"),
  }),

  // Tab 5: Leave
  leave: z.array(z.object({
    academicYear: z.string().min(1, "Academic year is required"),
    leaveType: z.enum(["CL", "EL", "SL", "ML"]),
    totalLeave: z.number().int().min(0),
  })).optional(),

  // Tab 6: Experience & Education
  experience: z.array(z.object({
    sector: z.string().optional(),
    subSector: z.string().optional(),
    institutionName: z.string().optional(),
    yearsOfExp: z.number().int().min(0).optional(),
  })).optional(),

  education: z.object({
    qualification: z.string().min(1, "Qualification is required"),
    passingDate: z.string().nullable().optional(),
  }),

  // Tab 7: Address
  address: z.object({
    residential: z.object({
      addressLine: z.string().min(1, "Address is required"),
      city: z.string().min(1, "City is required"),
      state: z.string().min(1, "State is required"),
      country: z.string().min(1, "Country is required"),
      pinCode: z.string().min(6, "Invalid PIN code"),
    }),
    communication: z.object({
      addressLine: z.string().min(1, "Address is required"),
      city: z.string().min(1, "City is required"),
      state: z.string().min(1, "State is required"),
      country: z.string().min(1, "Country is required"),
      pinCode: z.string().min(6, "Invalid PIN code"),
    }),
    sameAsResidential: z.boolean().default(false),
  }),

  // Tab 8: Professional Metrics (part of Uploads tab in UI)
  professionalMetrics: z.object({
    technicalSkills: z.string().optional(),
    domainExpertise: z.string().optional(),
    certifications: z.string().optional(),
  }).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const createUserRouteSchema = z.object({
  body: CreateUserSchema,
});
