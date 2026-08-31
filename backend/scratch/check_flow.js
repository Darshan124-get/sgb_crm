const pool = require('../src/config/db');

async function cleanSelfLoopsAndVerify() {
    try {
        console.log('Cleaning up self-referencing edges from chatbot_edges...');
        const [delResult] = await pool.query('DELETE FROM chatbot_edges WHERE source_node_key = target_node_key');
        console.log(`Deleted ${delResult.affectedRows} self-loop edge(s).`);

        // Check active flows
        const [flows] = await pool.query('SELECT * FROM chatbot_flows WHERE status = "active"');
        for (const f of flows) {
            console.log(`\nFlow ID: ${f.flow_id} (${f.name}), Active Version: ${f.active_version_id}`);
            const [edges] = await pool.query('SELECT * FROM chatbot_edges WHERE version_id = ?', [f.active_version_id]);
            console.log(`Edges (${edges.length}):`);
            edges.forEach(e => {
                console.log(`  ${e.source_node_key} (${e.source_handle}) --> ${e.target_node_key}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

cleanSelfLoopsAndVerify();
