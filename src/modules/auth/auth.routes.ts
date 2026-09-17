import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import * as authSchema from './auth.schema';

const router = Router();

// The events module already rate-limits its public OTP flow; this one guards
// the ADMIN, STAFF and STARTUP portals and had nothing at all. A six-digit code
// with unlimited attempts is brute-forceable in minutes.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification codes requested. Please try again in 15 minutes.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many verification attempts. Please try again in 15 minutes.' },
});

// Password login deserves the same treatment for the same reason.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

router.post('/login',           loginLimiter,      validate(authSchema.loginSchema),      AuthController.login);
router.post('/request-otp',     otpRequestLimiter, validate(authSchema.requestOTPSchema), AuthController.requestOTP);
router.post('/verify-otp',      otpVerifyLimiter,  validate(authSchema.verifyOTPSchema),  AuthController.verifyOTP);
router.post('/set-password',    validate(authSchema.setPasswordSchema),    AuthController.setPassword);
router.post('/forgot-password',                                             AuthController.forgotPassword);
router.post('/reset-password',                                              AuthController.resetPassword);
router.post('/refresh',                                                     AuthController.refresh);
router.post('/logout',                                                      AuthController.logout);
router.post('/logout-all',      authenticate,                              AuthController.logoutAll);
router.post('/request-app-email-otp', authenticate, validate(authSchema.requestAppEmailOTPSchema), AuthController.requestApplicationEmailOTP);
router.post('/verify-app-email-otp',  authenticate, validate(authSchema.verifyAppEmailOTPSchema),  AuthController.verifyApplicationEmailOTP);

export default router;
