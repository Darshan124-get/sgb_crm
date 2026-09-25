const axios = require('axios');
const storageService = require('../src/services/storage.service');

async function testR2Http() {
  const key = 'campaigns/ag test chart 001/auto-reply-1789130642042-1.jpeg';
  const url = storageService.getPublicUrl(key);
  console.log('Testing R2 Public URL:', url);

  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    console.log('✅ Success! HTTP Status:', res.status, 'Buffer size:', res.data.length);
  } catch (err) {
    console.error('❌ HTTP GET Failed:', err.response ? err.response.status : err.message);
    if (err.response) {
      console.error('Response headers:', err.response.headers);
      console.error('Response body:', err.response.data.toString());
    }
  }
}

testR2Http();
