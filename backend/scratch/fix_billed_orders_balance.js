const db = require('../src/config/db');

async function getVerifiedBalance(connection, orderId) {
    const [orders] = await connection.query('SELECT lead_id, advance_amount FROM orders WHERE order_id = ?', [orderId]);
    const leadId = orders[0]?.lead_id;
    const advanceAmount = parseFloat(orders[0]?.advance_amount || 0);

    const [payments] = await connection.query(`
        SELECT SUM(amount) as total FROM payments 
        WHERE order_id = ? AND payment_status = 'verified'
    `, [orderId]);

    let leadTotal = 0;
    if (leadId) {
        const [leadPayments] = await connection.query(`
            SELECT SUM(amount) as total FROM lead_advance_payments 
            WHERE lead_id = ? AND verified = 'yes'
        `, [leadId]);
        leadTotal = parseFloat(leadPayments[0]?.total || 0);
    }

    return parseFloat(payments[0]?.total || 0) + Math.max(advanceAmount, leadTotal);
}

async function fixBalances() {
    try {
        const [orders] = await db.query(`
            SELECT order_id, customer_name, total_amount, advance_amount, balance_amount, discount, shipping_charges, extra_charges, order_status 
            FROM orders 
            WHERE order_status IN ('billed', 'shipped')
        `);

        console.log(`Found ${orders.length} active orders to verify/fix.`);

        for (const order of orders) {
            const id = order.order_id;
            
            // 1. Get raw items sum
            const [itemSumRows] = await db.query('SELECT SUM(total_price) AS total FROM order_items WHERE order_id = ?', [id]);
            const subtotal = parseFloat(itemSumRows[0]?.total || 0);

            // 2. Fetch invoice values if exists, or fallback to order values
            const [invoices] = await db.query('SELECT discount, shipping_charges, extra_charges FROM invoices WHERE order_id = ? AND invoice_status = "finalized"', [id]);
            const discount = invoices[0] ? parseFloat(invoices[0].discount || 0) : parseFloat(order.discount || 0);
            const shipping_charges = invoices[0] ? parseFloat(invoices[0].shipping_charges || 0) : parseFloat(order.shipping_charges || 0);
            const extra_charges = invoices[0] ? parseFloat(invoices[0].extra_charges || 0) : parseFloat(order.extra_charges || 0);

            // 3. Compute correct total & balance
            const grandTotal = subtotal - discount + shipping_charges + extra_charges;
            const verifiedTotal = await getVerifiedBalance(db, id);
            const correctBalance = Math.max(0, grandTotal - verifiedTotal);

            const oldBalance = parseFloat(order.balance_amount || 0);

            if (Math.abs(oldBalance - correctBalance) > 0.01) {
                console.log(`Fixing Order #${id} (${order.customer_name}):`);
                console.log(`  Subtotal: ${subtotal}, Discount: ${discount}, Shipping: ${shipping_charges}, Extra: ${extra_charges}`);
                console.log(`  Grand Total: ${grandTotal}, Verified Paid: ${verifiedTotal}`);
                console.log(`  Old Balance: ${oldBalance} => Correct Balance: ${correctBalance}`);

                await db.query(`
                    UPDATE orders SET 
                        total_amount = ?, 
                        discount = ?, 
                        shipping_charges = ?, 
                        extra_charges = ?, 
                        balance_amount = ? 
                    WHERE order_id = ?
                `, [grandTotal, discount, shipping_charges, extra_charges, correctBalance, id]);
            }
        }
        console.log('Balance cleanup completed successfully!');
    } catch (e) {
        console.error('Error during cleanup:', e);
    } finally {
        process.exit();
    }
}

fixBalances();
