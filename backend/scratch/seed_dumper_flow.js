const pool = require('../src/config/db');

async function seedDumperWheelbarrowFlow() {
    console.log('🔄 Seeding/Updating "Dumper Wheelbarrow Enquiry" flow in live database...');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Check if Flow exists
        const [flows] = await connection.query(
            'SELECT flow_id, active_version_id FROM chatbot_flows WHERE name LIKE "%Dumper%" OR name LIKE "%Wheelbarrow%" LIMIT 1'
        );
        
        let flowId, versionId;
        if (flows.length > 0) {
            flowId = flows[0].flow_id;
            const [versions] = await connection.query('SELECT version_id FROM chatbot_flow_versions WHERE flow_id = ? LIMIT 1', [flowId]);
            if (versions.length > 0) {
                versionId = versions[0].version_id;
            } else {
                const [versionResult] = await connection.query(
                    'INSERT INTO chatbot_flow_versions (flow_id, version_number, status, published_at) VALUES (?, 1.0, "published", NOW())',
                    [flowId]
                );
                versionId = versionResult.insertId;
            }
            await connection.query('UPDATE chatbot_flows SET active_version_id = ? WHERE flow_id = ?', [versionId, flowId]);
            console.log(`Found existing flow ID ${flowId}, using version ID ${versionId}`);
        } else {
            const [flowResult] = await connection.query(
                'INSERT INTO chatbot_flows (name, description, category, status) VALUES (?, ?, ?, ?)',
                ['Dumper Wheelbarrow Enquiry', 'Qualifies customers looking for normal vs dumper wheelbarrows for construction or farming.', 'enquiry', 'active']
            );
            flowId = flowResult.insertId;

            const [versionResult] = await connection.query(
                'INSERT INTO chatbot_flow_versions (flow_id, version_number, status, published_at) VALUES (?, 1.0, "published", NOW())',
                [flowId]
            );
            versionId = versionResult.insertId;

            await connection.query('UPDATE chatbot_flows SET active_version_id = ? WHERE flow_id = ?', [versionId, flowId]);
            console.log(`Created new flow ID ${flowId}, version ID ${versionId}`);
        }

        // 2. Clear existing nodes and edges for this version
        await connection.query('DELETE FROM chatbot_nodes WHERE version_id = ?', [versionId]);
        await connection.query('DELETE FROM chatbot_edges WHERE version_id = ?', [versionId]);

        // 3. Define EXACT 9 nodes matching Image 14
        const nodes = [
            { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 300, config: { triggerType: 'Keyword', keywords: 'Dumper, dumper, wheelbarrow' } },
            { key: 'node-1', type: 'text_input', name: 'Step 1', x: 280, y: 220, config: { question: 'Q: What purpose you are looking for ?\n(If you specify its easy for us to suggest model)', saveTo: 'purpose', saveResponseTo: 'purpose', nextNode: 'node-2' } },
            { key: 'node-2', type: 'question', name: 'Step 2', x: 580, y: 220, config: { question: 'Q: Normal Wheel borrow or Dumper Wheel Borrow', responseType: 'buttons', choices: ['1. Normal Wheel Borrow', '2. Dumper Wheel Borrow'], options: [{ label: '1. Normal Wheel Borrow', value: 'normal', nextNode: 'node-p1' }, { label: '2. Dumper Wheel Borrow', value: 'dumper', nextNode: 'node-p2' }], saveResponseTo: 'barrow_type' } },
            { key: 'node-p1', type: 'product', name: 'Send price of Normal Wheel Borrow', x: 880, y: 140, config: { productId: 4, product: 'Normal Wheel Barrow', price: '₹4,500', desc: 'Heavy duty single wheel barrow', message: 'Send price of Normal Wheel Borrow', nextNode: 'node-3' } },
            { key: 'node-p2', type: 'product', name: 'Send price of Dumper Wheel Borrow', x: 880, y: 340, config: { productId: 3, product: 'Dumper Wheel Barrow', price: '₹12,000', desc: 'Heavy duty dual wheel barrow with tilt box', message: 'Send price of Dumper Wheel Borrow', nextNode: 'node-3' } },
            { key: 'node-3', type: 'question', name: 'Step 3', x: 1180, y: 240, config: { question: 'Q: Right time to contact you ?\n(sir nimage call madalu sariyada samaya?)', responseType: 'buttons', choices: ['1. 9:30 - 1:00 PM', '2. 2:30 - 6:00 PM'], options: [{ label: '1. 9:30 - 1:00 PM', value: 'morning', nextNode: 'node-4' }, { label: '2. 2:30 - 6:00 PM', value: 'evening', nextNode: 'node-4' }], saveResponseTo: 'preferred_contact_time' } },
            { key: 'node-4', type: 'text_input', name: 'Step 4', x: 1460, y: 240, config: { question: 'Q: Please share your Name & Place\n(Sir nimm hesaru mattu ooru tillisi)', saveTo: 'name_place', saveResponseTo: 'name_place', nextNode: 'node-lead' } },
            { key: 'node-lead', type: 'create_lead', name: 'Create Lead', x: 1680, y: 240, config: { fieldMappings: { name: 'name_place', product: 'barrow_type', land: 'purpose', contactTime: 'preferred_contact_time' }, nameVar: 'name_place', status: 'new', source: 'WhatsApp Chatbot', nextNode: 'node-end' } },
            { key: 'node-end', type: 'end', name: 'End', x: 1880, y: 240, config: { message: 'Thank You!\nOur team will contact you soon.' } }
        ];

        for (const n of nodes) {
            await connection.query(
                'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [versionId, n.key, n.type, n.name, n.x, n.y, JSON.stringify(n.config)]
            );
        }

        // 4. Define 10 Edges matching Image 14
        const edges = [
            { source: 'node-start', target: 'node-1', handle: null },
            { source: 'node-1', target: 'node-2', handle: null },
            { source: 'node-2', target: 'node-p1', handle: '1. Normal Wheel Borrow' },
            { source: 'node-2', target: 'node-p2', handle: '2. Dumper Wheel Borrow' },
            { source: 'node-p1', target: 'node-3', handle: null },
            { source: 'node-p2', target: 'node-3', handle: null },
            { source: 'node-3', target: 'node-4', handle: '1. 9:30 - 1:00 PM' },
            { source: 'node-3', target: 'node-4', handle: '2. 2:30 - 6:00 PM' },
            { source: 'node-4', target: 'node-lead', handle: null },
            { source: 'node-lead', target: 'node-end', handle: null }
        ];

        for (const e of edges) {
            await connection.query(
                'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle) VALUES (?, ?, ?, ?)',
                [versionId, e.source, e.target, e.handle]
            );
        }

        await connection.commit();
        console.log(`✅ Successfully seeded "Dumper Wheelbarrow Enquiry" flow ID ${flowId} in DB with 9 nodes and 10 edges!`);

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error seeding Dumper Wheelbarrow flow:', error);
    } finally {
        connection.release();
        process.exit();
    }
}

seedDumperWheelbarrowFlow();
