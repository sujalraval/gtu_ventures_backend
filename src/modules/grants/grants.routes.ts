import { Router } from 'express';
import { GrantsController } from './grants.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, GrantsController.getAll);
router.get('/:id', authenticate, GrantsController.getById);

router.post('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.create);
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.update);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.delete);

// Receipt and Allocation routes
router.get('/:id/receipts', authenticate, GrantsController.getReceiptsByGrant);
router.post('/:id/receipts', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.addReceipt);
router.put('/receipts/:receiptId', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.updateReceipt);
router.delete('/receipts/:receiptId', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.deleteReceipt);

router.get('/:id/allocations', authenticate, GrantsController.getAllocationsByGrant);
router.post('/:id/allocations', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.addAllocation);
router.put('/allocations/:allocationId', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.updateAllocation);
router.delete('/allocations/:allocationId', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), GrantsController.deleteAllocation);

export default router;
