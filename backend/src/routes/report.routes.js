const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/dashboard-stats', authenticateToken, reportController.getDashboardStats);
router.get('/leads', authenticateToken, reportController.exportLeads);
router.get('/orders', authenticateToken, reportController.exportOrders);
router.get('/campaign-analytics', authenticateToken, reportController.getCampaignAnalytics);
router.get('/locations', authenticateToken, reportController.getLocations);

module.exports = router;
