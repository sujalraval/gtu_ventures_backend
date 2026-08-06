const express = require('express');
const router = express.Router();
const startupsController = require('./startups.controller');
const { authenticate: authenticateToken } = require('../../../common/middleware/auth.middleware');
const auditLog = (action) => (req, res, next) => next();

router.get('/', startupsController.getAll);
router.get('/:id', startupsController.getOne);

router.post('/', authenticateToken, auditLog('Startup'), startupsController.create);
router.put('/:id', authenticateToken, auditLog('Startup'), startupsController.update);
router.delete('/:id', authenticateToken, auditLog('Startup'), startupsController.delete);

module.exports = router;
