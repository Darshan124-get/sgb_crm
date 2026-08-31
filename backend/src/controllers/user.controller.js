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

exports.getUserById = async (req, res) => {
    let { id } = req.params;
    if ((id === 'me' || id === 'self') && req.user) {
        id = req.user.user_id || req.user.id;
    }
    try {
        const query = `
            SELECT 
                u.user_id, u.name, u.email, u.phone, u.employee_id, u.language, u.status, u.permissions, u.role_id, u.department_id, u.created_at,
                COALESCE(u.updated_at, u.created_at) as updated_at,
                r.name as role_name,
                d.name as department_name,
                (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.user_id) as leads_assigned,
                (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.user_id AND (l.status = 'converted' OR l.status = 'Interested to Converted')) as leads_converted,
                (SELECT COUNT(*) FROM orders o WHERE o.created_by = u.user_id) as orders_created,
                (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.created_by = u.user_id) as total_sales
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.user_id = ?
        `;
        const [[user]] = await db.execute(query, [id]);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // PBAC check: Allow if user is viewing their OWN profile or is manager/admin
        const isSelf = req.user && (req.user.user_id == user.user_id || req.user.id == user.user_id);
        if (!isSelf && req.user && req.user.is_manager && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            if (user.department_id !== req.user.department_id) {
                return res.status(403).json({ message: 'Unauthorized to view this user profile' });
            }
        }
        if (!isSelf && req.user && !req.user.is_manager && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            return res.status(403).json({ message: 'Unauthorized to view other user profiles' });
        }

        // Role-based Stat Cards Calculation
        const roleName = (user.role_name || '').toLowerCase();
        const deptName = (user.department_name || '').toLowerCase();

        let roleCategory = 'sales';
        if (roleName.includes('billing') || deptName.includes('billing') || roleName.includes('invoice')) {
            roleCategory = 'billing';
        } else if (roleName.includes('pack') || deptName.includes('pack')) {
            roleCategory = 'packing';
        } else if (roleName.includes('ship') || deptName.includes('ship') || roleName.includes('logistics')) {
            roleCategory = 'shipping';
        }

        let statCards = [];

        if (roleCategory === 'billing') {
            let bStats = { total_invoices: 0, finalized_invoices: 0, draft_invoices: 0, total_revenue: 0 };
            try {
                const [[resStats]] = await db.execute(`
                    SELECT 
                        (SELECT COUNT(*) FROM invoices WHERE created_by = ?) as total_invoices,
                        (SELECT COUNT(*) FROM invoices WHERE created_by = ? AND invoice_status = 'finalized') as finalized_invoices,
                        (SELECT COUNT(*) FROM invoices WHERE created_by = ? AND invoice_status = 'draft') as draft_invoices,
                        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE created_by = ?) as total_revenue
                `, [id, id, id, id]);
                if (resStats) bStats = resStats;
            } catch (e) {
                console.error('Billing stats query fallback:', e.message);
            }

            const handled = Number(bStats.total_invoices || 0);
            const finalized = Number(bStats.finalized_invoices || 0);
            const clearanceRate = handled > 0 ? ((finalized / handled) * 100).toFixed(2) : '0.00';

            statCards = [
                { label: 'Invoices Generated', value: handled, icon: 'fa-file-invoice', bg: '#eff6ff', color: '#3b82f6' },
                { label: 'Finalized Invoices', value: finalized, icon: 'fa-circle-check', bg: '#f0fdf4', color: '#10b981' },
                { label: 'Draft Invoices', value: Number(bStats.draft_invoices || 0), icon: 'fa-file-pen', bg: '#fff7ed', color: '#f97316' },
                { label: 'Total Billed Amount', value: `₹${Number(bStats.total_revenue || 0).toLocaleString('en-IN')}`, icon: 'fa-indian-rupee-sign', bg: '#faf5ff', color: '#a855f7' },
                { label: 'Finalization Rate', value: `${clearanceRate}%`, icon: 'fa-chart-line', bg: '#f0fdfa', color: '#14b8a6' }
            ];
        } else if (roleCategory === 'packing') {
            let pStats = { assigned_orders: 0, packed_count: 0, pending_count: 0, items_packed: 0 };
            try {
                const [[resStats]] = await db.execute(`
                    SELECT 
                        (SELECT COUNT(*) FROM orders WHERE order_status IN ('billed', 'packed')) as assigned_orders,
                        (SELECT COUNT(*) FROM packing WHERE packed_by = ? AND status = 'packed') as packed_count,
                        (SELECT COUNT(*) FROM packing WHERE packed_by = ? AND status = 'pending') as pending_count,
                        (SELECT COALESCE(SUM(oi.quantity), 0) FROM packing p JOIN order_items oi ON p.order_id = oi.order_id WHERE p.packed_by = ?) as items_packed
                `, [id, id, id]);
                if (resStats) pStats = resStats;
            } catch (e) {
                console.error('Packing stats query fallback:', e.message);
            }

            const assigned = Number(pStats.assigned_orders || 0);
            const packed = Number(pStats.packed_count || 0);
            const completionRate = assigned > 0 ? ((packed / assigned) * 100).toFixed(2) : '0.00';

            statCards = [
                { label: 'Orders Assigned', value: assigned, icon: 'fa-box-archive', bg: '#eff6ff', color: '#3b82f6' },
                { label: 'Orders Packed', value: packed, icon: 'fa-box', bg: '#f0fdf4', color: '#10b981' },
                { label: 'Pending Packing', value: Number(pStats.pending_count || 0), icon: 'fa-clock', bg: '#fff7ed', color: '#f97316' },
                { label: 'Total Units Packed', value: Number(pStats.items_packed || 0), icon: 'fa-boxes-stacked', bg: '#faf5ff', color: '#a855f7' },
                { label: 'Completion Rate', value: `${completionRate}%`, icon: 'fa-chart-line', bg: '#f0fdfa', color: '#14b8a6' }
            ];
        } else if (roleCategory === 'shipping') {
            let sStats = { total_shipments: 0, shipped_count: 0, delivered_count: 0, transit_count: 0 };
            try {
                const [[resStats]] = await db.execute(`
                    SELECT 
                        (SELECT COUNT(*) FROM shipments WHERE shipped_by = ?) as total_shipments,
                        (SELECT COUNT(*) FROM shipments WHERE shipped_by = ? AND status = 'shipped') as shipped_count,
                        (SELECT COUNT(*) FROM shipments WHERE shipped_by = ? AND status = 'delivered') as delivered_count,
                        (SELECT COUNT(*) FROM shipments WHERE shipped_by = ? AND status = 'in_transit') as transit_count
                `, [id, id, id, id]);
                if (resStats) sStats = resStats;
            } catch (e) {
                console.error('Shipping stats query fallback:', e.message);
            }

            const handled = Number(sStats.total_shipments || 0);
            const delivered = Number(sStats.delivered_count || 0);
            const successRate = handled > 0 ? ((delivered / handled) * 100).toFixed(2) : '0.00';

            statCards = [
                { label: 'Shipments Handled', value: handled, icon: 'fa-truck-fast', bg: '#eff6ff', color: '#3b82f6' },
                { label: 'Dispatched Orders', value: Number(sStats.shipped_count || 0), icon: 'fa-paper-plane', bg: '#f0fdf4', color: '#10b981' },
                { label: 'Delivered Orders', value: delivered, icon: 'fa-house-circle-check', bg: '#fff7ed', color: '#f97316' },
                { label: 'In-Transit Orders', value: Number(sStats.transit_count || 0), icon: 'fa-route', bg: '#faf5ff', color: '#a855f7' },
                { label: 'Delivery Success Rate', value: `${successRate}%`, icon: 'fa-chart-line', bg: '#f0fdfa', color: '#14b8a6' }
            ];
        } else {
            // Default Sales / Telecaller / Admin
            const leadsAssigned = Number(user.leads_assigned || 0);
            const leadsConverted = Number(user.leads_converted || 0);
            const conversionRate = leadsAssigned > 0 ? ((leadsConverted / leadsAssigned) * 100).toFixed(2) : '0.00';

            statCards = [
                { label: 'Leads Assigned', value: leadsAssigned, icon: 'fa-user-group', bg: '#eff6ff', color: '#3b82f6' },
                { label: 'Leads Converted', value: leadsConverted, icon: 'fa-circle-check', bg: '#f0fdf4', color: '#10b981' },
                { label: 'Orders Created', value: Number(user.orders_created || 0), icon: 'fa-shopping-cart', bg: '#fff7ed', color: '#f97316' },
                { label: 'Total Sales', value: `₹${Number(user.total_sales || 0).toLocaleString('en-IN')}`, icon: 'fa-indian-rupee-sign', bg: '#faf5ff', color: '#a855f7' },
                { label: 'Conversion Rate', value: `${conversionRate}%`, icon: 'fa-chart-line', bg: '#f0fdfa', color: '#14b8a6' }
            ];
        }

        user.role_category = roleCategory;
        user.stat_cards = statCards;

        // Fetch recent activities for this user
        let activities = [];
        try {
            const activityQuery = `
                SELECT * FROM (
                    SELECT 
                        CONCAT('sys_', l.log_id) as id,
                        l.created_at,
                        'system' as type,
                        l.action as title,
                        COALESCE(l.details, 'Logged in to system') as description
                    FROM system_logs l
                    WHERE l.user_id = ?
                    
                    UNION ALL
                    
                    SELECT 
                        CONCAT('lead_', ln.note_id) as id,
                        ln.created_at,
                        'lead' as type,
                        'Updated lead status' as title,
                        CONCAT('Lead Note: ', LEFT(ln.note, 120)) as description
                    FROM lead_notes ln
                    WHERE ln.user_id = ?
                    
                    UNION ALL
                    
                    SELECT 
                        CONCAT('ord_', o.order_id) as id,
                        o.created_at,
                        'order' as type,
                        CONCAT('Created Order #', o.order_id) as title,
                        CONCAT('Amount: ₹', o.total_amount) as description
                    FROM orders o
                    WHERE o.created_by = ?
                ) AS combined
                ORDER BY created_at DESC
                LIMIT 15
            `;
            const [logs] = await db.execute(activityQuery, [id, id, id]);
            activities = logs;
        } catch (actErr) {
            console.error('Error fetching user activity logs:', actErr.message);
        }

        user.recent_activity = activities;
        res.json(user);
    } catch (err) {
        console.error('getUserById Error:', err);
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

exports.registerFcmToken = async (req, res) => {
    const { token, device_type } = req.body;
    const userId = req.user.id;

    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }

    try {
        await db.execute(
            `INSERT INTO user_fcm_tokens (user_id, fcm_token, device_type) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
            [userId, token, device_type || 'web']
        );
        res.status(200).json({ message: 'FCM token registered successfully' });
    } catch (err) {
        console.error('Error registering FCM token:', err);
        res.status(500).json({ message: 'Error registering FCM token' });
    }
};

exports.deleteFcmToken = async (req, res) => {
    const { token } = req.query;
    const userId = req.user.id;

    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }

    try {
        await db.execute(
            'DELETE FROM user_fcm_tokens WHERE fcm_token = ? AND user_id = ?',
            [token, userId]
        );
        res.status(200).json({ message: 'FCM token deleted successfully' });
    } catch (err) {
        console.error('Error deleting FCM token:', err);
        res.status(500).json({ message: 'Error deleting FCM token' });
    }
};

exports.toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || (status !== 'active' && status !== 'inactive')) {
        return res.status(400).json({ success: false, message: 'Invalid status value. Must be active or inactive.' });
    }

    try {
        // Fetch current row
        const [[current]] = await db.execute(
            'SELECT department_id FROM users WHERE user_id = ?', [id]
        );

        if (!current) return res.status(404).json({ success: false, message: 'User not found' });

        // PBAC: If requester is a Manager, ensure they are only editing a user in their department
        if (req.user && req.user.is_manager && req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            if (current.department_id !== req.user.department_id) {
                return res.status(403).json({ success: false, message: 'Unauthorized to edit this user' });
            }
        }

        await db.execute('UPDATE users SET status = ? WHERE user_id = ?', [status, id]);
        res.json({ success: true, message: `User status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


