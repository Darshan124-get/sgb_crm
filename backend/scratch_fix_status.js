const pool = require('./src/config/db');

async function fix() {
  try {
    const [res] = await pool.query('UPDATE leads SET status = ? WHERE status = ?', ['followup', 'callback']);
    console.log('Fixed', res.affectedRows, 'leads');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
fix();
