const pool = require('../config/db');
require('dotenv').config();

async function fixRelativeUrls() {
  console.log('====================================================');
  console.log(' 🛠️ NORMALIZING ALL MEDIA URLS TO /api/media/ PREFIX ');
  console.log('====================================================\n');

  // 1. Update chat_messages
  const [res1] = await pool.query(
    `UPDATE chat_messages 
     SET media_url = CONCAT('/api/media/', media_url) 
     WHERE media_url IS NOT NULL 
       AND media_url != '' 
       AND media_url NOT LIKE '/api/media/%' 
       AND media_url NOT LIKE 'http%'`
  );
  console.log(`✅ Updated chat_messages: ${res1.affectedRows} rows prefixed with /api/media/`);

  // 2. Update whatsapp_quick_replies
  const [res2] = await pool.query(
    `UPDATE whatsapp_quick_replies 
     SET media_url = REPLACE(media_url, 'quick-replies/', '/api/media/quick-replies/') 
     WHERE media_url IS NOT NULL 
       AND media_url LIKE '%quick-replies/%' 
       AND media_url NOT LIKE '%/api/media/%'`
  );
  console.log(`✅ Updated whatsapp_quick_replies: ${res2.affectedRows} rows updated.`);

  // 3. Update campaigns
  const [res3] = await pool.query(
    `UPDATE campaigns 
     SET auto_replies = REPLACE(auto_replies, 'campaigns/', '/api/media/campaigns/') 
     WHERE auto_replies IS NOT NULL 
       AND auto_replies LIKE '%campaigns/%' 
       AND auto_replies NOT LIKE '%/api/media/%'`
  );
  console.log(`✅ Updated campaigns: ${res3.affectedRows} rows updated.`);

  // 4. Update chatbot_media
  const [res4] = await pool.query(
    `UPDATE chatbot_media 
     SET file_url = CONCAT('/api/media/', storage_path) 
     WHERE storage_path IS NOT NULL 
       AND file_url NOT LIKE '/api/media/%'`
  );
  console.log(`✅ Updated chatbot_media: ${res4.affectedRows} rows updated.`);

  // 5. Update chatbot_products
  const [res5] = await pool.query(
    `UPDATE chatbot_products 
     SET image_url = REPLACE(image_url, 'chatbot-media/', '/api/media/chatbot-media/'),
         gallery_urls = REPLACE(gallery_urls, 'chatbot-media/', '/api/media/chatbot-media/') 
     WHERE (image_url LIKE '%chatbot-media/%' OR gallery_urls LIKE '%chatbot-media/%')
       AND image_url NOT LIKE '%/api/media/%'`
  );
  console.log(`✅ Updated chatbot_products: ${res5.affectedRows} rows updated.`);

  // 6. Update chatbot_nodes
  const [res6] = await pool.query(
    `UPDATE chatbot_nodes 
     SET config = REPLACE(config, 'chatbot-media/', '/api/media/chatbot-media/') 
     WHERE config LIKE '%chatbot-media/%' 
       AND config NOT LIKE '%/api/media/%'`
  );
  console.log(`✅ Updated chatbot_nodes: ${res6.affectedRows} rows updated.`);

  console.log('\n🎉 ALL MEDIA URLS ARE NOW 100% UNIFIED AND PROXIED VIA /api/media/');
  process.exit(0);
}

fixRelativeUrls().catch(err => {
  console.error('URL normalization failed:', err);
  process.exit(1);
});
