const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');

// Public Webhook Endpoints
router.get('/', whatsappController.verifyWebhook);
router.post('/', whatsappController.receiveMessage);

module.exports = router;
