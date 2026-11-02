/**
 * migrate_temp_order_report.js
 * ─────────────────────────────────────────────────────────────
 * One-time migration to create the `temp_order_report` table.
 * This is a temporary manual tracking layer for telecaller
 * product sales — managed by the Sales Manager panel.
 *
 * Run: node migrate_temp_order_report.js
 * ─────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const pool = await mysql.createPool({
        host:     process.env.DB_HOST,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port:     process.env.DB_PORT || 3306,
        waitForConnections: true,
        connectionLimit: 5,
    });

    const connection = await pool.getConnection();
    console.log('✅ Connected to DB:', process.env.DB_NAME);

    try {
        await connection.beginTransaction();

        // ── Create temp_order_report table ────────────────────
        await connection.query(`
            CREATE TABLE IF NOT EXISTS temp_order_report (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                record_date      DATE NOT NULL COMMENT 'Day the sale was logged',
                telecaller_id    INT NOT NULL COMMENT 'FK → users.user_id',
                telecaller_name  VARCHAR(150) NOT NULL COMMENT 'Denormalized telecaller name',
                product_id       INT NOT NULL COMMENT 'FK → products.product_id',
                product_name     VARCHAR(200) NOT NULL COMMENT 'Denormalized product name',
                unit_price       DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Auto-filled from products table',
                quantity         INT NOT NULL DEFAULT 1 COMMENT 'Units sold',
                final_amount     DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Editable final price (after discounts/advances)',
                notes            TEXT COMMENT 'Optional: discount reason, advance note, etc.',
                recorded_by      INT NOT NULL COMMENT 'FK → users.user_id (the Sales Manager who logged)',
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

                INDEX idx_record_date  (record_date),
                INDEX idx_telecaller   (telecaller_id),
                INDEX idx_product      (product_id),
                INDEX idx_recorded_by  (recorded_by),
                INDEX idx_date_tele    (record_date, telecaller_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
              COMMENT='Temporary manual sales tracking — Sales Manager panel'
        `);

        console.log('✅ Table `temp_order_report` created (or already exists).');

        await connection.commit();
        console.log('✅ Migration complete.');
    } catch (err) {
        await connection.rollback();
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        connection.release();
        await pool.end();
        process.exit(0);
    }
}

migrate();
