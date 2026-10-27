const pool = require('../src/config/db');

async function test() {
  try {
    const [m] = await pool.query('SELECT * FROM chatbot_media WHERE LOWER(filename) LIKE "%blade%" OR LOWER(filename) LIKE "%protector%" OR LOWER(filename) LIKE "%qr%" OR LOWER(file_url) LIKE "%qr%"');
    console.log('Matching media in DB:', m);
    
    const [p] = await pool.query('SELECT * FROM chatbot_products WHERE LOWER(name) LIKE "%blade%" OR LOWER(name) LIKE "%protector%"');
    console.log('Matching products in DB:', p);

    const [allProducts] = await pool.query('SELECT * FROM products WHERE LOWER(name) LIKE "%blade%" OR LOWER(name) LIKE "%protector%"');
    console.log('Matching in general products table:', allProducts);

    const [qr] = await pool.query('SELECT id, shortcut, message, media_url, media_type FROM whatsapp_quick_replies WHERE LOWER(shortcut) LIKE "%blade%" OR LOWER(shortcut) LIKE "%qr%"');
    console.log('Matching quick replies:', qr);

    const [camp] = await pool.query('SELECT id, campaign_id, tag_line, auto_replies FROM campaigns WHERE LOWER(campaign_id) LIKE "%blade%" OR LOWER(tag_line) LIKE "%blade%"');
    console.log('Matching campaigns:', camp);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

test();
