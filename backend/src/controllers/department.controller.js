const db = require('../config/db');

exports.getAllDepartments = async (req, res) => {
    try {
        const query = `
            SELECT 
                d.id, d.name, d.department_code, d.description, d.status, d.created_at,
                m.name AS manager_name,
                m.user_id AS manager_id,
                (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) AS total_users
            FROM departments d
            LEFT JOIN users m ON d.manager_id = m.user_id
            ORDER BY d.created_at DESC
        `;
        const [departments] = await db.execute(query);
        res.json({ success: true, departments });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createDepartment = async (req, res) => {
    const { name, department_code, description, manager_id, status } = req.body;
    try {
        const query = `
            INSERT INTO departments (name, department_code, description, manager_id, status) 
            VALUES (?, ?, ?, ?, ?)
        `;
        const [result] = await db.execute(query, [
            name, 
            department_code || null, 
            description || null, 
            manager_id || null, 
            status || 'active'
        ]);
        res.status(201).json({ success: true, department_id: result.insertId });
    } catch (error) {
        console.error('Error creating department:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Department code or name already exists' });
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateDepartment = async (req, res) => {
    const { id } = req.params;
    const { name, department_code, description, manager_id, status } = req.body;
    try {
        const query = `
            UPDATE departments 
            SET name = ?, department_code = ?, description = ?, manager_id = ?, status = ?
            WHERE id = ?
        `;
        await db.execute(query, [name, department_code || null, description || null, manager_id || null, status || 'active', id]);
        res.json({ success: true, message: 'Department updated' });
    } catch (error) {
        console.error('Error updating department:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Department code or name already exists' });
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteDepartment = async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('DELETE FROM departments WHERE id = ?', [id]);
        res.json({ success: true, message: 'Department deleted' });
    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({ success: false, message: 'Server error. Make sure it has no active users before deleting.' });
    }
};
