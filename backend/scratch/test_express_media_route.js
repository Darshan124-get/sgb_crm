const axios = require('axios');
const pool = require('../src/config/db');

async function testExpressMediaRoute() {
  console.log('--- Testing Express Media Route /api/media/* ---');

  // Fetch a sample chat message with media
  const [rows] = await pool.query('SELECT chat_id, media_url, mime_type FROM chat_messages WHERE media_url LIKE "/api/media/%" LIMIT 5');

  if (rows.length === 0) {
    console.error('No chat message rows found with /api/media/');
    process.exit(1);
  }

  for (const row of rows) {
    const testUrl = `http://localhost:5000${row.media_url}`;
    console.log(`Testing chat_id ${row.chat_id} URL: ${testUrl}`);
    try {
      const res = await axios.get(testUrl, { responseType: 'arraybuffer', timeout: 5000 });
      console.log(`✅ Success! HTTP Status: ${res.status}, Content-Type: ${res.headers['content-type']}, Size: ${res.data.length} bytes`);
    } catch (err) {
      console.error(`❌ HTTP test failed for ${testUrl}:`, err.response ? err.response.status : err.message);
    }
  }

  process.exit(0);
}

testExpressMediaRoute().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
