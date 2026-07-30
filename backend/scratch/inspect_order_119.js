const db = require('../src/config/db');

async function test() {
    try {
        const [orders] = await db.query("SELECT * FROM orders WHERE order_id = 119");
        console.log('Order 119 Details:', orders[0]);

        if (orders[0]?.lead_id) {
            const [leadPayments] = await db.query("SELECT * FROM lead_advance_payments WHERE lead_id = ?", [orders[0].lead_id]);
            console.log('Lead Payments:', leadPayments);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

test();
