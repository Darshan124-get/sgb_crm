const pool = require('./src/config/db');

async function inspectDealers() {
    try {
        const [rows] = await pool.query(`SELECT dealer_id, dealer_name, contact_person, phone, gst_no, vrl_code, city, state, created_at FROM dealers ORDER BY dealer_id DESC LIMIT 30`);
        console.log(`TOTAL DEALERS FOUND: ${rows.length}`);
        console.table(rows);
    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        process.exit(0);
    }
}
inspectDealers();
