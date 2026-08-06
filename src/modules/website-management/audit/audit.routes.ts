const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const { authenticate: authenticateToken } = require('../../../common/middleware/auth.middleware');

// Audit logs are read-only and restricted to SUPER_ADMIN
const checkSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
};

router.get('/', authenticateToken, checkSuperAdmin, auditController.getAll);

module.exports = router;
