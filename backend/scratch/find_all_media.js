const pool = require('../src/config/db');
const supabase = require('../src/config/supabase');

async function findAllMedia() {
  console.log('--- DB & Storage Media Inventory Scan ---');

  // 1. Scan chat_messages table
  const [chatRows] = await pool.query('SELECT chat_id, media_url, mime_type FROM chat_messages WHERE media_url IS NOT NULL AND media_url != ""');
  console.log(`Found ${chatRows.length} media records in 'chat_messages'.`);

  // 2. Scan whatsapp_quick_replies table
  const [qrRows] = await pool.query('SELECT id, shortcut, media_url, media_type FROM whatsapp_quick_replies WHERE media_url IS NOT NULL AND media_url != ""');
  console.log(`Found ${qrRows.length} records in 'whatsapp_quick_replies'.`);

  // 3. Scan campaigns table
  const [campRows] = await pool.query('SELECT id, campaign_id, auto_replies FROM campaigns WHERE auto_replies IS NOT NULL');
  console.log(`Found ${campRows.length} records in 'campaigns'.`);

  // 4. Scan chatbot_media table
  const [botMediaRows] = await pool.query('SELECT id, filename, file_url, storage_path FROM chatbot_media');
  console.log(`Found ${botMediaRows.length} records in 'chatbot_media'.`);

  // 5. List Supabase root contents
  console.log('\n--- Supabase Bucket "SGB" Root Items ---');
  const { data: sgbItems, error: sgbError } = await supabase.storage.from('SGB').list('', { limit: 100 });
  if (sgbError) {
    console.error('Error listing SGB bucket:', sgbError.message);
  } else {
    console.log('Items in SGB root:', sgbItems.map(i => `${i.name} (${i.id ? 'file' : 'folder'})`));
  }

  // Check folders inside SGB
  if (sgbItems) {
    for (const item of sgbItems) {
      if (!item.id) { // Folder
        const { data: subItems } = await supabase.storage.from('SGB').list(item.name, { limit: 100 });
        console.log(`Folder '${item.name}' contains ${subItems ? subItems.length : 0} items.`);
      }
    }
  }

  process.exit(0);
}

findAllMedia().catch(err => {
  console.error('Scan failed:', err);
  process.exit(1);
});
