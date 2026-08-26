const pool = require('../src/config/db');

async function reseedTrolleyFlow() {
    console.log('🔄 Re-seeding "Full Set / Trolley Enquiry" flow in live database...');
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Check if Flow exists
        const [flows] = await connection.query('SELECT flow_id, active_version_id FROM chatbot_flows WHERE name LIKE "%Full Set%" OR name LIKE "%Trolley%" LIMIT 1');
        
        let flowId, versionId;
        if (flows.length > 0) {
            flowId = flows[0].flow_id;
            versionId = flows[0].active_version_id;
            console.log(`Found existing flow ID ${flowId}, version ID ${versionId}`);
        } else {
            const [flowResult] = await connection.query(
                'INSERT INTO chatbot_flows (name, description, category, status) VALUES (?, ?, ?, ?)',
                ['Full Set / Trolley Enquiry', 'Complete lead qualification flow for agri machinery, rotavators, and trolley attachments.', 'enquiry', 'active']
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

        // 3. Define EXACT 13 nodes from diagram
        const nodes = [
            { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 250, config: { triggerType: 'Keyword', keywords: 'trolley, full set, machine' } },
            { key: 'node-1', type: 'question', name: 'Step 1', x: 280, y: 250, config: { question: 'Q: Sir do you need a full set or Trolley ?', responseType: 'buttons', choices: ['Full Set', 'Trolley'], options: [{ label: 'Full Set', value: 'full_set', nextNode: 'node-2' }, { label: 'Trolley', value: 'trolley', nextNode: 'node-3' }], saveResponseTo: 'product_interest' } },
            { key: 'node-2', type: 'question', name: 'Step 2', x: 520, y: 100, config: { question: 'Q: How much Acre land do you have sir ?\n(Sir nimm jaaga estu ide ant gottu adra, navu machine suggest madtivi sir)', responseType: 'buttons', choices: ['1. Below 2 Acre', '2. 2 - 5 Acre', '3. More than 5 Acre'], options: [{ label: '1. Below 2 Acre', value: 'below_2_acre', nextNode: 'node-4' }, { label: '2. 2 - 5 Acre', value: '2_5_acre', nextNode: 'node-5' }, { label: '3. More than 5 Acre', value: 'more_5_acre', nextNode: 'node-6' }], saveResponseTo: 'land_acres' } },
            { key: 'node-3', type: 'question', name: 'Step: Brush Cutter', x: 520, y: 440, config: { question: 'Q: Which brush cutter do you have sir?', responseType: 'buttons', choices: ['1. Side pack 1', '2. Side pack 2', '3. Don\'t know'], options: [{ label: '1. Side pack 1', value: 'side_pack_1', nextNode: 'node-7' }, { label: '2. Side pack 2', value: 'side_pack_2', nextNode: 'node-8' }, { label: '3. Don\'t know', value: 'dont_know', nextNode: 'node-9' }], saveResponseTo: 'brush_cutter_type' } },
            { key: 'node-4', type: 'product', name: 'Send details of Machine 12K', x: 780, y: 40, config: { productId: 1, product: 'Machine 12K', message: 'Send details of Machine 12K', nextNode: 'node-10' } },
            { key: 'node-5', type: 'product', name: 'Send details of Machine 16K & 21K', x: 780, y: 160, config: { productId: 2, product: 'Machine 16K & 21K', message: 'Send details of Machine 16K & 21K', nextNode: 'node-10' } },
            { key: 'node-6', type: 'product', name: 'Send details of Machine 21K', x: 780, y: 280, config: { productId: 3, product: 'Machine 21K', message: 'Send details of Machine 21K', nextNode: 'node-10' } },
            { key: 'node-7', type: 'product', name: 'Send details of Side Pack 1', x: 780, y: 400, config: { productId: 4, product: 'Side Pack 1', message: 'Send details of Side Pack 1', nextNode: 'node-10' } },
            { key: 'node-8', type: 'product', name: 'Send details of Side Pack 2', x: 780, y: 520, config: { productId: 5, product: 'Side Pack 2', message: 'Send details of Side Pack 2', nextNode: 'node-10' } },
            { key: 'node-9', type: 'message', name: 'Reply Message: Photo Request', x: 780, y: 640, config: { message: 'Reply Message:\nSir please send photo of your brush cutter', inputType: 'image', nextNode: 'node-10' } },
            { key: 'node-10', type: 'question', name: 'Step 3', x: 1080, y: 340, config: { question: 'Q: Right time to contact you ?\n(sir nimage call madalu sariyada samaya?)', responseType: 'buttons', choices: ['1. 9:30 - 1:00 PM', '2. 2:30 - 6:00 PM'], options: [{ label: '1. 9:30 - 1:00 PM', value: 'morning', nextNode: 'node-11' }, { label: '2. 2:30 - 6:00 PM', value: 'evening', nextNode: 'node-11' }], saveResponseTo: 'preferred_contact_time' } },
            { key: 'node-11', type: 'text_input', name: 'Step 4', x: 1340, y: 340, config: { question: 'Q: Please share your Name & Place\n(Sir nimm hesaru mattu ooru tillisi)', saveTo: 'name_place', saveResponseTo: 'name_place', nextNode: 'node-12' } },
            { key: 'node-12', type: 'create_lead', name: 'Create Lead', x: 1540, y: 340, config: { fieldMappings: { name: 'name_place', product: 'product_interest', land: 'land_acres', contactTime: 'preferred_contact_time', notes: 'brush_cutter_type' }, nameVar: 'name_place', status: 'new', source: 'WhatsApp Chatbot', nextNode: 'node-13' } },
            { key: 'node-13', type: 'end', name: 'End', x: 1720, y: 340, config: { message: 'Thank You!\nOur team will contact you soon.' } }
        ];

        for (const n of nodes) {
            await connection.query(
                'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [versionId, n.key, n.type, n.name, n.x, n.y, JSON.stringify(n.config)]
            );
        }

        // 4. Define EXACT 18 edges from diagram
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

        for (const e of edges) {
            await connection.query(
                'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                [versionId, e.source, e.target, e.sourceHandle || null, null]
            );
        }

        await connection.commit();
        console.log('✅ Successfully updated "Full Set / Trolley Enquiry" flow in DB with 13 nodes and 18 edges!');
    } catch (err) {
        await connection.rollback();
        console.error('❌ Error updating flow in DB:', err);
    } finally {
        connection.release();
        process.exit(0);
    }
}

reseedTrolleyFlow();
