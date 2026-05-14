const pool = require('./src/config/db');

async function migrate() {
    console.log('Starting Inclusive Billing Migration...');
    const connection = await pool.getConnection();

    try {
        console.log('Updating Orders table...');
        await connection.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS pincode VARCHAR(10),
            ADD COLUMN IF NOT EXISTS extra_charges DECIMAL(10, 2) DEFAULT 0
        `).catch(err => console.log('Orders table update:', err.message));

        console.log('Updating Invoices table...');
        await connection.query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(20),
            ADD COLUMN IF NOT EXISTS billing_pincode VARCHAR(10),
            ADD COLUMN IF NOT EXISTS extra_charges DECIMAL(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS delivery_note TEXT,
            ADD COLUMN IF NOT EXISTS dispatch_through VARCHAR(100),
            ADD COLUMN IF NOT EXISTS destination VARCHAR(100),
            ADD COLUMN IF NOT EXISTS payment_terms TEXT,
            MODIFY COLUMN tax_type ENUM('CGST_SGST', 'IGST', 'NONE') DEFAULT 'NONE'
        `).catch(err => console.log('Invoices table update:', err.message));

        console.log('Migration Completed Successfully! ✅');
    } catch (err) {
        console.error('Migration Failed! ❌', err);
    } finally {
        connection.release();
        process.exit();
    }
}

migrate();
