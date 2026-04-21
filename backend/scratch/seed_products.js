const mysql = require('mysql2/promise');
require('dotenv').config();

async function seed() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };
    const pool = mysql.createPool(config);

    try {
        console.log('Seeding demo products...');

        const products = [
            ['Organic Soil Booster', 'Fertilizer', 'High-quality organic soil booster', 'OSB-001', 'Bag', 1500, 1200, 10],
            ['NPK 19:19:19', 'Fertilizer', 'Water soluble fertilizer', 'NPK-19', 'Pack', 800, 650, 20],
            ['Micro Nutrient Mix', 'Nutrients', 'Essential micro nutrients for crops', 'MNM-01', 'Bottle', 450, 350, 50]
        ];

        for (const p of products) {
            const [res] = await pool.query(
                `INSERT INTO products (name, category, description, sku, unit, selling_price, dealer_price, min_stock_alert) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                p
            );
            const productId = res.insertId;

            // Init inventory
            await pool.query(
                'INSERT INTO inventory (product_id, current_stock, reserved_stock) VALUES (?, ?, ?)',
                [productId, 100, 0]
            );
        }

        console.log('✅ Demo products seeded with inventory.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seed();
