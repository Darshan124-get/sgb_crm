/**
 * monitor.middleware.js
 * High-performance Express middleware for real-time telemetry capture.
 * Captures caller identity, endpoints, execution time, error status, and payload snippets.
 * ZERO DATABASE QUERIES.
 */

const jwt = require('jsonwebtoken');
const monitorService = require('../services/monitor.service');

// Fast non-sensitive payload sanitizer
function sanitizePayload(data) {
    if (!data) return null;
    if (typeof data !== 'object') return String(data).substring(0, 200);

    const safe = {};
    const forbiddenKeys = ['password', 'token', 'authorization', 'secret', 'apiKey', 'access_token', 'refresh_token', 'media_data'];

    for (const key of Object.keys(data)) {
        if (forbiddenKeys.some(fk => key.toLowerCase().includes(fk))) {
            safe[key] = '[REDACTED]';
        } else if (typeof data[key] === 'object' && data[key] !== null) {
            safe[key] = Array.isArray(data[key]) 
                ? `[Array (${data[key].length} items)]` 
                : '[Object]';
        } else {
            const valStr = String(data[key]);
            safe[key] = valStr.length > 250 ? valStr.substring(0, 250) + '...' : data[key];
        }
    }
    return safe;
}

// Categorize request by functional business module
function categorizeAction(url, method) {
    const u = (url || '').toLowerCase();
    
    if (u.includes('/telephony') || u.includes('/acefone') || u.includes('/click-to-call') || u.includes('/cdr')) {
        return { category: 'Telephony / Calling', icon: 'phone', badge: 'telephony' };
    }
    if (u.includes('/leads') || u.includes('/campaigns')) {
        return { category: 'Leads & CRM', icon: 'users', badge: 'leads' };
    }
    if (u.includes('/orders') || u.includes('/logistics') || u.includes('/shipping')) {
        return { category: 'Orders & Logistics', icon: 'package', badge: 'orders' };
    }
    if (u.includes('/billing') || u.includes('/zoho') || u.includes('/invoices')) {
        return { category: 'Billing & Accounts', icon: 'file-text', badge: 'billing' };
    }
    if (u.includes('/dealers')) {
        return { category: 'Dealer Network', icon: 'briefcase', badge: 'dealers' };
    }
    if (u.includes('/inventory') || u.includes('/products') || u.includes('/categories')) {
        return { category: 'Products & Stock', icon: 'box', badge: 'inventory' };
    }
    if (u.includes('/whatsapp') || u.includes('/chatbot')) {
        return { category: 'Chatbot & WhatsApp', icon: 'message-circle', badge: 'messaging' };
    }
    if (u.includes('/webhook')) {
        return { category: 'External Webhook', icon: 'zap', badge: 'webhook' };
    }
    if (u.includes('/auth') || u.includes('/users') || u.includes('/departments')) {
        return { category: 'Auth & Access', icon: 'shield', badge: 'auth' };
    }
    return { category: 'General API', icon: 'activity', badge: 'general' };
}

// Extract caller details without database queries
function extractCaller(req) {
    let user = {
        id: null,
        name: 'Guest / Public',
        role: 'guest',
        email: null
    };

    try {
        const authHeader = req.headers['authorization'];
        const token = (authHeader && authHeader.split(' ')[1]) || req.query?.token;

        if (token) {
            // Fast decode without verification to eliminate latency/dependency
            const decoded = jwt.decode(token);
            if (decoded) {
                user.id = decoded.id || decoded.user_id || decoded.userId || null;
                user.name = decoded.name || decoded.username || (decoded.role ? `${decoded.role} #${decoded.id}` : 'Authenticated User');
                user.role = (decoded.role || 'user').toLowerCase();
                user.email = decoded.email || null;
            }
        } else if (req.headers['x-api-key'] || req.headers['user-agent']?.includes('Acefone') || req.path?.includes('webhook')) {
            user.name = 'External Webhook';
            user.role = 'webhook';
        }
    } catch (e) {
        // Safe fallback
    }

    return user;
}

module.exports = function telemetryMiddleware(req, res, next) {
    // 1. Skip telemetry internal routes, static assets, and pre-flight CORS
    if (
        req.method === 'OPTIONS' ||
        req.path.startsWith('/api/monitoring') ||
        req.path.endsWith('.js') ||
        req.path.endsWith('.css') ||
        req.path.endsWith('.png') ||
        req.path.endsWith('.jpg') ||
        req.path.endsWith('.ico') ||
        req.path.endsWith('.svg') ||
        req.path.endsWith('.woff2')
    ) {
        return next();
    }

    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const actionMeta = categorizeAction(req.originalUrl || req.url, req.method);
    const caller = extractCaller(req);

    // Capture response data
    let responseSnippet = null;
    let errorMessage = null;

    // Capture original methods
    const originalJson = res.json;
    const originalSend = res.send;

    res.json = function(body) {
        if (body && typeof body === 'object') {
            if (body.error || body.message) {
                errorMessage = body.error || body.message;
            }
            try {
                const bodyStr = JSON.stringify(body);
                responseSnippet = bodyStr.length > 300 ? bodyStr.substring(0, 300) + '...' : bodyStr;
            } catch (err) {}
        }
        return originalJson.apply(this, arguments);
    };

    res.send = function(body) {
        if (typeof body === 'string') {
            responseSnippet = body.length > 200 ? body.substring(0, 200) + '...' : body;
            if (res.statusCode >= 400 && !errorMessage) {
                errorMessage = responseSnippet;
            }
        }
        return originalSend.apply(this, arguments);
    };

    // When the request finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // If the route set req.user during execution, prioritize it over decoded token
        if (req.user && req.user.id) {
            caller.id = req.user.id;
            caller.name = req.user.name || caller.name;
            caller.role = (req.user.role || caller.role).toLowerCase();
            caller.email = req.user.email || caller.email;
        }

        const event = {
            id: requestId,
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.originalUrl || req.url,
            path: req.path,
            statusCode,
            duration,
            actionCategory: actionMeta.category,
            badge: actionMeta.badge,
            icon: actionMeta.icon,
            user: caller,
            ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
            query: Object.keys(req.query || {}).length ? req.query : null,
            payload: sanitizePayload(req.body),
            errorMessage: errorMessage,
            responseSnippet: responseSnippet
        };

        monitorService.recordEvent(event);
    });

    next();
};
