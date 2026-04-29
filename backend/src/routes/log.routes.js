const express = require('express');
const router = express.Router();
const logController = require('../controllers/log.controller');
const auth = require('../middleware/auth.middleware');

// Only admins should view logs
router.get('/', auth.authenticateToken, auth.isAdmin, logController.getSystemLogs);

module.exports = router;
