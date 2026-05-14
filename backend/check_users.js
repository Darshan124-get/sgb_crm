const pool = require('./src/config/db');
async function check() {
    try {
        const [rows] = await pool.query('DESCRIBE users');
        console.log(JSON.stringify(rows, null, 2));
        const [roles] = await pool.query('SELECT * FROM roles');
        console.log("ROLES:", JSON.stringify(roles, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
