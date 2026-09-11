const express = require('express');
const router = express.Router();
const multer = require('multer');
const chatbotController = require('../controllers/chatbot.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Memory storage for file upload processing
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB max per file
});

// Chatbot Templates & Flows
router.get('/templates', authenticateToken, chatbotController.getTemplates);
router.post('/flows/from-template', authenticateToken, chatbotController.createFlowFromTemplate);
router.get('/flows', authenticateToken, chatbotController.getFlows);
router.get('/flows/:flowId', authenticateToken, chatbotController.getFlow);
router.post('/flows', authenticateToken, chatbotController.createFlow);
router.post('/flows/:flowId/draft', authenticateToken, chatbotController.saveDraft);
router.post('/flows/:flowId/publish', authenticateToken, chatbotController.publishFlow);
router.post('/flows/:flowId/duplicate', authenticateToken, chatbotController.duplicateFlow);
router.patch('/flows/:flowId/status', authenticateToken, chatbotController.updateFlowStatus);
router.delete('/flows/:flowId', authenticateToken, chatbotController.deleteFlow);

// Settings
router.get('/settings', authenticateToken, chatbotController.getSettings);
router.post('/settings', authenticateToken, chatbotController.updateSettings);

// Helpers
router.get('/node-types', authenticateToken, chatbotController.getNodeTypes);

// Products & Catalog API
router.get('/products', authenticateToken, chatbotController.getProducts);
router.post('/products', authenticateToken, chatbotController.createProduct);
router.post('/products/import', authenticateToken, chatbotController.importProducts);
router.put('/products/:id', authenticateToken, chatbotController.updateProduct);
router.delete('/products/:id', authenticateToken, chatbotController.deleteProduct);

// Categories API
router.get('/categories', authenticateToken, chatbotController.getCategories);
router.post('/categories', authenticateToken, chatbotController.createCategory);
router.delete('/categories/:id', authenticateToken, chatbotController.deleteCategory);

// Media Library & Storage API
router.get('/media', authenticateToken, chatbotController.getMedia);
router.get('/media/storage-usage', authenticateToken, chatbotController.getStorageUsage);
router.post('/media/upload', authenticateToken, upload.any(), chatbotController.uploadMedia);
router.delete('/media/:id', authenticateToken, chatbotController.deleteMedia);

// Human Handoff & Session Control API
router.get('/sessions/human-needed', authenticateToken, chatbotController.getPendingHumanAlerts);
router.post('/sessions/:sessionId/retrigger', authenticateToken, chatbotController.retriggerFlowSession);
router.post('/sessions/:sessionId/takeover', authenticateToken, chatbotController.takeoverFlowSession);
router.post('/sessions/retrigger', authenticateToken, chatbotController.retriggerFlowSession);
router.post('/sessions/takeover', authenticateToken, chatbotController.takeoverFlowSession);
router.post('/sessions/resolve-handoff', authenticateToken, chatbotController.resolveHandoffSession);
router.post('/sessions/:sessionId/resolve', authenticateToken, chatbotController.resolveHandoffSession);

module.exports = router;
