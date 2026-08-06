const express = require('express');
const router = express.Router();
const ctrl = require('./events.controller');
const { authenticate: authenticateToken } = require('../../../common/middleware/auth.middleware');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authenticateToken, ctrl.create);
router.put('/:id', authenticateToken, ctrl.update);
router.delete('/:id', authenticateToken, ctrl.delete);

module.exports = router;