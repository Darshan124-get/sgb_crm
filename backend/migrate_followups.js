const pool = require('./src/config/db');

async function migrateFollowups() {
    console.log('🚀 Starting Follow-up Migration...');
    try {
        // 1. Fetch leads that have a next_followup_date but no pending record in lead_followups
        const [leads] = await pool.query(`
            SELECT lead_id, next_followup_date, assigned_to 
            FROM leads 
            WHERE next_followup_date IS NOT NULL 
            AND lead_id NOT IN (SELECT lead_id FROM lead_followups WHERE status = 'pending')
        `);

        console.log(`📊 Found ${leads.length} leads to migrate.`);

        for (const lead of leads) {
            await pool.query(
                'INSERT INTO lead_followups (lead_id, followup_date, status, remarks, created_by) VALUES (?, ?, "pending", "Auto-migrated from leads table", ?)',
                [lead.lead_id, lead.next_followup_date, lead.assigned_to]
            );
            console.log(`✅ Migrated lead ID: ${lead.lead_id}`);
        }

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrateFollowups();
