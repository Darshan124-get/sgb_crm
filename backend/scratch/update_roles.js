const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateRoles() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
    });

    try {
        console.log("Replacing custom roles with fixed roles...");

        // First, update users who have custom roles to be 'executive' (as a safe fallback)
        // Find if executive role exists, if not create it
        let [rows] = await pool.query('SELECT role_id FROM roles WHERE name = "executive"');
        let execRoleId;
        if (rows.length === 0) {
            const [result] = await pool.query("INSERT INTO roles (name, description) VALUES ('executive', 'Standard worker in assigned department')");
            execRoleId = result.insertId;
        } else {
            execRoleId = rows[0].role_id;
        }

        let [manRows] = await pool.query('SELECT role_id FROM roles WHERE name = "manager"');
        let manRoleId;
        if (manRows.length === 0) {
            const [result] = await pool.query("INSERT INTO roles (name, description) VALUES ('manager', 'Department head with full access to department panels')");
            manRoleId = result.insertId;
        } else {
            manRoleId = manRows[0].role_id;
        }

        let [viewRows] = await pool.query('SELECT role_id FROM roles WHERE name = "viewer"');
        let viewRoleId;
        if (viewRows.length === 0) {
            const [result] = await pool.query("INSERT INTO roles (name, description) VALUES ('viewer', 'Read-only access to department panels')");
            viewRoleId = result.insertId;
        }

        // Move anyone on 'sales', 'billing', 'packing', 'shipping' to 'executive'
        await pool.query(
            "UPDATE users SET role_id = ? WHERE role_id IN (SELECT role_id FROM roles WHERE name IN ('sales', 'billing', 'packing', 'shipment'))",
            [execRoleId]
        );

        // Delete the old custom roles safely now that users are migrated
        await pool.query("DELETE FROM roles WHERE name IN ('sales', 'billing', 'packing', 'shipment')");

        console.log("Database roles updated successfully!");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

updateRoles();
