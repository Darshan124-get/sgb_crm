const express = require('express');
const router = express.Router();
const zohoController = require('../controllers/zoho.controller');

// 1. OAuth Redirect Callback from Zoho Accounts India
router.get('/callback', zohoController.handleOAuthCallback);

// 2. Webhook Listener for real-time Zoho Books events (Invoices, Payments, Credits)
router.post('/webhook', zohoController.handleWebhook);

// 3. Integration Health & Configuration Status
router.get('/status', zohoController.getStatus);

// 4. Authorization URL Generator (convenience endpoint)
router.get('/auth-url', zohoController.getAuthUrl);

module.exports = router;
