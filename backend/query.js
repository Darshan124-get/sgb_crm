const db = require('./src/config/db');
db.query("SELECT * FROM campaigns WHERE status = 'active' AND auto_replies IS NOT NULL AND auto_replies != '[]' ORDER BY id DESC")
  .then(([rows]) => console.log(rows))
  .catch(console.error)
  .finally(() => process.exit());
