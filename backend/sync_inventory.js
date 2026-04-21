const mysql = require('mysql2/promise');
require('dotenv').config();

async function sync() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'admin_db'
    });

    try {
        console.log('Synchronizing inventory records...');
        
        // 1. Get all products
        const [products] = await pool.query('SELECT product_id FROM products');
        console.log(`Found ${products.length} products.`);

        // 2. Ensure each product has an inventory record
        for (const p of products) {
            await pool.query(`
                INSERT IGNORE INTO inventory (product_id, current_stock, reserved_stock)
                VALUES (?, 100, 0)
            `, [p.product_id]);
        }

        console.log('Inventory synchronization complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error syncing inventory:', err);
        process.exit(1);
    }
}

sync();
