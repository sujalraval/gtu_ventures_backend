// @ts-nocheck
import express from 'express';
const router = express.Router();
import auditController from './audit.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';

// Audit logs are read-only and restricted to SUPER_ADMIN
const checkSuperAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
};

router.get('/', authenticateToken, checkSuperAdmin, auditController.getAll);

export default router;
