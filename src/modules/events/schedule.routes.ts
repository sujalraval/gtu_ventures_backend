import { Router } from 'express';
import { ScheduleController } from './schedule.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router({ mergeParams: true });
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

router.get('/', authenticate, ScheduleController.getSchedule);
router.get('/eligible-startups', authenticate, authorize(ADMIN_ROLES), ScheduleController.getEligibleStartups);
router.post('/', authenticate, authorize(ADMIN_ROLES), ScheduleController.addSlot);
router.post('/reorder', authenticate, authorize(ADMIN_ROLES), ScheduleController.reorder);
router.post('/auto-schedule', authenticate, authorize(ADMIN_ROLES), ScheduleController.autoSchedule);
router.post('/send-emails', authenticate, authorize(ADMIN_ROLES), ScheduleController.sendEmails);
router.put('/:slotId', authenticate, authorize(ADMIN_ROLES), ScheduleController.updateSlot);
router.delete('/:slotId', authenticate, authorize(ADMIN_ROLES), ScheduleController.removeSlot);

export default router;
