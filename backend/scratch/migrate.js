const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
});

async function migrate() {
    try {
        console.log('Checking database connection...');
        const [rows] = await pool.query('SELECT 1');
        console.log('Database connected.');

        console.log('Adding hsn_code to products table...');
        try {
            await pool.query("ALTER TABLE products ADD COLUMN hsn_code VARCHAR(20) AFTER sku");
            console.log('Added hsn_code to products.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('hsn_code already exists in products.');
            } else {
                throw err;
            }
        }

        console.log('Adding hsn_code to invoice_items table...');
        try {
            await pool.query("ALTER TABLE invoice_items ADD COLUMN hsn_code VARCHAR(20)");
            console.log('Added hsn_code to invoice_items.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('hsn_code already exists in invoice_items.');
            } else {
                throw err;
            }
        }

        console.log('Migration completed.');
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    }
}

migrate();
