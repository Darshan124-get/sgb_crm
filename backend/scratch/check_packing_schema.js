const pool = require('../src/config/db');

async function checkSchema() {
    try {
        const [rows] = await pool.query('DESCRIBE packing');
        console.log('Columns in packing table:');
        rows.forEach(row => console.log(`- ${row.Field}`));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkSchema();
