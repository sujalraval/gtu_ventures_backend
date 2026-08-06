const express = require('express');
const router = express.Router();
const mediaController = require('./media.controller');
const { upload } = require('../../../common/utils/multer');
const { authenticate: authenticateToken } = require('../../../common/middleware/auth.middleware');
const auditLog = (action) => (req, res, next) => next();

router.post('/', authenticateToken, upload.single('file'), auditLog('Media'), mediaController.upload);
router.get('/', authenticateToken, mediaController.getAll);
router.delete('/:id', authenticateToken, auditLog('Media'), mediaController.delete);

module.exports = router;
