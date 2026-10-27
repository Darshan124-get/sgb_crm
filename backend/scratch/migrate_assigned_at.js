const pool = require('../src/config/db');

async function migrate() {
    try {
        const [cols] = await pool.query("SHOW COLUMNS FROM leads LIKE 'assigned_at'");
        if (cols.length === 0) {
            await pool.query("ALTER TABLE leads ADD COLUMN assigned_at TIMESTAMP NULL DEFAULT NULL AFTER assigned_to");
            console.log("Successfully added assigned_at column to leads table.");
        } else {
            console.log("assigned_at column already exists in leads table.");
        }

        // Backfill assigned_at for existing assigned leads
        const [backfill] = await pool.query("UPDATE leads SET assigned_at = COALESCE(updated_at, created_at) WHERE assigned_to IS NOT NULL AND assigned_at IS NULL");
        console.log("Backfilled assigned_at count:", backfill.affectedRows);

        // Check the 4 leads in question
        const [rows] = await pool.query(
            "SELECT lead_id, customer_name, phone_number, status, assigned_to, assigned_at, updated_at, created_at FROM leads WHERE phone_number IN ('6364594854', '8317332769', '8867724616', '9999900001')"
        );
        console.log("Current status of the 4 leads:", JSON.stringify(rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
}

migrate();
