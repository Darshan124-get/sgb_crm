const pool = require('../config/db');
const supabase = require('../config/supabase');
const fs = require('fs');
const path = require('path');

// Helper to log audit events
async function logAudit(connection, flowId, versionId, userId, action, metadata) {
    try {
        await connection.query(
            'INSERT INTO chatbot_audit_logs (flow_id, version_id, user_id, action, metadata) VALUES (?, ?, ?, ?, ?)',
            [flowId, versionId || null, userId || null, action, JSON.stringify(metadata)]
        );
    } catch (err) {
        console.error('[AUDIT ERROR]', err);
    }
}

// 0. Get system predefined templates
exports.getTemplates = async (req, res) => {
    try {
        const templates = [
            {
                id: 'full-set-trolley-enquiry',
                name: 'Full Set / Trolley Enquiry',
                description: 'Complete lead qualification flow for agri machinery, rotavators, and trolley attachments.',
                category: 'Enquiry',
                icon: 'fa-tractor',
                iconColor: 'green-badge',
                badgeText: 'POPULAR',
                usageCount: 42,
                previewNodes: ['Product Choice', 'Acres Land', 'Time Slot', 'Collect Details', 'Create Lead']
            },
            {
                id: 'dumper-wheelbarrow-enquiry',
                name: 'Dumper Wheelbarrow Enquiry',
                description: 'Qualifies customers looking for normal vs dumper wheelbarrows for construction or farming.',
                category: 'Enquiry',
                icon: 'fa-dolly',
                iconColor: 'blue-badge',
                badgeText: 'HIGH CONVERSION',
                usageCount: 28,
                previewNodes: ['Usage Purpose', 'Barrow Model', 'Product Info', 'Contact Slot', 'Create Lead']
            },
            {
                id: 'lead-qualification-booking',
                name: 'Lead Qualification & Booking',
                description: 'Collects customer name, location, requirement details and schedules sales calls.',
                category: 'Lead Capture',
                icon: 'fa-user-check',
                iconColor: 'purple-badge',
                badgeText: 'RECOMMENDED',
                usageCount: 35,
                previewNodes: ['Welcome', 'Select Interest', 'Collect Phone', 'Preferred Time', 'Save Lead']
            },
            {
                id: 'customer-support-faq',
                name: 'Customer Support & FAQ',
                description: 'Automated 24/7 self-service flow for common customer questions and service requests.',
                category: 'Support',
                icon: 'fa-headset',
                iconColor: 'amber-badge',
                badgeText: '24/7 BOT',
                usageCount: 19,
                previewNodes: ['Main Menu', 'FAQ Topics', 'Service Request', 'Escalate to Agent']
            },
            {
                id: 'product-catalog-showcase',
                name: 'Product Catalog Showcase',
                description: 'Displays product specs, photos, and selling prices directly inside WhatsApp chat.',
                category: 'Sales',
                icon: 'fa-boxes-stacked',
                iconColor: 'teal-badge',
                badgeText: 'SHOWCASE',
                usageCount: 31,
                previewNodes: ['Categories', 'Product Specs', 'Price Quote', 'Buy / Contact']
            }
        ];
        res.json(templates);
    } catch (err) {
        console.error('[GET TEMPLATES ERROR]', err);
        res.status(500).json({ message: 'Error fetching templates' });
    }
};

