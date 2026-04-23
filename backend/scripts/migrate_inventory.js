const pool = require('../src/config/db');

async function migrate() {
    const connection = await pool.getConnection();
    try {
        console.log('🚀 Starting Inventory Migration...');

        // 1. Create categories table
        console.log('Checking categories table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS categories (
                category_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                parent_id INT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL
            )
        `);
        console.log('✅ categories table ready.');

        // 2. Modify products table
        console.log('Updating products table schema...');
        const [columns] = await connection.query('SHOW COLUMNS FROM products');
        const hasCategoryId = columns.find(c => c.Field === 'category_id');
        const hasCategoryStr = columns.find(c => c.Field === 'category');
        const hasDiscount = columns.find(c => c.Field === 'discount_percentage');
        const hasStatus = columns.find(c => c.Field === 'status');
        const hasImageUrl = columns.find(c => c.Field === 'image_url');

        if (!hasCategoryId) {
            console.log('Adding category_id to products...');
            await connection.query('ALTER TABLE products ADD COLUMN category_id INT AFTER name');
            await connection.query('ALTER TABLE products ADD CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL');
        }

        if (!hasDiscount) {
            console.log('Adding discount_percentage to products...');
            await connection.query('ALTER TABLE products ADD COLUMN discount_percentage DECIMAL(5, 2) DEFAULT 0 AFTER dealer_price');
        }

        if (!hasStatus) {
            console.log('Adding status to products...');
            await connection.query("ALTER TABLE products ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active' AFTER min_stock_alert");
        }

        if (!hasImageUrl) {
            console.log('Adding image_url to products...');
            await connection.query('ALTER TABLE products ADD COLUMN image_url TEXT AFTER status');
        }

        // 3. Migrate data if needed
        if (hasCategoryStr && !hasCategoryId) {
             // This is a bit complex to do automatically without unique names, but we can try to create categories from existing strings
             const [prods] = await connection.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""');
             for (const p of prods) {
                 await connection.query('INSERT IGNORE INTO categories (name) VALUES (?)', [p.category]);
                 await connection.query('UPDATE products p JOIN categories c ON p.category = c.name SET p.category_id = c.category_id WHERE p.category = ?', [p.category]);
             }
             // await connection.query('ALTER TABLE products DROP COLUMN category');
        }

        console.log('✅ products table updated.');

        // 4. Fix inventory_logs schema
        console.log('Checking inventory_logs table...');
        const [logCols] = await connection.query('SHOW COLUMNS FROM inventory_logs');
        const hasUserId = logCols.find(c => c.Field === 'user_id');
        const hasCreatedBy = logCols.find(c => c.Field === 'created_by');

        if (hasUserId && !hasCreatedBy) {
            console.log('Renaming user_id to created_by in inventory_logs...');
            await connection.query('ALTER TABLE inventory_logs CHANGE COLUMN user_id created_by INT');
        } else if (hasUserId && hasCreatedBy) {
            console.log('Both user_id and created_by exist. Migrating data...');
            await connection.query('UPDATE inventory_logs SET created_by = user_id WHERE created_by IS NULL');
            
            console.log('Dropping foreign key and user_id column...');
            try {
                await connection.query('ALTER TABLE inventory_logs DROP FOREIGN KEY fk_inventory_log_user');
            } catch (e) {
                console.log('Could not drop FK (might not exist):', e.message);
            }
            try {
                await connection.query('ALTER TABLE inventory_logs DROP COLUMN user_id');
            } catch (e) {
                console.log('Could not drop column:', e.message);
            }
        }

        console.log('✅ Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

migrate();
