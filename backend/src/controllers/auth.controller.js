const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logActivity } = require('../utils/logger');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

exports.login = async (req, res) => {
    const { identifier, password } = req.body;

    try {
        const [rows] = await pool.query(
            `SELECT u.*, r.name as role_name,
             (SELECT id FROM departments WHERE manager_id = u.user_id LIMIT 1) as managed_dept_id,
             (SELECT name FROM departments WHERE manager_id = u.user_id LIMIT 1) as managed_dept_name
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.role_id 
             WHERE u.email = ? OR u.phone = ?`, 
            [identifier, identifier]
        );
        const user = rows[0];

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Account is inactive' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const roleName = user.role_name ? user.role_name.toLowerCase() : '';
        const is_manager = roleName.includes('manager');
        
        let deptName = '';
        let resolved_department_id = user.department_id;
        
        if (user.department_id) {
            const [deptRows] = await pool.query('SELECT name FROM departments WHERE id = ?', [user.department_id]);
            if (deptRows.length > 0) {
                deptName = deptRows[0].name.toLowerCase();
            }
        }

        // Parse explicit permissions
        let perms = [];
        if (typeof user.permissions === 'string') {
            try { perms = JSON.parse(user.permissions); } catch(e) {}
        }

        // Add team management permission for managers
        if (is_manager) {
            if (!perms.includes('manager_team')) perms.push('manager_team');
        }

        // Inject default permissions based on Department (for Manager, Executive, Viewer)
        if (roleName !== 'super-admin' && roleName !== 'admin' && deptName) {
            if (deptName.includes('sales')) {
                const salesPerms = ['sales_dashboard', 'sales_lead_management', 'sales_sales_pipeline', 'sales_schedules', 'sales_orders', 'sales_dealers', 'sales_reports', 'sales_activity', 'sales_settings', 'sales_campaigns', 'whatsapp_whatsapp_chats'];
                salesPerms.forEach(p => { if (!perms.includes(p)) perms.push(p); });
            } else if (deptName.includes('billing')) {
                if (!perms.includes('billing_billing')) perms.push('billing_billing');
            } else if (deptName.includes('packing')) {
                if (!perms.includes('packing_dashboard')) perms.push('packing_dashboard');
                if (!perms.includes('packing_packing')) perms.push('packing_packing');
            } else if (deptName.includes('ship')) {
                if (!perms.includes('shipping_dashboard')) perms.push('shipping_dashboard');
                if (!perms.includes('shipping_shipping')) perms.push('shipping_shipping');
            }
        }

        const token = jwt.sign(
            { 
                id: user.user_id, 
                name: user.name, 
                role: user.role_name,
                department_id: resolved_department_id,
                is_manager: is_manager,
                permissions: perms
            }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );
        
        // Log the login activity
        await logActivity(user.user_id, 'Auth', 'User Login', `Logged in from IP: ${req.ip || 'Unknown'}`, req.ip);
        
        res.json({ 
            token, 
            user: { 
                id: user.user_id,
                name: user.name, 
                role: user.role_name,
                language: user.language,
                permissions: perms,
                department_id: resolved_department_id,
                is_manager: is_manager
            } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.user_id as id, u.name, u.email, u.phone, r.name as role 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.role_id 
             WHERE u.status = 'active'`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};
