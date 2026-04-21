const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authenticateToken, isAdmin } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, settingsController.getSettings);
router.patch('/', authenticateToken, isAdmin, settingsController.updateSettings);

module.exports = router;
