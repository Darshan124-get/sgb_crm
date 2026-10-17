const pool = require('../src/config/db');

async function run() {
    try {
        await pool.query("UPDATE leads SET assigned_at = CURRENT_TIMESTAMP, status = 'new' WHERE lead_id IN (5037, 803, 809, 44879)");
        const [rows] = await pool.query("SELECT lead_id, customer_name, status, assigned_to, assigned_at FROM leads WHERE lead_id IN (5037, 803, 809, 44879)");
        console.log("Updated leads:", JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
