import { Router } from 'express';
import { SchemesController } from './schemes.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, SchemesController.getAll);
router.get('/trash', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), SchemesController.getDeleted);
router.get('/:id', authenticate, SchemesController.getById);

router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), SchemesController.create);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), SchemesController.update);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), SchemesController.delete);
router.post('/:id/restore', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), SchemesController.restore);

export default router;
