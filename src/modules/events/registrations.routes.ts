import { Router } from 'express';
import { RegistrationsController } from './registrations.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router({ mergeParams: true }); // mergeParams to access :eventId

const ADMIN = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];

// The register route is deliberately unauthenticated, so it needs its own
// throttle. Sized for a shared campus/college NAT, where many genuine students
// register from one IP — generous enough not to block a lab, tight enough to
// stop a script.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: 'Too many registration attempts from this network. Please try again in 15 minutes.' },
});

// Every request here sends a real email, so this is the endpoint someone would
// abuse to mail-bomb a third party. Tighter than registration, and paired with
// a per-address cooldown in the service.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification codes requested. Please try again in 15 minutes.' },
});

// Brute-forcing a 6-digit code is the other risk. The service burns a code
// after 5 wrong guesses; this stops someone cycling through fresh codes.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many verification attempts. Please try again in 15 minutes.' },
});

// Registration routes (public register — no auth required for public events)
router.get('/', authenticate, authorize(ADMIN), RegistrationsController.getAll);

// Public email verification, then registration
router.post('/request-otp', otpRequestLimiter, RegistrationsController.requestOtp);
router.post('/verify-otp', otpVerifyLimiter, RegistrationsController.verifyOtp);
router.post('/', registerLimiter, RegistrationsController.register);          // public, needs verificationToken

// Staff-entered registration, bypasses OTP
router.post('/manual', authenticate, authorize(ADMIN), RegistrationsController.registerManual);
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
