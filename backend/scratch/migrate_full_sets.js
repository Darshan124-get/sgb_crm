const pool = require('../src/config/db');

async function run() {
    try {
        console.log('Running database migration for Full Sets creation...');

        // 1. Create product_sets table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS product_sets (
                set_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created product_sets table.');

        // 2. Create product_set_items table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS product_set_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                set_id INT,
                product_id INT,
                quantity INT DEFAULT 1,
                FOREIGN KEY (set_id) REFERENCES product_sets(set_id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
            )
        `);
        console.log('Created product_set_items table.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
