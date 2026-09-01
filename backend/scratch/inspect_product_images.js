const pool = require('../src/config/db');

async function inspectProductImageBug() {
  try {
    const [nodes] = await pool.query(`
      SELECT version_id, node_key, name, config 
      FROM chatbot_nodes 
      WHERE node_type = 'product' OR name LIKE '%side pack%' OR name LIKE '%back pack%'
    `);

    console.log('ALL PRODUCT NODES IN DB:');
    nodes.forEach(n => {
      console.log(`Version ${n.version_id} | Key: ${n.node_key} | Name: "${n.name}" | Config: ${JSON.stringify(n.config)}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectProductImageBug();
