const pool = require('./src/config/db');

async function check() {
    try {
        const [orders] = await pool.query(`SELECT order_id, dealer_id, customer_name, phone, total_amount, created_at FROM orders WHERE phone LIKE '%9123456789%' OR customer_name LIKE '%Kisan%' ORDER BY order_id DESC`);
        console.log("ORDERS FOUND FOR 9123456789 / Kisan:", orders);

        const [dealers] = await pool.query(`SELECT dealer_id, dealer_name, phone FROM dealers WHERE phone LIKE '%9123456789%' OR dealer_name LIKE '%Kisan%'`);
        console.log("DEALERS FOUND FOR 9123456789 / Kisan:", dealers);
    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        process.exit(0);
    }
}
check();
