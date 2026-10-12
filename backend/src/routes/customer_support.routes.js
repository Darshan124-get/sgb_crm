const express = require('express');
const router = express.Router();
const controller = require('../controllers/customer_support.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// All customer support routes require authentication
router.use(authenticateToken);

// Dashboard metrics
router.get('/dashboard-metrics', controller.getDashboardMetrics);

// Sync / recovery for delivered orders
router.post('/sync-delivered', controller.syncDeliveredOrders);

// In-app notifications
router.get('/notifications', controller.getNotifications);
router.patch('/notifications/:id/read', controller.markNotificationRead);

// Customer & Order Lookup
router.get('/lookup-customer', controller.lookupCustomer);

// Cases management
router.get('/cases', controller.getCases);
router.post('/cases', controller.createManualCase);
router.get('/cases/:id', controller.getCaseDetails);
router.post('/cases/:id/calls', controller.recordCall);
router.post('/cases/:id/notes', controller.addNote);
router.post('/cases/:id/photos', upload.array('photos', 10), controller.uploadPhotos);
router.post('/cases/:id/complete', controller.completeSupport);

// 30-Day Follow-ups
router.get('/followups', controller.getFollowups);
router.get('/followups/:id', controller.getFollowupDetails);
router.post('/followups/:id/call', controller.recordFollowupCall);

// Settings & Staff Roster
router.get('/settings', controller.getSettings);

module.exports = router;

