const db = require('./src/config/db');

async function seedDepartmentViewerRoles() {
    const rolesToSeed = [
        { name: 'dealer_viewer', description: 'Dealer B2B Department Viewer' },
        { name: 'shipping_executive', description: 'Shipping Department Executive' },
        { name: 'shipping_viewer', description: 'Shipping Department Viewer' },
        { name: 'packing_viewer', description: 'Packing Department Viewer' }
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
        console.log("Department viewer roles seeding complete.");
        process.exit(0);
    } catch (err) {
        console.error("Error seeding viewer roles:", err.message);
        process.exit(1);
    }
}

seedDepartmentViewerRoles();
