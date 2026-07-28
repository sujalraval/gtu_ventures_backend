import { Router } from 'express';
import { CollateralController } from './collateral.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router({ mergeParams: true });
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

router.get('/attendees.csv', authenticate, authorize(ADMIN_ROLES), CollateralController.downloadAttendeeCSV);
router.get('/pitches.csv', authenticate, authorize(ADMIN_ROLES), CollateralController.downloadPitchSummaryCSV);
router.get('/report.pdf', authenticate, authorize(ADMIN_ROLES), CollateralController.downloadEventReportPDF);

export default router;
