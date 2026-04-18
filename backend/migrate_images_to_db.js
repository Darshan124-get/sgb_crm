const pool = require('./src/config/db');

async function migrate() {
    try {
        console.log('Starting migration: Increasing image_url column size to LONGTEXT...');
        // Products table
        await pool.query('ALTER TABLE products MODIFY COLUMN image_url LONGTEXT');
        console.log('✅ products.image_url column updated to LONGTEXT.');

        // Also check if other tables need it (e.g. advance payment screenshots)
        await pool.query('ALTER TABLE lead_advance_payments MODIFY COLUMN screenshot_url LONGTEXT');
        console.log('✅ lead_advance_payments.screenshot_url column updated to LONGTEXT.');

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
