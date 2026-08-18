// @ts-nocheck
import express from 'express';
const router = express.Router();
import * as ctrl from './leads.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

const leadsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // Limit each IP to 5 requests per windowMs
  message: { error: 'Too many enquiries sent from this IP. Please try again after 15 minutes.' }
});

router.get('/', authenticateToken, ctrl.getAll);
router.get('/:id', authenticateToken, ctrl.getById);
router.post('/', leadsLimiter, ctrl.create);
router.put('/:id', authenticateToken, ctrl.update);
router.delete('/:id', authenticateToken, ctrl.delete);

export default router;