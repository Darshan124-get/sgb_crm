const pool = require('./backend/src/config/db');

async function migrate() {
    console.log('Checking if assigned_by column exists...');
    const [cols] = await pool.query("SHOW COLUMNS FROM leads LIKE 'assigned_by'");
    if (cols.length === 0) {
        console.log('Adding assigned_by column to leads...');
        await pool.query("ALTER TABLE leads ADD COLUMN assigned_by INT NULL AFTER assigned_to");
        try {
            await pool.query("ALTER TABLE leads ADD CONSTRAINT fk_leads_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE SET NULL");
        } catch (e) {
            console.warn('FK creation warning:', e.message);
        }
        try {
            await pool.query("CREATE INDEX idx_leads_assigned_by ON leads(assigned_by)");
        } catch (e) {
            console.warn('Index creation warning:', e.message);
        }
        console.log('Column added successfully.');
    } else {
        console.log('assigned_by column already exists.');
    }

    console.log('Backfilling assigned_by for existing assigned leads...');
    const [result] = await pool.query(`
        UPDATE leads l
        JOIN (
            SELECT ln.lead_id, ln.user_id
            FROM lead_notes ln
            INNER JOIN (
                SELECT lead_id, MAX(note_id) as max_note_id
                FROM lead_notes
                WHERE (note LIKE '%assign%' OR note LIKE '%transfer%') AND user_id IS NOT NULL
                GROUP BY lead_id
            ) latest ON ln.note_id = latest.max_note_id
        ) latest_assign ON l.lead_id = latest_assign.lead_id
        SET l.assigned_by = latest_assign.user_id
        WHERE l.assigned_to IS NOT NULL AND l.assigned_by IS NULL
    `);
    console.log('Backfilled records count:', result.affectedRows);

    // Verify
    const [check] = await pool.query(`
        SELECT l.lead_id, l.assigned_to, u_to.name as assigned_to_name, l.assigned_by, u_by.name as assigned_by_name
        FROM leads l
        LEFT JOIN users u_to ON l.assigned_to = u_to.user_id
        LEFT JOIN users u_by ON l.assigned_by = u_by.user_id
        WHERE l.assigned_to IS NOT NULL
        LIMIT 5
    `);
    console.log('Verification sample:', check);

    process.exit(0);
}

migrate().catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
});
