const db = require('./backend/src/config/db');

async function run() {
  try {
    let [[supportDept]] = await db.query("SELECT id, name FROM departments WHERE LOWER(name) LIKE '%customer%support%' LIMIT 1");
    if (!supportDept) {
      console.log('Customer support department not found, creating it...');
      await db.query("INSERT INTO departments (name, status) VALUES ('Customer support', 'active')");
      const [[newDept]] = await db.query("SELECT id, name FROM departments WHERE LOWER(name) LIKE '%customer%support%' LIMIT 1");
      supportDept = newDept;
    }
    const deptId = supportDept.id;
    console.log(`Found Customer Support department with ID: ${deptId}`);

    const basePerms = [
      'customer_support_dashboard',
      'customer_support_tickets',
      'customer_support_queries',
      'customer_support_feedback',
      'support_dashboard',
      'support_tickets',
      'support_queries',
      'support_feedback'
    ];

    const roles = [
      {
        name: 'customer_support_executive',
        desc: 'Customer Support Executive',
        perms: basePerms
      },
      {
        name: 'customer_support_manager',
        desc: 'Customer Support Manager',
        perms: [...basePerms, 'manager_team']
      },
      {
        name: 'customer_support_viewer',
        desc: 'Customer Support Viewer',
        perms: ['customer_support_dashboard', 'customer_support_tickets', 'support_dashboard', 'support_tickets']
      }
    ];

    for (const role of roles) {
      const [existing] = await db.query("SELECT role_id FROM roles WHERE name = ?", [role.name]);
      if (existing.length === 0) {
        await db.query(
          "INSERT INTO roles (name, description, department_id, status, default_permissions) VALUES (?, ?, ?, 'active', ?)",
          [role.name, role.desc, deptId, JSON.stringify(role.perms)]
        );
        console.log(`Created role: ${role.name}`);
      } else {
        await db.query(
          "UPDATE roles SET description = ?, department_id = ?, status = 'active', default_permissions = ? WHERE role_id = ?",
          [role.desc, deptId, JSON.stringify(role.perms), existing[0].role_id]
        );
        console.log(`Updated role: ${role.name}`);
      }
    }

    console.log('Support roles setup successfully completed.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding support roles:', err);
    process.exit(1);
  }
}

run();
