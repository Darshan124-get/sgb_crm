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
        console.log('Updating products table schema...');
        
        // Add new columns to products table
        await pool.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS image_url VARCHAR(500) AFTER dealer_price,
            ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive') DEFAULT 'active' AFTER min_stock_alert,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
        `);
        
        console.log('Products table updated successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error updating products table:', err);
        process.exit(1);
    }
}

run();
