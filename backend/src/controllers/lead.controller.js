const pool = require('../config/db');

exports.getLeads = async (req, res) => {
    const { status, language, assigned_to, is_today, is_unassigned, source, search } = req.query;
    const userRole = (req.user && req.user.role) ? req.user.role.toLowerCase() : 'sales';
    const userId = req.user ? req.user.id : null;

    try {
        let query = 'SELECT l.*, u.name as assigned_to_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.user_id WHERE 1=1';
        let params = [];

        // 🛡️ SECURITY: Role-Based Data Isolation
        if (userRole === 'sales') {
            query += ' AND l.assigned_to = ?';
            params.push(userId);
        } else {
            // Admin or other roles can filter by assigned_to
            if (assigned_to) {
                query += ' AND l.assigned_to = ?';
                params.push(assigned_to);
            } else if (is_unassigned === 'true') {
                query += ' AND l.assigned_to IS NULL';
            }
        }

        if (status) {
            if (status.includes(',')) {
                const statusList = status.split(',');
                const placeholders = statusList.map(() => '?').join(',');
                query += ` AND l.status IN (${placeholders})`;
                params.push(...statusList);
            } else {
                query += ' AND l.status = ?';
                params.push(status);
            }
        }

        if (req.query.score) {
            query += ' AND l.score = ?';
            params.push(req.query.score);
        }

        if (language) {
            query += ' AND l.language = ?';
            params.push(language);
        }

        if (source) {
            query += ' AND l.source = ?';
            params.push(source);
        }
        
        if (search) {
            query += ' AND (l.customer_name LIKE ? OR l.phone_number LIKE ? OR l.first_message LIKE ?)';
            const searchVal = `%${search}%`;
            params.push(searchVal, searchVal, searchVal);
        }

        if (is_today === 'true') {
            query += ' AND DATE(l.created_at) = CURDATE()';
        } else if (req.query.date) {
            query += ' AND DATE(l.created_at) = ?';
            params.push(req.query.date);
        }

        query += ' ORDER BY l.created_at DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows || []);
    } catch (err) {
        console.error('getLeads Error:', err);
        res.status(500).json({ message: 'Database error: ' + err.message });
    }
};

