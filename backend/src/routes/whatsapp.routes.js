const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Protected Internal API Endpoints
router.get('/customers', authenticateToken, whatsappController.getCustomers);
router.put('/customers/:phone/read', authenticateToken, whatsappController.markRead);
router.get('/history/:phone', authenticateToken, whatsappController.getHistory);
router.post('/send', authenticateToken, whatsappController.sendReply);
router.get('/media/:chatId', authenticateToken, whatsappController.getMedia);
router.get('/message/:chatId', authenticateToken, whatsappController.getMedia); // just correcting an earlier comment if any, but wait, there was getMedia
router.delete('/message/:chatId', authenticateToken, whatsappController.deleteMessage);

// Quick Replies Endpoints
router.get('/quick-replies', authenticateToken, whatsappController.getQuickReplies);
router.post('/quick-replies', authenticateToken, whatsappController.saveQuickReply);
router.delete('/quick-replies/:id', authenticateToken, whatsappController.deleteQuickReply);

module.exports = router;
