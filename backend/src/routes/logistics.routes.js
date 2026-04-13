const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logistics.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/packing', authenticateToken, logisticsController.packOrder);
router.post('/shipping', authenticateToken, logisticsController.shipOrder);

module.exports = router;
