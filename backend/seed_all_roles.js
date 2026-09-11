const db = require('./src/config/db');

async function seedAllDepartmentRoles() {
    const rolesToSeed = [
        { name: 'dealer_manager', description: 'Dealer B2B Department Manager' },
        { name: 'sales_manager', description: 'Sales Department Manager' },
        { name: 'shipping_manager', description: 'Shipping Department Manager' },
        { name: 'packing_executive', description: 'Packing Department Executive' },
        { name: 'packing_manager', description: 'Packing Department Manager' }
    ];

    try {
        for (const r of rolesToSeed) {
            const [existing] = await db.execute("SELECT * FROM roles WHERE LOWER(name) = ?", [r.name]);
            if (existing.length === 0) {
                await db.execute(
                    "INSERT INTO roles (name, description, status) VALUES (?, ?, 'active')",
                    [r.name, r.description]
                );
                console.log(`Seeded role: ${r.name}`);
            }
        }
        console.log("Department roles seeding complete.");
        process.exit(0);
    } catch (err) {
        console.error("Error seeding roles:", err.message);
        process.exit(1);
    }
}

seedAllDepartmentRoles();
