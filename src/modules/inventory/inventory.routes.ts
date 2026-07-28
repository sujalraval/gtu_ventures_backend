import { Router } from 'express';
import { InventoryController } from './inventory.controller';

const router = Router();

// Asset Directory Endpoints
router.get('/items', InventoryController.getAllItems);
router.post('/items', InventoryController.createItem);
router.patch('/items/:id/status', InventoryController.updateItemStatus);
router.get('/items/:id/history', InventoryController.getItemHistory);

// Allocation Endpoints
router.post('/allocations', InventoryController.createAllocation);
router.post('/allocations/:id/return', InventoryController.returnAllocation);

// Consumables Endpoints
router.get('/consumables', InventoryController.getAllConsumables);
router.post('/consumables', InventoryController.createConsumable);
router.patch('/consumables/:id/stock', InventoryController.adjustConsumableStock);

// Maintenance / Repair Queue Endpoints
router.get('/maintenance', InventoryController.getAllMaintenanceTickets);
router.post('/maintenance', InventoryController.createMaintenanceTicket);
router.post('/maintenance/:id/resolve', InventoryController.resolveMaintenanceTicket);

// Dropdowns & Unified Live Activity Feed Helpers
router.get('/targets', InventoryController.getCheckoutTargets);
router.get('/history-feed', InventoryController.getUnifiedHistoryFeed);

export default router;
