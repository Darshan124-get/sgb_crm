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
                u.email, u.phone, u.language, u.status, u.created_at, 
                r.name as role_name,
                (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.user_id) as leads_handled,
                (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.user_id AND l.status = 'converted') as conversions
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.role_id
            WHERE 1=1
        `;
        let params = [];

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

exports.getRoles = async (req, res) => {
    try {
        const [roles] = await db.execute('SELECT * FROM roles ORDER BY name ASC');
        res.json(roles);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createUser = async (req, res) => {
    const { name, email, phone, password, role_id, language } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            'INSERT INTO users (name, email, phone, password_hash, role_id, language) VALUES (?, ?, ?, ?, ?, ?)',
            [name, email, phone, hashedPassword, role_id, language || 'EN']
        );
        res.status(201).json({ message: 'Staff created successfully', user_id: result.insertId });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, role_id, language, status } = req.body;
    try {
        await db.execute(
            'UPDATE users SET name = ?, email = ?, phone = ?, role_id = ?, language = ?, status = ? WHERE user_id = ?',
            [name, email, phone, role_id, language, status, id]
        );
        res.json({ message: 'Staff updated successfully' });
    } catch (err) {
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
        await db.execute('DELETE FROM users WHERE user_id = ?', [id]);
        res.json({ message: 'Staff deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
