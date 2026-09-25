const axios = require('axios');
const pool = require('../src/config/db');

async function testChatMedia() {
  console.log('--- Testing Chat Media Proxy URLs ---');
  const [rows] = await pool.query('SELECT chat_id, message_type, media_url FROM chat_messages WHERE media_url IS NOT NULL ORDER BY chat_id DESC LIMIT 10');

  for (const row of rows) {
    const fullUrl = `http://localhost:5000${row.media_url}`;
    console.log(`Chat ID ${row.chat_id} (${row.message_type}): ${fullUrl}`);
    try {
      const res = await axios.get(fullUrl, { responseType: 'arraybuffer', timeout: 5000 });
      console.log(`   ✅ SUCCESS: HTTP 200, Content-Type: ${res.headers['content-type']}, Size: ${res.data.length} bytes`);
    } catch (err) {
      console.error(`   ❌ FAILED: ${err.response ? err.response.status : err.message}`);
    }
  }

  process.exit(0);
}

testChatMedia().catch(err => {
  console.error(err);
  process.exit(1);
});
