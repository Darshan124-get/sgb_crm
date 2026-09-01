const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'd:/sgb scratch/backend/.env' });

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    const [rows] = await pool.query(`
      SELECT chat_id, session_id, sender_type, message_type, message, media_url, message_id, timestamp 
      FROM chat_messages 
      WHERE session_id = 1928 
      ORDER BY chat_id DESC LIMIT 10
    `);

    console.log('RECENT CHAT MESSAGES FOR 6364594854:');
    console.log(JSON.stringify(rows, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
