const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticateToken, isAdmin } = require('../middleware/auth.middleware');

// Dashboard & Lists
router.get('/stats', authenticateToken, billingController.getStats);
router.get('/pending', authenticateToken, billingController.getPendingOrders);
router.get('/invoices', authenticateToken, billingController.getAllInvoices);

// Order specifics
router.get('/orders/:id', authenticateToken, billingController.getOrderForBilling);
router.patch('/orders/:id', authenticateToken, billingController.updateOrderItems);

// Invoicing
router.post('/orders/:id/invoice', authenticateToken, billingController.generateInvoice);
router.post('/invoices/:id/finalize', authenticateToken, billingController.finalizeInvoice);
router.get('/invoices/:id', authenticateToken, billingController.getInvoiceById);
router.get('/invoices/:id/print', authenticateToken, billingController.printInvoice);

// Payments
router.get('/payments', authenticateToken, billingController.getPayments);
router.post('/payments', authenticateToken, billingController.addPayment);
router.patch('/payments/:id/verify', authenticateToken, billingController.verifyPayment);
router.patch('/payments/lead-advance/:id/verify', authenticateToken, billingController.verifyLeadAdvance);

// Settings
router.get('/settings', authenticateToken, billingController.getSettings);
router.patch('/settings', authenticateToken, isAdmin, billingController.updateSettings);

// Reports (Concept)
router.get('/reports/revenue', authenticateToken, billingController.getStats); // Reusing getStats for now

module.exports = router;
