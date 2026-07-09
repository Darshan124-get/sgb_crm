const db = require('./src/config/db');

async function runMigration() {
    try {
        console.log('Running PBAC migration...');
        
        // Add employee_id to users
        try {
            await db.execute("ALTER TABLE users ADD COLUMN employee_id VARCHAR(50);");
            console.log('Added employee_id to users.');
        } catch (e) {
            if(e.code === 'ER_DUP_FIELDNAME') console.log('employee_id already exists.');
            else throw e;
        }

        // Add permissions to users
        try {
            await db.execute("ALTER TABLE users ADD COLUMN permissions JSON;");
            console.log('Added permissions to users.');
        } catch (e) {
            if(e.code === 'ER_DUP_FIELDNAME') console.log('permissions already exists on users.');
            else throw e;
        }

        // Add default_permissions to roles
        try {
            await db.execute("ALTER TABLE roles ADD COLUMN default_permissions JSON;");
            console.log('Added default_permissions to roles.');
        } catch (e) {
            if(e.code === 'ER_DUP_FIELDNAME') console.log('default_permissions already exists on roles.');
            else throw e;
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

runMigration();
