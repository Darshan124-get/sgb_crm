const pool = require('../src/config/db');

async function fixSchema() {
    try {
        console.log('Altering packing table...');
        // Rename notes to remarks if notes exists, otherwise add remarks
        const [rows] = await pool.query('DESCRIBE packing');
        const hasNotes = rows.some(r => r.Field === 'notes');
        const hasRemarks = rows.some(r => r.Field === 'remarks');

        if (hasNotes && !hasRemarks) {
            await pool.query('ALTER TABLE packing CHANGE notes remarks TEXT');
            console.log('Renamed notes to remarks.');
        } else if (!hasRemarks) {
            await pool.query('ALTER TABLE packing ADD COLUMN remarks TEXT');
            console.log('Added remarks column.');
        } else {
            console.log('Remarks column already exists.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

fixSchema();