exports.getLeadById = async (req, res) => {
    const userRole = (req.user && req.user.role) ? req.user.role.toLowerCase() : 'sales';
    const userId = req.user ? req.user.id : null;

    try {
        const [rows] = await pool.query(
            'SELECT l.*, u.name as assigned_to_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.user_id WHERE l.lead_id = ?',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Lead not found' });

        const lead = rows[0];

        // 🛡️ SECURITY: Prevent Sales from viewing leads not assigned to them
        if (userRole === 'sales' && lead.assigned_to !== userId) {
            return res.status(403).json({ message: 'Access denied: Lead not assigned to you' });
        }

        // 📊 FETCH RELATED DATA
        const [interests] = await pool.query('SELECT * FROM lead_interest WHERE lead_id = ?', [req.params.id]);
        lead.interests = interests;

        const [followups] = await pool.query(
            'SELECT * FROM lead_followups WHERE lead_id = ? AND status = "pending" ORDER BY followup_date ASC LIMIT 1',
            [req.params.id]
        );
        lead.next_followup = followups[0] || null;

        // Fetch ALL orders for this customer (via phone) for history
        const [allOrders] = await pool.query(
            `SELECT o.*, 
                (SELECT GROUP_CONCAT(p.name SEPARATOR ", ") 
                 FROM order_items oi 
                 JOIN products p ON oi.product_id = p.product_id 
                 WHERE oi.order_id = o.order_id) as items_summary 
             FROM orders o 
             WHERE o.phone = ? 
             ORDER BY o.created_at DESC`,
            [lead.phone_number]
        );
        lead.order = allOrders[0] || null; // Most recent for top summary
        lead.order_history = allOrders; // Full list for history section

        // Fetch recent feedback (last note that isn't an 'attempt' or automated)
        const [feedbackRows] = await pool.query(
            'SELECT note FROM lead_notes WHERE lead_id = ? AND note NOT LIKE "%attempt%" AND note NOT LIKE "Lead created%" ORDER BY created_at DESC LIMIT 1',
            [req.params.id]
        );
        lead.feedback = feedbackRows[0] ? feedbackRows[0].note : '-';

        // Count call attempts
        const [attemptRows] = await pool.query(
            'SELECT COUNT(*) as count FROM lead_notes WHERE lead_id = ? AND note LIKE "%attempt%"',
            [req.params.id]
        );
        lead.call_attempts = attemptRows[0].count;

        res.json(lead);
    } catch (err) {
        console.error('getLeadById Error:', err);
        res.status(500).json({ message: 'Database error: ' + err.message, stack: err.stack });
    }
};

exports.createLead = async (req, res) => {
    const { phone_number, customer_name, first_message, language, address, city, state, district, pincode, source, delivery_type } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 🚫 DUPLICATE PREVENTION: Check if phone exists
        const [existing] = await connection.query('SELECT lead_id, assigned_to FROM leads WHERE phone_number = ?', [phone_number]);
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({
                message: 'A lead with this phone number already exists.',
                lead_id: existing[0].lead_id,
                duplicate: true
            });
        }

        // 🔄 AUTO-ASSIGNMENT: Language-Based Round-Robin (Strict No-AI Logic)
        // Match against comma-separated values in the user's language column
        const [salesStaff] = await connection.query(
            `SELECT u.user_id 
             FROM users u 
             JOIN roles r ON u.role_id = r.role_id 
             WHERE r.name = 'sales' 
               AND (FIND_IN_SET(?, u.language) > 0 OR u.language = 'General') 
               AND u.status = 'active'
             ORDER BY u.updated_at ASC LIMIT 1`,
            [language || 'EN']
        );

        let assignedTo = null;
        let status = 'new';

        if (salesStaff.length > 0) {
            assignedTo = salesStaff[0].user_id;
            status = 'assigned';

            // Touch staff to ensure fair round-robin distribution
            await connection.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [assignedTo]);
        }

        const [result] = await connection.query(
            `INSERT INTO leads (phone_number, customer_name, first_message, language, address, city, state, district, pincode, source, status, assigned_to, delivery_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [phone_number, customer_name, first_message, language, address, city, state, district || null, pincode || null, source || 'manual', status, assignedTo, delivery_type || null]
        );

        const leadId = result.insertId;

        // Logging
        await connection.query(
            'INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)',
            [leadId, req.user.id, `Lead created via ${source || 'manual'}. Status: ${status}${assignedTo ? ` (Auto-assigned based on language: ${language})` : ' (Unassigned: No matching language staff)'}`]
        );

        await connection.commit();
        res.status(201).json({ message: 'Lead created successfully', lead_id: leadId, assignedTo });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) { }
        res.status(500).json({ message: 'Error creating lead: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.updateLead = async (req, res) => {
    const {
        phone_number, customer_name, first_message, language, address, city, state, district, pincode,
        status, assigned_to, score, next_followup_date, lost_reason, lost_notes,
        current_crop, acreage, delivery_type
    } = req.body;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [oldLead] = await connection.query('SELECT assigned_to, next_followup_date FROM leads WHERE lead_id = ?', [req.params.id]);
        const oldAssignedTo = oldLead[0] ? oldLead[0].assigned_to : null;
        const oldFollowupDate = oldLead[0] ? oldLead[0].next_followup_date : null;

        const finalAssignedTo = (assigned_to !== undefined && assigned_to !== '') ? assigned_to : oldAssignedTo;

        await connection.query(
            `UPDATE leads SET 
                phone_number = ?, customer_name = ?, first_message = ?, language = ?, 
                address = ?, city = ?, state = ?, district = ?, pincode = ?, status = ?, assigned_to = ?,
                score = ?, next_followup_date = ?, lost_reason = ?, lost_notes = ?,
                current_crop = ?, acreage = ?, delivery_type = ?
            WHERE lead_id = ?`,
            [
                phone_number, customer_name, first_message, language,
                address, city, state, district || null, pincode || null, status, finalAssignedTo,
                score || 'cold', next_followup_date || null, lost_reason || null, lost_notes || null,
                current_crop || null, acreage || null, delivery_type || null,
                req.params.id
            ]
        );

        // Sync lead_followups if date changed
        if (next_followup_date && next_followup_date !== oldFollowupDate) {
            // Check if there's already a pending followup
            const [existing] = await connection.query('SELECT followup_id FROM lead_followups WHERE lead_id = ? AND status = "pending"', [req.params.id]);
            if (existing.length > 0) {
                await connection.query('UPDATE lead_followups SET followup_date = ? WHERE followup_id = ?', [next_followup_date, existing[0].followup_id]);
            } else {
                await connection.query(
                    'INSERT INTO lead_followups (lead_id, followup_date, status, remarks, created_by) VALUES (?, ?, "pending", ?, ?)',
                    [req.params.id, next_followup_date, `Scheduled via Update (${status})`, req.user.id]
                );
            }
        }

        await connection.query('INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)',
            [req.params.id, req.user.id, `Lead details updated. Status: ${status}`]);

        await connection.commit();
        res.json({ message: 'Lead updated successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: 'Error updating lead: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.assignLead = async (req, res) => {
    const { assigned_to } = req.body;
    try {
        await pool.query('UPDATE leads SET assigned_to = ?, status = "assigned" WHERE lead_id = ?', [assigned_to, req.params.id]);
        await pool.query('INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)',
            [req.params.id, req.user.id, `Lead assigned to user ID ${assigned_to}`]);
        res.json({ message: 'Lead assigned successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error assigning lead' });
    }
};

exports.deleteLead = async (req, res) => {
    try {
        await pool.query('DELETE FROM leads WHERE lead_id = ?', [req.params.id]);
        res.json({ message: 'Lead deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting lead' });
    }
};

exports.getLeadNotes = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT n.*, u.name as user_name FROM lead_notes n LEFT JOIN users u ON n.user_id = u.user_id 
             WHERE n.lead_id = ? ORDER BY n.created_at DESC`, [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Database error' });
    }
};

