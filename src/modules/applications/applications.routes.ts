import { Router } from 'express';
import { ApplicationsController } from './applications.controller';
import { authenticate, authorize, authorizePermission } from '../../common/middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '../../common/config/paths';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // UPLOADS_DIR, not a relative 'uploads/applications'. The relative path
    // resolves inside the deployment directory, which the deploy rsyncs over
    // with --delete — every application document uploaded here was being
    // destroyed on the next push. See common/config/paths.ts.
    const uploadDir = path.join(UPLOADS_DIR, 'applications');
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

/** Pitch decks are PDF-only; supporting documents may also be images. */
const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage,
  // Was unbounded: any authenticated user could fill the disk with one request.
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'pitchDeck' && file.mimetype !== 'application/pdf') {
      return cb(new Error('The pitch deck must be a PDF.'));
    }
    if (!ALLOWED_UPLOAD_TYPES.has(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG, PNG and WebP files are accepted.'));
    }
    cb(null, true);
  },
});

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
// Onboarding decision — which requested scheme the startup proceeds in.
router.post('/:id/scheme-decision', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'edit'), ApplicationsController.decideScheme);
router.post('/:id/assign', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'edit'), ApplicationsController.assign);
router.post('/:id/review', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), authorizePermission('applications', 'edit'), ApplicationsController.submitReview);
router.post('/:id/verify-docs', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), authorizePermission('applications', 'edit'), ApplicationsController.updateVerifiedDocs);
router.post('/:id/email', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'STAFF']), ApplicationsController.sendEmailToStartup);
router.post('/:id/graduate', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'approve'), ApplicationsController.markAsGraduated);
router.delete('/:id/graduate', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), authorizePermission('applications', 'approve'), ApplicationsController.revokeGraduation);

export default router;
