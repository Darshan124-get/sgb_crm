const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runSeed() {
    console.log('--- SGB Agro: Starting Data Seeding ---');
    
    // 1. Setup DB Connection
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'admin_db',
        multipleStatements: true
    });

    try {
        // 2. Read SQL File - Allow custom file via argument
        const targetFile = process.argv[2] || 'seed_demo_data.sql';
        const sqlPath = path.join(__dirname, targetFile);
        
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`File not found: ${sqlPath}`);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Executing seed script: ${targetFile}...`);
        await connection.query(sql);
        
        console.log('✅ SEEDING COMPLETE');
        
        // 3. Count check
        const [leads] = await connection.query('SELECT COUNT(*) as count FROM leads');
        const [orders] = await connection.query('SELECT COUNT(*) as count FROM orders');
        
        console.log(`Leads in DB: ${leads[0].count}`);
        console.log(`Orders in DB: ${orders[0].count}`);

    } catch (err) {
        console.error('❌ SEEDING FAILED:', err.message);
    } finally {
        await connection.end();
    }
}

runSeed();
