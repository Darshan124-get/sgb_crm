const pool = require('./db');

async function migrateDealersTable() {
    const columnsToAdd = [
        'visited_date VARCHAR(50) NULL',
        'visited_by VARCHAR(100) NULL',
        'gst_no VARCHAR(50) NULL',
        'town_village VARCHAR(100) NULL',
        'taluk VARCHAR(100) NULL',
        'district VARCHAR(100) NULL',
        'pincode VARCHAR(20) NULL',
        'nearest_vrl VARCHAR(150) NULL',
        'vrl_code VARCHAR(50) NULL'
    ];

    for (const col of columnsToAdd) {
        try {
            await pool.query(`ALTER TABLE dealers ADD COLUMN ${col}`);
            console.log(`Added column: ${col}`);
        } catch (err) {
            if (!err.message.includes('Duplicate column')) {
                console.log(`Column status: ${err.message}`);
            }
        }
    }

    try {
        await pool.query("ALTER TABLE dealers MODIFY COLUMN status VARCHAR(20) DEFAULT 'Active'");
        await pool.query("ALTER TABLE dealers MODIFY COLUMN phone VARCHAR(150) NULL");
        console.log("Updated status and phone columns in dealers table");
    } catch (err) {
        console.log("Column modify error:", err.message);
    }

    console.log("Dealers table migration finished.");
    process.exit(0);
}

migrateDealersTable();
