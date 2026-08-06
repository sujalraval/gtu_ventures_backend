const express = require('express');
const router = express.Router();
const controller = require('./labs.controller');
const { authenticate: protect } = require('../../../common/middleware/auth.middleware');

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

// Protected routes
router.post('/', protect, controller.create);
router.put('/:id', protect, controller.update);
router.delete('/:id', protect, controller.delete);

module.exports = router;
