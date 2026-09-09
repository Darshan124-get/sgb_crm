const express = require('express');
const router = express.Router();
const dealerController = require('../controllers/dealer.controller');
const orderController = require('../controllers/order.controller');
const { authenticateToken, isAdmin, isAdminOrSales } = require('../middleware/auth.middleware');

// Specific routes FIRST
router.get('/orders', authenticateToken, dealerController.getDealerOrders);
router.get('/orders/:orderId/payments', authenticateToken, dealerController.getOrderPaymentHistory);
router.put('/orders/:orderId', authenticateToken, isAdminOrSales, dealerController.updateDealerOrder);
router.delete('/orders/:orderId', authenticateToken, isAdminOrSales, dealerController.deleteDealerOrder);
router.post('/orders/:orderId/pay-balance', authenticateToken, isAdminOrSales, dealerController.payDealerOrderBalance);
router.post('/orders/bulk-delete', authenticateToken, isAdminOrSales, dealerController.bulkDeleteDealerOrders);
router.post('/orders/bulk-clear-payment', authenticateToken, isAdminOrSales, dealerController.bulkClearPaymentDealerOrders);
router.post('/orders/bulk-status', authenticateToken, isAdminOrSales, dealerController.bulkUpdateDealerOrdersStatus);
router.post('/orders/bulk-import', authenticateToken, isAdminOrSales, orderController.bulkImportOrders);
router.post('/bulk-import', authenticateToken, isAdminOrSales, dealerController.bulkImportDealers);
router.post('/bulk-delete', authenticateToken, isAdminOrSales, dealerController.bulkDeleteDealers);

// Parametric routes NEXT
router.get('/', authenticateToken, dealerController.getDealers);
router.post('/', authenticateToken, isAdminOrSales, dealerController.createDealer);
router.post('/:id/orders', authenticateToken, isAdminOrSales, dealerController.createDealerOrder);
router.put('/:id', authenticateToken, isAdminOrSales, dealerController.updateDealer);
router.delete('/:id', authenticateToken, isAdmin, dealerController.deleteDealer);

module.exports = router;
