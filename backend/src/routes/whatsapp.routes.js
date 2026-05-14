const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Protected Internal API Endpoints
router.get('/customers', authenticateToken, whatsappController.getCustomers);
router.get('/history/:phone', authenticateToken, whatsappController.getHistory);
router.post('/send', authenticateToken, whatsappController.sendReply);
router.get('/media/:chatId', authenticateToken, whatsappController.getMedia);
router.delete('/message/:chatId', authenticateToken, whatsappController.deleteMessage);

module.exports = router;
