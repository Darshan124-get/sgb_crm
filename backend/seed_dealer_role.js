const db = require('./src/config/db');

async function seedDealerRole() {
    try {
        const [existing] = await db.execute("SELECT * FROM roles WHERE LOWER(name) IN ('dealer_executive', 'dealer executive', 'dealer-executive')");
        if (existing.length === 0) {
            await db.execute(
                "INSERT INTO roles (name, description, status) VALUES (?, ?, ?)",
                ['dealer_executive', 'Dealer B2B executive handling dealer orders and inventory', 'active']
            );
            console.log("Successfully seeded 'dealer_executive' role.");
        } else {
            console.log("'dealer_executive' role already exists.");
        }
        process.exit(0);
    } catch (err) {
        console.error("Error seeding dealer executive role:", err.message);
        process.exit(1);
    }
}

seedDealerRole();
