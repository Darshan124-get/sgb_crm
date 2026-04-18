const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticateToken, isAdminOrSales } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, orderController.getOrders);
router.get('/reports', authenticateToken, isAdminOrSales, orderController.getReports);
router.get('/:id', authenticateToken, orderController.getOrderDetails);
router.post('/convert', authenticateToken, isAdminOrSales, orderController.convertLeadToOrder);
router.post('/dealer', authenticateToken, isAdminOrSales, orderController.createDealerOrder);
router.patch('/:id/status', authenticateToken, orderController.updateStatus);

module.exports = router;
