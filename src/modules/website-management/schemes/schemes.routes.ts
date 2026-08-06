// @ts-nocheck
import express from 'express';
const router = express.Router();
import controller from './schemes.controller';
import { authenticate as protect } from '../../../common/middleware/auth.middleware';

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

// Protected routes
router.post('/', protect, controller.create);
router.put('/:id', protect, controller.update);
router.delete('/:id', protect, controller.delete);

export default router;
