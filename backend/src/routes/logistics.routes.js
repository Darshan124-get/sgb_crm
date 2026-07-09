const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logistics.controller');
const { authenticateToken, hasPermission } = require('../middleware/auth.middleware');

router.post('/packing', authenticateToken, hasPermission('packing_packing'), logisticsController.packOrder);
router.post('/ship', authenticateToken, hasPermission('shipping_shipping'), logisticsController.shipOrder);
router.get('/dashboard-stats', authenticateToken, logisticsController.getDashboardStats); // Dashboard handles both, so keep generic or protect appropriately
router.get('/ship', authenticateToken, hasPermission('shipping_shipping'), logisticsController.getShippingOrders);

module.exports = router;
