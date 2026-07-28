import { z } from 'zod';

export const createCohortSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    startDate: z.string().min(1, 'Start date is required').refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
    domain: z.string().optional(),
    budget: z.union([z.number(), z.string()]).optional().transform((val) => 
      val === undefined || val === null ? null : (typeof val === 'string' ? parseFloat(val) : val)
    ),
    schemeId: z.string().min(1, 'Scheme ID is required'),
    managerId: z.string().min(1, 'Manager ID is required'),
    status: z.enum(['Active', 'Completed', 'Upcoming', 'Draft']).optional().default('Active'),
  }),
});

export const updateCohortSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    startDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
    domain: z.string().optional(),
    budget: z.union([z.number(), z.string()]).optional().transform((val) => 
      val === undefined || val === null ? undefined : (typeof val === 'string' ? parseFloat(val) : val)
    ),
    schemeId: z.string().optional(),
    managerId: z.string().optional(),
    status: z.enum(['Active', 'Completed', 'Upcoming', 'Draft']).optional(),
  }),
});

export const assignStartupsSchema = z.object({
  body: z.object({
    applicationIds: z.array(z.string()).nonempty('At least one application ID is required'),
  }),
});

export const assignMentorsSchema = z.object({
  body: z.object({
    userIds: z.array(z.string()).nonempty('At least one user ID is required'),
    role: z.string().optional().default('Advisor'),
  }),
});

export const createModuleSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    sequenceOrder: z.number().optional().default(0),
    totalSessions: z.number().optional().default(0),
  }),
});

export const scheduleMeetingSchema = z.object({
  body: z.object({
    moduleId: z.string().optional(),
    title: z.string().min(1, 'Title is required'),
    type: z.enum(['Online', 'Offline', 'Hybrid']).default('Online'),
    startTime: z.string().min(1, 'Start time is required').refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
    endTime: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
    instructorId: z.string().min(1, 'Instructor ID is required'),
    meetingLink: z.string().url().optional().or(z.literal('')),
  }),
});

export const markAttendanceSchema = z.object({
  body: z.object({
    records: z.array(z.object({
      startupId: z.string(),
      isPresent: z.boolean(),
      remarks: z.string().optional(),
    })).nonempty('Attendance records cannot be empty'),
  }),
});
export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    dueDate: z.string().min(1, 'Due date is required').refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
    priority: z.enum(['Low', 'Medium', 'High']).optional().default('Medium'),
    submissionType: z.enum(['File', 'Link']).optional().default('File'),
    status: z.enum(['Active', 'Draft']).optional().default('Active'),
  }),
});