// 0.1 Create flow from template
exports.createFlowFromTemplate = async (req, res) => {
    const { templateId, name, description, category, keywords } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Flow name is required' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create flow record
        const [flowResult] = await connection.query(
            'INSERT INTO chatbot_flows (name, description, category, status) VALUES (?, ?, ?, ?)',
            [name, description || '', category || 'Enquiry', 'draft']
        );
        const flowId = flowResult.insertId;

        // 2. Create version 1.0 (Draft)
        const [versionResult] = await connection.query(
            'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, 1.0, ?)',
            [flowId, 'draft']
        );
        const versionId = versionResult.insertId;

        // 3. Populate nodes & edges based on templateId
        let nodes = [];
        let edges = [];

        if (templateId === 'dumper-wheelbarrow-enquiry') {
            nodes = [
                { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 300, config: { triggerType: 'Keyword', keywords: keywords ? (Array.isArray(keywords) ? keywords.join(', ') : keywords) : 'Dumper, dumper, wheelbarrow' } },
                { key: 'node-1', type: 'text_input', name: 'Step 1', x: 280, y: 220, config: { question: 'Q: What purpose you are looking for ?\n(If you specify its easy for us to suggest model)', saveTo: 'purpose', saveResponseTo: 'purpose', nextNode: 'node-2' } },
                { key: 'node-2', type: 'question', name: 'Step 2', x: 580, y: 220, config: { question: 'Q: Normal Wheel borrow or Dumper Wheel Borrow', responseType: 'buttons', choices: ['1. Normal Wheel Borrow', '2. Dumper Wheel Borrow'], options: [{ label: '1. Normal Wheel Borrow', value: 'normal', nextNode: 'node-p1' }, { label: '2. Dumper Wheel Borrow', value: 'dumper', nextNode: 'node-p2' }], saveResponseTo: 'barrow_type' } },
                { key: 'node-p1', type: 'product', name: 'Send price of Normal Wheel Borrow', x: 880, y: 140, config: { productId: 4, product: 'Normal Wheel Barrow', price: '₹4,500', desc: 'Heavy duty single wheel barrow', message: 'Send price of Normal Wheel Borrow', nextNode: 'node-3' } },
                { key: 'node-p2', type: 'product', name: 'Send price of Dumper Wheel Borrow', x: 880, y: 340, config: { productId: 3, product: 'Dumper Wheel Barrow', price: '₹12,000', desc: 'Heavy duty dual wheel barrow with tilt box', message: 'Send price of Dumper Wheel Borrow', nextNode: 'node-3' } },
                { key: 'node-3', type: 'question', name: 'Step 3', x: 1180, y: 240, config: { question: 'Q: Right time to contact you ?\n(sir nimage call madalu sariyada samaya?)', responseType: 'buttons', choices: ['1. 9:30 - 1:00 PM', '2. 2:30 - 6:00 PM'], options: [{ label: '1. 9:30 - 1:00 PM', value: 'morning', nextNode: 'node-4' }, { label: '2. 2:30 - 6:00 PM', value: 'evening', nextNode: 'node-4' }], saveResponseTo: 'preferred_contact_time' } },
                { key: 'node-4', type: 'text_input', name: 'Step 4', x: 1460, y: 240, config: { question: 'Q: Please share your Name & Place\n(Sir nimm hesaru mattu ooru tillisi)', saveTo: 'name_place', saveResponseTo: 'name_place', nextNode: 'node-lead' } },
                { key: 'node-lead', type: 'create_lead', name: 'Create Lead', x: 1680, y: 240, config: { fieldMappings: { name: 'name_place', product: 'barrow_type', land: 'purpose', contactTime: 'preferred_contact_time' }, nameVar: 'name_place', status: 'new', source: 'WhatsApp Chatbot', nextNode: 'node-end' } },
                { key: 'node-end', type: 'end', name: 'End', x: 1880, y: 240, config: { message: 'Thank You!\nOur team will contact you soon.' } }
            ];
            edges = [
                { source: 'node-start', target: 'node-1' },
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-p1', sourceHandle: '1. Normal Wheel Borrow' },
                { source: 'node-2', target: 'node-p2', sourceHandle: '2. Dumper Wheel Borrow' },
                { source: 'node-p1', target: 'node-3' },
                { source: 'node-p2', target: 'node-3' },
                { source: 'node-3', target: 'node-4', sourceHandle: '1. 9:30 - 1:00 PM' },
                { source: 'node-3', target: 'node-4', sourceHandle: '2. 2:30 - 6:00 PM' },
                { source: 'node-4', target: 'node-lead' },
                { source: 'node-lead', target: 'node-end' }
            ];
        } else {
            // Default full-set-trolley-enquiry template
            nodes = [
                { key: 'node-start', type: 'start', name: 'Start', x: 80, y: 250, config: { triggerType: 'Keyword', keywords: keywords ? (Array.isArray(keywords) ? keywords.join(', ') : keywords) : 'trolley, full set' } },
                { key: 'node-1', type: 'question', name: 'Step 1', x: 280, y: 250, config: { question: 'Q: Sir do you need a full set or Trolley ?', responseType: 'buttons', choices: ['Full Set', 'Trolley'], options: [{ label: 'Full Set', value: 'full_set', nextNode: 'node-2' }, { label: 'Trolley', value: 'trolley', nextNode: 'node-3' }], saveResponseTo: 'product_interest' } },
                { key: 'node-2', type: 'question', name: 'Step 2', x: 520, y: 100, config: { question: 'Q: How much Acre land do you have sir ?\n(Sir nimm jaaga estu ide ant gottu adra, navu machine suggest madtivi sir)', responseType: 'buttons', choices: ['1. Below 2 Acre', '2. 2 - 5 Acre', '3. More than 5 Acre'], options: [{ label: '1. Below 2 Acre', value: 'below_2_acre', nextNode: 'node-4' }, { label: '2. 2 - 5 Acre', value: '2_5_acre', nextNode: 'node-5' }, { label: '3. More than 5 Acre', value: 'more_5_acre', nextNode: 'node-6' }], saveResponseTo: 'land_acres' } },
                { key: 'node-3', type: 'question', name: 'Step: Brush Cutter', x: 520, y: 440, config: { question: 'Q: Which brush cutter do you have sir?', responseType: 'buttons', choices: ['1. Side pack 1', '2. Side pack 2', '3. Don\'t know'], options: [{ label: '1. Side pack 1', value: 'side_pack_1', nextNode: 'node-7' }, { label: '2. Side pack 2', value: 'side_pack_2', nextNode: 'node-8' }, { label: '3. Don\'t know', value: 'dont_know', nextNode: 'node-9' }], saveResponseTo: 'brush_cutter_type' } },
                { key: 'node-4', type: 'product', name: 'Send details of Machine 12K', x: 780, y: 40, config: { productId: 1, product: 'Machine 12K', message: 'Send details of Machine 12K', nextNode: 'node-10' } },
                { key: 'node-5', type: 'product', name: 'Send details of Machine 16K & 21K', x: 780, y: 160, config: { productId: 2, product: 'Machine 16K & 21K', message: 'Send details of Machine 16K & 21K', nextNode: 'node-10' } },
                { key: 'node-6', type: 'product', name: 'Send details of Machine 21K', x: 780, y: 280, config: { productId: 3, product: 'Machine 21K', message: 'Send details of Machine 21K', nextNode: 'node-10' } },
                { key: 'node-7', type: 'product', name: 'Send details of Side Pack 1', x: 780, y: 400, config: { productId: 4, product: 'Side Pack 1', message: 'Send details of Side Pack 1', nextNode: 'node-10' } },
                { key: 'node-8', type: 'product', name: 'Send details of Side Pack 2', x: 780, y: 520, config: { productId: 5, product: 'Side Pack 2', message: 'Send details of Side Pack 2', nextNode: 'node-10' } },
                { key: 'node-9', type: 'message', name: 'Reply Message: Photo Request', x: 780, y: 640, config: { message: 'Reply Message:\nSir please send photo of your brush cutter', inputType: 'image', nextNode: 'node-10' } },
                { key: 'node-10', type: 'question', name: 'Step 3', x: 1050, y: 280, config: { question: 'Q: Right time to contact you ?\n(sir nimage call madalu sariyada samaya?)', responseType: 'buttons', choices: ['1. 9:30 - 1:00 PM', '2. 2:30 - 6:00 PM'], options: [{ label: '1. 9:30 - 1:00 PM', value: 'morning', nextNode: 'node-11' }, { label: '2. 2:30 - 6:00 PM', value: 'evening', nextNode: 'node-11' }], saveResponseTo: 'preferred_contact_time' } },
                { key: 'node-11', type: 'text_input', name: 'Step 4', x: 1300, y: 280, config: { question: 'Q: Please share your Name & Place\n(Sir nimm hesaru mattu ooru tillisi)', choices: ['Name & Place'], options: [{ label: 'Name & Place', value: 'name_place', nextNode: 'node-12' }], saveResponseTo: 'name_place', nextNode: 'node-12' } },
                { key: 'node-12', type: 'create_lead', name: 'Create Lead', x: 1480, y: 280, config: { nextNode: 'node-13' } },
                { key: 'node-13', type: 'end', name: 'End', x: 1640, y: 280, config: { message: 'Thank You!\nOur team will contact you soon.' } }
            ];
            edges = [
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
        }

        for (const n of nodes) {
            await connection.query(
                'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [versionId, n.key, n.type, n.name, n.x, n.y, JSON.stringify(n.config)]
            );
        }

        for (const e of edges) {
            await connection.query(
                'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                [versionId, e.source, e.target, e.sourceHandle || null, null]
            );
        }

        await logAudit(connection, flowId, versionId, req.user?.id, 'Flow Created from Template', { templateId, name });

        await connection.commit();
        res.status(201).json({ flow_id: flowId, message: 'Flow created from template successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('[CREATE FLOW FROM TEMPLATE ERROR]', err);
        res.status(500).json({ message: 'Error creating flow from template' });
    } finally {
        connection.release();
    }
};

// 1. Get all flows
exports.getFlows = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT f.*, 
                   COALESCE(v.version_number, 1.0) as active_version,
                   (SELECT COUNT(*) FROM chatbot_sessions s WHERE s.flow_id = f.flow_id AND s.lead_id IS NOT NULL) as lead_count,
                   (SELECT COUNT(*) FROM chatbot_sessions s WHERE s.flow_id = f.flow_id) as total_sessions,
                   (SELECT COUNT(*) FROM chatbot_sessions s WHERE s.flow_id = f.flow_id AND s.status = 'completed') as completed_sessions,
                   u.name as creator_name
            FROM chatbot_flows f 
            LEFT JOIN chatbot_flow_versions v ON f.active_version_id = v.version_id 
            LEFT JOIN users u ON f.created_by = u.user_id
            WHERE f.status != 'archived'
            ORDER BY f.updated_at DESC
        `);

        for (let flow of rows) {
            try {
                const [nodes] = await pool.query(`
                    SELECT n.config FROM chatbot_nodes n
                    JOIN chatbot_flow_versions v ON n.version_id = v.version_id
                    WHERE v.flow_id = ? AND n.node_type = 'start'
                    LIMIT 1
                `, [flow.flow_id]);
                if (nodes.length > 0) {
                    const cfg = typeof nodes[0].config === 'string' ? JSON.parse(nodes[0].config) : nodes[0].config;
                    flow.triggerType = cfg?.triggerType || 'Keyword';
                    flow.triggerKeywords = cfg?.keywords ? cfg.keywords.split(',').map(s => s.trim()) : [];
                }
            } catch (e) {
                flow.triggerType = 'Keyword';
                flow.triggerKeywords = [];
            }
        }

        res.json(rows);
    } catch (err) {
        console.error('[GET FLOWS ERROR]', err);
        res.status(500).json({ message: 'Error fetching chatbot flows' });
    }
};

// 2. Get specific flow details (draft nodes/edges/settings + all versions list)
exports.getFlow = async (req, res) => {
    const flowId = req.params.flowId;
    try {
        // Fetch flow metadata
        const [flowRows] = await pool.query('SELECT * FROM chatbot_flows WHERE flow_id = ?', [flowId]);
        if (flowRows.length === 0) {
            return res.status(404).json({ message: 'Flow not found' });
        }
        const flow = flowRows[0];

        // Fetch all versions
        const [versions] = await pool.query(
            'SELECT * FROM chatbot_flow_versions WHERE flow_id = ? ORDER BY version_number DESC',
            [flowId]
        );

        // Determine which version ID to load (default is the draft version, fallback to active)
        let draftVersion = versions.find(v => v.status === 'draft');
        let activeVersion = versions.find(v => v.version_id === flow.active_version_id);
        let versionToLoad = draftVersion || activeVersion || versions[0];

        let nodes = [];
        let edges = [];

        if (versionToLoad) {
            // Load nodes from preferred version
            const [nodeRows] = await pool.query(
                'SELECT node_key as `id`, node_type as `type`, name, position_x as `x`, position_y as `y`, config FROM chatbot_nodes WHERE version_id = ?',
                [versionToLoad.version_id]
            );

            // If draft has no nodes but published version has nodes, use published version for display
            if (nodeRows.length === 0 && draftVersion && activeVersion && draftVersion.version_id !== activeVersion.version_id) {
                const [publishedNodeRows] = await pool.query(
                    'SELECT node_key as `id`, node_type as `type`, name, position_x as `x`, position_y as `y`, config FROM chatbot_nodes WHERE version_id = ?',
                    [activeVersion.version_id]
                );
                if (publishedNodeRows.length > 0) {
                    versionToLoad = activeVersion;
                    nodes = publishedNodeRows.map(n => ({
                        id: n.id,
                        type: n.type,
                        name: n.name,
                        position: { x: n.x, y: n.y },
                        config: typeof n.config === 'string' ? JSON.parse(n.config) : n.config
                    }));
                    const [publishedEdgeRows] = await pool.query(
                        'SELECT source_node_key as `source`, target_node_key as `target`, source_handle as `sourceHandle`, target_handle as `targetHandle` FROM chatbot_edges WHERE version_id = ?',
                        [activeVersion.version_id]
                    );
                    edges = publishedEdgeRows.map(e => ({
                        id: `e-${e.source}-${e.target}-${e.sourceHandle || 'default'}`,
                        source: e.source,
                        target: e.target,
                        sourceHandle: e.sourceHandle,
                        targetHandle: e.targetHandle
                    }));
                }
            } else {
                nodes = nodeRows.map(n => ({
                    id: n.id,
                    type: n.type,
                    name: n.name,
                    position: { x: n.x, y: n.y },
                    config: typeof n.config === 'string' ? JSON.parse(n.config) : n.config
                }));

                // Load edges
                const [edgeRows] = await pool.query(
                    'SELECT source_node_key as `source`, target_node_key as `target`, source_handle as `sourceHandle`, target_handle as `targetHandle` FROM chatbot_edges WHERE version_id = ?',
                    [versionToLoad.version_id]
                );
                edges = edgeRows.map(e => ({
                    id: `e-${e.source}-${e.target}-${e.sourceHandle || 'default'}`,
                    source: e.source,
                    target: e.target,
                    sourceHandle: e.sourceHandle,
                    targetHandle: e.targetHandle
                }));
            }
        }

        res.json({
            flow,
            versions,
            nodes,
            edges,
            activeVersionNumber: activeVersion ? activeVersion.version_number : null,
            loadedVersionNumber: versionToLoad ? versionToLoad.version_number : null,
            loadedVersionId: versionToLoad ? versionToLoad.version_id : null
        });
    } catch (err) {
        console.error('[GET FLOW ERROR]', err);
        res.status(500).json({ message: 'Error fetching flow details' });
    }
};

// 3. Create a new flow
exports.createFlow = async (req, res) => {
    const { name, description, category, triggerType, keywords } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Flow name is required' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert flow metadata
        const [flowResult] = await connection.query(
            'INSERT INTO chatbot_flows (name, description, category, status) VALUES (?, ?, ?, ?)',
            [name, description || '', category || 'enquiry', 'draft']
        );
        const flowId = flowResult.insertId;

        // 2. Insert version 1.0 (Draft)
        const [versionResult] = await connection.query(
            'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, ?, ?)',
            [flowId, 1.0, 'draft']
        );
        const versionId = versionResult.insertId;

        // 3. Seed Start node
        const startNodeConfig = {
            triggerType: triggerType || 'Keyword',
            keywords: keywords || 'hello, help'
        };
        await connection.query(
            'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [versionId, 'node-start', 'start', 'Start', 400, 100, JSON.stringify(startNodeConfig)]
        );

        // Audit Log
        await logAudit(connection, flowId, versionId, req.user?.id, 'Flow Created', { name, triggerType });

        await connection.commit();
        res.status(201).json({ flow_id: flowId, message: 'Flow created successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('[CREATE FLOW ERROR]', err);
        res.status(500).json({ message: 'Error creating flow' });
    } finally {
        connection.release();
    }
};

// 4. Save Flow Draft
exports.saveDraft = async (req, res) => {
    const flowId = req.params.flowId;
    const { nodes, edges, settings } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check if draft version exists (target latest draft version)
        let [versionRows] = await connection.query(
            'SELECT version_id FROM chatbot_flow_versions WHERE flow_id = ? AND status = "draft" ORDER BY version_number DESC LIMIT 1',
            [flowId]
        );

        let versionId;
        if (versionRows.length === 0) {
            // Find latest published version to increment
            const [pubRows] = await connection.query(
                'SELECT MAX(version_number) as max_ver FROM chatbot_flow_versions WHERE flow_id = ?',
                [flowId]
            );
            const nextVer = pubRows[0].max_ver ? parseFloat(pubRows[0].max_ver) + 0.1 : 1.0;

            const [versionResult] = await connection.query(
                'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, ?, ?)',
                [flowId, nextVer, 'draft']
            );
            versionId = versionResult.insertId;
        } else {
            versionId = versionRows[0].version_id;
        }

        // Clean up existing nodes and edges for this draft
        await connection.query('DELETE FROM chatbot_nodes WHERE version_id = ?', [versionId]);
        await connection.query('DELETE FROM chatbot_edges WHERE version_id = ?', [versionId]);

        // Insert new nodes
        if (nodes && Array.isArray(nodes)) {
            for (const node of nodes) {
                const posX = node.position ? node.position.x : 0;
                const posY = node.position ? node.position.y : 0;
                await connection.query(
                    'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [versionId, node.id, node.type, node.name, posX, posY, JSON.stringify(node.config || {})]
                );
            }
        }

        // Insert new edges
        if (edges && Array.isArray(edges)) {
            for (const edge of edges) {
                if (!edge.source || !edge.target || edge.source === edge.target) {
                    continue; // Ignore self-looping edges
                }
                await connection.query(
                    'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                    [versionId, edge.source, edge.target, edge.sourceHandle || null, edge.targetHandle || null]
                );
            }
        }

        // Update settings/metadata in chatbot_flows
        if (settings) {
            await connection.query(
                'UPDATE chatbot_flows SET name = ?, description = ?, category = ?, status = ? WHERE flow_id = ?',
                [settings.name, settings.description || '', settings.category || 'enquiry', settings.status || 'draft', flowId]
            );
        }

        await logAudit(connection, flowId, versionId, req.user?.id, 'Flow Draft Saved', { node_count: nodes?.length });

        await connection.commit();
        res.json({ message: 'Draft saved successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('[SAVE DRAFT ERROR]', err);
        res.status(500).json({ message: 'Error saving draft' });
    } finally {
        connection.release();
    }
};

// 5. Validate & Publish Flow
exports.publishFlow = async (req, res) => {
    const flowId = req.params.flowId;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Get draft version
        const [versionRows] = await connection.query(
            'SELECT version_id, version_number FROM chatbot_flow_versions WHERE flow_id = ? AND status = "draft" LIMIT 1',
            [flowId]
        );

        if (versionRows.length === 0) {
            return res.status(400).json({ message: 'No draft found to publish' });
        }
        const draftVersionId = versionRows[0].version_id;
        const currentVerNum = parseFloat(versionRows[0].version_number);

        // 2. Perform validation checks
        const [nodes] = await connection.query('SELECT * FROM chatbot_nodes WHERE version_id = ?', [draftVersionId]);
        const [edges] = await connection.query('SELECT * FROM chatbot_edges WHERE version_id = ?', [draftVersionId]);

        const errors = [];
        const warnings = [];

        // Check 1: Must have exactly one start node
        const startNodes = nodes.filter(n => n.node_type === 'start');
        if (startNodes.length === 0) errors.push('Flow has no Start node.');
        if (startNodes.length > 1) errors.push('Flow contains multiple Start nodes.');

        // Check 2: All interactive nodes check WhatsApp limits
        nodes.forEach(n => {
            const config = JSON.parse(n.config);
            if (n.node_type === 'question' && config.responseType === 'buttons') {
                const optCount = config.options ? config.options.length : 0;
                if (optCount > 3) {
                    errors.push(`Question node "${n.name}" has ${optCount} buttons. WhatsApp Cloud API supports a maximum of 3 buttons.`);
                }
            }
            if (n.node_type === 'question' && config.responseType === 'list') {
                const optCount = config.options ? config.options.length : 0;
                if (optCount > 10) {
                    errors.push(`List option node "${n.name}" has ${optCount} items. WhatsApp List menus support a maximum of 10 items.`);
                }
            }
        });

        // Check 3: Missing destinations
        edges.forEach(e => {
            if (!e.target_node_key) {
                errors.push(`Connection from "${e.source_node_key}" has no destination node.`);
            }
        });

        if (errors.length > 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Validation failed before publish', errors, warnings });
        }

        // 3. Mark draft version as published
        await connection.query(
            'UPDATE chatbot_flow_versions SET status = "published", published_at = NOW() WHERE version_id = ?',
            [draftVersionId]
        );

        // 4. Set flow status to active and active_version_id to this version
        await connection.query(
            'UPDATE chatbot_flows SET status = "active", active_version_id = ? WHERE flow_id = ?',
            [draftVersionId, flowId]
        );

        // 5. Create a new draft version for subsequent editing
        const nextVerNum = (currentVerNum + 0.1).toFixed(1);
        const [newVerResult] = await connection.query(
            'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, ?, ?)',
            [flowId, nextVerNum, 'draft']
        );
        const newDraftVersionId = newVerResult.insertId;

        // Clone nodes to the new draft
        for (const n of nodes) {
            await connection.query(
                'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [newDraftVersionId, n.node_key, n.node_type, n.name, n.position_x, n.position_y, n.config]
            );
        }

        // Clone edges to the new draft
        for (const e of edges) {
            if (e.source_node_key && e.target_node_key && e.source_node_key !== e.target_node_key) {
                await connection.query(
                    'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                    [newDraftVersionId, e.source_node_key, e.target_node_key, e.source_handle, e.target_handle]
                );
            }
        }

        await logAudit(connection, flowId, draftVersionId, req.user?.id, 'Flow Published', { version: currentVerNum });

        await connection.commit();
        res.json({ message: 'Flow published successfully', active_version: currentVerNum, next_draft_version: nextVerNum });
    } catch (err) {
        await connection.rollback();
        console.error('[PUBLISH FLOW ERROR]', err);
        res.status(500).json({ message: 'Error publishing flow' });
    } finally {
        connection.release();
    }
};

// 6. Duplicate Flow
exports.duplicateFlow = async (req, res) => {
    const flowId = req.params.flowId;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Get original flow metadata
        const [flowRows] = await connection.query('SELECT * FROM chatbot_flows WHERE flow_id = ?', [flowId]);
        if (flowRows.length === 0) {
            return res.status(404).json({ message: 'Original flow not found' });
        }
        const orig = flowRows[0];

        // Create flow copy
        const [copyResult] = await connection.query(
            'INSERT INTO chatbot_flows (name, description, category, status) VALUES (?, ?, ?, ?)',
            [`${orig.name} Copy`, orig.description || '', orig.category || 'enquiry', 'draft']
        );
        const newFlowId = copyResult.insertId;

        // Get latest version ID of original flow
        const [verRows] = await connection.query(
            'SELECT version_id FROM chatbot_flow_versions WHERE flow_id = ? ORDER BY version_number DESC LIMIT 1',
            [flowId]
        );
        if (verRows.length > 0) {
            const origVersionId = verRows[0].version_id;

            // Create version 1.0 (Draft) for copy
            const [newVerResult] = await connection.query(
                'INSERT INTO chatbot_flow_versions (flow_id, version_number, status) VALUES (?, 1.0, "draft")',
                [newFlowId]
            );
            const newVersionId = newVerResult.insertId;

            // Clone nodes
            const [nodes] = await connection.query('SELECT * FROM chatbot_nodes WHERE version_id = ?', [origVersionId]);
            for (const n of nodes) {
                await connection.query(
                    'INSERT INTO chatbot_nodes (version_id, node_key, node_type, name, position_x, position_y, config) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [newVersionId, n.node_key, n.node_type, n.name, n.position_x, n.position_y, n.config]
                );
            }

            // Clone edges
            const [edges] = await connection.query('SELECT * FROM chatbot_edges WHERE version_id = ?', [origVersionId]);
            for (const e of edges) {
                await connection.query(
                    'INSERT INTO chatbot_edges (version_id, source_node_key, target_node_key, source_handle, target_handle) VALUES (?, ?, ?, ?, ?)',
                    [newVersionId, e.source_node_key, e.target_node_key, e.source_handle, e.target_handle]
                );
            }
        }

        await logAudit(connection, newFlowId, null, req.user?.id, 'Flow Duplicated', { from_flow_id: flowId });

        await connection.commit();
        res.json({ duplicated_flow_id: newFlowId, message: 'Flow duplicated successfully' });
    } catch (err) {
        await connection.rollback();
        console.error('[DUPLICATE FLOW ERROR]', err);
        res.status(500).json({ message: 'Error duplicating flow' });
    } finally {
        connection.release();
    }
};

// 7. Archive/Soft-delete Flow
exports.deleteFlow = async (req, res) => {
    const flowId = req.params.flowId;
    try {
        await pool.query('UPDATE chatbot_flows SET status = "archived" WHERE flow_id = ?', [flowId]);
        res.json({ message: 'Flow archived successfully' });
    } catch (err) {
        console.error('[DELETE FLOW ERROR]', err);
        res.status(500).json({ message: 'Error archiving flow' });
    }
};

// 7.1 Update Flow Status (active, draft, stopped)
exports.updateFlowStatus = async (req, res) => {
    const flowId = req.params.flowId;
    const { status } = req.body;
    if (!status || !['active', 'draft', 'stopped', 'archived'].includes(status.toLowerCase())) {
        return res.status(400).json({ message: 'Invalid status value. Allowed: active, draft, stopped, archived' });
    }

    try {
        await pool.query('UPDATE chatbot_flows SET status = ? WHERE flow_id = ?', [status.toLowerCase(), flowId]);
        await logAudit(pool, flowId, null, req.user?.id, 'Status Updated', { status });
        res.json({ message: `Flow status updated to ${status}` });
    } catch (err) {
        console.error('[UPDATE FLOW STATUS ERROR]', err);
        res.status(500).json({ message: 'Error updating flow status' });
    }
};

// 8. Global settings retrieval
exports.getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM chatbot_settings ORDER BY id DESC LIMIT 1');
        res.json(rows[0] || {});
    } catch (err) {
        console.error('[GET SETTINGS ERROR]', err);
        res.status(500).json({ message: 'Error fetching chatbot settings' });
    }
};

// 9. Update global settings
exports.updateSettings = async (req, res) => {
    const { ai_fallback_enabled, ai_model, ai_temperature, default_fallback_msg, max_fallback_attempts, webhook_url, webhook_token } = req.body;
    try {
        await pool.query(`
            INSERT INTO chatbot_settings (id, ai_fallback_enabled, ai_model, ai_temperature, default_fallback_msg, max_fallback_attempts, webhook_url, webhook_token) 
            VALUES (1, ?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
                ai_fallback_enabled = VALUES(ai_fallback_enabled),
                ai_model = VALUES(ai_model),
                ai_temperature = VALUES(ai_temperature),
                default_fallback_msg = VALUES(default_fallback_msg),
                max_fallback_attempts = VALUES(max_fallback_attempts),
                webhook_url = VALUES(webhook_url),
                webhook_token = VALUES(webhook_token)
        `, [ai_fallback_enabled, ai_model, ai_temperature, default_fallback_msg, max_fallback_attempts, webhook_url, webhook_token]);
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        console.error('[UPDATE SETTINGS ERROR]', err);
        res.status(500).json({ message: 'Error updating chatbot settings' });
    }
};

// 10. Node types helper registry
exports.getNodeTypes = (req, res) => {
    res.json({
        question: { label: 'Question', desc: 'Ask a multiple choice or free text question' },
        buttons: { label: 'Buttons', desc: 'Send quick-reply buttons (Max 3)' },
        list: { label: 'List Options', desc: 'Send WhatsApp list options menu (Max 10)' },
        text_input: { label: 'Text Input', desc: 'Request user to type open text response' },
        number_input: { label: 'Number Input', desc: 'Request and validate numeric answers' },
        contact_time: { label: 'Contact Time', desc: 'Allow user to pick standard time slot' },
        message: { label: 'Text Message', desc: 'Send simple WhatsApp text response' },
        image: { label: 'Send Image', desc: 'Send image URL from media library' },
        video: { label: 'Send Video', desc: 'Send video media from gallery' },
        product: { label: 'Product Card', desc: 'Send pricing card from inventory list' },
        save_lead_field: { label: 'Save CRM Field', desc: 'Binds variable answer to lead column' },
        create_lead: { label: 'Create CRM Lead', desc: 'Generates lead in CRM system' },
        human_handoff: { label: 'Human Handoff', desc: 'Escalates session and pauses bot' },
        time_trigger: { label: 'Time Trigger / Delay', desc: 'Pauses execution for specified duration before next step' },
        end: { label: 'End Flow', desc: 'Terminates chatbot flow session' }
    });
};

// ==========================================
// CHATBOT PRODUCTS & MEDIA CONTROLLER API
// ==========================================

// 11. Get all products with filters
exports.getProducts = async (req, res) => {
    try {
        const { category, status, search } = req.query;
        let query = 'SELECT * FROM chatbot_products WHERE 1=1';
        const params = [];

        if (category && category !== 'all' && category !== 'All Products') {
            query += ' AND category = ?';
            params.push(category);
        }
        if (status && status !== 'all') {
            query += ' AND status = ?';
            params.push(status);
        }
        if (search) {
            query += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ? OR tags LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += ' ORDER BY id DESC';
        const [rows] = await pool.query(query, params);

        const formatted = rows.map(r => ({
            ...r,
            gallery_urls: typeof r.gallery_urls === 'string' ? JSON.parse(r.gallery_urls || '[]') : (r.gallery_urls || []),
            specs: typeof r.specs === 'string' ? JSON.parse(r.specs || '[]') : (r.specs || []),
            tags: typeof r.tags === 'string' ? JSON.parse(r.tags || '[]') : (r.tags || [])
        }));

        res.json(formatted);
    } catch (err) {
        console.error('[GET CHATBOT PRODUCTS ERROR]', err);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

// 12. Create product
exports.createProduct = async (req, res) => {
    try {
        const { name, sku, category, price, status, description, image_url, gallery_urls, specs, tags } = req.body;
        if (!name || !category) {
            return res.status(400).json({ message: 'Product name and category are required' });
        }

        const generatedSku = sku || `PROD-${Date.now().toString().slice(-6)}`;
        const prodPrice = parseFloat(price) || 0;
        const prodStatus = status || 'active';
        const galleryJson = JSON.stringify(Array.isArray(gallery_urls) ? gallery_urls : []);
        const specsJson = JSON.stringify(Array.isArray(specs) ? specs : []);
        const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

        const [result] = await pool.query(`
            INSERT INTO chatbot_products 
            (name, sku, category, price, status, description, image_url, gallery_urls, specs, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, generatedSku, category, prodPrice, prodStatus, description || '', image_url || '', galleryJson, specsJson, tagsJson]);

        const [newRows] = await pool.query('SELECT * FROM chatbot_products WHERE id = ?', [result.insertId]);
        const newProduct = newRows[0];
        newProduct.gallery_urls = JSON.parse(newProduct.gallery_urls || '[]');
        newProduct.specs = JSON.parse(newProduct.specs || '[]');
        newProduct.tags = JSON.parse(newProduct.tags || '[]');

        res.status(201).json(newProduct);
    } catch (err) {
        console.error('[CREATE CHATBOT PRODUCT ERROR]', err);
        res.status(500).json({ message: 'Error creating product: ' + err.message });
    }
};

