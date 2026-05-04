const pool = require('../src/config/db');

async function migrate() {
    try {
        console.log('Starting migration...');
        await pool.query("ALTER TABLE leads ADD COLUMN delivery_type VARCHAR(100) DEFAULT NULL AFTER language");
        console.log('Added delivery_type to leads');
        await pool.query("ALTER TABLE orders ADD COLUMN delivery_type VARCHAR(100) DEFAULT NULL AFTER pincode");
        console.log('Added delivery_type to orders');
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
