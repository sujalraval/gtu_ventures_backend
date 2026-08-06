// @ts-nocheck
import express from 'express';
const router = express.Router();
import settingsController from './settings.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';
const auditLog = (action) => (req: any, res: any, next: any) => next();

// We restrict Settings to Super Admin only, we can do a simple check inline for now
const checkSuperAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
};

router.get('/', authenticateToken, checkSuperAdmin, settingsController.getAll);
router.put('/:key', authenticateToken, checkSuperAdmin, auditLog('Setting'), settingsController.update);

export default router;
