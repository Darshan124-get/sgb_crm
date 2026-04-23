const pool = require('../src/config/db');

async function debugSchema() {
    const connection = await pool.getConnection();
    try {
        const tables = ['products', 'categories', 'inventory', 'inventory_logs', 'leads'];
        for (const table of tables) {
            console.log(`--- Table: ${table} ---`);
            try {
                const [cols] = await connection.query(`SHOW COLUMNS FROM ${table}`);
                console.table(cols);
            } catch (err) {
                console.error(`Error describing ${table}:`, err.message);
            }
        }
    } finally {
        connection.release();
        process.exit();
    }
}

debugSchema();