// 13. Update product
exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, sku, category, price, status, description, image_url, gallery_urls, specs, tags } = req.body;

        const galleryJson = JSON.stringify(Array.isArray(gallery_urls) ? gallery_urls : []);
        const specsJson = JSON.stringify(Array.isArray(specs) ? specs : []);
        const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

        await pool.query(`
            UPDATE chatbot_products SET
                name = COALESCE(?, name),
                sku = COALESCE(?, sku),
                category = COALESCE(?, category),
                price = COALESCE(?, price),
                status = COALESCE(?, status),
                description = COALESCE(?, description),
                image_url = COALESCE(?, image_url),
                gallery_urls = COALESCE(?, gallery_urls),
                specs = COALESCE(?, specs),
                tags = COALESCE(?, tags)
            WHERE id = ?
        `, [name, sku, category, price, status, description, image_url, galleryJson, specsJson, tagsJson, productId]);

        const [rows] = await pool.query('SELECT * FROM chatbot_products WHERE id = ?', [productId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });

        const updated = rows[0];
        updated.gallery_urls = JSON.parse(updated.gallery_urls || '[]');
        updated.specs = JSON.parse(updated.specs || '[]');
        updated.tags = JSON.parse(updated.tags || '[]');

        res.json(updated);
    } catch (err) {
        console.error('[UPDATE CHATBOT PRODUCT ERROR]', err);
        res.status(500).json({ message: 'Error updating product' });
    }
};

