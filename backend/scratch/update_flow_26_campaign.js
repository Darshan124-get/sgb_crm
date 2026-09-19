const pool = require('../src/config/db');

(async () => {
    try {
        const [verRows] = await pool.query('SELECT version_id FROM chatbot_flow_versions WHERE flow_id = 26 AND status = "draft" ORDER BY version_id DESC LIMIT 1');
        if (verRows.length > 0) {
            const draftId = verRows[0].version_id;
            const [nodes] = await pool.query('SELECT node_key, config FROM chatbot_nodes WHERE version_id = ? AND node_type = "start"', [draftId]);
            if (nodes.length > 0) {
                const cfg = JSON.parse(nodes[0].config);
                cfg.campaignId = 'ag test chart 001';
                cfg.campaignTagline = 'test';
                cfg.keywords = 'test';
                cfg.triggerType = 'Campaign';
                await pool.query('UPDATE chatbot_nodes SET config = ? WHERE version_id = ? AND node_key = ?', [JSON.stringify(cfg), draftId, nodes[0].node_key]);
                console.log('Updated Flow 26 Start Node Config:', cfg);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
