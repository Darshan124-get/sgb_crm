const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticateToken, isAdmin } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, inventoryController.getInventory);
router.post('/adjust', authenticateToken, isAdmin, inventoryController.adjustStock);
router.get('/logs', authenticateToken, inventoryController.getInventoryLogs);
router.get('/low-stock', authenticateToken, inventoryController.getLowStockAlerts);
router.get('/search', authenticateToken, inventoryController.searchProducts);

module.exports = router;
