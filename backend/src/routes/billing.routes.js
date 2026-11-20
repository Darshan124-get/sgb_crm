const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticateToken, isAdmin, hasPermission } = require('../middleware/auth.middleware');

const requireBilling = hasPermission('billing_billing');

// Dashboard & Lists
router.get('/stats', authenticateToken, requireBilling, billingController.getStats);
router.get('/pending', authenticateToken, requireBilling, billingController.getPendingOrders);
router.post('/orders/:id/cancel', authenticateToken, requireBilling, billingController.cancelPendingOrder);
router.delete('/orders/:id', authenticateToken, requireBilling, billingController.hardDeletePendingOrder);
// Sales Orders
router.get('/sales-orders', authenticateToken, requireBilling, billingController.getSalesOrders);
router.post('/sales-orders', authenticateToken, requireBilling, billingController.createManualSalesOrder);
router.get('/sales-orders/meta', authenticateToken, requireBilling, billingController.getSalesOrderMeta);
router.get('/sales-orders/gst-taxes', authenticateToken, requireBilling, billingController.getGstTaxesConfig);
router.get('/sales-orders/resolve-tax', authenticateToken, requireBilling, billingController.resolveGstTax);
router.get('/sales-orders/products', authenticateToken, requireBilling, billingController.getProductsForSalesOrder);
router.get('/sales-orders/customers/search', authenticateToken, requireBilling, billingController.searchSalesOrderCustomers);
router.get('/sales-orders/:id', authenticateToken, requireBilling, billingController.getSalesOrderDetails);
router.get('/sales-orders/:id/pdf', authenticateToken, requireBilling, billingController.getSalesOrderPdf);
router.post('/sales-orders/:id/sync', authenticateToken, requireBilling, billingController.retrySyncSalesOrder);
router.post('/sales-orders/:id/fulfill', authenticateToken, requireBilling, billingController.markSalesOrderFulfilled);
router.post('/sales-orders/:id/cancel-items', authenticateToken, requireBilling, billingController.cancelSalesOrderItems);
router.put('/sales-orders/:id', authenticateToken, requireBilling, billingController.updateSalesOrder);
router.delete('/sales-orders/:id', authenticateToken, requireBilling, billingController.deleteSalesOrder);
// Orders & Invoices
router.get('/orders', authenticateToken, requireBilling, billingController.getOrdersByStatus);
router.get('/invoices', authenticateToken, requireBilling, billingController.getAllInvoices);
router.get('/invoices/prepare-from-so/:soId', authenticateToken, requireBilling, billingController.prepareInvoiceFromSalesOrder);
router.post('/invoices/create-zoho-invoice', authenticateToken, requireBilling, billingController.createZohoInvoice);
router.get('/invoices/:id/details', authenticateToken, requireBilling, billingController.getZohoInvoiceDetails);
router.get('/invoices/:id/zoho-pdf', authenticateToken, requireBilling, billingController.getZohoInvoicePdf);

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
router.put('/customers/:contactId', authenticateToken, requireBilling, billingController.updateZohoCustomer);
router.delete('/customers/:contactId', authenticateToken, requireBilling, billingController.deleteZohoCustomer);
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
