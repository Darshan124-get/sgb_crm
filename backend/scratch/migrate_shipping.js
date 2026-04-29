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
        await pool.query('SELECT 1');
        console.log('Database connected.');

        console.log('Adding shipping columns to orders table...');
        const orderCols = [
            'pincode VARCHAR(10)',
            'shipping_name VARCHAR(150)',
            'shipping_address TEXT',
            'shipping_city VARCHAR(100)',
            'shipping_state VARCHAR(100)',
            'shipping_pincode VARCHAR(10)'
        ];

        for (const col of orderCols) {
            const colName = col.split(' ')[0];
            try {
                await pool.query(`ALTER TABLE orders ADD COLUMN ${col}`);
                console.log(`Added ${colName} to orders.`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`${colName} already exists in orders.`);
                } else {
                    throw err;
                }
            }
        }

        console.log('Adding invoice-specific shipping details to invoices table...');
        const invoiceCols = [
            'delivery_note VARCHAR(255)',
            'dispatch_through VARCHAR(255)',
            'destination VARCHAR(255)',
            'payment_terms VARCHAR(255)'
        ];

        for (const col of invoiceCols) {
            const colName = col.split(' ')[0];
            try {
                await pool.query(`ALTER TABLE invoices ADD COLUMN ${col}`);
                console.log(`Added ${colName} to invoices.`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`${colName} already exists in invoices.`);
                } else {
                    throw err;
                }
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
