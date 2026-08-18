import { Router } from 'express';
import { EventsController } from './events.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import registrationRoutes from './registrations.routes';
import pitchDeckRoutes from './pitchdeck.routes';
import scheduleRoutes from './schedule.routes';
import scorecardRoutes from './scorecard.routes';
import collateralRoutes from './collateral.routes';
import { PitchDeckController } from './pitchdeck.controller';

const router = Router();

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

router.get('/', authenticate, EventsController.getAll);
router.get('/trash', authenticate, authorize(ADMIN_ROLES), EventsController.getDeleted);
router.get('/:id/public', EventsController.getPublicDetails);
router.get('/:id', authenticate, EventsController.getById);

router.post('/', authenticate, authorize(ADMIN_ROLES), EventsController.create);
router.put('/:id', authenticate, authorize(ADMIN_ROLES), EventsController.update);
router.patch('/:id/status', authenticate, authorize(ADMIN_ROLES), EventsController.updateStatus);
router.delete('/:id', authenticate, authorize(ADMIN_ROLES), EventsController.delete);
router.post('/:id/restore', authenticate, authorize(ADMIN_ROLES), EventsController.restore);

// Sub-router: /api/events/:eventId/registrations
router.use('/:eventId/registrations', registrationRoutes);

// Sub-router: /api/events/:eventId/pitch-decks
router.use('/:eventId/pitch-decks', pitchDeckRoutes);

// Sub-router: /api/events/:eventId/schedule
router.use('/:eventId/schedule', scheduleRoutes);

// Sub-router: /api/events/:eventId/scorecard
router.use('/:eventId/scorecard', scorecardRoutes);

// Sub-router: /api/events/:eventId/collateral
router.use('/:eventId/collateral', collateralRoutes);

// Startup: my pitch deck submissions across all events
router.get('/my-pitchdecks', authenticate, authorize(['STARTUP']), PitchDeckController.getMySubmissions);

export default router;
