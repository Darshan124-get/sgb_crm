const db = require('./backend/src/config/db');

async function run() {
  try {
    const [[billingDept]] = await db.query("SELECT id FROM departments WHERE name = 'Billing'");
    if (!billingDept) throw new Error('Billing dept not found');
    const deptId = billingDept.id;

    const roles = [
      { name: 'billing_manager', desc: 'Billing Manager', perms: ['billing_billing', 'manager_team'] },
      { name: 'billing_executive', desc: 'Billing Executive', perms: ['billing_billing'] },
      { name: 'billing_viewer', desc: 'Billing Viewer', perms: ['billing_billing'] }
    ];

    for (const role of roles) {
      await db.query(
        "INSERT IGNORE INTO roles (name, description, department_id, default_permissions) VALUES (?, ?, ?, ?)",
        [role.name, role.desc, deptId, JSON.stringify(role.perms)]
      );
    }
    console.log('Roles inserted');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
