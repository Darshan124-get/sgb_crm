const pool = require('./src/config/db');

async function checkIndexes() {
    try {
        const [indexes] = await pool.query(`SHOW INDEX FROM dealers`);
        console.log("DEALERS TABLE INDEXES:", indexes.map(i => ({ Key_name: i.Key_name, Column_name: i.Column_name, Non_unique: i.Non_unique })));
    } catch (err) {
        console.error("ERROR:", err.message);
    } finally {
        process.exit(0);
    }
}
checkIndexes();
