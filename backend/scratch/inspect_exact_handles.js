const pool = require('../src/config/db');

async function inspectExactHandles() {
  try {
    const versionId = 34; // KAN_trolley active_version_id

    const [edges] = await pool.query(`SELECT id, source_node_key, target_node_key, source_handle, target_handle FROM chatbot_edges WHERE version_id = ?`, [versionId]);
    console.log('\nEXACT EDGES FOR VERSION 34:');
    edges.forEach(e => console.log(`id=${e.id} source="${e.source_node_key}" handle="[${e.source_handle}]" target="${e.target_node_key}"`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectExactHandles();
