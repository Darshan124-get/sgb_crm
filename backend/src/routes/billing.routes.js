const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticateToken, isAdmin, hasPermission } = require('../middleware/auth.middleware');

const requireBilling = hasPermission('billing_billing');

// Dashboard & Lists
router.get('/stats', authenticateToken, requireBilling, billingController.getStats);
router.get('/pending', authenticateToken, requireBilling, billingController.getPendingOrders);
// Sales Orders
router.get('/sales-orders', authenticateToken, requireBilling, billingController.getSalesOrders);
router.post('/sales-orders', authenticateToken, requireBilling, billingController.createManualSalesOrder);
router.get('/sales-orders/meta', authenticateToken, requireBilling, billingController.getSalesOrderMeta);
router.get('/sales-orders/products', authenticateToken, requireBilling, billingController.getProductsForSalesOrder);
router.get('/sales-orders/customers/search', authenticateToken, requireBilling, billingController.searchSalesOrderCustomers);
router.get('/sales-orders/:id', authenticateToken, requireBilling, billingController.getSalesOrderDetails);
// Orders & Invoices
router.get('/orders', authenticateToken, requireBilling, billingController.getOrdersByStatus);
router.get('/invoices', authenticateToken, requireBilling, billingController.getAllInvoices);

// Order specifics
router.get('/orders/:id', authenticateToken, requireBilling, billingController.getOrderForBilling);
router.patch('/orders/:id', authenticateToken, requireBilling, billingController.updateOrderItems);
router.post('/orders/:id/approve', authenticateToken, requireBilling, billingController.approveOrder);
router.post('/orders/:id/zoho-customer', authenticateToken, requireBilling, billingController.createZohoCustomer);
router.post('/orders/:id/zoho-salesorder', authenticateToken, requireBilling, billingController.createOrSyncZohoSalesOrder);

// Zoho Customers Directory & Details
router.get('/customers', authenticateToken, requireBilling, billingController.getZohoCustomers);
router.get('/customers/:contactId', authenticateToken, requireBilling, billingController.getZohoCustomerById);
router.get('/customers/:contactId/timeline', authenticateToken, requireBilling, billingController.getZohoCustomerTimeline);
router.post('/customers', authenticateToken, requireBilling, billingController.createDirectZohoCustomer);

// Invoicing
router.post('/orders/:id/invoice', authenticateToken, requireBilling, billingController.generateInvoice);
router.post('/invoices/:id/finalize', authenticateToken, requireBilling, billingController.finalizeInvoice);
router.delete('/invoices/:id', authenticateToken, requireBilling, billingController.deleteInvoice);
router.get('/invoices/:id', authenticateToken, requireBilling, billingController.getInvoiceById);
router.get('/invoices/:id/print', authenticateToken, requireBilling, billingController.printInvoice);

// Payments
router.get('/payments', authenticateToken, requireBilling, billingController.getPayments);
router.post('/payments', authenticateToken, requireBilling, billingController.addPayment);
router.patch('/payments/:id/verify', authenticateToken, requireBilling, billingController.verifyPayment);
router.patch('/payments/lead-advance/:id/verify', authenticateToken, requireBilling, billingController.verifyLeadAdvance);

// Settings
router.get('/settings', authenticateToken, requireBilling, billingController.getSettings);
router.patch('/settings', authenticateToken, isAdmin, billingController.updateSettings);

// Reports (Concept)
router.get('/reports/revenue', authenticateToken, requireBilling, billingController.getStats); // Reusing getStats for now

module.exports = router;
