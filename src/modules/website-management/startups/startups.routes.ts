// @ts-nocheck
import express from 'express';
const router = express.Router();
import startupsController from './startups.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';
const auditLog = (action) => (req: any, res: any, next: any) => next();

router.get('/', startupsController.getAll);
router.get('/approved-applications', authenticateToken, startupsController.getApprovedApplications);
router.get('/:id', startupsController.getOne);

router.post('/', authenticateToken, auditLog('Startup'), startupsController.create);
router.put('/:id', authenticateToken, auditLog('Startup'), startupsController.update);
router.delete('/:id', authenticateToken, auditLog('Startup'), startupsController.delete);

export default router;
