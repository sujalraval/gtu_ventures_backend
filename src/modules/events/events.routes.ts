import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { EventsController } from './events.controller';
import { CertificatesController } from './certificates.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import registrationRoutes from './registrations.routes';
import pitchDeckRoutes from './pitchdeck.routes';
import scheduleRoutes from './schedule.routes';
import scorecardRoutes from './scorecard.routes';
import collateralRoutes from './collateral.routes';
import certificateRoutes from './certificates.routes';
import { PitchDeckController } from './pitchdeck.controller';

const router = Router();

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// Public lookup that returns a participant's name. The random check block in a
// certificate number already makes guessing impractical; this caps the damage
// if someone tries anyway.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many verification attempts. Please try again shortly.' },
});

router.get('/', authenticate, EventsController.getAll);
// Must stay above '/:id' — Express would otherwise match "public" as an id and
// bounce the public website off the authenticate middleware.
router.get('/public', EventsController.getPublicList);
// Public certificate verification — lets anyone confirm a certificate number.
router.get('/certificates/verify/:certificateNo', verifyLimiter, CertificatesController.verify);
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

router.use('/:eventId/certificates', certificateRoutes);

// Startup: my pitch deck submissions across all events
router.get('/my-pitchdecks', authenticate, authorize(['STARTUP']), PitchDeckController.getMySubmissions);

export default router;
