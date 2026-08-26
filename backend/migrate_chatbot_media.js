const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateChatbotMediaDB() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'admin_db',
        port: parseInt(process.env.DB_PORT) || 3306
    };

    console.log('🚀 Starting Chatbot Products & Media DB Migration...');
    const pool = mysql.createPool(config);

    try {
        // 1. Create chatbot_categories table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                icon VARCHAR(50) DEFAULT 'fa-layer-group',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_categories table');

        // 2. Create chatbot_products table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                sku VARCHAR(100) NOT NULL UNIQUE,
                category VARCHAR(100) NOT NULL,
                price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                status ENUM('active', 'draft') DEFAULT 'active',
                used_in_flows_count INT DEFAULT 0,
                description TEXT,
                image_url TEXT,
                gallery_urls JSON,
                specs JSON,
                tags JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_products table');

        // 3. Create chatbot_media table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_media (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                file_url TEXT NOT NULL,
                file_type ENUM('image', 'video', 'document', 'audio', 'gif', 'other') NOT NULL DEFAULT 'image',
                mime_type VARCHAR(100),
                size_bytes BIGINT NOT NULL DEFAULT 0,
                storage_path VARCHAR(255),
                associated_product_id INT NULL,
                used_in_flows_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (associated_product_id) REFERENCES chatbot_products(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_media table');

        // Seed Categories
        const [catCount] = await pool.query('SELECT COUNT(*) as count FROM chatbot_categories');
        if (catCount[0].count === 0) {
            const categories = [
                { name: 'Full Set Machines', icon: 'fa-layer-group' },
                { name: 'Trolley', icon: 'fa-truck-ramp-box' },
                { name: 'Dumper', icon: 'fa-truck-monster' },
                { name: 'Tractor', icon: 'fa-tractor' },
                { name: 'Brush Cutter', icon: 'fa-scissors' },
                { name: 'Power Sprayer', icon: 'fa-spray-can' },
                { name: 'Attachments', icon: 'fa-plug' },
                { name: 'Accessories', icon: 'fa-boxes-packing' }
            ];
            for (const c of categories) {
                await pool.query('INSERT IGNORE INTO chatbot_categories (name, icon) VALUES (?, ?)', [c.name, c.icon]);
            }
            console.log('🌱 Seeded default chatbot categories');
        }

        // Seed Products
        const [prodCount] = await pool.query('SELECT COUNT(*) as count FROM chatbot_products');
        if (prodCount[0].count === 0) {
            const products = [
                {
                    name: 'Machine 12K',
                    sku: 'FSM-12K',
                    category: 'Full Set Machines',
                    price: 12000.00,
                    status: 'active',
                    used_in_flows_count: 3,
                    description: 'High performance 12K power tiller suitable for small and medium farms. Easy to operate and maintain with durable diesel engine.',
                    image_url: '../../assets/images/red_power_tiller.jpg',
                    gallery_urls: JSON.stringify(['../../assets/images/red_power_tiller.jpg', '../../assets/images/mini_tractor.jpg']),
                    specs: JSON.stringify([
                        { key: 'Engine Power', val: '12 HP' },
                        { key: 'Fuel Type', val: 'Diesel' },
                        { key: 'Starting System', val: 'Recoil / Key Start' },
                        { key: 'Transmission', val: 'Gear Drive' },
                        { key: 'Tilling Width', val: '80-110 cm' },
                        { key: 'Tilling Depth', val: '15-30 cm' },
                        { key: 'Weight', val: '135 kg' }
                    ]),
                    tags: JSON.stringify(['full set', 'power tiller', '12k', 'agriculture'])
                },
                {
                    name: 'Machine 16K',
                    sku: 'FSM-16K',
                    category: 'Full Set Machines',
                    price: 16000.00,
                    status: 'active',
                    used_in_flows_count: 2,
                    description: 'Heavy-duty 16 HP power tiller with double electric starter and heavy gearbox for tough terrain.',
                    image_url: '../../assets/images/mini_tractor.jpg',
                    gallery_urls: JSON.stringify(['../../assets/images/mini_tractor.jpg', '../../assets/images/red_power_tiller.jpg']),
                    specs: JSON.stringify([
                        { key: 'Engine Power', val: '16 HP' },
                        { key: 'Fuel Type', val: 'Diesel' },
                        { key: 'Tilling Width', val: '120 cm' },
                        { key: 'Weight', val: '160 kg' }
                    ]),
                    tags: JSON.stringify(['full set', '16k', 'heavy duty'])
                },
                {
                    name: 'Machine 21K',
                    sku: 'FSM-21K',
                    category: 'Full Set Machines',
                    price: 21000.00,
                    status: 'draft',
                    used_in_flows_count: 0,
                    description: 'Ultimate 21 HP Power Tiller designed for large commercial farms.',
                    image_url: '../../assets/images/red_power_tiller.jpg',
                    gallery_urls: JSON.stringify(['../../assets/images/red_power_tiller.jpg']),
                    specs: JSON.stringify([
                        { key: 'Engine Power', val: '21 HP' },
                        { key: 'Fuel Type', val: 'Diesel' }
                    ]),
                    tags: JSON.stringify(['full set', '21k', 'commercial'])
                },
                {
                    name: 'Back Pack 1',
                    sku: 'BP-01',
                    category: 'Attachments',
                    price: 4500.00,
                    status: 'active',
                    used_in_flows_count: 5,
                    description: 'Backpack attachment pack with ergonomic harness, furrower and ditching blades.',
                    image_url: '../../assets/images/red_power_tiller.jpg',
                    gallery_urls: JSON.stringify(['../../assets/images/red_power_tiller.jpg']),
                    specs: JSON.stringify([
                        { key: 'Blade Material', val: 'Forged Manganese Steel' },
                        { key: 'Compatibility', val: 'All 7HP-15HP Tillers' },
                        { key: 'Harness Type', val: 'Padded Backpack Harness' }
                    ]),
                    tags: JSON.stringify(['back pack', 'backpack', 'furrower', 'attachment'])
                },
                {
                    name: 'Back Pack 2',
                    sku: 'BP-02',
                    category: 'Attachments',
                    price: 5800.00,
                    status: 'active',
                    used_in_flows_count: 1,
                    description: 'Advanced backpack multi-cutter attachment with ridger and adjustable wings.',
                    image_url: '../../assets/images/mini_tractor.jpg',
                    gallery_urls: JSON.stringify(['../../assets/images/mini_tractor.jpg']),
                    specs: JSON.stringify([
                        { key: 'Weight', val: '18 kg' },
                        { key: 'Frame', val: 'Reinforced Steel Backpack Frame' }
                    ]),
                    tags: JSON.stringify(['backpack', 'ridger', 'attachment'])
                },
                {
                    name: 'Normal Wheel Barrow',
                    sku: 'WB-NRM',
                    category: 'Trolley',
                    price: 3200.00,
                    status: 'active',
                    used_in_flows_count: 4,
                    description: 'Single pneumatic wheel barrow with 100L capacity heavy steel tray.',
                    image_url: '../../assets/images/red_power_tiller.jpg',
                    gallery_urls: JSON.stringify(['../../assets/images/red_power_tiller.jpg']),
                    specs: JSON.stringify([
                        { key: 'Capacity', val: '100 Liters / 150 kg' },
                        { key: 'Wheel Type', val: 'Heavy Duty Pneumatic' }
                    ]),
                    tags: JSON.stringify(['wheelbarrow', 'trolley'])
                },
                {
                    name: 'Dumper Wheel Barrow',
                    sku: 'WB-DMP',
                    category: 'Dumper',
                    price: 9999.00,
                    status: 'active',
                    used_in_flows_count: 2,
                    description: 'Self-dumping tipping mechanism wheel barrow for easy unloading.',
                    image_url: '../../assets/images/mini_tractor.jpg',
                    gallery_urls: JSON.stringify(['../../assets/images/mini_tractor.jpg']),
                    specs: JSON.stringify([
                        { key: 'Payload', val: '300 kg' },
                        { key: 'Tipping Angle', val: '75 Degrees' }
                    ]),
                    tags: JSON.stringify(['dumper', 'tipper', 'trolley'])
                },
                {
                    name: 'Mini Tractor 18HP',
                    sku: 'TRAC-18',
                    category: 'Tractor',
                    price: 145000.00,
                    status: 'active',
                    used_in_flows_count: 6,
                    description: 'Compact 4WD 18HP mini tractor suitable for orchard cultivation, plowing, and spraying.',
                    image_url: '../../assets/images/mini_tractor.jpg',
                    gallery_urls: JSON.stringify(['../../assets/images/mini_tractor.jpg', '../../assets/images/red_power_tiller.jpg']),
                    specs: JSON.stringify([
                        { key: 'Horsepower', val: '18 HP' },
                        { key: 'Drive', val: '4WD' },
                        { key: 'PTO Speed', val: '540 / 1000 RPM' },
                        { key: 'Lift Capacity', val: '500 kg' }
                    ]),
                    tags: JSON.stringify(['tractor', 'mini tractor', '4wd'])
                }
            ];

            for (const p of products) {
                await pool.query(`
                    INSERT INTO chatbot_products 
                    (name, sku, category, price, status, used_in_flows_count, description, image_url, gallery_urls, specs, tags)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [p.name, p.sku, p.category, p.price, p.status, p.used_in_flows_count, p.description, p.image_url, p.gallery_urls, p.specs, p.tags]);
            }
            console.log('🌱 Seeded default chatbot products');
        }

        // Seed Media Files
        const [mediaCount] = await pool.query('SELECT COUNT(*) as count FROM chatbot_media');
        if (mediaCount[0].count === 0) {
            const mediaItems = [
                { filename: 'red_power_tiller.jpg', original_name: 'Red Power Tiller.jpg', file_url: '../../assets/images/red_power_tiller.jpg', file_type: 'image', mime_type: 'image/jpeg', size_bytes: 450000, storage_path: 'chatbot-media/red_power_tiller.jpg' },
                { filename: 'mini_tractor.jpg', original_name: 'Mini Tractor 18HP.jpg', file_url: '../../assets/images/mini_tractor.jpg', file_type: 'image', mime_type: 'image/jpeg', size_bytes: 620000, storage_path: 'chatbot-media/mini_tractor.jpg' }
            ];

            for (const m of mediaItems) {
                await pool.query(`
                    INSERT INTO chatbot_media (filename, original_name, file_url, file_type, mime_type, size_bytes, storage_path)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [m.filename, m.original_name, m.file_url, m.file_type, m.mime_type, m.size_bytes, m.storage_path]);
            }
            console.log('🌱 Seeded default chatbot media files');
        }

        console.log('🎉 Chatbot Products & Media DB Migration Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Error:', err);
        process.exit(1);
    }
}

migrateChatbotMediaDB();
