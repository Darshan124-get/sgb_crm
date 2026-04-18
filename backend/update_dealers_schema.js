const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'admin_db'
    });

    try {
        console.log('Updating dealers table schema...');
        
        // Add new columns to dealers table
        await pool.query(`
            ALTER TABLE dealers 
            ADD COLUMN IF NOT EXISTS alternate_number VARCHAR(20) AFTER phone,
            ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive') DEFAULT 'active' AFTER state,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
        `);
        
        console.log('Dealers table updated successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error updating dealers table:', err);
        process.exit(1);
    }
}

run();
