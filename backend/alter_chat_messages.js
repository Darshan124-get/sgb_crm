const pool = require('./src/config/db');

async function run() {
    try {
        console.log('Starting chat_messages table schema alterations...');

        // 1. Add reaction column
        await pool.query(`
            ALTER TABLE chat_messages 
            ADD COLUMN IF NOT EXISTS reaction VARCHAR(50) DEFAULT NULL AFTER mime_type
        `).then(() => {
            console.log('Reaction column verified/added successfully.');
        }).catch(async (err) => {
            // Fallback for older MySQL versions that do not support ADD COLUMN IF NOT EXISTS
            console.log('ADD COLUMN IF NOT EXISTS failed, trying standard ALTER...');
            await pool.query(`
                ALTER TABLE chat_messages ADD COLUMN reaction VARCHAR(50) DEFAULT NULL
            `).catch(e => console.log('Reaction column already exists or alter skipped:', e.message));
        });

        // 2. Add reply_to_chat_id column
        await pool.query(`
            ALTER TABLE chat_messages 
            ADD COLUMN IF NOT EXISTS reply_to_chat_id INT DEFAULT NULL AFTER reaction
        `).then(() => {
            console.log('Reply_to_chat_id column verified/added successfully.');
        }).catch(async (err) => {
            console.log('ADD COLUMN IF NOT EXISTS failed, trying standard ALTER...');
            await pool.query(`
                ALTER TABLE chat_messages ADD COLUMN reply_to_chat_id INT DEFAULT NULL
            `).catch(e => console.log('Reply_to_chat_id column already exists or alter skipped:', e.message));
        });

        // 3. Add is_forwarded column
        await pool.query(`
            ALTER TABLE chat_messages 
            ADD COLUMN IF NOT EXISTS is_forwarded TINYINT(1) DEFAULT 0 AFTER reply_to_chat_id
        `).then(() => {
            console.log('Is_forwarded column verified/added successfully.');
        }).catch(async (err) => {
            console.log('ADD COLUMN IF NOT EXISTS failed, trying standard ALTER...');
            await pool.query(`
                ALTER TABLE chat_messages ADD COLUMN is_forwarded TINYINT(1) DEFAULT 0
            `).catch(e => console.log('Is_forwarded column already exists or alter skipped:', e.message));
        });

        console.log('All alterations complete!');
        process.exit(0);
    } catch (err) {
        console.error('Alterations failed:', err);
        process.exit(1);
    }
}

run();
