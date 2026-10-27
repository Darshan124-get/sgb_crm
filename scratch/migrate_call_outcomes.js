const db = require('../backend/src/config/db');

async function migrateOutcomes() {
    try {
        console.log('Modifying customer_support_calls call_outcome ENUM...');
        await db.query(`
            ALTER TABLE customer_support_calls 
            MODIFY COLUMN call_outcome ENUM('answered', 'not_answered', 'switched_off', 'not_reachable', 'busy', 'callback_required', 'no_assistance_needed') NOT NULL
        `);
        console.log('Successfully altered customer_support_calls call_outcome ENUM');

        // Check customer_support_followups table structure and constraints
        const [indexes] = await db.query('SHOW INDEX FROM customer_support_followups');
        console.log('Followup indexes:', indexes.map(i => ({ Key_name: i.Key_name, Column_name: i.Column_name })));

        // If uq_case_followup exists, let's see its definition
        // If unique key is (case_id, followup_type), when a callback is scheduled:
        // followup_type could be 'CALL_ATTEMPT_RETRY' or 'CALLBACK' or 'UNREACHABLE_FOLLOWUP'.
        // If a customer was unreachable today and then unreachable tomorrow, we should ensure
        // subsequent followups don't crash with ER_DUP_ENTRY!

        process.exit(0);
    } catch (err) {
        console.error('Error during migration:', err);
        process.exit(1);
    }
}

migrateOutcomes();
