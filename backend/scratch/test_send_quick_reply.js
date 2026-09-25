const whatsappService = require('../src/services/whatsapp.service');
const storageService = require('../src/services/storage.service');

async function testQuickReplySend() {
  console.log('--- Testing Quick Reply Media Pre-upload to Meta ---');
  
  const testUrl = '/api/media/quick-replies/1789188091796-dumpermedia-0.jpeg';
  const type = 'image';

  console.log(`Processing media URL: ${testUrl}`);

  try {
    const metaMediaId = await whatsappService.getOrCreateMetaMediaId(testUrl, type);
    console.log('✅ Success! Meta Media ID acquired:', metaMediaId);
  } catch (err) {
    console.error('❌ Failed:', err);
  }
}

testQuickReplySend();
