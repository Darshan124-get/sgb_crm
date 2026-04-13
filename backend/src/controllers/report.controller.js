const pool = require('../config/db');
const ExcelJS = require('exceljs');

exports.exportLeads = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT lead_id, customer_name, phone_number, language, city, status, source, created_at 
            FROM leads 
            ORDER BY created_at DESC
        `);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Leads Report');

        worksheet.columns = [
            { header: 'ID', key: 'lead_id', width: 10 },
            { header: 'Name', key: 'customer_name', width: 25 },
            { header: 'Phone', key: 'phone_number', width: 15 },
            { header: 'Language', key: 'language', width: 15 },
            { header: 'City', key: 'city', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Source', key: 'source', width: 15 },
            { header: 'Created On', key: 'created_at', width: 20 }
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } };

        rows.forEach(row => worksheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=leads_report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Export Error:', err);
        res.status(500).json({ message: 'Failed to export report' });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;  // JWT signed with {id: user.user_id}
        const role   = (req.user.role || '').toLowerCase();
        const isAdminUser = role.includes('admin');

        // Contextual filter: If not admin, only show stats for assigned leads
        let leadFilter    = isAdminUser ? '1=1' : `assigned_to = ${userId}`;
        let creatorFilter = isAdminUser ? '1=1' : `created_by = ${userId}`;


        // 1. KPI Cards
        const [[leadsToday]] = await pool.query(`SELECT COUNT(*) as count FROM leads WHERE DATE(created_at) = CURDATE() AND ${leadFilter}`);
        const [[leadsMTD]] = await pool.query(`SELECT COUNT(*) as count FROM leads WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) AND ${leadFilter}`);
        
        // Revenue is specifically CONFIRMED ADVANCE PAYMENTS as per user request
        const [[revenue]] = await pool.query(`
            SELECT SUM(amount) as total 
            FROM lead_advance_payments ap
            JOIN leads l ON ap.lead_id = l.lead_id
            WHERE ap.verified = 'yes' AND ${leadFilter}
        `);

        const [[followupsUrgent]] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM lead_followups f
            JOIN leads l ON f.lead_id = l.lead_id
            WHERE f.status = 'pending' AND f.followup_date < NOW() AND ${leadFilter}
        `);

        const [[followupsToday]] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM lead_followups f
            JOIN leads l ON f.lead_id = l.lead_id
            WHERE f.status = 'pending' AND DATE(f.followup_date) = CURDATE() AND ${leadFilter}
        `);

        // Conversion Rate: % of assigned leads that are converted
        const [[conversionData]] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
            FROM leads 
            WHERE ${leadFilter}
        `);
        const conversionRate = conversionData.total > 0 ? ((conversionData.converted / conversionData.total) * 100).toFixed(1) : 0;

        // 2. Pipeline Summary (Mini Funnel)
        const [funnel] = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM leads 
            WHERE ${leadFilter}
            GROUP BY status
        `);

        // 3. Urgent Task List (Overdue Follow-ups)
        const [urgentTasks] = await pool.query(`
            SELECT f.followup_id, l.customer_name, f.followup_date, f.remarks 
            FROM lead_followups f
            JOIN leads l ON f.lead_id = l.lead_id
            WHERE f.status = 'pending' AND f.followup_date < NOW() AND ${leadFilter}
            ORDER BY f.followup_date ASC
            LIMIT 5
        `);

        res.json({
            kpis: {
                leadsToday: leadsToday.count || 0,
                leadsMTD: leadsMTD.count || 0,
                revenueMTD: revenue.total || 0,
                conversionRate: conversionRate,
                urgentAlerts: followupsUrgent.count || 0,
                todayAlerts: followupsToday.count || 0
            },
            funnel,
            urgentTasks
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Failed to aggregate dashboard data.' });
    }
};

exports.exportOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT o.order_id, o.customer_name, o.phone, o.order_status, o.total_amount, o.advance_amount, o.created_at 
            FROM orders o 
            ORDER BY o.created_at DESC
        `);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Orders Report');

        worksheet.columns = [
            { header: 'Order ID', key: 'order_id', width: 15 },
            { header: 'Customer', key: 'customer_name', width: 25 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Status', key: 'order_status', width: 15 },
            { header: 'Total', key: 'total_amount', width: 15 },
            { header: 'Advance', key: 'advance_amount', width: 15 },
            { header: 'Date', key: 'created_at', width: 20 }
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } };

        rows.forEach(row => worksheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=orders_report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Export Error:', err);
        res.status(500).json({ message: 'Failed to export report' });
    }
};
