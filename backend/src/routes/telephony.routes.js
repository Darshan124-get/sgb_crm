const express = require('express');
const router = express.Router();
const TelephonyController = require('../controllers/telephony.controller');
const { authenticateToken, isAdmin } = require('../middleware/auth.middleware');

// Configuration & Connection (Admin Only)
router.get('/integration', authenticateToken, isAdmin, TelephonyController.getIntegration);
router.post('/credentials', authenticateToken, isAdmin, TelephonyController.saveCredentials);
router.post('/test-connection', authenticateToken, isAdmin, TelephonyController.testConnection);

// Agents & DIDs (Admin Only)
router.get('/crm-users', authenticateToken, isAdmin, TelephonyController.getCrmUsers);
router.get('/acefone-agents', authenticateToken, isAdmin, TelephonyController.getAcefoneAgents);
router.get('/agents', authenticateToken, isAdmin, TelephonyController.getAgents);
router.post('/agents/map', authenticateToken, isAdmin, TelephonyController.mapAgent);
router.delete('/agents/:id', authenticateToken, isAdmin, TelephonyController.deleteAgent);
router.get('/dids', authenticateToken, isAdmin, TelephonyController.getDids);
router.post('/dids/sync', authenticateToken, isAdmin, TelephonyController.syncDids);
router.post('/dids/save', authenticateToken, isAdmin, TelephonyController.saveDid);
router.delete('/dids/:id', authenticateToken, isAdmin, TelephonyController.deleteDid);

// Calls & Click to Call (Staff Click-to-call & Monitoring)
router.post('/click-to-call', authenticateToken, TelephonyController.initiateClickToCall);
router.get('/recents', authenticateToken, TelephonyController.getRecentCalls);
router.get('/calls/:callId/status', authenticateToken, TelephonyController.getCallStatus);
router.get('/calls/:callId', authenticateToken, TelephonyController.getCallDetails);
router.post('/calls/:callId/hangup', authenticateToken, TelephonyController.hangupCall);
router.get('/calls', authenticateToken, TelephonyController.getCallLogs);
router.get('/cdr', authenticateToken, TelephonyController.getCallLogs);
router.post('/cdr/sync', authenticateToken, isAdmin, TelephonyController.syncCdr);
router.get('/performance', authenticateToken, isAdmin, TelephonyController.getPerformance);

// Inbound Webhook Endpoint
router.post('/webhook', TelephonyController.handleWebhook);

module.exports = router;

