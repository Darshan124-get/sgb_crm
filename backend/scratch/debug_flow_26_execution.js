const pool = require('../src/config/db');

(async () => {
    try {
        console.log('=== DEBUG FLOW 26 ACTIVE VERSION ===');
        const [flowRows] = await pool.query('SELECT * FROM chatbot_flows WHERE flow_id = 26');
        if (flowRows.length === 0) {
            console.log('Flow 26 not found!');
            process.exit(0);
        }
        const flow = flowRows[0];
        console.log('Flow metadata:', flow);

        const activeVerId = flow.active_version_id;
        console.log('Active Version ID:', activeVerId);

        const [versions] = await pool.query('SELECT * FROM chatbot_flow_versions WHERE flow_id = 26 ORDER BY version_id DESC');
        console.log('All versions for Flow 26:', versions);

        if (!activeVerId) {
            console.log('NO ACTIVE VERSION ID SET FOR FLOW 26!');
            process.exit(0);
        }

        const [nodes] = await pool.query('SELECT * FROM chatbot_nodes WHERE version_id = ?', [activeVerId]);
        const [edges] = await pool.query('SELECT * FROM chatbot_edges WHERE version_id = ?', [activeVerId]);

        console.log('\n--- ACTIVE VERSION NODES ---');
        nodes.forEach(n => {
            console.log(`Node Key: ${n.node_key} | Type: ${n.node_type} | Name: "${n.name}"`);
            console.log(`  Config:`, typeof n.config === 'string' ? n.config : JSON.stringify(n.config));
        });

        console.log('\n--- ACTIVE VERSION EDGES ---');
        edges.forEach(e => {
            console.log(`Edge: ${e.source_node_key} (${e.source_handle || 'default'}) -> ${e.target_node_key}`);
        });

        // Let's trace execution path starting from 'node-start'
        console.log('\n--- EXECUTION PATH TRACE ---');
        let currentKey = 'node-start';
        const visited = new Set();
        while (currentKey && !visited.has(currentKey)) {
            visited.add(currentKey);
            const currentNode = nodes.find(n => n.node_key === currentKey);
            if (!currentNode) {
                console.log(`❌ ERROR: Node key "${currentKey}" NOT FOUND in nodes list!`);
                break;
            }
            console.log(`-> Step: [${currentNode.node_type}] "${currentNode.name}" (${currentNode.node_key})`);
            
            // Find edge from currentKey
            const outEdges = edges.filter(e => e.source_node_key === currentKey);
            console.log(`   Outgoing Edges count: ${outEdges.length}`, outEdges.map(e => `${e.source_handle || 'out'} -> ${e.target_node_key}`));
            
            if (outEdges.length > 0) {
                currentKey = outEdges[0].target_node_key;
            } else {
                const cfg = typeof currentNode.config === 'string' ? JSON.parse(currentNode.config) : currentNode.config;
                console.log(`   No edge found. Fallback cfg.nextNode:`, cfg?.nextNode);
                currentKey = cfg?.nextNode || null;
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
