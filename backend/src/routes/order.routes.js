const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const dealerController = require('../controllers/dealer.controller');
const { authenticateToken, isAdminOrSales } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/', authenticateToken, orderController.getOrders);
router.post('/convert', authenticateToken, isAdminOrSales, upload.single('screenshot'), orderController.convertLeadToOrder);
router.post('/dealer', authenticateToken, isAdminOrSales, orderController.createDealerOrder);
router.post('/bulk-import', authenticateToken, isAdminOrSales, orderController.bulkImportOrders);
router.post('/bulk-delete', authenticateToken, isAdminOrSales, dealerController.bulkDeleteDealerOrders);
router.post('/bulk-clear-payment', authenticateToken, isAdminOrSales, dealerController.bulkClearPaymentDealerOrders);
router.post('/bulk-status', authenticateToken, isAdminOrSales, dealerController.bulkUpdateDealerOrdersStatus);
router.patch('/:id/status', authenticateToken, orderController.updateStatus);
router.delete('/:id', authenticateToken, isAdminOrSales, dealerController.deleteDealerOrder);

module.exports = router;
