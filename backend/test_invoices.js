const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  try {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    console.log("Connecting to DB...");
    const [rows] = await pool.query(`
        SELECT i.*, o.customer_name as order_customer, o.delivery_type, o.village, o.district, o.state, o.pincode,
               (SELECT SUM(amount) FROM payments WHERE order_id = o.order_id AND payment_status = 'verified') as advance_paid
        FROM invoices i 
        LEFT JOIN orders o ON i.order_id = o.order_id 
        ORDER BY i.created_at DESC
    `);
    console.log('ROWS FETCHED:', rows.length);
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}
run();
