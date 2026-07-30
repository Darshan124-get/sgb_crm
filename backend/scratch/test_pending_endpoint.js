const db = require('../src/config/db');

async function test() {
    try {
        const [rows] = await db.query(`
            SELECT o.order_id, o.customer_name, o.advance_amount,
                   (COALESCE((SELECT SUM(amount) FROM payments p WHERE p.order_id = o.order_id AND p.payment_status = 'verified'), 0) + o.advance_amount) as advance_paid
            FROM orders o
            WHERE o.order_status IN ('draft', 'in_review')
            ORDER BY o.created_at DESC
            LIMIT 5
        `);
        console.log('Pending orders advance_paid values:', rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

test();
