const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../../.env' });

const connectionLimit = process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 10;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: connectionLimit,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    maxIdle: Math.min(connectionLimit, 2), // Keep max 2 warm idle connections
    idleTimeout: 8000, // Close idle connections after 8s, safely below Hostinger's 20s wait_timeout
    timezone: '+00:00'
});

// Helper to identify transient network / connection timeout errors
function isRetryableDbError(err) {
    if (!err) return false;
    const code = err.code || '';
    const msg = err.message || '';
    const errStr = String(err);
    return (
        code === 'ECONNRESET' ||
        code === 'PROTOCOL_CONNECTION_LOST' ||
        code === 'ETIMEDOUT' ||
        code === 'EPIPE' ||
        code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED' ||
        code === 'ER_USER_LIMIT_REACHED' ||
        code === 'ER_TOO_MANY_USER_CONNECTIONS' ||
        code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR' ||
        code === 'PROTOCOL_PACKETS_OUT_OF_ORDER' ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('PROTOCOL_CONNECTION_LOST') ||
        msg.includes('ECONNRESET') ||
        msg.includes('Connection lost') ||
        msg.includes('read ECONNRESET') ||
        msg.includes('write EPIPE') ||
        msg.includes('max_user_connections') ||
        msg.includes('user_connections') ||
        msg.includes('too many connections') ||
        errStr.includes('Connection lost') ||
        errStr.includes('ECONNRESET') ||
        errStr.includes('PROTOCOL_CONNECTION_LOST')
    );
}

// Intercept connection errors to destroy bad sockets from pool
pool.on('connection', (connection) => {
    connection.on('error', (err) => {
        if (isRetryableDbError(err)) {
            try { connection.destroy(); } catch (e) {}
        }
    });
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 5;

// Save original references
const originalGetConnection = pool.getConnection.bind(pool);

pool.query = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let conn;
        try {
            conn = await originalGetConnection();
            // Validate connection if it has been idle for more than 5s
            const now = Date.now();
            if (conn._lastUsed && (now - conn._lastUsed > 5000)) {
                try {
                    await conn.ping();
                } catch (pingErr) {
                    try { conn.destroy(); } catch (e) {}
                    conn = null;
                    throw pingErr;
                }
            }
            const result = await conn.query(...args);
            conn._lastUsed = Date.now();
            return result;
        } catch (err) {
            lastErr = err;
            if (conn) {
                try { conn.destroy(); } catch (e) {}
                conn = null;
            }
            if (isRetryableDbError(err) && attempt < MAX_RETRIES) {
                console.warn(`[DB] Query failed (attempt ${attempt}/${MAX_RETRIES}) due to connection error (${err.code || err.message}). Retrying in ${100 * attempt}ms...`);
                await delay(100 * attempt);
            } else {
                throw err;
            }
        } finally {
            if (conn) {
                try { conn.release(); } catch (e) {}
            }
        }
    }
    throw lastErr;
};

pool.execute = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let conn;
        try {
            conn = await originalGetConnection();
            // Validate connection if it has been idle for more than 5s
            const now = Date.now();
            if (conn._lastUsed && (now - conn._lastUsed > 5000)) {
                try {
                    await conn.ping();
                } catch (pingErr) {
                    try { conn.destroy(); } catch (e) {}
                    conn = null;
                    throw pingErr;
                }
            }
            const result = await conn.execute(...args);
            conn._lastUsed = Date.now();
            return result;
        } catch (err) {
            lastErr = err;
            if (conn) {
                try { conn.destroy(); } catch (e) {}
                conn = null;
            }
            if (isRetryableDbError(err) && attempt < MAX_RETRIES) {
                console.warn(`[DB] Execute failed (attempt ${attempt}/${MAX_RETRIES}) due to connection error (${err.code || err.message}). Retrying in ${100 * attempt}ms...`);
                await delay(100 * attempt);
            } else {
                throw err;
            }
        } finally {
            if (conn) {
                try { conn.release(); } catch (e) {}
            }
        }
    }
    throw lastErr;
};

pool.getConnection = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        let conn;
        try {
            conn = await originalGetConnection(...args);
            try {
                await conn.ping();
                conn._lastUsed = Date.now();
                return conn;
            } catch (pingErr) {
                try { conn.destroy(); } catch (e) {}
                conn = null;
                if (isRetryableDbError(pingErr) && attempt < MAX_RETRIES) {
                    console.warn(`[DB] Acquired connection failed ping (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${100 * attempt}ms...`);
                    await delay(100 * attempt);
                    continue;
                }
                throw pingErr;
            }
        } catch (err) {
            lastErr = err;
            if (conn) {
                try { conn.destroy(); } catch (e) {}
                conn = null;
            }
            if (isRetryableDbError(err) && attempt < MAX_RETRIES) {
                console.warn(`[DB] getConnection failed (attempt ${attempt}/${MAX_RETRIES}) due to connection error (${err.code || err.message}). Retrying in ${100 * attempt}ms...`);
                await delay(100 * attempt);
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
};

// Periodic Database Heartbeat (ping every 5s) to keep warm connection alive on Hostinger
setInterval(async () => {
    try {
        await pool.query('SELECT 1');
    } catch (err) {
        // Silent catch for heartbeat
    }
}, 5000);

module.exports = pool;
