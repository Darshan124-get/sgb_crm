const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../../.env' });

async function testConnection() {
    console.log('Testing connection to:', process.env.DB_HOST);
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });
        
        console.log('✅ Successfully connected to the database!');
        
        const [columns] = await connection.query('SHOW COLUMNS FROM dealers');
        const columnNames = columns.map(c => c.Field);
        console.log('Available columns in "dealers" table:', columnNames.join(', '));
        
        const required = ['alternate_number', 'status', 'updated_at'];
        const missing = required.filter(col => !columnNames.includes(col));
        
        if (missing.length > 0) {
            console.log('❌ Missing required columns:', missing.join(', '));
            console.log('👉 Please run the migration script: backend/update_dealers_schema.js');
        } else {
            console.log('✅ All required columns are present.');
        }
        
        await connection.end();
    } catch (err) {
        console.error('❌ Database connection failed!');
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);
        
        if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('👉 Tip: Check if your IP is whitelisted in Hostinger Remote MySQL settings.');
        }
    }
}

testConnection();
