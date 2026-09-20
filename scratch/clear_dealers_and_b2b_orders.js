const path = require('path');
const pool = require(path.join(__dirname, '../backend/src/config/db'));

async function clearDealersAndB2bOrders() {
    const connection = await pool.getConnection();
    try {
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        console.log('Clearing B2B order payments...');
        const [payRes] = await connection.query(`
            DELETE FROM order_payments 
            WHERE order_id IN (SELECT order_id FROM orders WHERE order_source = 'dealer' OR dealer_id IS NOT NULL)
        `);
        console.log(`Deleted ${payRes.affectedRows} order payments.`);

        console.log('Clearing B2B order items...');
        const [itemRes] = await connection.query(`
            DELETE FROM order_items 
            WHERE order_id IN (SELECT order_id FROM orders WHERE order_source = 'dealer' OR dealer_id IS NOT NULL)
        `);
        console.log(`Deleted ${itemRes.affectedRows} order items.`);

        console.log('Clearing B2B packing records...');
        try {
            const [packRes] = await connection.query(`
                DELETE FROM packing 
                WHERE order_id IN (SELECT order_id FROM orders WHERE order_source = 'dealer' OR dealer_id IS NOT NULL)
            `);
            console.log(`Deleted ${packRes.affectedRows || 0} packing records.`);
        } catch (e) {}

        console.log('Clearing B2B shipment records...');
        try {
            const [shipRes] = await connection.query(`
                DELETE FROM shipments 
                WHERE order_id IN (SELECT order_id FROM orders WHERE order_source = 'dealer' OR dealer_id IS NOT NULL)
            `);
            console.log(`Deleted ${shipRes.affectedRows || 0} shipment records.`);
        } catch (e) {}

        console.log('Clearing B2B orders...');
        const [orderRes] = await connection.query(`
            DELETE FROM orders WHERE order_source = 'dealer' OR dealer_id IS NOT NULL
        `);
        console.log(`Deleted ${orderRes.affectedRows} B2B orders.`);

        console.log('Clearing all dealers...');
        const [dealerRes] = await connection.query(`DELETE FROM dealers`);
        console.log(`Deleted ${dealerRes.affectedRows} dealers.`);

        console.log('Resetting AUTO_INCREMENT for dealers table to 1...');
        await connection.query('ALTER TABLE dealers AUTO_INCREMENT = 1');

        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        const [dCheck] = await connection.query('SELECT COUNT(*) as dCount FROM dealers');
        const [oCheck] = await connection.query('SELECT COUNT(*) as oCount FROM orders WHERE order_source = "dealer" OR dealer_id IS NOT NULL');
        console.log(`SUCCESS! Current dealer count: ${dCheck[0].dCount}, Current B2B order count: ${oCheck[0].oCount}`);

    } catch (err) {
        console.error('ERROR clearing dealers and orders:', err);
    } finally {
        connection.release();
        process.exit(0);
    }
}

clearDealersAndB2bOrders();
