// @ts-nocheck
import express from 'express';
const router = express.Router();
import authController from './auth.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);

export default router;
