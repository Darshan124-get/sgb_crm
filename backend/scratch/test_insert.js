const pool = require('../src/config/db');

async function test() {
    try {
        console.log('--- STARTING DB TEST ---');
        const [result] = await pool.query(
            "INSERT INTO orders (order_source, customer_name, phone, order_status) VALUES (?, ?, ?, ?)",
            ['lead', 'TEST_USER', '1234567890', 'billed']
        );
        console.log('✅ SUCCESS! New Order ID:', result.insertId);
        process.exit(0);
    } catch (err) {
        console.error('❌ DATABASE REJECTED INSERT:', err.message);
        console.error('ERROR CODE:', err.code);
        process.exit(1);
    }
}

test();
