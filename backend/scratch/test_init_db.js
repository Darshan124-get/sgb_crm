const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runTest() {
    console.log('Testing init_db.sql execution...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'u581231108_SGB_CRM_test1',
        port: parseInt(process.env.DB_PORT) || 3306,
        multipleStatements: true
    });

    try {
        const sqlPath = path.join(__dirname, '../init_db.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await connection.query(sql);
        console.log('✅ init_db.sql executed successfully without any errors!');
    } catch (err) {
        console.error('❌ init_db.sql execution failed:', err);
    } finally {
        await connection.end();
    }
}

runTest();
