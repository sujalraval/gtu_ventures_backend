// @ts-nocheck
import express from 'express';
const router = express.Router();
import mentorsController from './mentors.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';
const auditLog = (action) => (req: any, res: any, next: any) => next();

router.get('/', mentorsController.getAll);
router.get('/:id', mentorsController.getOne);

router.post('/', authenticateToken, auditLog('Mentor'), mentorsController.create);
router.put('/:id', authenticateToken, auditLog('Mentor'), mentorsController.update);
router.delete('/:id', authenticateToken, auditLog('Mentor'), mentorsController.delete);

export default router;
