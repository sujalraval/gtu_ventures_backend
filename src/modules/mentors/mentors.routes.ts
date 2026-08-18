import { Router } from 'express';
import { MentorsController } from './mentors.controller';
import { authenticate } from '../../common/middleware/auth.middleware';

const router = Router();
const controller = new MentorsController();

// Secure all routes
router.use(authenticate);

// Directory
router.get('/directory', controller.getDirectory);

// Profile
router.post('/profile', controller.updateProfile);

// Availability
router.post('/availability', controller.setAvailability);
router.get('/availability/:mentorId', controller.getAvailability);

// Sessions
router.post('/sessions/book', controller.bookSession);
router.get('/sessions', controller.getSessions);
router.post('/sessions/:id/feedback', controller.submitFeedback);

export default router;
