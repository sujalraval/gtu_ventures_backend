// @ts-nocheck
import express from 'express';
const router = express.Router();
import * as ctrl from './leads.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authenticateToken, ctrl.create);
router.put('/:id', authenticateToken, ctrl.update);
router.delete('/:id', authenticateToken, ctrl.delete);

export default router;