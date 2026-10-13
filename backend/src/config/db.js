const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../../.env' });

const connectionLimit = process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 15;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: connectionLimit,
    queueLimit: 0,
    connectTimeout: 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 1000,
    maxIdle: Math.min(connectionLimit, 2), // Keep max 2 warm idle connections to avoid keeping dead TCP sockets in pool on Hostinger
    idleTimeout: 15000, // Gracefully close client-side idle connections after 15s before Hostinger firewall forcibly resets TCP sockets
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

// Wrap execute, query, and getConnection to auto-retry on connection resets/timeouts
const originalQuery = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);
const originalGetConnection = pool.getConnection.bind(pool);

pool.query = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await originalQuery(...args);
        } catch (err) {
            lastErr = err;
            if (isRetryableDbError(err) && attempt < MAX_RETRIES) {
                console.warn(`[DB] Query failed (attempt ${attempt}/${MAX_RETRIES}) due to connection error (${err.code || err.message}). Retrying in ${200 * attempt}ms...`);
                await delay(200 * attempt);
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
};

pool.execute = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await originalExecute(...args);
        } catch (err) {
            lastErr = err;
            if (isRetryableDbError(err) && attempt < MAX_RETRIES) {
                console.warn(`[DB] Execute failed (attempt ${attempt}/${MAX_RETRIES}) due to connection error (${err.code || err.message}). Retrying in ${200 * attempt}ms...`);
                await delay(200 * attempt);
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
};

pool.getConnection = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const conn = await originalGetConnection(...args);
            // Validate connection with a ping before returning it to caller
            try {
                await conn.ping();
                return conn;
            } catch (pingErr) {
                try { conn.destroy(); } catch (e) {}
                if (isRetryableDbError(pingErr) && attempt < MAX_RETRIES) {
                    console.warn(`[DB] Acquired connection failed ping (attempt ${attempt}/${MAX_RETRIES}). Retrying...`);
                    await delay(200 * attempt);
                    continue;
                }
                throw pingErr;
            }
        } catch (err) {
            lastErr = err;
            if (isRetryableDbError(err) && attempt < MAX_RETRIES) {
                console.warn(`[DB] getConnection failed (attempt ${attempt}/${MAX_RETRIES}) due to connection error (${err.code || err.message}). Retrying in ${200 * attempt}ms...`);
                await delay(200 * attempt);
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
};

// Periodic Database Heartbeat (ping every 10s) to keep active connection alive on Hostinger (wait_timeout)
setInterval(async () => {
    try {
        await originalQuery('SELECT 1');
    } catch (err) {
        // Silent catch for heartbeat
    }
}, 10000);

module.exports = pool;
