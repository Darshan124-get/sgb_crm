const storageService = require('../src/services/storage.service');

async function testMediaServing() {
  console.log('--- Testing R2 Media Stream helper ---');
  const sampleKey = 'campaigns/ag test chart 001/auto-reply-1789130642042-1.jpeg';

  try {
    const data = await storageService.downloadObject({ key: sampleKey });
    console.log('✅ Successfully downloaded R2 object buffer!');
    console.log('   ContentType:', data.contentType);
    console.log('   ContentLength:', data.contentLength, 'bytes');
    console.log('   Buffer length:', data.buffer.length);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

testMediaServing();
