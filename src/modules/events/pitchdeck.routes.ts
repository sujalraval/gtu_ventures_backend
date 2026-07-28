import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { PitchDeckController } from './pitchdeck.controller';
import { authenticate, authorize } from '../../common/middleware/auth.middleware';

const ADMIN = ['SUPER_ADMIN', 'ADMIN', 'STAFF'];
const STARTUP = ['STARTUP'];

// Multer config for pitch decks — allow PPT/PDF/DOC up to 50MB
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `pitch-${randomUUID()}${ext}`);
  },
});

const pitchUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|ppt|pptx|key|doc|docx)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, PPT, PPTX, KEY, DOC, DOCX files are allowed'));
    }
  },
});

const router = Router({ mergeParams: true });

// Startup: submit new version
router.post(
  '/',
  authenticate,
  authorize(STARTUP),
  pitchUpload.single('file'),
  PitchDeckController.submit,
);

// Startup: my version history for this event
router.get('/my', authenticate, authorize(STARTUP), PitchDeckController.getVersionHistory);

// Startup: restore a previous version
router.patch('/:submissionId/activate', authenticate, authorize(STARTUP), PitchDeckController.setActive);

// Startup: delete a non-active version
router.delete('/:submissionId', authenticate, authorize(STARTUP), PitchDeckController.deleteVersion);

// Admin: all submissions for event
router.get('/', authenticate, authorize(ADMIN), PitchDeckController.getByEvent);

// Admin: stats
router.get('/stats', authenticate, authorize(ADMIN), PitchDeckController.getStats);

// Admin: review a submission
router.patch('/:submissionId/review', authenticate, authorize(ADMIN), PitchDeckController.review);

// Both: download file
router.get('/download/:filename', authenticate, PitchDeckController.download);

export default router;
