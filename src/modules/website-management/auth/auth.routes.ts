const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate: authenticateToken } = require('../../../common/middleware/auth.middleware');

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
