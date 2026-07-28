import { Router } from 'express';
import { AgreementTemplatesController } from './agreement-templates.controller';
import { LibraryClausesController } from './library-clauses.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();

// Base CRUD - Admins and Staff can view, but only Admins can modify
router.get('/', authenticate, AgreementTemplatesController.getAll);
router.get('/:id', authenticate, AgreementTemplatesController.getById);

// Scheme-specific filtering
router.get('/scheme/:schemeId', authenticate, AgreementTemplatesController.getByScheme);

// Modification routes - Restricted to Admin/SuperAdmin
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AgreementTemplatesController.create);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AgreementTemplatesController.update);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AgreementTemplatesController.delete);

// Activation logic
router.post('/:id/activate', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), AgreementTemplatesController.activate);

// Test hydration
router.post('/:id/hydrate', authenticate, AgreementTemplatesController.hydrate);

// ---- Library Clauses Routes ----
router.get('/library/all', LibraryClausesController.getAll);
router.get('/library/default/:category', LibraryClausesController.getDefaultByCategory);
router.get('/library/:id', authenticate, LibraryClausesController.getById);
router.post('/library', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), LibraryClausesController.create);
router.put('/library/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), LibraryClausesController.update);
router.delete('/library/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), LibraryClausesController.delete);

export default router;
