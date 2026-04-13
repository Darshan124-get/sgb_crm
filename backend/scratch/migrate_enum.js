const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../.env' });

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('Migrating leads status enum...');
        await pool.query(`ALTER TABLE leads MODIFY COLUMN status ENUM('new', 'assigned', 'contacted', 'callback', 'followup', 'interested', 'negotiation', 'advance_paid', 'converted', 'lost', 'not_interested', 'dealer') DEFAULT 'new'`);
        console.log('Migration successful!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
