require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });
    await conn.execute("INSERT INTO roles (name, description) VALUES ('whatsapp_manager', 'Manage WhatsApp chat and analytics') ON DUPLICATE KEY UPDATE description=VALUES(description);");
    console.log('Role inserted');
    conn.end();
}
run();
