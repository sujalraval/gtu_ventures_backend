// @ts-nocheck
import express from 'express';
const router = express.Router();
import controller from './inventory.controller';
import { authenticate as protect } from '../../../common/middleware/auth.middleware';

// ── Public reads ─────────────────────────────────────────────────────────────
// The whole tree in one call — what the public Inventory page uses.
router.get('/', controller.getTree);

router.get('/categories', controller.getCategories);
router.get('/items', controller.getItems);

// ── Protected writes — categories ────────────────────────────────────────────
router.post('/categories/reorder', protect, controller.reorderCategories);
router.post('/categories', protect, controller.createCategory);
router.put('/categories/:id', protect, controller.updateCategory);
router.delete('/categories/:id', protect, controller.deleteCategory);
router.get('/categories/:id', controller.getCategoryById);

// ── Protected writes — items ─────────────────────────────────────────────────
router.post('/items/reorder', protect, controller.reorderItems);
router.post('/items', protect, controller.createItem);
router.put('/items/:id', protect, controller.updateItem);
router.delete('/items/:id', protect, controller.deleteItem);
router.get('/items/:id', controller.getItemById);

export default router;
