const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../../.env' });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 15, 
    queueLimit: 0,
    connectTimeout: 20000, 
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    maxIdle: 10,
    idleTimeout: 10000, // Proactively close idle connections after 10s (below Hostinger server timeouts)
    timezone: '+00:00'
});

// Intercept connection errors to prevent ECONNRESET/PROTOCOL_CONNECTION_LOST in pool
pool.on('connection', (connection) => {
    connection.on('error', (err) => {
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
            console.warn('[DB] Connection lost/reset in pool, destroying connection socket:', err.message);
            connection.destroy();
        }
    });
});

// Wrap execute, query, and getConnection to auto-retry once on connection resets
const originalQuery = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);
const originalGetConnection = pool.getConnection.bind(pool);

pool.query = async function (...args) {
    try {
        return await originalQuery(...args);
    } catch (err) {
        if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.warn(`[DB] Query failed due to connection reset (${err.code}). Retrying query...`);
            return await originalQuery(...args);
        }
        throw err;
    }
};

pool.execute = async function (...args) {
    try {
        return await originalExecute(...args);
    } catch (err) {
        if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.warn(`[DB] Execute failed due to connection reset (${err.code}). Retrying execute...`);
            return await originalExecute(...args);
        }
        throw err;
    }
};

pool.getConnection = async function (...args) {
    try {
        return await originalGetConnection(...args);
    } catch (err) {
        if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.warn(`[DB] getConnection failed due to connection reset (${err.code}). Retrying...`);
            return await originalGetConnection(...args);
        }
        throw err;
    }
};

module.exports = pool;
