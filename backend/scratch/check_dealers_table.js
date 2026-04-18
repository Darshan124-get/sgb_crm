const pool = require('../src/config/db');

async function check() {
    try {
        const [rows] = await pool.query('DESCRIBE dealers');
        console.log('Dealers table structure:');
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

check();
