const express = require('express');
const router = express.Router();
const mentorsController = require('./mentors.controller');
const { authenticate: authenticateToken } = require('../../../common/middleware/auth.middleware');
const auditLog = (action) => (req, res, next) => next();

router.get('/', mentorsController.getAll);
router.get('/:id', mentorsController.getOne);

router.post('/', authenticateToken, auditLog('Mentor'), mentorsController.create);
router.put('/:id', authenticateToken, auditLog('Mentor'), mentorsController.update);
router.delete('/:id', authenticateToken, auditLog('Mentor'), mentorsController.delete);

module.exports = router;
