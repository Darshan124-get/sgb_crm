const pool = require('../src/config/db');

async function run() {
    try {
        console.log('Running database migration for post order splitting...');

        // 1. Alter packing table
        await pool.query(`
            ALTER TABLE packing 
            ADD COLUMN IF NOT EXISTS product_id INT NULL AFTER order_id,
            ADD COLUMN IF NOT EXISTS unit_no INT DEFAULT 1 AFTER product_id,
            ADD CONSTRAINT fk_packing_product FOREIGN KEY IF NOT EXISTS (product_id) REFERENCES products(product_id) ON DELETE SET NULL
        `);
        console.log('Modified packing table successfully.');

        // 2. Alter shipments table
        await pool.query(`
            ALTER TABLE shipments 
            ADD COLUMN IF NOT EXISTS product_id INT NULL AFTER order_id,
            ADD COLUMN IF NOT EXISTS unit_no INT DEFAULT 1 AFTER product_id,
            ADD CONSTRAINT fk_shipments_product FOREIGN KEY IF NOT EXISTS (product_id) REFERENCES products(product_id) ON DELETE SET NULL
        `);
        console.log('Modified shipments table successfully.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
