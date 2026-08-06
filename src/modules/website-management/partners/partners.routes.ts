// @ts-nocheck
import express from 'express';
const router = express.Router();
import partnersController from './partners.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';
const auditLog = (action) => (req: any, res: any, next: any) => next();

router.get('/', partnersController.getAll);
router.get('/:id', partnersController.getOne);

router.post('/', authenticateToken, auditLog('Partner'), partnersController.create);
router.put('/:id', authenticateToken, auditLog('Partner'), partnersController.update);
router.delete('/:id', authenticateToken, auditLog('Partner'), partnersController.delete);

export default router;
