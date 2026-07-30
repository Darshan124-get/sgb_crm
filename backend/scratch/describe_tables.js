const pool = require('../src/config/db');

async function main() {
    try {
        const tables = ['orders', 'invoices', 'payments'];
        for (const table of tables) {
            console.log(`\n--- SCHEMA FOR TABLE: ${table} ---`);
            const [rows] = await pool.query(`DESCRIBE ${table}`);
            console.table(rows.map(r => ({ Field: r.Field, Type: r.Type, Null: r.Null, Key: r.Key, Default: r.Default, Extra: r.Extra })));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
