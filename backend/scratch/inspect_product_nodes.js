const pool = require('../src/config/db');

async function inspectProductNodes() {
  try {
    const versionId = 34; // KAN_trolley active_version_id

    const [nodes] = await pool.query(`SELECT id, node_key, node_type, name, config FROM chatbot_nodes WHERE version_id = ? AND (node_key = 'node-7' OR node_key = 'node-8')`, [versionId]);
    console.log('PRODUCT NODES CONFIG:');
    nodes.forEach(n => {
      console.log(`node_key="${n.node_key}" name="${n.name}" config=${JSON.stringify(n.config)}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectProductNodes();
