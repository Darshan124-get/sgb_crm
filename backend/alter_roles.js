const db = require('./src/config/db');

async function runMigration() {
    try {
        console.log('Running migration to add status to roles table...');
        await db.execute("ALTER TABLE roles ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active';");
        console.log('Migration completed successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column status already exists on roles table.');
        } else {
            console.error('Migration failed:', err);
        }
    } finally {
        process.exit();
    }
}

runMigration();
