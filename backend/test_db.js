const db = require('./src/config/db');
async function test() {
  const [rows] = await db.execute("SELECT status, count(*) FROM chat_messages WHERE sender_type = 'user' GROUP BY status");
  console.log(rows);
  process.exit(0);
}
test();
