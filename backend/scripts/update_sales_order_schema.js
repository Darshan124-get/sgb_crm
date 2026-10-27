const pool = require('../src/config/db');

async function updateSchema() {
    try {
        console.log('Modifying order_status enum...');
        await pool.query(`
            ALTER TABLE orders 
            MODIFY COLUMN order_status ENUM('draft','in_review','approved','so_created','billed','packed','shipped','delivered','cancelled') DEFAULT 'draft'
        `);

        console.log('Adding sales_order_number and zoho_salesorder_id columns...');
        await pool.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS sales_order_number VARCHAR(100) NULL AFTER zoho_bill_number,
            ADD COLUMN IF NOT EXISTS zoho_salesorder_id VARCHAR(100) NULL AFTER sales_order_number,
            ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL AFTER zoho_salesorder_id,
            ADD COLUMN IF NOT EXISTS approved_by INT(11) NULL AFTER approved_at
        `);

        console.log('Successfully updated orders table schema!');
        process.exit(0);
    } catch (err) {
        console.error('Error updating schema:', err);
        process.exit(1);
    }
}

updateSchema();
