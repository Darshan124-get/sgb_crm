const db = require('./backend/src/config/db');

async function run() {
  try {
    let [[shippingDept]] = await db.query("SELECT id FROM departments WHERE name = 'Shipping'");
    if (!shippingDept) {
        await db.query("INSERT INTO departments (name, status) VALUES ('Shipping', 'active')");
        const [[newDept]] = await db.query("SELECT id FROM departments WHERE name = 'Shipping'");
        shippingDept = newDept;
    }
    const deptId = shippingDept.id;

    const roles = [
      { name: 'shipping_manager', desc: 'Shipping Manager', perms: ['shipping_dashboard', 'shipping_shipping', 'manager_team'] },
      { name: 'shipping_executive', desc: 'Shipping Executive', perms: ['shipping_dashboard', 'shipping_shipping'] },
      { name: 'shipping_viewer', desc: 'Shipping Viewer', perms: ['shipping_dashboard', 'shipping_shipping'] }
    ];

    for (const role of roles) {
      await db.query(
        "INSERT IGNORE INTO roles (name, description, department_id, default_permissions) VALUES (?, ?, ?, ?)",
        [role.name, role.desc, deptId, JSON.stringify(role.perms)]
      );
    }
    console.log('Shipping roles inserted');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
