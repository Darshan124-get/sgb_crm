const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'sgb_crm'
    });

    try {
        await pool.query("ALTER TABLE shipments MODIFY COLUMN status ENUM('shipped', 'in_transit', 'reached_destination', 'delivered', 'returned') DEFAULT 'shipped'");
        console.log('Status enum updated');
        
        try { await pool.query("ALTER TABLE shipments ADD COLUMN delivery_date DATETIME DEFAULT NULL"); } catch(e) { console.log('delivery_date exists'); }
        try { await pool.query("ALTER TABLE shipments ADD COLUMN check_received_date DATETIME DEFAULT NULL"); } catch(e) { console.log('check_received_date exists'); }
        
        console.log('Schema updated successfully');
    } catch(e) {
        console.error('Error:', e.message);
    }
    process.exit();
}
run();
