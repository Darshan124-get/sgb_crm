const pool = require('../src/config/db');

async function testConn() {
    try {
        const [rows] = await pool.query('SELECT 1');
        console.log('Database connection successful:', rows);
        process.exit(0);
    } catch (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
}

testConn();
