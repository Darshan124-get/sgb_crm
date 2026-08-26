const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'admin_db',
        port: parseInt(process.env.DB_PORT) || 3306
    };
    const pool = mysql.createPool(config);

    try {
        console.log('🚀 Starting Chatbot DB Tables Migration...');

        // 1. Create chatbot_flows
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_flows (
                flow_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                description TEXT,
                category VARCHAR(50) DEFAULT 'enquiry',
                status ENUM('draft', 'active', 'paused', 'archived') DEFAULT 'draft',
                active_version_id INT DEFAULT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_flows table');

        // 2. Create chatbot_flow_versions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_flow_versions (
                version_id INT AUTO_INCREMENT PRIMARY KEY,
                flow_id INT NOT NULL,
                version_number DECIMAL(4,2) NOT NULL,
                status ENUM('draft', 'published') DEFAULT 'draft',
                published_at TIMESTAMP NULL,
                published_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (flow_id) REFERENCES chatbot_flows(flow_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_flow_versions table');

        // 3. Create chatbot_nodes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_nodes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                version_id INT NOT NULL,
                node_key VARCHAR(100) NOT NULL,
                node_type VARCHAR(50) NOT NULL,
                name VARCHAR(150) NOT NULL,
                position_x INT DEFAULT 0,
                position_y INT DEFAULT 0,
                config JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (version_id) REFERENCES chatbot_flow_versions(version_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_nodes table');

        // 4. Create chatbot_edges
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_edges (
                id INT AUTO_INCREMENT PRIMARY KEY,
                version_id INT NOT NULL,
                source_node_key VARCHAR(100) NOT NULL,
                target_node_key VARCHAR(100) NOT NULL,
                source_handle VARCHAR(150) DEFAULT NULL,
                target_handle VARCHAR(150) DEFAULT NULL,
                condition_key VARCHAR(100) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (version_id) REFERENCES chatbot_flow_versions(version_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_edges table');

        // 5. Create chatbot_sessions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_sessions (
                session_id INT AUTO_INCREMENT PRIMARY KEY,
                flow_id INT NOT NULL,
                version_id INT NOT NULL,
                lead_id INT DEFAULT NULL,
                phone VARCHAR(20) NOT NULL,
                current_node_key VARCHAR(100) DEFAULT 'node-start',
                status ENUM('active', 'paused_for_human', 'completed', 'expired') DEFAULT 'active',
                variables JSON DEFAULT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                paused_at TIMESTAMP NULL,
                completed_at TIMESTAMP NULL,
                FOREIGN KEY (flow_id) REFERENCES chatbot_flows(flow_id) ON DELETE CASCADE,
                FOREIGN KEY (version_id) REFERENCES chatbot_flow_versions(version_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_sessions table');

        // 6. Create chatbot_executions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_executions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                node_key VARCHAR(100) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                input TEXT,
                output TEXT,
                status VARCHAR(50) DEFAULT 'success',
                error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES chatbot_sessions(session_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_executions table');

        // 7. Create chatbot_settings
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ai_fallback_enabled BOOLEAN DEFAULT TRUE,
                ai_model VARCHAR(50) DEFAULT 'gpt-4o-mini',
                ai_temperature DECIMAL(2,1) DEFAULT 0.3,
                default_fallback_msg TEXT NOT NULL,
                max_fallback_attempts INT DEFAULT 2,
                webhook_url VARCHAR(255) DEFAULT NULL,
                webhook_token VARCHAR(255) DEFAULT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_settings table');

        // 8. Create chatbot_audit_logs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chatbot_audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                flow_id INT NOT NULL,
                version_id INT DEFAULT NULL,
                user_id INT NULL,
                action VARCHAR(100) NOT NULL,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (flow_id) REFERENCES chatbot_flows(flow_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created chatbot_audit_logs table');

        // Seed default settings if empty
        const [settingsRows] = await pool.query('SELECT COUNT(*) as count FROM chatbot_settings');
        if (settingsRows[0].count === 0) {
            await pool.query(`
                INSERT INTO chatbot_settings (default_fallback_msg, webhook_url) VALUES 
                ('I\\'m sorry, I didn\\'t quite catch that. Would you like to connect with a sales representative?', 'https://api.sgbagro.com/v1/webhooks/whatsapp')
            `);
            console.log('🌱 Seeded default chatbot settings');
        }

        // Seed products if empty
        const [productRows] = await pool.query('SELECT COUNT(*) as count FROM products');
        let seededProductIds = {};
        if (productRows[0].count === 0) {
            // Seed a category first
            const [catResult] = await pool.query(`INSERT INTO categories (name, description) VALUES ('Farm Machinery', 'Rotavators, Cultivators and Agri Equipment')`);
            const catId = catResult.insertId;

            const productsToSeed = [
                { name: 'Machine 12K', sku: 'M12K', price: 12000.00, desc: 'Best performance for small scale farms.' },
                { name: 'Machine 16K', sku: 'M16K', price: 16000.00, desc: 'Heavy duty engine tractor attachments.' },
                { name: 'Machine 21K', sku: 'M21K', price: 21000.00, desc: 'Premium multi-speed crawler rotavator.' },
                { name: 'Side Pack 1', sku: 'SP1', price: 9999.00, desc: 'Compact side-pack petrol brush cutter.' },
                { name: 'Side Pack 2', sku: 'SP2', price: 11499.00, desc: 'Pro side-pack multi-brush cutter.' }
            ];

            for (const prod of productsToSeed) {
                const [result] = await pool.query(`
                    INSERT INTO products (name, category_id, sku, selling_price, description, status) 
                    VALUES (?, ?, ?, ?, ?, 'active')
                `, [prod.name, catId, prod.sku, prod.price, prod.desc]);
                seededProductIds[prod.name] = result.insertId;
            }
            console.log('🌱 Seeded default demo products:', seededProductIds);
        } else {
            // Fetch existing products to map IDs
            const [rows] = await pool.query('SELECT product_id, name FROM products');
            rows.forEach(r => {
                seededProductIds[r.name] = r.product_id;
            });
        }

        // Seed demo flows if empty
        const [flowRows] = await pool.query('SELECT COUNT(*) as count FROM chatbot_flows');
        if (flowRows[0].count === 0) {
            console.log('🌱 Seeding demo flows...');

            // Flow 1: Full Set / Trolley Enquiry
            const [flowResult] = await pool.query(`
                INSERT INTO chatbot_flows (name, description, category, status) 
                VALUES ('Full Set / Trolley Enquiry', 'WhatsApp flow to qualify machinery inquiries.', 'enquiry', 'active')
            `);
            const flowId = flowResult.insertId;

            const [versionResult] = await pool.query(`
                INSERT INTO chatbot_flow_versions (flow_id, version_number, status, published_at) 
                VALUES (?, 1.0, 'published', NOW())
            `, [flowId]);
            const versionId = versionResult.insertId;

            // Update active_version_id
            await pool.query('UPDATE chatbot_flows SET active_version_id = ? WHERE flow_id = ?', [versionId, flowId]);

            // Seed Nodes
            const nodes = [
                {
                    key: 'node-start',
                    type: 'start',
                    name: 'Start',
                    x: 80, y: 250,
                    config: { triggerType: 'Keyword', keywords: 'trolley, full set, machine' }
                },
                {
                    key: 'node-1',
                    type: 'question',
                    name: 'Step 1',
                    x: 280, y: 250,
                    config: {
                        question: 'Q: Sir do you need a full set or Trolley ?',
                        responseType: 'buttons',
                        choices: ['Full Set', 'Trolley'],
                        options: [
                            { label: 'Full Set', value: 'full_set', nextNode: 'node-2' },
                            { label: 'Trolley', value: 'trolley', nextNode: 'node-3' }
                        ],
                        saveResponseTo: 'product_interest'
                    }
                },
                {
                    key: 'node-2',
                    type: 'question',
                    name: 'Step 2',
                    x: 520, y: 100,
                    config: {
                        question: 'Q: How much Acre land do you have sir ?\n(Sir nimm jaaga estu ide ant gottu adra, navu machine suggest madtivi sir)',
                        responseType: 'buttons',
                        choices: ['1. Below 2 Acre', '2. 2 - 5 Acre', '3. More than 5 Acre'],
                        options: [
                            { label: '1. Below 2 Acre', value: 'below_2_acre', nextNode: 'node-4' },
                            { label: '2. 2 - 5 Acre', value: '2_5_acre', nextNode: 'node-5' },
                            { label: '3. More than 5 Acre', value: 'more_5_acre', nextNode: 'node-6' }
                        ],
                        saveResponseTo: 'land_acres'
                    }
                },
                {
                    key: 'node-3',
                    type: 'question',
                    name: 'Step: Brush Cutter',
                    x: 520, y: 440,
                    config: {
                        question: 'Q: Which brush cutter do you have sir?',
                        responseType: 'buttons',
                        choices: ['1. Side pack 1', '2. Side pack 2', '3. Don\'t know'],
                        options: [
                            { label: '1. Side pack 1', value: 'side_pack_1', nextNode: 'node-7' },
                            { label: '2. Side pack 2', value: 'side_pack_2', nextNode: 'node-8' },
                            { label: '3. Don\'t know', value: 'dont_know', nextNode: 'node-9' }
                        ],
                        saveResponseTo: 'brush_cutter_type'
                    }
                },
                {
                    key: 'node-4',
                    type: 'product',
                    name: 'Send details of Machine 12K',
                    x: 780, y: 40,
                    config: {
                        productId: seededProductIds['Machine 12K'] || 1,
                        product: 'Machine 12K',
                        message: 'Send details of Machine 12K',
                        nextNode: 'node-10'
                    }
                },
                {
                    key: 'node-5',
                    type: 'product',
                    name: 'Send details of Machine 16K & 21K',
                    x: 780, y: 160,
                    config: {
                        productId: seededProductIds['Machine 16K'] || 2,
                        product: 'Machine 16K & 21K',
                        message: 'Send details of Machine 16K & 21K',
                        nextNode: 'node-10'
                    }
                },
                {
                    key: 'node-6',
                    type: 'product',
                    name: 'Send details of Machine 21K',
                    x: 780, y: 280,
                    config: {
                        productId: seededProductIds['Machine 21K'] || 3,
                        product: 'Machine 21K',
                        message: 'Send details of Machine 21K',
                        nextNode: 'node-10'
                    }
                },
                {
                    key: 'node-7',
                    type: 'product',
                    name: 'Send details of Side Pack 1',
                    x: 780, y: 400,
                    config: {
                        productId: seededProductIds['Side Pack 1'] || 4,
                        product: 'Side Pack 1',
                        message: 'Send details of Side Pack 1',
                        nextNode: 'node-10'
                    }
                },
                {
                    key: 'node-8',
                    type: 'product',
                    name: 'Send details of Side Pack 2',
                    x: 780, y: 520,
                    config: {
                        productId: seededProductIds['Side Pack 2'] || 5,
                        product: 'Side Pack 2',
                        message: 'Send details of Side Pack 2',
                        nextNode: 'node-10'
                    }
                },
                {
                    key: 'node-9',
                    type: 'message',
                    name: 'Reply Message: Photo Request',
                    x: 780, y: 640,
                    config: {
                        message: 'Reply Message:\nSir please send photo of your brush cutter',
                        inputType: 'image',
                        nextNode: 'node-10'
                    }
                },
                {
                    key: 'node-10',
                    type: 'question',
                    name: 'Step 3',
                    x: 1050, y: 280,
                    config: {
                        question: 'Q: Right time to contact you ?\n(sir nimage call madalu sariyada samaya?)',
                        responseType: 'buttons',
                        choices: ['1. 9:30 - 1:00 PM', '2. 2:30 - 6:00 PM'],
                        options: [
                            { label: '1. 9:30 - 1:00 PM', value: 'morning', nextNode: 'node-11' },
                            { label: '2. 2:30 - 6:00 PM', value: 'evening', nextNode: 'node-11' }
                        ],
                        saveResponseTo: 'preferred_contact_time'
                    }
                },
                {
                    key: 'node-11',
                    type: 'text_input',
                    name: 'Step 4',
                    x: 1300, y: 280,
                    config: {
                        question: 'Q: Please share your Name & Place\n(Sir nimm hesaru mattu ooru tillisi)',
                        choices: ['Name & Place'],
                        options: [{ label: 'Name & Place', value: 'name_place', nextNode: 'node-12' }],
                        saveResponseTo: 'name_place',
                        nextNode: 'node-12'
                    }
                },
                {
                    key: 'node-12',
                    type: 'create_lead',
                    name: 'Create Lead',
                    x: 1480, y: 280,
                    config: {
                        nextNode: 'node-13'
                    }
                },
                {
                    key: 'node-13',
                    type: 'end',
                    name: 'End',
                    x: 1640, y: 280,
                    config: {
                        message: 'Thank You!\nOur team will contact you soon.'
                    }
                }
            ];

            for (const node of nodes) {
                await pool.query(`
                    INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [versionId, node.key, node.type, node.name, node.x, node.y, JSON.stringify(node.config)]);
            }

            // Seed Edges
            const edges = [
                { source: 'node-start', target: 'node-1' },
                { source: 'node-1', target: 'node-2', sourceHandle: 'Full Set' },
                { source: 'node-1', target: 'node-3', sourceHandle: 'Trolley' },
                { source: 'node-2', target: 'node-4', sourceHandle: '1. Below 2 Acre' },
                { source: 'node-2', target: 'node-5', sourceHandle: '2. 2 - 5 Acre' },
                { source: 'node-2', target: 'node-6', sourceHandle: '3. More than 5 Acre' },
                { source: 'node-3', target: 'node-7', sourceHandle: '1. Side pack 1' },
                { source: 'node-3', target: 'node-8', sourceHandle: '2. Side pack 2' },
                { source: 'node-3', target: 'node-9', sourceHandle: "3. Don't know" },
                { source: 'node-4', target: 'node-10' },
                { source: 'node-5', target: 'node-10' },
                { source: 'node-6', target: 'node-10' },
                { source: 'node-7', target: 'node-10' },
                { source: 'node-8', target: 'node-10' },
                { source: 'node-9', target: 'node-10' },
                { source: 'node-10', target: 'node-11', sourceHandle: '1. 9:30 - 1:00 PM' },
                { source: 'node-10', target: 'node-11', sourceHandle: '2. 2:30 - 6:00 PM' },
                { source: 'node-11', target: 'node-12' },
                { source: 'node-12', target: 'node-13' }
            ];

            for (const edge of edges) {
                await pool.query(`
                    INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) 
                    VALUES (?, ?, ?, ?, ?)
                `, [versionId, edge.source, edge.target, edge.sourceHandle || null, null]);
            }

            console.log('🌱 Seeded Flow: "Full Set / Trolley Enquiry" [Version 1.0]');

            // Flow 2: Dumper Enquiry
            const [flowResult2] = await pool.query(`
                INSERT INTO chatbot_flows (name, description, category, status) 
                VALUES ('Dumper Enquiry', 'WhatsApp flow for dumper wheelbarrow specifications.', 'enquiry', 'draft')
            `);
            const flowId2 = flowResult2.insertId;

            const [versionResult2] = await pool.query(`
                INSERT INTO chatbot_flow_versions (flow_id, version_number, status) 
                VALUES (?, 1.0, 'draft')
            `, [flowId2]);
            const versionId2 = versionResult2.insertId;

            // Seed Nodes for Dumper Flow
            const dumperNodes = [
                {
                    key: 'node-start',
                    type: 'start',
                    name: 'Start',
                    x: 400, y: 50,
                    config: { triggerType: 'Keyword', keywords: 'dumper, barrow' }
                },
                {
                    key: 'node-d1',
                    type: 'question',
                    name: 'Usage Purpose',
                    x: 400, y: 180,
                    config: {
                        question: 'What purpose are you looking for?',
                        responseType: 'buttons',
                        options: [
                            { label: 'Construction', value: 'const', nextNode: 'node-d2' },
                            { label: 'Agricultural', value: 'agri', nextNode: 'node-d2' }
                        ],
                        saveResponseTo: 'purpose'
                    }
                },
                {
                    key: 'node-d2',
                    type: 'question',
                    name: 'Barrow Type',
                    x: 400, y: 310,
                    config: {
                        question: 'Normal Wheelbarrow or Dumper Wheelbarrow?',
                        responseType: 'buttons',
                        options: [
                            { label: 'Normal Wheelbarrow', value: 'normal', nextNode: 'node-d3' },
                            { label: 'Dumper Wheelbarrow', value: 'dumper', nextNode: 'node-d4' }
                        ],
                        saveResponseTo: 'barrow_type'
                    }
                },
                {
                    key: 'node-d3',
                    type: 'message',
                    name: 'Normal Info',
                    x: 250, y: 440,
                    config: {
                        message: 'SGB Normal Wheelbarrow: ₹3,500. Features heavy-duty iron wheel & solid stand.',
                        nextNode: 'node-d5'
                    }
                },
                {
                    key: 'node-d4',
                    type: 'message',
                    name: 'Dumper Info',
                    x: 550, y: 440,
                    config: {
                        message: 'SGB Dumper Wheelbarrow: ₹6,500. Features dual bearing wheel & tilt-discharge box.',
                        nextNode: 'node-d5'
                    }
                },
                {
                    key: 'node-d5',
                    type: 'question',
                    name: 'Contact Slot',
                    x: 400, y: 570,
                    config: {
                        question: 'Right time to contact you?',
                        responseType: 'buttons',
                        options: [
                            { label: '9:30 AM - 1:00 PM', value: 'morning', nextNode: 'node-d6' },
                            { label: '2:30 PM - 6:00 PM', value: 'evening', nextNode: 'node-d6' }
                        ],
                        saveResponseTo: 'preferred_contact_time'
                    }
                },
                {
                    key: 'node-d6',
                    type: 'text_input',
                    name: 'Collect Name/Place',
                    x: 400, y: 700,
                    config: {
                        question: 'Please share your Name & Place',
                        saveResponseTo: 'name_place',
                        nextNode: 'node-d7'
                    }
                },
                {
                    key: 'node-d7',
                    type: 'create_lead',
                    name: 'Create Dumper Lead',
                    x: 400, y: 820,
                    config: {
                        nextNode: 'node-d8'
                    }
                },
                {
                    key: 'node-d8',
                    type: 'end',
                    name: 'Dumper End',
                    x: 400, y: 940,
                    config: {
                        message: 'Thank you! SGB team will coordinate shortly.'
                    }
                }
            ];

            for (const node of dumperNodes) {
                await pool.query(`
                    INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [versionId2, node.key, node.type, node.name, node.x, node.y, JSON.stringify(node.config)]);
            }

            // Seed Dumper Edges
            const dumperEdges = [
                { source: 'node-start', target: 'node-d1' },
                { source: 'node-d1', target: 'node-d2', sourceHandle: 'Construction' },
                { source: 'node-d1', target: 'node-d2', sourceHandle: 'Agricultural' },
                { source: 'node-d2', target: 'node-d3', sourceHandle: 'Normal Wheelbarrow' },
                { source: 'node-d2', target: 'node-d4', sourceHandle: 'Dumper Wheelbarrow' },
                { source: 'node-d3', target: 'node-d5' },
                { source: 'node-d4', target: 'node-d5' },
                { source: 'node-d5', target: 'node-d6', sourceHandle: '9:30 AM - 1:00 PM' },
                { source: 'node-d5', target: 'node-d6', sourceHandle: '2:30 PM - 6:00 PM' },
                { source: 'node-d6', target: 'node-d7' },
                { source: 'node-d7', target: 'node-d8' }
            ];

            for (const edge of dumperEdges) {
                await pool.query(`
                    INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) 
                    VALUES (?, ?, ?, ?, ?)
                `, [versionId2, edge.source, edge.target, edge.sourceHandle || null, null]);
            }

            console.log('🌱 Seeded Flow: "Dumper Enquiry" [Version 1.0 (Draft)]');
        }

        console.log('🎉 Chatbot Database Tables Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Chatbot Migration failed:', err);
        process.exit(1);
    }
}

migrate();
