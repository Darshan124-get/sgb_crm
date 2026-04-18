const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'admin_db'
    });

    try {
        console.log('Running robust schema update...');

        // 1. Create categories table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS categories (
                category_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                parent_id INT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL
            )
        `);
        console.log('✓ Categories table ensured.');

        // 2. Add columns to products
        const [columns] = await pool.query('SHOW COLUMNS FROM products');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('category_id')) {
            await pool.query('ALTER TABLE products ADD COLUMN category_id INT NULL AFTER category');
            await pool.query('ALTER TABLE products ADD FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL');
            console.log('✓ Column category_id added to products.');
        }

        if (!columnNames.includes('image_url')) {
            await pool.query('ALTER TABLE products ADD COLUMN image_url TEXT NULL AFTER name');
            console.log('✓ Column image_url added to products.');
        }

        if (!columnNames.includes('status')) {
            await pool.query("ALTER TABLE products ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active' AFTER min_stock_alert");
            console.log('✓ Column status added to products.');
        }

        if (!columnNames.includes('dealer_price')) {
            await pool.query('ALTER TABLE products ADD COLUMN dealer_price DECIMAL(10,2) DEFAULT 0 AFTER selling_price');
            console.log('✓ Column dealer_price added to products.');
        }

        if (!columnNames.includes('discount_percentage')) {
            await pool.query('ALTER TABLE products ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0 AFTER dealer_price');
            console.log('✓ Column discount_percentage added to products.');
        }

        // 3. Ensure inventory table has correct columns
        const [invColumns] = await pool.query('SHOW COLUMNS FROM inventory');
        const invColumnNames = invColumns.map(c => c.Field);

        if (!invColumnNames.includes('reserved_stock')) {
            await pool.query('ALTER TABLE inventory ADD COLUMN reserved_stock INT DEFAULT 0 AFTER current_stock');
            console.log('✓ Column reserved_stock added to inventory.');
        }

        console.log('Database schema update completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error during schema update:', err);
        process.exit(1);
    }
}

run();