exports.addLeadNote = async (req, res) => {
    const { note } = req.body;
    try {
        await pool.query('INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)', [req.params.id, req.user.id, note]);
        res.status(201).json({ message: 'Note added' });
    } catch (err) {
        res.status(500).json({ message: 'Error adding note' });
    }
};

exports.transferLead = async (req, res) => {
    const { target_language } = req.body;
    const leadId = req.params.id;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Find the best target Sales staff for the new language
        const [salesStaff] = await connection.query(
            `SELECT u.user_id, u.name 
             FROM users u 
             JOIN roles r ON u.role_id = r.role_id 
             WHERE r.name = 'sales' AND u.language = ? AND u.status = 'active'
             ORDER BY u.updated_at ASC LIMIT 1`,
            [target_language]
        );

        if (salesStaff.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: `No active sales staff found for language: ${target_language}` });
        }

        const targetUser = salesStaff[0];

        // 2. Perform the transfer
        await connection.query(
            'UPDATE leads SET assigned_to = ?, language = ?, status = "assigned" WHERE lead_id = ?',
            [targetUser.user_id, target_language, leadId]
        );

        // 3. Log the transfer
        await connection.query(
            'INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)',
            [leadId, req.user.id, `Lead transferred to ${targetUser.name} (ID: ${targetUser.user_id}) due to language shift to ${target_language}`]
        );

        // 4. Update target user's rotation timestamp
        await connection.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [targetUser.user_id]);

        await connection.commit();
        res.json({ message: 'Lead transferred successfully', target_user: targetUser.name });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) { }
        res.status(500).json({ message: 'Transfer error: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.getStats = async (req, res) => {
    const userRole = (req.user && req.user.role) ? req.user.role.toLowerCase() : 'sales';
    const userId = req.user ? req.user.id : null;

    try {
        let baseWhere = 'WHERE 1=1';
        let params = [];

        if (userRole === 'sales') {
            baseWhere += ' AND assigned_to = ?';
            params.push(userId);
        }

        const [all] = await pool.query(`SELECT COUNT(*) as count FROM leads ${baseWhere}`, params);
        const [today] = await pool.query(`SELECT COUNT(*) as count FROM leads ${baseWhere} AND DATE(created_at) = CURDATE()`, params);
        const [unassigned] = await pool.query(`SELECT COUNT(*) as count FROM leads WHERE assigned_to IS NULL`);

        // Grouped statuses
        const [followup] = await pool.query(`SELECT COUNT(*) as count FROM leads ${baseWhere} AND status IN ("followup", "interested", "callback")`, params);
        const [converted] = await pool.query(`SELECT COUNT(*) as count FROM leads ${baseWhere} AND status = "converted"`, params);
        const [lost] = await pool.query(`SELECT COUNT(*) as count FROM leads ${baseWhere} AND status IN ("lost", "not_interested")`, params);
        const [scheduled] = await pool.query(`SELECT COUNT(*) as count FROM leads ${baseWhere} AND status = "callback"`, params);
        const [manual] = await pool.query(`SELECT COUNT(*) as count FROM leads ${baseWhere} AND source = "manual"`, params);

        res.json({
            all: all[0].count,
            today: today[0].count,
            unassigned: userRole === 'sales' ? 0 : unassigned[0].count,
            followup: followup[0].count,
            converted: converted[0].count,
            lost: lost[0].count,
            scheduled: scheduled[0].count,
            manual: manual[0].count
        });
    } catch (err) {
        console.error('getStats Error:', err);
        res.status(500).json({ message: 'Error fetching stats: ' + err.message });
    }
};

exports.bulkAssign = async (req, res) => {
    const { leadIds, staffId } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || !staffId) {
        return res.status(400).json({ message: 'Missing leadIds or staffId' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Bulk Update Leads table
        const [result] = await connection.query(
            'UPDATE leads SET assigned_to = ?, status = CASE WHEN status = "new" THEN "assigned" ELSE status END WHERE lead_id IN (?)',
            [staffId, leadIds]
        );

        // 2. Add System Note to each lead
        const [staffRows] = await connection.query('SELECT name FROM users WHERE user_id = ?', [staffId]);
        const staffName = staffRows[0] ? staffRows[0].name : 'Staff Member';

        const noteValues = leadIds.map(id => [id, req.user.id, `System: Lead manually assigned to ${staffName}.`]);
        await connection.query('INSERT INTO lead_notes (lead_id, user_id, note) VALUES ?', [noteValues]);

        await connection.commit();
        res.json({ message: 'Bulk assignment complete', count: result.affectedRows });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) { }
        console.error('bulkAssign Error:', err);
        res.status(500).json({ message: 'Database error' });
    } finally {
        if (connection) connection.release();
    }
};

exports.autoAssign = async (req, res) => {
    const { leadIds } = req.body;
    if (!leadIds || !Array.isArray(leadIds)) {
        return res.status(400).json({ message: 'Missing leadIds' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let count = 0;
        for (const leadId of leadIds) {
            // Get Lead Language
            const [leadRows] = await connection.query('SELECT language FROM leads WHERE lead_id = ?', [leadId]);
            if (leadRows.length === 0) continue;
            const lang = leadRows[0].language || 'EN';

            // Find best staff for this language (Round Robin based on updated_at)
            const [staffRows] = await connection.query(
                `SELECT u.user_id, u.name 
                 FROM users u 
                 JOIN roles r ON u.role_id = r.role_id 
                 WHERE r.name = 'sales' 
                   AND (FIND_IN_SET(?, u.language) > 0 OR u.language = 'General') 
                   AND u.status = 'active'
                 ORDER BY u.updated_at ASC LIMIT 1`,
                [lang]
            );

            if (staffRows.length > 0) {
                const staff = staffRows[0];
                // Assign
                await connection.query(
                    'UPDATE leads SET assigned_to = ?, status = CASE WHEN status = "new" THEN "assigned" ELSE status END WHERE lead_id = ?',
                    [staff.user_id, leadId]
                );
                // Touch staff to move them to back of round robin
                await connection.query('UPDATE users SET updated_at = NOW() WHERE user_id = ?', [staff.user_id]);
                // Note
                await connection.query('INSERT INTO lead_notes (lead_id, note) VALUES (?, ?)',
                    [leadId, `System: Lead auto-assigned to ${staff.name} based on ${lang} language.`]);
                count++;
            }
        }

        await connection.commit();
        res.json({ message: 'Auto-assignment complete', count });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) { }
        console.error('autoAssign Error:', err);
        res.status(500).json({ message: 'Database error' });
    } finally {
        if (connection) connection.release();
    }
};
