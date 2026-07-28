import { Router } from 'express';
import { RegistrationsController } from './registrations.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router({ mergeParams: true }); // mergeParams to access :eventId

const ADMIN = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];

// Registration routes (public register — no auth required for public events)
router.get('/', authenticate, authorize(ADMIN), RegistrationsController.getAll);
router.post('/', RegistrationsController.register);                           // public
router.patch('/:regId/cancel', authenticate, authorize(ADMIN), RegistrationsController.cancel);
router.patch('/:regId/checkin', authenticate, authorize(ADMIN), RegistrationsController.checkInManual);
router.get('/stats', authenticate, authorize(ADMIN), RegistrationsController.getStats);

// QR check-in (token in body, no :regId needed)
router.post('/checkin-qr', authenticate, authorize(ADMIN), RegistrationsController.checkInQr);

// Invite routes
router.get('/invites', authenticate, authorize(ADMIN), RegistrationsController.getInvites);
router.post('/invites', authenticate, authorize(ADMIN), RegistrationsController.addInvites);
router.delete('/invites/:inviteId', authenticate, authorize(ADMIN), RegistrationsController.removeInvite);

export default router;
