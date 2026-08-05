const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    console.log('--- SGB Agro: Creating user_fcm_tokens Table ---');
    
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'admin_db',
        port: process.env.DB_PORT || 3306
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_fcm_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                fcm_token VARCHAR(255) NOT NULL UNIQUE,
                device_type VARCHAR(50) DEFAULT 'web',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Table user_fcm_tokens created successfully or already exists.');
    } catch (err) {
        console.error('❌ Table creation failed:', err.message);
    } finally {
        await connection.end();
    }
}

run();
