import { Router } from 'express';
import { CertificatesController } from './certificates.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const router = Router({ mergeParams: true }); // mergeParams to access :eventId

const ADMIN = ['SUPER_ADMIN', 'ADMIN'];
const STAFF = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];

router.get('/template', authenticate, authorize(STAFF), CertificatesController.getTemplate);
router.put('/template', authenticate, authorize(ADMIN), CertificatesController.saveTemplate);

router.get('/stats', authenticate, authorize(STAFF), CertificatesController.stats);
router.post('/preview', authenticate, authorize(STAFF), CertificatesController.preview);

router.get('/:regId/download', authenticate, authorize(STAFF), CertificatesController.download);
router.post('/:regId/email', authenticate, authorize(ADMIN), CertificatesController.emailOne);

// Sends to every checked-in attendee — admin only, and never automatic.
router.post('/issue', authenticate, authorize(ADMIN), CertificatesController.issueAll);

export default router;
