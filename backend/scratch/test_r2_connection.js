const storageService = require('../src/services/storage.service');

async function testR2() {
  console.log('--- Testing Cloudflare R2 Connection ---');
  console.log('Target Bucket:', storageService.defaultBucket);
  
  const testKey = `test/connection_check_${Date.now()}.txt`;
  const testContent = Buffer.from('Cloudflare R2 Storage Connection Test for SGB CRM');

  try {
    console.log(`1. Uploading test object to key '${testKey}'...`);
    const uploadRes = await storageService.uploadObject({
      key: testKey,
      body: testContent,
      contentType: 'text/plain',
    });
    console.log('✅ Upload Success:', uploadRes);

    console.log('2. Checking if object exists...');
    const exists = await storageService.objectExists({ key: testKey });
    console.log('✅ Object Exists:', exists);

    console.log('3. Downloading object...');
    const downloaded = await storageService.downloadObject({ key: testKey });
    console.log('✅ Download Success. Content:', downloaded.buffer.toString());

    console.log('4. Cleaning up test object...');
    await storageService.deleteObject({ key: testKey });
    console.log('✅ Delete Success.');

    console.log('\n🎉 CLOUDFLARE R2 INTEGRATION IS FULLY FUNCTIONAL AND WORKING PERFECTLY!');
  } catch (err) {
    console.error('❌ R2 Test Failed:', err);
    process.exit(1);
  }
}

testR2();
