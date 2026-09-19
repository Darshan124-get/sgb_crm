const pool = require('../src/config/db');

(async () => {
    try {
        const [verRows] = await pool.query('SELECT version_id, version_number FROM chatbot_flow_versions WHERE flow_id = 26 AND status = "draft" ORDER BY version_id DESC LIMIT 1');
        if (verRows.length === 0) {
            console.log('No draft version found');
            process.exit(0);
        }
        const draftId = verRows[0].version_id;
        const [nodes] = await pool.query('SELECT node_key, node_type, config FROM chatbot_nodes WHERE version_id = ? AND node_type = "start"', [draftId]);
        console.log(`Flow 26 Draft (${draftId}) Start Node Config:`, nodes[0] ? JSON.parse(nodes[0].config) : 'No start node');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
