// @ts-nocheck
import express from 'express';
const router = express.Router();
import * as ctrl from './users.controller';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';

router.get('/', authenticateToken, ctrl.getAll);
router.post('/', authenticateToken, ctrl.create);
router.delete('/:id', authenticateToken, ctrl.delete);

export default router;