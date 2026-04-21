const pool = require('./src/config/db');

async function migrate() {
    console.log('Starting Billing Migration...');
    const connection = await pool.getConnection();

    try {
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
        
        console.log('Updating Orders table...');
        await connection.query(`
            ALTER TABLE orders 
            MODIFY COLUMN order_status ENUM('draft', 'in_review', 'billed', 'packed', 'shipped', 'delivered', 'cancelled') DEFAULT 'draft',
            ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS locked_by INT,
            ADD CONSTRAINT fk_orders_locked_by FOREIGN KEY (locked_by) REFERENCES users(user_id) ON DELETE SET NULL
        `).catch(err => console.log('Orders table update (might already have some columns):', err.message));

        console.log('Creating Settings table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(50) NOT NULL UNIQUE,
                setting_value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        console.log('Seeding Settings...');
        const settings = [
            ['company_name', 'SGB Agro Industries'],
            ['company_state', 'Maharashtra'],
            ['company_gst_number', '27AAACS1234A1Z1'],
            ['invoice_prefix', 'SGB'],
            ['default_tax_mode', 'auto']
        ];
        for (const [key, val] of settings) {
            await connection.query('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_key=setting_key', [key, val]);
        }

        console.log('Recreating Invoices tables for clean billing history...');
        await connection.query('DROP TABLE IF EXISTS invoice_items');
        await connection.query('DROP TABLE IF EXISTS invoices');

        await connection.query(`
            CREATE TABLE invoices (
                invoice_id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT,
                invoice_number VARCHAR(50) UNIQUE,
                invoice_date DATE,
                billing_name VARCHAR(150),
                billing_address TEXT,
                gst_number VARCHAR(20),
                subtotal DECIMAL(10, 2) DEFAULT 0,
                discount DECIMAL(10, 2) DEFAULT 0,
                shipping_charges DECIMAL(10, 2) DEFAULT 0,
                tax_type ENUM('CGST_SGST', 'IGST') DEFAULT 'CGST_SGST',
                cgst DECIMAL(10, 2) DEFAULT 0,
                sgst DECIMAL(10, 2) DEFAULT 0,
                igst DECIMAL(10, 2) DEFAULT 0,
                total_amount DECIMAL(10, 2) DEFAULT 0,
                invoice_status ENUM('draft', 'finalized', 'cancelled') DEFAULT 'draft',
                is_tax_overridden BOOLEAN DEFAULT FALSE,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
                FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);

        await connection.query(`
            CREATE TABLE invoice_items (
                invoice_item_id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT,
                product_id INT,
                quantity INT NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                gst_percentage DECIMAL(5, 2) DEFAULT 0,
                total DECIMAL(10, 2) NOT NULL,
                FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE SET NULL
            )
        `);

        console.log('Creating/Updating Payments table...');
        await connection.query('DROP TABLE IF EXISTS payments');
        await connection.query(`
            CREATE TABLE payments (
                payment_id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT,
                amount DECIMAL(10, 2) NOT NULL,
                payment_mode VARCHAR(50),
                payment_type ENUM('advance', 'final', 'partial') DEFAULT 'partial',
                payment_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
                proof_url TEXT,
                verified_by INT,
                verified_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
                FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);

        console.log('Creating Invoice Logs table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS invoice_logs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT NULL,
                order_id INT NULL,
                action VARCHAR(255) NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_by INT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE SET NULL,
                FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
                FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);

        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('Migration Completed Successfully! ✅');
    } catch (err) {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.error('Migration Failed! ❌', err);
    } finally {
        connection.release();
        process.exit();
    }
}

migrate();