// 14. Delete product
exports.deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        await pool.query('DELETE FROM chatbot_products WHERE id = ?', [productId]);
        res.json({ message: 'Product deleted successfully', id: productId });
    } catch (err) {
        console.error('[DELETE CHATBOT PRODUCT ERROR]', err);
        res.status(500).json({ message: 'Error deleting product' });
    }
};

// 15. Get categories with dynamic product count
exports.getCategories = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                c.id, 
                c.name, 
                c.icon,
                COUNT(p.id) AS count
            FROM chatbot_categories c
            LEFT JOIN chatbot_products p ON c.name = p.category
            GROUP BY c.id, c.name, c.icon
            ORDER BY c.id ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error('[GET CATEGORIES ERROR]', err);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

// 16. Create category
exports.createCategory = async (req, res) => {
    try {
        const { name, icon } = req.body;
        if (!name) return res.status(400).json({ message: 'Category name is required' });

        const categoryIcon = icon || 'fa-layer-group';
        const [result] = await pool.query('INSERT INTO chatbot_categories (name, icon) VALUES (?, ?)', [name, categoryIcon]);
        res.status(201).json({ id: result.insertId, name, icon: categoryIcon, count: 0 });
    } catch (err) {
        console.error('[CREATE CATEGORY ERROR]', err);
        res.status(500).json({ message: 'Error creating category: ' + err.message });
    }
};

