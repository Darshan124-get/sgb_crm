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

    const [campaigns] = await pool.query('SELECT id, campaign_id, tag_line, product_name, status, auto_replies FROM campaigns');
    console.log('ALL CAMPAIGNS IN DB:');
    campaigns.forEach(c => {
      let parsed = [];
      try { parsed = typeof c.auto_replies === 'string' ? JSON.parse(c.auto_replies) : (c.auto_replies || []); } catch(e) {}
      console.log(`- ID: ${c.id} | CampaignID: ${c.campaign_id} | Status: ${c.status} | Tagline: "${c.tag_line}" | AutoReplies count: ${parsed.length}`);
      if (parsed.length > 0) {
        console.log('  AutoReplies items:', parsed);
      }
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
