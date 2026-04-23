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
    idleTimeout: 60000 
});

module.exports = pool;
