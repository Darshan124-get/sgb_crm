const pool = require('./src/config/db');

async function fixSchema() {
    try {
        console.log('Checking for reminders_enabled column...');
        const [columns] = await pool.query("SHOW COLUMNS FROM leads LIKE 'reminders_enabled'");
        
        if (columns.length === 0) {
            console.log('Adding reminders_enabled column to leads table...');
            await pool.query('ALTER TABLE leads ADD COLUMN reminders_enabled BOOLEAN DEFAULT TRUE AFTER next_followup_date');
            console.log('Column added successfully.');
        } else {
            console.log('Column already exists.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error fixing schema:', err);
        process.exit(1);
    }
}

fixSchema();
