const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logistics.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/packing', authenticateToken, logisticsController.packOrder);
router.post('/ship', authenticateToken, logisticsController.shipOrder);
router.get('/dashboard-stats', authenticateToken, logisticsController.getDashboardStats);
router.get('/ship', authenticateToken, logisticsController.getShippingOrders);

module.exports = router;
