const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logActivity } = require('../utils/logger');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable must be set.');
}
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET + '_REFRESH_SECRET');

async function resolveUserPermissionsAndPayload(user) {
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
    } else if (Array.isArray(user.permissions)) {
        perms = [...user.permissions];
    }

    // Add team management permission for managers
    if (is_manager) {
        if (!perms.includes('manager_team')) perms.push('manager_team');
    }

    // Inject default permissions based on Department/Role (for Manager, Executive, Viewer)
    if (roleName !== 'super-admin' && roleName !== 'admin') {
        if (roleName.includes('dealer') || (deptName && (deptName.includes('delar') || deptName.includes('dealer')))) {
            const dealerPerms = ['dealer_dashboard', 'dealer_dealers', 'dealer_orders', 'dealer_visits', 'dealer_reports', 'dealer_settings'];
            dealerPerms.forEach(p => { if (!perms.includes(p)) perms.push(p); });
        } else if (roleName.includes('sales') || (deptName && deptName.includes('sales'))) {
            const salesPerms = ['sales_dashboard', 'sales_lead_management', 'sales_sales_pipeline', 'sales_schedules', 'sales_orders', 'sales_reports', 'sales_activity', 'sales_settings', 'whatsapp_whatsapp_chats'];
            salesPerms.forEach(p => { if (!perms.includes(p)) perms.push(p); });
        } else if (roleName.includes('billing') || (deptName && deptName.includes('billing'))) {
            if (!perms.includes('billing_billing')) perms.push('billing_billing');
        } else if (roleName.includes('packing') || (deptName && deptName.includes('packing'))) {
            if (!perms.includes('packing_dashboard')) perms.push('packing_dashboard');
            if (!perms.includes('packing_packing')) perms.push('packing_packing');
        } else if (roleName.includes('ship') || (deptName && deptName.includes('ship'))) {
            if (!perms.includes('shipping_dashboard')) perms.push('shipping_dashboard');
            if (!perms.includes('shipping_shipping')) perms.push('shipping_shipping');
        }
    }

    return {
        resolved_department_id,
        is_manager,
        perms
    };
}

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

        const { resolved_department_id, is_manager, perms } = await resolveUserPermissionsAndPayload(user);

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
            { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
            { id: user.user_id },
            JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );
        
        // Log the login activity
        await logActivity(user.user_id, 'Auth', 'User Login', `Logged in from IP: ${req.ip || 'Unknown'}`, req.ip);
        
        res.json({ 
            token, 
            refreshToken,
            user: { 
                id: user.user_id,
                user_id: user.user_id,
                name: user.name, 
                email: user.email || '',
                phone: user.phone || '',
                employee_id: user.employee_id || '',
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

exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token required' });
    }

    try {
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        const [rows] = await pool.query(
            `SELECT u.*, r.name as role_name
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.role_id 
             WHERE u.user_id = ?`,
            [decoded.id]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: 'User not found' });
        }

        const user = rows[0];
        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Account is inactive' });
        }

        const { resolved_department_id, is_manager, perms } = await resolveUserPermissionsAndPayload(user);

        const newToken = jwt.sign(
            { 
                id: user.user_id, 
                name: user.name, 
                role: user.role_name,
                department_id: resolved_department_id,
                is_manager: is_manager,
                permissions: perms
            }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );

        const newRefreshToken = jwt.sign(
            { id: user.user_id },
            JWT_REFRESH_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            token: newToken,
            refreshToken: newRefreshToken,
            user: { 
                id: user.user_id,
                user_id: user.user_id,
                name: user.name, 
                email: user.email || '',
                phone: user.phone || '',
                employee_id: user.employee_id || '',
                role: user.role_name,
                language: user.language,
                permissions: perms,
                department_id: resolved_department_id,
                is_manager: is_manager
            } 
        });
    } catch (err) {
        console.error('Refresh token error:', err);
        res.status(500).json({ message: 'Server error during token refresh' });
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
