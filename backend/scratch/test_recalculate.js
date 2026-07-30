const db = require('../src/config/db');

async function getVerifiedBalance(connection, orderId) {
    const [orders] = await connection.query('SELECT lead_id FROM orders WHERE order_id = ?', [orderId]);
    const leadId = orders[0]?.lead_id;

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

    return parseFloat(payments[0]?.total || 0) + leadTotal;
}

async function test() {
    const connection = db;
    try {
        const orderId = 119;
        
        // Simulating generateInvoice logic:
        const [itemSumRows] = await connection.query('SELECT SUM(total_price) AS total FROM order_items WHERE order_id = ?', [orderId]);
        const subtotal = parseFloat(itemSumRows[0]?.total || 0);
        
        // Let's get the discount and charges currently applied to the invoice/order
        const [invoices] = await connection.query("SELECT discount, shipping_charges, extra_charges FROM invoices WHERE order_id = ?", [orderId]);
        const discount = parseFloat(invoices[0]?.discount || 0);
        const shipping_charges = parseFloat(invoices[0]?.shipping_charges || 0);
        const extra_charges = parseFloat(invoices[0]?.extra_charges || 0);

        console.log('--- BEFORE ---');
        const [beforeOrder] = await connection.query("SELECT total_amount, balance_amount, discount FROM orders WHERE order_id = ?", [orderId]);
        console.log('Order:', beforeOrder[0]);

        console.log('--- RECALCULATING ---');
        console.log('Subtotal (items sum):', subtotal);
        console.log('Discount:', discount);
        console.log('Shipping charges:', shipping_charges);
        console.log('Extra charges:', extra_charges);

        const grandTotal = subtotal - discount + shipping_charges + extra_charges;
        console.log('Calculated Grand Total:', grandTotal);

        const verifiedTotal = await getVerifiedBalance(connection, orderId);
        console.log('Verified Payments Received:', verifiedTotal);

        const finalBalance = Math.max(0, grandTotal - verifiedTotal);
        console.log('Calculated Final Balance (COD):', finalBalance);

        // Update database to fix it
        await connection.query(`
            UPDATE orders SET 
                total_amount = ?, 
                discount = ?, 
                shipping_charges = ?, 
                extra_charges = ?, 
                balance_amount = ? 
            WHERE order_id = ?
        `, [grandTotal, discount, shipping_charges, extra_charges, finalBalance, orderId]);

        console.log('--- AFTER UPDATE ---');
        const [afterOrder] = await connection.query("SELECT total_amount, balance_amount, discount FROM orders WHERE order_id = ?", [orderId]);
        console.log('Order:', afterOrder[0]);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

test();
