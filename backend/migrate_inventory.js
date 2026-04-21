const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'admin_db'
    };
    const pool = mysql.createPool(config);

    try {
        console.log('🚀 Starting Inventory & Categories Migration...');

        // 1. Create categories table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS categories (
                category_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                parent_id INT DEFAULT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created categories table');

        // 2. Update products table
        // We use individual ALTER TABLE statements for better compatibility and error handling
        const productColumns = [
            'ADD COLUMN IF NOT EXISTS status ENUM(\'active\', \'inactive\') DEFAULT \'active\'',
            'ADD COLUMN IF NOT EXISTS image_url TEXT',
            'ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5, 2) DEFAULT 0',
            'ADD COLUMN IF NOT EXISTS category_id INT'
        ];

        for (const col of productColumns) {
            try {
                await pool.query(`ALTER TABLE products ${col}`);
            } catch (err) {
                // Ignore "Column already exists" errors if IF NOT EXISTS is not supported or fails
                if (!err.message.includes('Duplicate column')) throw err;
            }
        }

        // Add foreign key constraint if not exists
        try {
            await pool.query(`
                ALTER TABLE products 
                ADD CONSTRAINT fk_product_category 
                FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
            `);
        } catch (err) {
            if (!err.message.includes('Duplicate foreign key')) console.log('Note: Foreign key might already exist, skipping.');
        }
        console.log('✅ Updated products table');

        // 3. Update inventory_logs table
        try {
            await pool.query('ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS user_id INT');
            await pool.query(`
                ALTER TABLE inventory_logs 
                ADD CONSTRAINT fk_inventory_log_user 
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
            `);
        } catch (err) {
            if (!err.message.includes('Duplicate')) console.log('Note: inventory_logs update skipped or column exists.');
        }
        console.log('✅ Updated inventory_logs table');

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
