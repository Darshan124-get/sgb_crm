/**
 * monitor.routes.js
 * API routes for Developer Monitoring Dashboard
 * Provides Server-Sent Events (SSE), initial snapshots, and cache clearance.
 * ZERO DATABASE DEPENDENCY.
 */

const express = require('express');
const router = express.Router();
const monitorService = require('../services/monitor.service');

// 1. Server-Sent Events (SSE) Real-Time Stream
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    // Register SSE client
    monitorService.addClient(res);

    // Heartbeat every 25 seconds to keep connection alive through proxies
    const heartbeat = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
        } catch (e) {
            clearInterval(heartbeat);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
    });
});

// 2. Initial Snapshot (Returns current cache + system health)
router.get('/snapshot', async (req, res) => {
    try {
        const snapshot = await monitorService.getSnapshot();
        res.json(snapshot);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate snapshot', message: err.message });
    }
});

// 2b. Full Server Health Check Endpoint
router.get('/health', async (req, res) => {
    try {
        const health = await monitorService.getDeepHealth();
        res.json(health);
    } catch (err) {
        res.status(500).json({ error: 'Health check failed', message: err.message });
    }
});

// 2c. Server Console Logs Endpoint
router.get('/console', (req, res) => {
    res.json(monitorService.consoleLogs);
});

// 3. Clear In-Memory Cache
router.post('/clear', (req, res) => {
    const result = monitorService.clearCache();
    res.json(result);
});

// 4. Test Error Trigger (For Developer Dashboard Verification)
router.post('/test-error', (req, res) => {
    const errorType = req.body?.type || '500';
    if (errorType === '400') {
        const errorRecord = {
            id: `err_${Date.now()}`,
            timestamp: new Date().toISOString(),
            method: 'POST',
            url: '/api/leads/assign',
            statusCode: 400,
            duration: 24,
            errorMessage: 'Validation Error: lead_id and assigned_user_id are required fields',
            actionCategory: 'Leads & CRM',
            user: { id: 2, name: 'Admin User', role: 'admin' },
            payload: { notes: 'Bulk assignment without target telecaller' }
        };
        monitorService.recordError(errorRecord);
        return res.status(400).json({
            error: errorRecord.errorMessage,
            failedField: 'lead_id'
        });
    }

    if (errorType === 'crash') {
        // Record synthetic unhandled rejection
        monitorService.recordError({
            url: '/api/leads/assign (Simulated Crash)',
            method: 'POST',
            statusCode: 500,
            errorMessage: 'Unhandled Rejection: Connection lost to third-party telephonic gateway',
            stack: 'Error: Connection lost to third-party gateway\n    at TelephonyGateway.connect (/src/services/telephony.service.js:142:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)',
            user: { id: 99, name: 'Lead Manager Admin', role: 'admin' },
            actionCategory: 'Telephony / Calling'
        });
        return res.status(500).json({ error: 'Simulated Crash recorded in monitoring dashboard' });
    }

    const dbErrorRecord = {
        id: `err_${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: 'POST',
        url: '/api/inventory/reserve',
        statusCode: 500,
        duration: 10042,
        errorMessage: 'Database Timeout: Failed to acquire lock for inventory item #492 after 10000ms',
        stack: 'Error: ER_LOCK_WAIT_TIMEOUT: Lock wait timeout exceeded; try restarting transaction\n    at PromisePool.query (/node_modules/mysql2/promise.js:356:22)\n    at Object.reserveStock (/src/controllers/inventory.controller.js:88:19)',
        actionCategory: 'Products & Stock',
        user: { id: 14, name: 'Priya Sharma', role: 'telecaller' },
        payload: { product_id: 492, qty: 5 }
    };
    monitorService.recordError(dbErrorRecord);

    return res.status(500).json({
        error: dbErrorRecord.errorMessage,
        code: 'ER_LOCK_WAIT_TIMEOUT'
    });
});

// 5. Test Telecaller Action (For Developer Dashboard Verification)
router.post('/test-telecaller', (req, res) => {
    const telecallerName = req.body?.name || 'Priya Sharma';
    const action = req.body?.action || 'Click-to-Call Initiated';

    monitorService.recordEvent({
        id: `test_tele_${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: 'POST',
        url: '/api/telephony/click-to-call',
        path: '/api/telephony/click-to-call',
        statusCode: 200,
        duration: 38,
        actionCategory: 'Telephony / Calling',
        badge: 'telephony',
        icon: 'phone',
        user: { id: 14, name: telecallerName, role: 'telecaller', email: 'priya.sharma@sgb.com' },
        ip: '192.168.1.45',
        query: null,
        payload: { lead_id: 1042, phone: '+919876543210', action: action },
        errorMessage: null,
        responseSnippet: '{"success":true,"callId":"ACE_CALL_98231","status":"ringing"}'
    });

    res.json({ success: true, message: `Simulated telecaller event for ${telecallerName}` });
});

module.exports = router;
