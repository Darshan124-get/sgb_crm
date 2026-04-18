const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../.env' });

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log("Checking tables...");
        const [tables] = await pool.query("SHOW TABLES");
        console.log("Tables:", tables.map(t => Object.values(t)[0]));

        const tablesToChecked = ['products', 'categories', 'inventory', 'inventory_logs'];
        for (const table of tablesToChecked) {
            console.log(`\nColumns for ${table}:`);
            try {
                const [cols] = await pool.query(`DESCRIBE ${table}`);
                console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));
            } catch (e) {
                console.error(`Error describing ${table}: ${e.message}`);
            }
        }
    } catch (err) {
        console.error("Connection Error:", err.message);
    } finally {
        await pool.end();
    }
}

check();
