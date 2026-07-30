const db = require('../src/config/db');

async function test() {
    try {
        const [leads] = await db.query("SELECT lead_id, first_message, CHAR_LENGTH(first_message) as len FROM leads WHERE phone_number = '9876013784'");
        console.log('Lead info:', leads[0]);

        const [campaigns] = await db.query("SELECT campaign_id, tag_line, CHAR_LENGTH(tag_line) as len FROM campaigns WHERE campaign_id = 'ads-marathi-july'");
        console.log('Campaign info:', campaigns[0]);

        if (leads[0] && campaigns[0]) {
            const firstMsg = leads[0].first_message;
            const tagLine = campaigns[0].tag_line;

            console.log('firstMsg (trimmed):', firstMsg.trim());
            console.log('tagLine (trimmed):', tagLine.trim());

            console.log('Exact Match (===):', firstMsg === tagLine);
            console.log('Trimmed Match:', firstMsg.trim() === tagLine.trim());
            
            // Check for partial or cleaned match
            const clean = str => str.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
            console.log('Cleaned Match:', clean(firstMsg) === clean(tagLine));
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

test();
