import { Router } from 'express';
import { CohortsController } from './cohorts.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { 
  createCohortSchema, 
  updateCohortSchema, 
  assignStartupsSchema, 
  assignMentorsSchema, 
  createModuleSchema, 
  scheduleMeetingSchema, 
  markAttendanceSchema,
  createTaskSchema 
} from './cohorts.schema';

const router = Router();

// --- Cohort Program & Mentor Routes (Static first) ---
router.get('/mentors/eligible', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), CohortsController.getEligibleMentors);

// Primary Management Routes
router.get('/', authenticate, CohortsController.getAll);
router.get('/:id', authenticate, CohortsController.getById);

// Special Pipeline Analytic Route for compliance dashboard
router.get('/:id/monitoring', authenticate, CohortsController.getDetailedMonitoring);
router.get('/:id/eligible-startups', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), CohortsController.getEligibleStartups);
router.get('/:id/program', authenticate, CohortsController.getProgramDetails);

// Mutation Routes (Admin Only)
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(createCohortSchema), CohortsController.create);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(updateCohortSchema), CohortsController.update);
router.post('/:id/assign-startups', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(assignStartupsSchema), CohortsController.assignStartups);
router.post('/:id/import-members', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), CohortsController.importMembers);
router.post('/:id/members/bulk-actions', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), CohortsController.bulkActionMembers);
router.post('/:id/assign-mentors', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(assignMentorsSchema), CohortsController.assignMentors);
router.post('/:id/modules', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(createModuleSchema), CohortsController.createModule);
router.post('/:id/meetings', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(scheduleMeetingSchema), CohortsController.scheduleMeeting);
router.post('/:id/tasks', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(createTaskSchema), CohortsController.createTask);

// Attendance Routes
router.get('/:id/meetings/:meetingId/attendance', authenticate, CohortsController.getMeetingAttendance);
router.post('/:id/meetings/:meetingId/attendance', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), validate(markAttendanceSchema), CohortsController.markAttendance);

export default router;
