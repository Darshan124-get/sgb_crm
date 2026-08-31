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

// Optional Auth middleware (falls back gracefully to admin user if no header passed)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
    if (!token) {
        req.user = { id: 1, role: 'admin' };
        return next();
    }
    return authenticateToken(req, res, next);
};

// Chatbot Templates & Flows
router.get('/templates', optionalAuth, chatbotController.getTemplates);
router.post('/flows/from-template', optionalAuth, chatbotController.createFlowFromTemplate);
router.get('/flows', optionalAuth, chatbotController.getFlows);
router.get('/flows/:flowId', optionalAuth, chatbotController.getFlow);
router.post('/flows', optionalAuth, chatbotController.createFlow);
router.post('/flows/:flowId/draft', optionalAuth, chatbotController.saveDraft);
router.post('/flows/:flowId/publish', optionalAuth, chatbotController.publishFlow);
router.post('/flows/:flowId/duplicate', optionalAuth, chatbotController.duplicateFlow);
router.patch('/flows/:flowId/status', optionalAuth, chatbotController.updateFlowStatus);
router.delete('/flows/:flowId', optionalAuth, chatbotController.deleteFlow);

// Settings
router.get('/settings', optionalAuth, chatbotController.getSettings);
router.post('/settings', optionalAuth, chatbotController.updateSettings);

// Helpers
router.get('/node-types', optionalAuth, chatbotController.getNodeTypes);

// Products & Catalog API
router.get('/products', optionalAuth, chatbotController.getProducts);
router.post('/products', optionalAuth, chatbotController.createProduct);
router.post('/products/import', optionalAuth, chatbotController.importProducts);
router.put('/products/:id', optionalAuth, chatbotController.updateProduct);
router.delete('/products/:id', optionalAuth, chatbotController.deleteProduct);

// Categories API
router.get('/categories', optionalAuth, chatbotController.getCategories);
router.post('/categories', optionalAuth, chatbotController.createCategory);
router.delete('/categories/:id', optionalAuth, chatbotController.deleteCategory);

// Media Library & Storage API
router.get('/media', optionalAuth, chatbotController.getMedia);
router.post('/media/upload', optionalAuth, upload.any(), chatbotController.uploadMedia);
router.delete('/media/:id', optionalAuth, chatbotController.deleteMedia);
// Human Handoff & Session Control API
router.get('/sessions/human-needed', optionalAuth, chatbotController.getPendingHumanAlerts);
router.post('/sessions/:sessionId/retrigger', optionalAuth, chatbotController.retriggerFlowSession);
router.post('/sessions/:sessionId/takeover', optionalAuth, chatbotController.takeoverFlowSession);
router.post('/sessions/retrigger', optionalAuth, chatbotController.retriggerFlowSession);
router.post('/sessions/takeover', optionalAuth, chatbotController.takeoverFlowSession);
router.post('/sessions/resolve-handoff', optionalAuth, chatbotController.resolveHandoffSession);
router.post('/sessions/:sessionId/resolve', optionalAuth, chatbotController.resolveHandoffSession);

module.exports = router;