// 16.1 Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        await pool.query('DELETE FROM chatbot_categories WHERE id = ?', [categoryId]);
        res.json({ message: 'Category deleted successfully', id: categoryId });
    } catch (err) {
        console.error('[DELETE CATEGORY ERROR]', err);
        res.status(500).json({ message: 'Error deleting category' });
    }
};

// 16.2 Bulk Import Products
exports.importProducts = async (req, res) => {
    try {
        const { products } = req.body;
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: 'No products array provided for import' });
        }

        let importedCount = 0;
        for (const p of products) {
            if (!p.name || !p.category) continue;

            const generatedSku = p.sku || `PROD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
            const prodPrice = parseFloat(p.price) || 0;
            const prodStatus = p.status || 'active';
            const galleryJson = JSON.stringify(Array.isArray(p.gallery_urls) ? p.gallery_urls : [p.image_url || '../../assets/images/red_power_tiller.jpg']);
            const specsJson = JSON.stringify(Array.isArray(p.specs) ? p.specs : []);
            const tagsJson = JSON.stringify(Array.isArray(p.tags) ? p.tags : ['imported']);

            await pool.query(`
                INSERT INTO chatbot_products 
                (name, sku, category, price, status, description, image_url, gallery_urls, specs, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    price = VALUES(price),
                    status = VALUES(status),
                    description = VALUES(description)
            `, [p.name, generatedSku, p.category, prodPrice, prodStatus, p.description || '', p.image_url || '../../assets/images/red_power_tiller.jpg', galleryJson, specsJson, tagsJson]);

            importedCount++;
        }

        res.status(201).json({ message: `Successfully imported ${importedCount} products`, count: importedCount });
    } catch (err) {
        console.error('[IMPORT PRODUCTS ERROR]', err);
        res.status(500).json({ message: 'Error importing products: ' + err.message });
    }
};

// 17. Get media items
exports.getMedia = async (req, res) => {
    try {
        const { type, search } = req.query;
        let query = 'SELECT * FROM chatbot_media WHERE 1=1';
        const params = [];

        if (type && type !== 'all') {
            let targetType = type.toLowerCase();
            if (targetType === 'images') targetType = 'image';
            else if (targetType === 'videos') targetType = 'video';
            else if (targetType === 'documents') targetType = 'document';
            query += ' AND file_type = ?';
            params.push(targetType);
        }
        if (search) {
            query += ' AND (filename LIKE ? OR original_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY id DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('[GET MEDIA ERROR]', err);
        res.status(500).json({ message: 'Error fetching media items' });
    }
};

// Helper: Upload file to Supabase Storage or Local Disk fallback
async function saveMediaFile(file) {
    const bucketName = process.env.SUPABASE_BUCKET_NAME || 'chatbot-media';
    const folderPath = 'chatbot-media';
    const filename = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `${folderPath}/${filename}`;

    let publicUrl = '';
    let isSupabaseSuccess = false;

    if (supabase && process.env.SUPABASE_URL) {
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(storagePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (!error) {
                const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
                publicUrl = urlData.publicUrl;
                isSupabaseSuccess = true;
            } else {
                console.warn('[SUPABASE UPLOAD WARN] Falling back to local disk:', error.message);
            }
        } catch (sErr) {
            console.warn('[SUPABASE UPLOAD CATCH WARN] Falling back to local disk:', sErr.message);
        }
    }

    if (!isSupabaseSuccess) {
        const uploadDir = path.join(__dirname, '../../uploads/chatbot-media');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const localPath = path.join(uploadDir, filename);
        fs.writeFileSync(localPath, file.buffer);
        publicUrl = `/uploads/chatbot-media/${filename}`;
    }

    let fileType = 'other';
    if (file.mimetype.startsWith('image/')) fileType = 'image';
    else if (file.mimetype.startsWith('video/')) fileType = 'video';
    else if (file.mimetype.startsWith('audio/')) fileType = 'audio';
    else if (file.mimetype.includes('pdf') || file.mimetype.includes('document') || file.mimetype.includes('text')) fileType = 'document';

    return {
        filename,
        original_name: file.originalname,
        file_url: publicUrl,
        file_type: fileType,
        mime_type: file.mimetype,
        size_bytes: file.size,
        storage_path: storagePath
    };
}

// 18. Upload media endpoint
exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const filesToProcess = req.files || [req.file];
        const insertedMedia = [];

        for (const file of filesToProcess) {
            const mediaInfo = await saveMediaFile(file);
            const [result] = await pool.query(`
                INSERT INTO chatbot_media 
                (filename, original_name, file_url, file_type, mime_type, size_bytes, storage_path, associated_product_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                mediaInfo.filename,
                mediaInfo.original_name,
                mediaInfo.file_url,
                mediaInfo.file_type,
                mediaInfo.mime_type,
                mediaInfo.size_bytes,
                mediaInfo.storage_path,
                req.body.associated_product_id || null
            ]);

            insertedMedia.push({
                id: result.insertId,
                ...mediaInfo,
                associated_product_id: req.body.associated_product_id || null
            });
        }

        res.status(201).json(insertedMedia);
    } catch (err) {
        console.error('[UPLOAD MEDIA ERROR]', err);
        res.status(500).json({ message: 'Error uploading media file' });
    }
};

