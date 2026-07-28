import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import * as authSchema from './auth.schema';

const router = Router();

router.post('/login',           validate(authSchema.loginSchema),          AuthController.login);
router.post('/request-otp',     validate(authSchema.requestOTPSchema),     AuthController.requestOTP);
router.post('/verify-otp',      validate(authSchema.verifyOTPSchema),      AuthController.verifyOTP);
router.post('/set-password',    validate(authSchema.setPasswordSchema),    AuthController.setPassword);
router.post('/forgot-password',                                             AuthController.forgotPassword);
router.post('/reset-password',                                              AuthController.resetPassword);
router.post('/refresh',                                                     AuthController.refresh);
router.post('/logout',                                                      AuthController.logout);
router.post('/logout-all',      authenticate,                              AuthController.logoutAll);
router.post('/request-app-email-otp', authenticate, validate(authSchema.requestAppEmailOTPSchema), AuthController.requestApplicationEmailOTP);
router.post('/verify-app-email-otp',  authenticate, validate(authSchema.verifyAppEmailOTPSchema),  AuthController.verifyApplicationEmailOTP);

export default router;
