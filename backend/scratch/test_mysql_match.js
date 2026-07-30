const db = require('../src/config/db');

async function test() {
    try {
        const leadId = 1067;
        const [rows] = await db.query(`
            SELECT l.lead_id, l.customer_name, l.first_message,
                   (SELECT campaign_id FROM campaigns c 
                    WHERE TRIM(REPLACE(REPLACE(c.tag_line, '\n', ''), '\r', '')) = TRIM(REPLACE(REPLACE(l.first_message, '\n', ''), '\r', ''))
                    LIMIT 1) as campaign_name
            FROM leads l
            WHERE l.lead_id = ?
        `, [leadId]);
        console.log('QueryResult:', rows[0]);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

test();
