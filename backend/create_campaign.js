const db = require('./src/config/db');

async function run() {
    try {
        const query = `
        CREATE TABLE IF NOT EXISTS campaigns (
            id INT AUTO_INCREMENT PRIMARY KEY,
            campaign_id VARCHAR(100) NOT NULL UNIQUE,
            tag_line TEXT NOT NULL,
            status ENUM('active', 'deactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`;
        await db.query(query);
        console.log("Table 'campaigns' created successfully.");
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
