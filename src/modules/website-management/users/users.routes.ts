const express = require('express');
const router = express.Router();
const ctrl = require('./users.controller');
const { authenticate: authenticateToken } = require('../../../common/middleware/auth.middleware');

router.get('/', authenticateToken, ctrl.getAll);
router.post('/', authenticateToken, ctrl.create);
router.delete('/:id', authenticateToken, ctrl.delete);

module.exports = router;