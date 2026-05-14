const pool = require('../backend/src/config/db');

async function check() {
    try {
        const [rows] = await pool.query('SELECT status, COUNT(*) as count FROM leads GROUP BY status');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
