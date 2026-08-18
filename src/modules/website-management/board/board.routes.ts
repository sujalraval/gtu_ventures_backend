// @ts-nocheck
import express from 'express';
const router = express.Router();
import controller from './board.controller';
import { authenticate as protect } from '../../../common/middleware/auth.middleware';

// ── Public read — what the About page's governing-body section uses ──────────
router.get('/', controller.getAll);

// ── Protected writes ────────────────────────────────────────────────────────
router.post('/reorder', protect, controller.reorder);
router.post('/', protect, controller.create);
router.put('/:id', protect, controller.update);
router.delete('/:id', protect, controller.remove);
router.get('/:id', controller.getById);

export default router;
