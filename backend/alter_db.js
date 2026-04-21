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
        console.log('Altering database...');
        
        // Add score column if not exists
        await pool.query(`
            ALTER TABLE leads 
            ADD COLUMN IF NOT EXISTS score ENUM('HOT', WARM, 'COLD') DEFAULT 'COLD' AFTER status
        `).catch(e => console.log('Leads alter skipped or column exists'));

        // Ensure orders table is ready for conversion
        await pool.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS order_source ENUM('lead', 'dealer') DEFAULT 'dealer' AFTER order_id
        `).catch(e => console.log('Orders source alter skipped'));

        await pool.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS lead_id INT NULL AFTER order_source
        `).catch(e => console.log('Orders lead_id alter skipped'));

        
        console.log('Database altered successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error altering database:', err);
        process.exit(1);
    }
}

run();
