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
    keepAliveInitialDelay: 5000,
    maxIdle: connectionLimit,
    idleTimeout: 10000, // Proactively close idle connections after 10s (below Hostinger server timeouts)
    timezone: '+00:00'
});

// Helper to identify transient network / connection timeout errors
function isRetryableDbError(err) {
    if (!err) return false;
    const code = err.code || '';
    const msg = err.message || '';
    return (
        code === 'ECONNRESET' ||
        code === 'PROTOCOL_CONNECTION_LOST' ||
        code === 'ETIMEDOUT' ||
        code === 'EPIPE' ||
        code === 'ER_USER_LIMIT_REACHED' ||
        code === 'ER_TOO_MANY_USER_CONNECTIONS' ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('PROTOCOL_CONNECTION_LOST') ||
        msg.includes('ECONNRESET') ||
        msg.includes('max_user_connections') ||
        msg.includes('user_connections') ||
        msg.includes('too many connections')
    );
}

// Intercept connection errors to prevent ECONNRESET/PROTOCOL_CONNECTION_LOST in pool
pool.on('connection', (connection) => {
    connection.on('error', (err) => {
        if (isRetryableDbError(err)) {
            console.warn('[DB] Connection socket error in pool, destroying socket:', err.message);
            connection.destroy();
        }
    });
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Wrap execute, query, and getConnection to auto-retry once on connection resets/timeouts
const originalQuery = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);
const originalGetConnection = pool.getConnection.bind(pool);

pool.query = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await originalQuery(...args);
        } catch (err) {
            lastErr = err;
            if (isRetryableDbError(err) && attempt < 3) {
                console.warn(`[DB] Query failed (attempt ${attempt}/3) due to connection error (${err.code || err.message}). Retrying in ${300 * attempt}ms...`);
                await delay(300 * attempt);
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
};

pool.execute = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await originalExecute(...args);
        } catch (err) {
            lastErr = err;
            if (isRetryableDbError(err) && attempt < 3) {
                console.warn(`[DB] Execute failed (attempt ${attempt}/3) due to connection error (${err.code || err.message}). Retrying in ${300 * attempt}ms...`);
                await delay(300 * attempt);
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
};

pool.getConnection = async function (...args) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await originalGetConnection(...args);
        } catch (err) {
            lastErr = err;
            if (isRetryableDbError(err) && attempt < 3) {
                console.warn(`[DB] getConnection failed (attempt ${attempt}/3) due to connection error (${err.code || err.message}). Retrying in ${300 * attempt}ms...`);
                await delay(300 * attempt);
            } else {
                throw err;
            }
        }
    }
    throw lastErr;
};

// Periodic Database Heartbeat (ping every 15s) to prevent Hostinger idle socket drops (wait_timeout)
setInterval(async () => {
    try {
        await originalQuery('SELECT 1');
    } catch (err) {
        // Silent catch for heartbeat
    }
}, 15000);

module.exports = pool;
