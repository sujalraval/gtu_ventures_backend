import { Router } from 'express';
import { ApplicationsController } from './applications.controller';
import { authenticate, authorize, authorizePermission } from '../../common/middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/applications';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Startup routes
router.get('/my', authenticate, authorize(['STARTUP']), ApplicationsController.getMyApplication);
router.get('/my/stats', authenticate, authorize(['STARTUP']), ApplicationsController.getMyStats);
router.post('/form-a', authenticate, authorize(['STARTUP']), ApplicationsController.submitFormA);
router.post('/form-b', authenticate, authorize(['STARTUP']), ApplicationsController.submitFormB);
router.post('/form-c', authenticate, authorize(['STARTUP']), ApplicationsController.submitFormC);
router.post('/upload', authenticate, authorize(['STARTUP', 'SUPER_ADMIN', 'ADMIN', 'STAFF']), upload.single('file'), ApplicationsController.uploadDocument);

// Admin routes
router.get('/staff/stats', authenticate, authorize(['STAFF']), authorizePermission('applications', 'view'), ApplicationsController.getStaffStats);
router.get('/staff/performance', authenticate, authorize(['STAFF', 'ADMIN', 'SUPER_ADMIN']), ApplicationsController.getStaffPerformance);
router.get('/staff/stream', authenticate, authorize(['STAFF', 'ADMIN', 'SUPER_ADMIN']), ApplicationsController.streamNotifications);
router.get('/stats', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'view'), ApplicationsController.getStats);
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), authorizePermission('applications', 'view'), ApplicationsController.getAll);
router.get('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), ApplicationsController.getById);
router.post('/:id/status', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'edit'), ApplicationsController.updateStatus);
router.post('/:id/approve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'approve'), ApplicationsController.approve);
router.post('/:id/reject', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'approve'), ApplicationsController.reject);
router.post('/:id/assign', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'edit'), ApplicationsController.assign);
router.post('/:id/review', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), authorizePermission('applications', 'edit'), ApplicationsController.submitReview);
router.post('/:id/verify-docs', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), authorizePermission('applications', 'edit'), ApplicationsController.updateVerifiedDocs);
router.post('/:id/email', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), ApplicationsController.sendEmailToStartup);
router.post('/:id/graduate', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'approve'), ApplicationsController.markAsGraduated);
router.delete('/:id/graduate', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'approve'), ApplicationsController.revokeGraduation);

export default router;
