import { Router } from 'express';
import { AgreementsController } from './agreements.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();

// All agreement routes require authentication
router.use(authenticate);

// POST /api/agreements/generate
router.post('/generate', authorize(['SUPER_ADMIN', 'ADMIN']), AgreementsController.generate);

// GET /api/agreements  — list all
router.get('/', authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), AgreementsController.getAll);

// POST /api/agreements/respond
router.post('/respond', AgreementsController.respond);

// GET /api/agreements/application/:applicationId
router.get('/application/:applicationId', AgreementsController.getByApplication);

// PATCH /api/agreements/:id/status
router.patch('/:id/status', authorize(['SUPER_ADMIN', 'ADMIN']), AgreementsController.updateStatus);

// PATCH /api/agreements/:id/variables
router.patch('/:id/variables', authorize(['SUPER_ADMIN', 'ADMIN']), AgreementsController.updateVariables);

// POST /api/agreements/:id/approve-review
router.post('/:id/approve-review', authorize(['SUPER_ADMIN', 'ADMIN']), AgreementsController.approveReview);

// GET /api/agreements/:id  — must be LAST to avoid swallowing named routes above
router.get('/:id', AgreementsController.getById);

export default router;
