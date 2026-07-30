const db = require('../src/config/db');

async function test() {
    try {
        const [leads] = await db.query(`
            SELECT l.lead_id, l.customer_name, l.first_message,
                   (SELECT campaign_id FROM campaigns c WHERE c.tag_line = l.first_message LIMIT 1) as campaign_name
            FROM leads l
            ORDER BY l.lead_id DESC
            LIMIT 10
        `);
        console.log('Recent leads with campaign details:', leads);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

test();
