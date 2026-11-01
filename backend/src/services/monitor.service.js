/**
 * monitor.service.js
 * In-Memory Real-Time Telemetry & Full System Monitoring Service
 * 
 * ZERO DATABASE STORAGE - All logs & metrics are kept purely in RAM with an auto-pruning
 * ring buffer and broadcast in real-time via Server-Sent Events (SSE).
 */

const os = require('os');
let pool = null;
try {
    pool = require('../config/db');
} catch (e) {}

class MonitorService {
    constructor() {
        this.MAX_EVENTS = 2000;
        this.MAX_ERRORS = 500;
        this.MAX_CONSOLE_LOGS = 1000;
        this.MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours max retention

        // In-memory circular stores
        this.events = [];
        this.errors = [];
        this.consoleLogs = [];

        // Aggregated counters
        this.stats = {
            totalRequests: 0,
            status2xx: 0,
            status3xx: 0,
            status4xx: 0,
            status5xx: 0,
            totalLatencyMs: 0,
            avgLatencyMs: 0,
            startTime: Date.now()
        };

        // Track active callers seen in last 15 minutes
        this.activeCallers = new Map();

        // Connected SSE clients
        this.clients = new Set();

        // Event loop lag tracking
        this.eventLoopLagMs = 0;
        this.measureEventLoop();

        // Hook console stdout/stderr safely
        this.hookConsole();

        // Setup periodic cleanup of old items (every 5 minutes)
        setInterval(() => this.pruneOldData(), 5 * 60 * 1000);
    }

    /**
     * Intercept console logs non-destructively for the Cyber Terminal
     */
    hookConsole() {
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;

        const recordConsole = (level, args) => {
            try {
                const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
                // Exclude noisy SSE keepalive or telemetry self-logs
                if (text.includes('GET /api/monitoring') || text.includes('keepalive')) return;

                const logItem = {
                    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    timestamp: new Date().toISOString(),
                    level,
                    text: text.length > 500 ? text.substring(0, 500) + '...' : text
                };

                this.consoleLogs.unshift(logItem);
                if (this.consoleLogs.length > this.MAX_CONSOLE_LOGS) {
                    this.consoleLogs.pop();
                }

                this.broadcast('console_log', logItem);
            } catch (err) {}
        };

        console.log = (...args) => {
            origLog.apply(console, args);
            recordConsole('info', args);
        };

        console.warn = (...args) => {
            origWarn.apply(console, args);
            recordConsole('warn', args);
        };

        console.error = (...args) => {
            origError.apply(console, args);
            recordConsole('error', args);
        };
    }

    /**
     * Periodically measure event loop delay (lag in ms)
     */
    measureEventLoop() {
        setInterval(() => {
            const start = Date.now();
            setImmediate(() => {
                this.eventLoopLagMs = Math.max(0, Date.now() - start);
            });
        }, 3000);
    }

    /**
     * Add an SSE client
     */
    addClient(res) {
        this.clients.add(res);

        res.write(`event: connected\ndata: ${JSON.stringify({ 
            message: 'Connected to CRM Cyber Telemetry Stream', 
            timestamp: new Date().toISOString(),
            subscribers: this.clients.size 
        })}\n\n`);

        res.on('close', () => {
            this.clients.delete(res);
        });
    }

    /**
     * Broadcast an event to all connected SSE clients
     */
    broadcast(eventType, payload) {
        if (this.clients.size === 0) return;
        const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
        for (const client of this.clients) {
            try {
                client.write(data);
            } catch (err) {
                this.clients.delete(client);
            }
        }
    }

    /**
     * Record an API request event
     */
    recordEvent(event) {
        this.stats.totalRequests++;
        this.stats.totalLatencyMs += (event.duration || 0);
        this.stats.avgLatencyMs = Math.round(this.stats.totalLatencyMs / this.stats.totalRequests);

        const status = event.statusCode || 200;
        if (status >= 200 && status < 300) this.stats.status2xx++;
        else if (status >= 300 && status < 400) this.stats.status3xx++;
        else if (status >= 400 && status < 500) this.stats.status4xx++;
        else if (status >= 500) this.stats.status5xx++;

        // Track caller
        if (event.user && event.user.id) {
            this.activeCallers.set(event.user.id, {
                ...event.user,
                lastSeen: Date.now()
            });
        }

        // Add to ring buffer
        this.events.unshift(event);
        if (this.events.length > this.MAX_EVENTS) {
            this.events.pop();
        }

        // If error (4xx or 5xx), add to error buffer
        if (status >= 400) {
            this.recordError({
                id: event.id,
                timestamp: event.timestamp,
                method: event.method,
                url: event.url,
                statusCode: event.statusCode,
                duration: event.duration,
                user: event.user,
                actionCategory: event.actionCategory,
                errorMessage: event.errorMessage || (status >= 500 ? 'Internal Server Error' : 'Client Error'),
                stack: event.stack || null,
                query: event.query,
                payload: event.payload,
                responseSnippet: event.responseSnippet
            });
        }

        // Stream event live to dashboard
        this.broadcast('api_event', event);
    }

