const pool = require('../src/config/db');

async function main() {
    const [sessions] = await pool.query('SELECT * FROM chatbot_sessions WHERE phone LIKE "%6364594854%" ORDER BY session_id DESC LIMIT 3');
    console.log('Recent sessions for 6364594854:', JSON.stringify(sessions, null, 2));

    for (const s of sessions) {
        const [execs] = await pool.query('SELECT * FROM chatbot_executions WHERE session_id = ? ORDER BY id ASC', [s.session_id]);
        console.log(`Executions for session ${s.session_id}:`, JSON.stringify(execs, null, 2));
    }

    // Also check edges for version 129
    const [edges] = await pool.query('SELECT * FROM chatbot_edges WHERE version_id = 129');
    console.log('Edges for version 129:', JSON.stringify(edges, null, 2));

    // Also check nodes for version 129
    const [nodes] = await pool.query('SELECT node_key, node_type, name, config FROM chatbot_nodes WHERE version_id = 129');
    console.log('Nodes for version 129:', JSON.stringify(nodes, null, 2));

    await pool.end();
}

main().catch(console.error);
