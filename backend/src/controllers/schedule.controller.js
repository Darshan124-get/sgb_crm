const pool = require('../config/db');

/**
 * Fetch schedules based on filters and classification
 */
exports.getSchedules = async (req, res) => {
    const { tab, staff_id, lead_status, search, start_date, end_date } = req.query;
    const userRole = (req.user && req.user.role) ? req.user.role.toLowerCase() : 'sales';
    const userId = req.user ? req.user.id : null;

    try {
        let query = `
            SELECT 
                f.*, 
                l.customer_name, l.phone_number, l.status as lead_status, l.score as lead_score,
                l.reminders_enabled,
                u.name as staff_name,
                (SELECT note FROM lead_notes WHERE lead_id = l.lead_id ORDER BY created_at DESC LIMIT 1) as last_note
            FROM lead_followups f
            JOIN leads l ON f.lead_id = l.lead_id
            LEFT JOIN users u ON l.assigned_to = u.user_id
            WHERE 1=1
        `;
        let params = [];

        // Role-based filtering
        if (userRole === 'sales') {
            query += ' AND l.assigned_to = ?';
            params.push(userId);
        } else if (staff_id) {
            query += ' AND l.assigned_to = ?';
            params.push(staff_id);
        }

        // Tab-based classification
        const today = new Date().toISOString().split('T')[0];
        if (tab === 'today') {
            query += ' AND DATE(f.followup_date) = CURDATE() AND f.status = "pending"';
        } else if (tab === 'overdue') {
            query += ' AND f.followup_date < NOW() AND f.status = "pending"';
        } else if (tab === 'upcoming') {
            query += ' AND f.followup_date > NOW() AND f.status = "pending"';
        } else if (tab === 'completed') {
            query += ' AND f.status = "done"';
        }

        // Filters
        if (lead_status) {
            query += ' AND l.status = ?';
            params.push(lead_status);
        }

        if (search) {
            query += ' AND (l.customer_name LIKE ? OR l.phone_number LIKE ? OR l.lead_id = ?)';
            params.push(`%${search}%`, `%${search}%`, search);
        }

        if (start_date && end_date) {
            query += ' AND DATE(f.followup_date) BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        query += ' ORDER BY f.followup_date ASC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('getSchedules Error:', err);
        res.status(500).json({ message: 'Database error: ' + err.message });
    }
};

/**
 * Get statistics for the dashboard
 */
exports.getScheduleStats = async (req, res) => {
    const userRole = (req.user && req.user.role) ? req.user.role.toLowerCase() : 'sales';
    const userId = req.user ? req.user.id : null;

    try {
        let baseWhere = 'FROM lead_followups f JOIN leads l ON f.lead_id = l.lead_id WHERE 1=1';
        let params = [];

        if (userRole === 'sales') {
            baseWhere += ' AND l.assigned_to = ?';
            params.push(userId);
        }

        const [today] = await pool.query(`SELECT COUNT(*) as count ${baseWhere} AND DATE(f.followup_date) = CURDATE() AND f.status = "pending"`, params);
        const [overdue] = await pool.query(`SELECT COUNT(*) as count ${baseWhere} AND f.followup_date < NOW() AND f.status = "pending"`, params);
        const [completed] = await pool.query(`SELECT COUNT(*) as count ${baseWhere} AND f.status = "done"`, params);
        const [total] = await pool.query(`SELECT COUNT(*) as count ${baseWhere}`, params);

        res.json({
            today: today[0].count,
            overdue: overdue[0].count,
            completed: completed[0].count,
            total_pending: total[0].count - completed[0].count
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

/**
 * Update followup status (Complete it)
 */
exports.updateStatus = async (req, res) => {
    const { status, remarks } = req.body;
    const followupId = req.params.id;

    try {
        await pool.query(
            'UPDATE lead_followups SET status = ?, remarks = ? WHERE followup_id = ?',
            [status || 'done', remarks || '', followupId]
        );

        // Optional: Update lead's next_followup_date if it was this one
        // Better: Fetch next pending followup and update lead record
        const [followup] = await pool.query('SELECT lead_id FROM lead_followups WHERE followup_id = ?', [followupId]);
        if (followup.length > 0) {
            const leadId = followup[0].lead_id;
            const [next] = await pool.query(
                'SELECT followup_date FROM lead_followups WHERE lead_id = ? AND status = "pending" ORDER BY followup_date ASC LIMIT 1',
                [leadId]
            );
            const nextDate = next.length > 0 ? next[0].followup_date : null;
            await pool.query('UPDATE leads SET next_followup_date = ? WHERE lead_id = ?', [nextDate, leadId]);
        }

        res.json({ message: 'Follow-up updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating status' });
    }
};

/**
 * Reschedule a follow-up
 */
exports.reschedule = async (req, res) => {
    const { followup_date, remarks } = req.body;
    const followupId = req.params.id;

    try {
        await pool.query(
            'UPDATE lead_followups SET followup_date = ?, remarks = ? WHERE followup_id = ?',
            [followup_date, remarks || 'Rescheduled', followupId]
        );

        // Sync with leads table
        const [followup] = await pool.query('SELECT lead_id FROM lead_followups WHERE followup_id = ?', [followupId]);
        if (followup.length > 0) {
            const leadId = followup[0].lead_id;
            await pool.query('UPDATE leads SET next_followup_date = ? WHERE lead_id = ?', [followup_date, leadId]);
        }

        res.json({ message: 'Follow-up rescheduled' });
    } catch (err) {
        res.status(500).json({ message: 'Error rescheduling' });
    }
};

/**
 * Reassign lead from schedule view
 */
exports.reassign = async (req, res) => {
    const { staff_id } = req.body;
    const followupId = req.params.id;

    try {
        const [followup] = await pool.query('SELECT lead_id FROM lead_followups WHERE followup_id = ?', [followupId]);
        if (followup.length === 0) return res.status(404).json({ message: 'Follow-up not found' });

        const leadId = followup[0].lead_id;
        await pool.query('UPDATE leads SET assigned_to = ? WHERE lead_id = ?', [staff_id, leadId]);
        
        await pool.query('INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)', 
            [leadId, req.user.id, `Lead reassigned from schedules view to staff ID: ${staff_id}`]);

        res.json({ message: 'Lead reassigned successfully' });
    } catch (err) {
        console.error('reassign Error:', err);
        res.status(500).json({ message: 'Error reassigning lead' });
    }
};

/**
 * Toggle WhatsApp reminders for a lead from the schedule view
 */
exports.toggleReminders = async (req, res) => {
    const { enabled } = req.body;
    const followupId = req.params.id;

    try {
        const [followup] = await pool.query('SELECT lead_id FROM lead_followups WHERE followup_id = ?', [followupId]);
        if (followup.length === 0) return res.status(404).json({ message: 'Follow-up not found' });

        const leadId = followup[0].lead_id;
        await pool.query('UPDATE leads SET reminders_enabled = ? WHERE lead_id = ?', [enabled ? 1 : 0, leadId]);

        res.json({ message: `Reminders ${enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (err) {
        console.error('toggleReminders Error:', err);
        res.status(500).json({ message: 'Error updating reminder status' });
    }
};
