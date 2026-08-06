// @ts-nocheck
import express from 'express';
const router = express.Router();
import mediaController from './media.controller';
import { upload  } from '../../../common/utils/multer';
import { authenticate as authenticateToken } from '../../../common/middleware/auth.middleware';
const auditLog = (action) => (req: any, res: any, next: any) => next();

router.post('/', authenticateToken, upload.single('file'), auditLog('Media'), mediaController.upload);
router.get('/', authenticateToken, mediaController.getAll);
router.delete('/:id', authenticateToken, auditLog('Media'), mediaController.delete);

export default router;
