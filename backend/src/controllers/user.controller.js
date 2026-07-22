const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.getAllUsers = async (req, res) => {
    const { role, status } = req.query;
    try {
        let query = `
            SELECT 
                u.user_id, u.name, 
                SUBSTRING_INDEX(u.name, ' ', 1) as first_name,
                SUBSTRING_INDEX(u.name, ' ', -1) as last_name,
                u.email, u.phone, u.employee_id, u.language, u.status, u.permissions, u.role_id, u.department_id, u.created_at, 
                r.name as role_name,
                (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.user_id) as leads_handled,
                (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.user_id AND l.status = 'converted') as conversions
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.role_id
            WHERE 1=1
        `;
        let params = [];
        
        // PBAC: If requester is a Manager, restrict to their department only
        if (req.user && req.user.is_manager && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            query += ' AND u.department_id = ?';
            params.push(req.user.department_id);
        }

        if (role) {
            query += ' AND r.name = ?';
            params.push(role);
        }
        if (status) {
            query += ' AND u.status = ?';
            params.push(status);
        }

        query += ' ORDER BY u.created_at DESC';

        const [users] = await db.execute(query, params);
        res.json(users);
    } catch (err) {
        console.error('getAllUsers Error:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getSalesTeam = async (req, res) => {
    try {
        const query = `
            SELECT u.user_id, u.name, u.email, u.phone, r.name as role_name, u.language
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE (r.name LIKE '%telecaller%' OR r.name LIKE '%sales%' OR r.name LIKE '%manager%' OR r.name LIKE '%viewer%' OR r.name LIKE '%executive%') 
            AND u.status = 'active'
            ORDER BY u.name ASC
        `;
        const [users] = await db.execute(query);
        res.json(users);
    } catch (err) {
        console.error('getSalesTeam Error:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.getRoles = async (req, res) => {
    try {
        let query = 'SELECT * FROM roles ';
        let params = [];
        
        // PBAC: Managers only see roles assigned to their department
        if (req.user && req.user.is_manager && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            query += 'WHERE department_id = ? ';
            params.push(req.user.department_id);
        } else {
            // Admins see global roles (department_id IS NULL)
            query += 'WHERE department_id IS NULL ';
        }
        
        query += 'ORDER BY name ASC';
        
        const [roles] = await db.execute(query, params);
        res.json(roles);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createRole = async (req, res) => {
    const { name, description, status, default_permissions } = req.body;
    try {
        if (!name) return res.status(400).json({ success: false, message: 'Role name is required' });
        const [result] = await db.execute(
            'INSERT INTO roles (name, description, status, default_permissions) VALUES (?, ?, ?, ?)',
            [name.toLowerCase().replace(/\s+/g, '-'), description || null, status || 'active', default_permissions ? JSON.stringify(default_permissions) : null]
        );
        res.status(201).json({ success: true, message: 'Role created successfully', role_id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Role already exists' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateRole = async (req, res) => {
    const { id } = req.params;
    const { name, description, status, default_permissions } = req.body;
    try {
        if (!name) return res.status(400).json({ success: false, message: 'Role name is required' });
        await db.execute(
            'UPDATE roles SET name = ?, description = ?, status = ?, default_permissions = ? WHERE role_id = ?',
            [name.toLowerCase().replace(/\s+/g, '-'), description || null, status || 'active', default_permissions ? JSON.stringify(default_permissions) : null, id]
        );
        res.json({ success: true, message: 'Role updated successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Role name already exists' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteRole = async (req, res) => {
    const { id } = req.params;
    try {
        // Optional: Check if users exist with this role
        const [[userCount]] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role_id = ?', [id]);
        if (userCount.count > 0) {
            return res.status(400).json({ success: false, message: 'Cannot delete role assigned to users.' });
        }

        await db.execute('DELETE FROM roles WHERE role_id = ?', [id]);
        res.json({ success: true, message: 'Role deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createUser = async (req, res) => {
    let { name, email, phone, employee_id, password, role_id, department_id, language, permissions } = req.body;
    try {
        // PBAC: If requester is a Manager, force department_id to be their own
        if (req.user && req.user.is_manager && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            department_id = req.user.department_id;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            'INSERT INTO users (name, email, phone, employee_id, password_hash, role_id, department_id, language, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, email, phone || null, employee_id || null, hashedPassword, role_id, department_id || null, language || 'EN', permissions ? JSON.stringify(permissions) : null]
        );
        res.status(201).json({ message: 'User created successfully', user_id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            let field = 'A unique field';
            if (err.message.includes('email')) field = 'Email';
            else if (err.message.includes('phone')) field = 'Phone';
            else if (err.message.includes('employee_id')) field = 'Employee ID';
            return res.status(400).json({ success: false, message: `${field} already exists.` });
        }
        res.status(500).json({ message: err.message });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    let { name, email, phone, employee_id, role_id, department_id, language, status, permissions, password } = req.body;
    try {
        // Fetch current row
        const [[current]] = await db.execute(
            'SELECT language, status, department_id FROM users WHERE user_id = ?', [id]
        );

        if (!current) return res.status(404).json({ message: 'User not found' });

        // PBAC: If requester is a Manager, ensure they are only editing a user in their department
        if (req.user && req.user.is_manager && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            if (current.department_id !== req.user.department_id) {
                return res.status(403).json({ message: 'Unauthorized to edit this user' });
            }
            // Prevent changing department
            department_id = req.user.department_id;
        }

        const safeLang   = (language != null && language !== '') ? language : (current?.language ?? null);
        const safeStatus = (status   != null && status   !== '') ? status   : (current?.status ?? 'active');

        if (password && password !== '********') {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.execute(
                'UPDATE users SET name = ?, email = ?, phone = ?, employee_id = ?, role_id = ?, department_id = ?, language = ?, status = ?, permissions = ?, password_hash = ? WHERE user_id = ?',
                [name, email, phone || null, employee_id || null, role_id, department_id || null, safeLang, safeStatus, permissions ? JSON.stringify(permissions) : null, hashedPassword, id]
            );
        } else {
            await db.execute(
                'UPDATE users SET name = ?, email = ?, phone = ?, employee_id = ?, role_id = ?, department_id = ?, language = ?, status = ?, permissions = ? WHERE user_id = ?',
                [name, email, phone || null, employee_id || null, role_id, department_id || null, safeLang, safeStatus, permissions ? JSON.stringify(permissions) : null, id]
            );
        }
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            let field = 'A unique field';
            if (err.message.includes('email')) field = 'Email';
            else if (err.message.includes('phone')) field = 'Phone';
            else if (err.message.includes('employee_id')) field = 'Employee ID';
            return res.status(400).json({ success: false, message: `${field} already exists.` });
        }
        res.status(500).json({ message: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.execute('UPDATE users SET password_hash = ? WHERE user_id = ?', [hashedPassword, id]);
        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // PBAC constraint
        if (req.user && req.user.is_manager && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            const [[current]] = await db.execute('SELECT department_id FROM users WHERE user_id = ?', [id]);
            if (current && current.department_id !== req.user.department_id) {
                return res.status(403).json({ message: 'Unauthorized to delete this user' });
            }
        }
        
        await db.execute('DELETE FROM users WHERE user_id = ?', [id]);
        res.json({ message: 'Staff deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