    /**
     * Record an error / exception
     */
    recordError(errorObj) {
        const errorRecord = {
            id: errorObj.id || `err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: errorObj.timestamp || new Date().toISOString(),
            ...errorObj
        };

        this.errors.unshift(errorRecord);
        if (this.errors.length > this.MAX_ERRORS) {
            this.errors.pop();
        }

        this.broadcast('error_event', errorRecord);
    }

    /**
     * Clear all in-memory cache
     */
    clearCache() {
        this.events = [];
        this.errors = [];
        this.consoleLogs = [];
        this.stats = {
            totalRequests: 0,
            status2xx: 0,
            status3xx: 0,
            status4xx: 0,
            status5xx: 0,
            totalLatencyMs: 0,
            avgLatencyMs: 0,
            startTime: Date.now()
        };
        this.activeCallers.clear();

        this.broadcast('cache_cleared', { 
            message: 'Cache was cleared by user', 
            timestamp: new Date().toISOString() 
        });

        return { success: true, message: 'In-memory monitoring cache cleared' };
    }

    /**
     * Prune items older than retention window
     */
    pruneOldData() {
        const cutoff = Date.now() - this.MAX_AGE_MS;
        this.events = this.events.filter(e => new Date(e.timestamp).getTime() > cutoff);
        this.errors = this.errors.filter(e => new Date(e.timestamp).getTime() > cutoff);
        this.consoleLogs = this.consoleLogs.filter(e => new Date(e.timestamp).getTime() > cutoff);

        const activeCutoff = Date.now() - (15 * 60 * 1000);
        for (const [key, caller] of this.activeCallers.entries()) {
            if (caller.lastSeen < activeCutoff) {
                this.activeCallers.delete(key);
            }
        }
    }

    /**
     * Deep Server Health Check (CPU, Memory, DB Ping, Event Loop Lag)
     * Zero DB storage - performs an in-memory latency check without modifying data.
     */
    async getDeepHealth() {
        const mem = process.memoryUsage();
        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        const cpus = os.cpus();

        // 1. Database Ping Check (read-only SELECT 1)
        let dbStatus = {
            connected: false,
            latencyMs: null,
            message: 'Database pool not initialized'
        };

        if (pool && typeof pool.query === 'function') {
            const dbStart = Date.now();
            try {
                await pool.query('SELECT 1');
                dbStatus = {
                    connected: true,
                    latencyMs: Date.now() - dbStart,
                    message: 'Connected & Responsive'
                };
            } catch (err) {
                dbStatus = {
                    connected: false,
                    latencyMs: Date.now() - dbStart,
                    message: `DB Error: ${err.message}`
                };
            }
        }

        // 2. Memory Percentages
        const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
        const heapUsagePct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
        const rssMB = Math.round(mem.rss / 1024 / 1024);
        const sysUsedMemPct = Math.round(((totalMem - freeMem) / totalMem) * 100);

        // 3. Overall Vitals Status
        let overallStatus = 'HEALTHY';
        if (!dbStatus.connected || this.stats.status5xx > 10 || this.eventLoopLagMs > 100) {
            overallStatus = 'DEGRADED';
        }
        if (!dbStatus.connected && this.stats.status5xx > 20) {
            overallStatus = 'CRITICAL';
        }

        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            uptimeFormatted: this.formatUptime(process.uptime()),
            db: dbStatus,
            eventLoop: {
                lagMs: this.eventLoopLagMs,
                status: this.eventLoopLagMs < 30 ? 'OPTIMAL' : (this.eventLoopLagMs < 80 ? 'MODERATE' : 'HIGH_LATENCY')
            },
            memory: {
                heapUsedMB,
                heapTotalMB,
                heapUsagePct,
                rssMB,
                systemFreeMB: Math.round(freeMem / 1024 / 1024),
                systemTotalMB: Math.round(totalMem / 1024 / 1024),
                systemUsagePct: sysUsedMemPct
            },
            cpu: {
                cores: cpus.length,
                model: cpus[0]?.model || 'Generic CPU',
                speedMHz: cpus[0]?.speed || 0,
                loadAvg: os.loadavg ? os.loadavg() : [0, 0, 0]
            },
            process: {
                nodeVersion: process.version,
                pid: process.pid,
                platform: process.platform,
                arch: process.arch
            },
            activeSSEConnections: this.clients.size,
            bufferStatus: {
                eventsInMemory: this.events.length,
                errorsInMemory: this.errors.length,
                consoleLogsInMemory: this.consoleLogs.length,
                maxEventsLimit: this.MAX_EVENTS,
                maxErrorsLimit: this.MAX_ERRORS
            }
        };
    }

    formatUptime(seconds) {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        parts.push(`${s}s`);
        return parts.join(' ');
    }

    /**
     * Returns full snapshot for initial dashboard load
     */
    async getSnapshot() {
        const health = await this.getDeepHealth();
        return {
            stats: {
                ...this.stats,
                errorRatePercent: this.stats.totalRequests > 0 
                    ? (( (this.stats.status4xx + this.stats.status5xx) / this.stats.totalRequests) * 100).toFixed(1)
                    : 0,
                activeCallersCount: this.activeCallers.size
            },
            activeCallers: Array.from(this.activeCallers.values()),
            recentEvents: this.events.slice(0, 200),
            recentErrors: this.errors.slice(0, 100),
            recentConsoleLogs: this.consoleLogs.slice(0, 100),
            system: health
        };
    }
}

// Global Singleton Instance
const monitorService = new MonitorService();

module.exports = monitorService;
