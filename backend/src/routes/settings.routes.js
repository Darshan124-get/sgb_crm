const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authenticateToken, isAdmin, isManagerOrAdmin } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, settingsController.getSettings);
router.patch('/', authenticateToken, isManagerOrAdmin, settingsController.updateSettings);

module.exports = router;