// 19. Delete media
exports.deleteMedia = async (req, res) => {
    try {
        const mediaId = req.params.id;
        const [rows] = await pool.query('SELECT * FROM chatbot_media WHERE id = ?', [mediaId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Media not found' });

        const media = rows[0];
        // 1. Hard Delete from Supabase Storage
        if (supabase && media.storage_path && process.env.SUPABASE_URL) {
            try {
                const bucketName = process.env.SUPABASE_BUCKET_NAME || 'chatbot-media';
                await supabase.storage.from(bucketName).remove([media.storage_path]);
            } catch (e) {
                console.warn('[SUPABASE HARD DELETE WARN]', e.message);
            }
        }

        // 2. Hard Delete from Local Disk if stored locally
        if (media.file_url && media.file_url.startsWith('/uploads/')) {
            try {
                const localPath = path.join(__dirname, '../..', media.file_url);
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                }
            } catch (e) {
                console.warn('[LOCAL DISK HARD DELETE WARN]', e.message);
            }
        }

        // 3. Hard Delete Record from Database
        await pool.query('DELETE FROM chatbot_media WHERE id = ?', [mediaId]);
        res.json({ message: 'Media item permanently hard deleted', id: mediaId });
    } catch (err) {
        console.error('[DELETE MEDIA ERROR]', err);
        res.status(500).json({ message: 'Error deleting media' });
    }
};

// 20. Get storage usage stats
exports.getStorageUsage = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                COUNT(*) as total_files, 
                COALESCE(SUM(size_bytes), 0) as used_bytes 
            FROM chatbot_media
        `);

        const usedBytes = parseInt(rows[0].used_bytes) || 0;
        const totalFiles = parseInt(rows[0].total_files) || 0;
        const totalCapacityBytes = 5 * 1024 * 1024 * 1024; // 5 GB limit

        const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
        const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
        const totalGB = 5;
        const percentage = Math.min(100, parseFloat(((usedBytes / totalCapacityBytes) * 100).toFixed(1)));

        res.json({
            used_bytes: usedBytes,
            total_bytes: totalCapacityBytes,
            used_mb: parseFloat(usedMB),
            used_gb: parseFloat(usedGB),
            total_gb: totalGB,
            percentage,
            total_files: totalFiles
        });
    } catch (err) {
        console.error('[GET STORAGE USAGE ERROR]', err);
        res.status(500).json({ message: 'Error calculating storage usage' });
    }
};

// 21. Get pending human handoff alerts (only show to assigned staff, admin, and whatsapp_manager)
exports.getPendingHumanAlerts = async (req, res) => {
    try {
        const userId = req.user ? (req.user.user_id || req.user.id) : null;
        const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : '';

        const isAdminUser = role === 'admin' || role === 'super-admin' || role.includes('admin');
        const isWhatsappManager = role === 'whatsapp_manager' || role.includes('whatsapp');

        let sql = `
            SELECT 
                cs.session_id, cs.flow_id, cs.phone, cs.status as session_status, cs.paused_at, cs.current_node_key,
                l.lead_id, l.customer_name, l.status as lead_status, l.assigned_to, l.score, l.city,
                (
                    SELECT message FROM chat_messages cm 
                    JOIN chat_sessions s ON cm.session_id = s.session_id 
                    WHERE s.lead_id = l.lead_id ORDER BY cm.chat_id DESC LIMIT 1
                ) as last_message
            FROM chatbot_sessions cs
            LEFT JOIN leads l ON (cs.lead_id IS NOT NULL AND cs.lead_id = l.lead_id) OR (l.phone_number COLLATE utf8mb4_general_ci LIKE CONCAT('%', RIGHT(REPLACE(cs.phone, '+', ''), 10)) COLLATE utf8mb4_general_ci)
            WHERE (cs.status = 'paused_for_human' OR l.status = 'human_needed')
        `;

        const queryParams = [];

        // Telecallers / Executives only see handoff alerts for leads assigned to them
        if (!isAdminUser && !isWhatsappManager) {
            if (userId) {
                sql += ` AND l.assigned_to = ?`;
                queryParams.push(userId);
            } else {
                return res.json([]);
            }
        }

        sql += ` ORDER BY cs.paused_at DESC, cs.session_id DESC`;

        const [rows] = await pool.query(sql, queryParams);

        res.json(rows);
    } catch (err) {
        console.error('[GET PENDING HUMAN ALERTS ERROR]', err);
        res.status(500).json({ message: 'Error fetching human handoff alerts' });
    }
};

// 22. Re-trigger chatbot flow session for a customer
exports.retriggerFlowSession = async (req, res) => {
    try {
        const FlowEngine = require('../services/FlowEngine');
        const identifier = req.params.sessionId || req.body.sessionId || req.body.phone;
        if (!identifier) {
            return res.status(400).json({ message: 'Session ID or Phone number is required' });
        }

        const result = await FlowEngine.retriggerSession(identifier);
        res.json({ message: 'Chatbot flow re-triggered successfully', ...result });
    } catch (err) {
        console.error('[RETRIGGER FLOW ERROR]', err);
        res.status(500).json({ message: err.message || 'Error re-triggering flow session' });
    }
};

// 23. Takeover chatbot flow session (pause bot for manual agent chat)
exports.takeoverFlowSession = async (req, res) => {
    try {
        const FlowEngine = require('../services/FlowEngine');
        const identifier = req.params.sessionId || req.body.sessionId || req.body.phone;
        if (!identifier) {
            return res.status(400).json({ message: 'Session ID or Phone number is required' });
        }

        const result = await FlowEngine.takeoverSession(identifier);
        res.json({ message: 'Bot paused for human takeover successfully', ...result });
    } catch (err) {
        console.error('[TAKEOVER FLOW ERROR]', err);
        res.status(500).json({ message: err.message || 'Error taking over flow session' });
    }
};

// 24. Resolve human handoff for a customer or session
exports.resolveHandoffSession = async (req, res) => {
    try {
        const FlowEngine = require('../services/FlowEngine');
        const identifier = req.params.sessionId || req.body.sessionId || req.body.phone;
        if (!identifier) {
            return res.status(400).json({ message: 'Session ID or Phone number is required' });
        }

        const result = await FlowEngine.resolveHandoff(identifier);
        res.json({ message: 'Handoff resolved successfully', ...result });
    } catch (err) {
        console.error('[RESOLVE HANDOFF ERROR]', err);
        res.status(500).json({ message: err.message || 'Error resolving handoff session' });
    }
};
