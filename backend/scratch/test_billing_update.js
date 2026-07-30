const db = require('../src/config/db');

async function test() {
    try {
        const [orders] = await db.query("SELECT order_id, customer_name, total_amount, advance_amount, balance_amount, discount, order_status FROM orders WHERE phone = '8217286727'");
        console.log('Orders found:', orders);

        if (orders.length > 0) {
            const orderId = orders[0].order_id;
            const [invoices] = await db.query("SELECT invoice_id, subtotal, discount, total_amount, invoice_status FROM invoices WHERE order_id = ?", [orderId]);
            console.log('Invoices found:', invoices);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

test();
