import { Router } from 'express';
import { StartupAllocationsController } from './startup-allocations.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();

// Admin routes
router.post('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), StartupAllocationsController.createAllocation);
router.get('/', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), StartupAllocationsController.getAllAllocations);
router.get('/startup/:startupId', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), StartupAllocationsController.getStartupAllocation);
router.patch('/tranches/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), StartupAllocationsController.updateTranche);
router.patch('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), StartupAllocationsController.updateAllocation);
router.post('/:id/retrigger-milestones', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), StartupAllocationsController.retriggerMilestones);

// Startup portal routes
router.get('/my', authenticate, StartupAllocationsController.getMyAllocation);

// Public or ID based (with auth)
router.get('/:id', authenticate, StartupAllocationsController.getAllocationById);

export default router;
