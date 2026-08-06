const express = require('express');
const router = express.Router();
const partnersController = require('./partners.controller');
const { authenticate: authenticateToken } = require('../../../common/middleware/auth.middleware');
const auditLog = (action) => (req, res, next) => next();

router.get('/', partnersController.getAll);
router.get('/:id', partnersController.getOne);

router.post('/', authenticateToken, auditLog('Partner'), partnersController.create);
router.put('/:id', authenticateToken, auditLog('Partner'), partnersController.update);
router.delete('/:id', authenticateToken, auditLog('Partner'), partnersController.delete);

module.exports = router;
