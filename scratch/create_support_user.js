const path = require('path');
const db = require(path.join(__dirname, '../backend/src/config/db'));
const bcrypt = require(path.join(__dirname, '../backend/node_modules/bcryptjs'));

async function main() {
    const email = 'support@sgbagro.com';
    const [existing] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length === 0) {
        const hash = await bcrypt.hash('Support@123', 10);
        const perms = JSON.stringify(['customer_support_dashboard', 'support_dashboard', 'customer_support_tickets', 'support_tickets']);
        const [res] = await db.query(
            'INSERT INTO users (name, phone, email, password_hash, role_id, department_id, employee_id, status, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, "active", ?)',
            ['Ravi Kumar', '9876543299', email, hash, 36, 19, 'CSE-001', perms]
        );
        console.log('Customer Support Executive created with ID:', res.insertId);
    } else {
        console.log('User already exists with ID:', existing[0].user_id);
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
