const db = require('../src/config/db');

async function addIndexes() {
    console.log('[INDEX MIGRATION] Adding missing composite performance indexes...');
    
    const indexes = [
        {
            table: 'chat_messages',
            name: 'idx_cm_session_time',
            query: 'ALTER TABLE chat_messages ADD INDEX idx_cm_session_time (session_id, timestamp DESC)'
        },
        {
            table: 'chat_messages',
            name: 'idx_cm_msgid',
            query: 'ALTER TABLE chat_messages ADD INDEX idx_cm_msgid (message_id)'
        },
        {
            table: 'chat_messages',
            name: 'idx_cm_sender_status',
            query: 'ALTER TABLE chat_messages ADD INDEX idx_cm_sender_status (sender_type, status)'
        },
        {
            table: 'chat_sessions',
            name: 'idx_cs_lead_status',
            query: 'ALTER TABLE chat_sessions ADD INDEX idx_cs_lead_status (lead_id, status)'
        },
        {
            table: 'leads',
            name: 'idx_leads_assigned_status',
            query: 'ALTER TABLE leads ADD INDEX idx_leads_assigned_status (assigned_to, status, updated_at DESC)'
        },
        {
            table: 'chatbot_sessions',
            name: 'idx_cbs_status_session',
            query: 'ALTER TABLE chatbot_sessions ADD INDEX idx_cbs_status_session (status, session_id)'
        }
    ];

    for (const idx of indexes) {
        try {
            console.log(`Checking index ${idx.name} on table ${idx.table}...`);
            await db.execute(idx.query);
            console.log(`✅ Successfully added index ${idx.name} on ${idx.table}`);
        } catch (err) {
            if (err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate key name')) {
                console.log(`ℹ️ Index ${idx.name} already exists on ${idx.table}. Skipping.`);
            } else {
                console.warn(`⚠️ Warning adding index ${idx.name}:`, err.message);
            }
        }
    }

    console.log('[INDEX MIGRATION] Completed successfully!');
    process.exit(0);
}

addIndexes().catch((err) => {
    console.error('[INDEX MIGRATION FAILED]', err);
    process.exit(1);
});
