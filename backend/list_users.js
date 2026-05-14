const mysql = require('mysql2/promise');
require('dotenv').config();

async function listUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sgb_crm'
    });

    const [rows] = await connection.query('SELECT name, email FROM users');
    console.log(JSON.stringify(rows, null, 2));
    await connection.end();
}

listUsers();
