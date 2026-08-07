import express from 'express';
const router = express.Router();
import statsController from './stats.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';

router.get('/dashboard', authenticateToken, statsController.getDashboardStats);

export default router;
