const pool = require('../src/config/db');

async function updateOrdersSchema() {
    try {
        console.log('Adding Zoho Customer fields to orders table...');
        await pool.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS zoho_contact_id VARCHAR(100) NULL AFTER zoho_salesorder_id,
            ADD COLUMN IF NOT EXISTS customer_type ENUM('individual', 'business') DEFAULT 'individual' AFTER zoho_contact_id,
            ADD COLUMN IF NOT EXISTS company_name VARCHAR(150) NULL AFTER customer_type,
            ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL AFTER company_name,
            ADD COLUMN IF NOT EXISTS gst_treatment VARCHAR(100) NULL DEFAULT 'consumer' AFTER email,
            ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100) NULL AFTER gst_treatment,
            ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50) NULL AFTER place_of_supply
        `);
        console.log('Successfully added Zoho Customer fields to orders table!');
        process.exit(0);
    } catch (err) {
        console.error('Schema update failed:', err);
        process.exit(1);
    }
}

updateOrdersSchema();
