import { Router } from 'express';
import { FinanceController } from './finance.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router();
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// Secure all routes in this sub-router
router.use(authenticate);
router.use(authorize(ADMIN_ROLES));

// 1. Chart of Accounts Configuration
router.get('/accounts', FinanceController.getChartOfAccounts);

// 2. Dynamic General Ledger Queries
router.get('/ledger', FinanceController.getLedger);

// 3. Central Finance KPI Dashboard Metrics
router.get('/dashboard', FinanceController.getDashboard);

// 4. Double-Entry Voucher Posting
router.post('/vouchers', FinanceController.createVoucher);

// 5. Operating Incubator Expenses logs
router.get('/expenses', FinanceController.getExpenses);
router.post('/expenses', FinanceController.createExpense);

// 6. Grant Scheme Milestones & Seed Tranche Disbursements
router.get('/grants', FinanceController.getStartupGrantMilestones);
router.post('/grants/:trancheId/payout', FinanceController.payoutGrantTranche);

// 7. Mentor Session Vouchers and Hour tracking
router.get('/mentors', FinanceController.getMentorSessions);
router.post('/mentors', FinanceController.createMentorSession);

// 8. Capital Asset Purchases & Inventory Ledger logs
router.get('/inventory', FinanceController.getInventoryAssets);
router.post('/inventory', FinanceController.createInventoryAsset);

export default router;
