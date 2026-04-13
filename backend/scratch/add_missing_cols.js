const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Migrating leads table with additional columns...');

    try {
        // Add score
        await connection.query(`
            ALTER TABLE leads 
            ADD COLUMN IF NOT EXISTS score ENUM('hot', 'warm', 'cold') DEFAULT 'cold',
            ADD COLUMN IF NOT EXISTS next_followup_date DATETIME NULL,
            ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(255) NULL,
            ADD COLUMN IF NOT EXISTS lost_notes TEXT NULL
        `);
        console.log('✅ Columns added successfully.');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await connection.end();
    }
}

migrate();
