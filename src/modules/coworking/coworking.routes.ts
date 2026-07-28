import { Router } from 'express';
import { CoworkingController } from './coworking.controller';

const router = Router();

// Dashboard Route
router.get('/dashboard/stats', CoworkingController.getDashboardStats);

// Building Routes
router.get('/buildings', CoworkingController.getAllBuildings);
router.get('/buildings/:id', CoworkingController.getBuildingById);
router.post('/buildings', CoworkingController.createBuilding);
router.put('/buildings/:id', CoworkingController.updateBuilding);
router.delete('/buildings/:id', CoworkingController.deleteBuilding);

// Floor & Zone Routes
router.get('/floors/:floorId', CoworkingController.getFloorDetails);
router.post('/buildings/:buildingId/floors', CoworkingController.createFloor);
router.post('/floors/:floorId/zones', CoworkingController.createZone);
router.put('/floors/:id', CoworkingController.updateFloor);
router.delete('/floors/:id', CoworkingController.deleteFloor);
router.put('/zones/:id', CoworkingController.updateZone);
router.delete('/zones/:id', CoworkingController.deleteZone);

// Resource (Seat/Desk) Routes
router.get('/zones/:zoneId/resources', CoworkingController.getZoneResources);
router.post('/zones/:zoneId/bulk-setup', CoworkingController.bulkGenerateResources);
router.patch('/resources/:id/status', CoworkingController.updateResourceStatus);

// Allocation Routes
router.get('/allocations', CoworkingController.getAllAllocations);
router.post('/allocations', CoworkingController.createAllocation);
router.post('/allocations/batch', CoworkingController.createBatchAllocation);
router.patch('/allocations/:id/status', CoworkingController.updateAllocationStatus);
router.delete('/allocations/:id', CoworkingController.deleteAllocation);

// Cost Plan Routes
router.get('/cost-plans', CoworkingController.getAllCostPlans);
router.post('/cost-plans', CoworkingController.createCostPlan);
router.put('/cost-plans/:id', CoworkingController.updateCostPlan);
router.delete('/cost-plans/:id', CoworkingController.deleteCostPlan);

// Helper Routes
router.get('/startups', CoworkingController.getStartupUsers);

// --- Meeting Room Booking Routes ---
router.post('/bookings', CoworkingController.createMeetingRoomBooking);
router.get('/bookings', CoworkingController.getMeetingRoomBookings);
router.delete('/bookings/:id', CoworkingController.cancelMeetingRoomBooking);
router.get('/users/:userId/credits', CoworkingController.getUserMonthlyCreditsAndUsage);
router.patch('/users/:userId/coworking-limits', CoworkingController.updateUserCoworkingLimits);
router.get('/users/:userId/quota-history', CoworkingController.getQuotaHistory);
router.post('/quotas/override', CoworkingController.grantAdminCredits);

import { authenticate, authorize } from '../../common/middleware/auth.middleware';

// --- Invoicing Routes ---
router.get('/invoices', CoworkingController.getInvoices);
router.post('/invoices/generate', CoworkingController.generateMonthlyInvoices);
router.post('/invoices/:id/send', CoworkingController.sendInvoiceEmail);

// --- Space Allocation Request Routes ---
router.post('/requests', authenticate, authorize(['STARTUP']), CoworkingController.createSpaceRequest);
router.get('/requests/my', authenticate, authorize(['STARTUP']), CoworkingController.getMySpaceRequests);
router.get('/requests', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), CoworkingController.getAllSpaceRequests);
router.patch('/requests/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), CoworkingController.reviewSpaceRequest);

export default router;
