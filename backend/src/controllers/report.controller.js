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
        const role = (req.user.role || '').toLowerCase();
        const isAdminUser = role.includes('admin');

        // Contextual filter: If not admin, only show stats for assigned leads
        let leadFilter = isAdminUser ? '1=1' : `assigned_to = ${userId}`;
        let creatorFilter = isAdminUser ? '1=1' : `created_by = ${userId}`;


        // 1. KPI Cards
        const [[totalLeads]] = await pool.query(`SELECT COUNT(*) as count FROM leads WHERE ${leadFilter}`);
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

        // 4. Location Distribution for Pie Chart
        const [locationDistribution] = await pool.query(`
            SELECT city, COUNT(*) as count 
            FROM leads 
            WHERE city IS NOT NULL AND city != '' AND ${leadFilter}
            GROUP BY city
            ORDER BY count DESC
            LIMIT 6
        `);

        res.json({
            kpis: {
                totalLeads: totalLeads.count || 0,
                leadsToday: leadsToday.count || 0,
                leadsMTD: leadsMTD.count || 0,
                revenueMTD: revenue.total || 0,
                conversionRate: conversionRate,
                urgentAlerts: followupsUrgent.count || 0,
                todayAlerts: followupsToday.count || 0
            },
            funnel,
            urgentTasks,
            locationDistribution
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

exports.getCampaignAnalytics = async (req, res) => {
    try {
        const { campaign_id, start_date, end_date, location } = req.query;

        if (!campaign_id) {
            return res.status(400).json({ error: 'campaign_id is required' });
        }

        let isAll = campaign_id === 'all';
        let tagLine = '';
        let currentAdSpend = 0;

        if (!isAll) {
            const [[campaign]] = await pool.query('SELECT tag_line, ad_spend FROM campaigns WHERE id = ?', [campaign_id]);
            if (!campaign) {
                return res.status(404).json({ error: 'Campaign not found' });
            }
            tagLine = campaign.tag_line;
            currentAdSpend = parseFloat(campaign.ad_spend) || 0;
        }

        let dateFilter = '';
        let dateParams = [];
        if (start_date && end_date) {
            dateFilter = 'AND DATE(l.created_at) BETWEEN ? AND ?';
            dateParams = [start_date, end_date];
        } else if (start_date) {
            dateFilter = 'AND DATE(l.created_at) >= ?';
            dateParams = [start_date];
        } else if (end_date) {
            dateFilter = 'AND DATE(l.created_at) <= ?';
            dateParams = [end_date];
        }
        
        let campaignFilter = isAll ? '' : 'AND l.first_message = ?';
        let queryParams = isAll ? [...dateParams] : [tagLine, ...dateParams];

        let locationFilter = '';
        if (location) {
            locationFilter = 'AND l.city = ?';
            queryParams.push(location);
        }

        const [[leadsData]] = await pool.query(`
            SELECT COUNT(*) as total_leads 
            FROM leads l
            WHERE 1=1 ${campaignFilter} ${dateFilter} ${locationFilter}
        `, queryParams);

        const [[salesData]] = await pool.query(`
            SELECT COUNT(*) as total_sales 
            FROM leads l
            WHERE l.status = 'converted' ${campaignFilter} ${dateFilter} ${locationFilter}
        `, queryParams);

        // Calculate Revenue from lead_advance_payments
        const [[revenueData]] = await pool.query(`
            SELECT SUM(ap.amount) as total_revenue
            FROM lead_advance_payments ap
            JOIN leads l ON ap.lead_id = l.lead_id
            WHERE ap.verified = 'yes' ${campaignFilter} ${dateFilter} ${locationFilter}
        `, queryParams);

        const [dateDistribution] = await pool.query(`
            SELECT DATE(l.created_at) as date, 
                   COUNT(*) as count,
                   SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) as sales_count,
                   SUM(CASE WHEN l.status = 'lost' THEN 1 ELSE 0 END) as lost_count
            FROM leads l
            WHERE 1=1 ${campaignFilter} ${dateFilter} ${locationFilter}
            GROUP BY DATE(l.created_at)
            ORDER BY date ASC
        `, queryParams);

        // Fetch Campaign Performance table data
        let perfDateFilter = dateFilter.replace(/l\./g, 'l2.');
        let perfDateFilterOuter = dateFilter.replace(/l\./g, 'l.');
        let perfLocationFilter = locationFilter.replace(/l\./g, 'l.');

        const [campaignPerformance] = await pool.query(`
            SELECT c.id, c.tag_line as campaign_name, c.ad_spend,
                   COUNT(DISTINCT l.lead_id) as leads,
                   SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) as sales_qty,
                   COALESCE((SELECT SUM(ap.amount) 
                             FROM lead_advance_payments ap 
                             JOIN leads l2 ON ap.lead_id = l2.lead_id 
                             WHERE l2.first_message = c.tag_line AND ap.verified = 'yes' ${perfDateFilter}), 0) as sales_amount
            FROM campaigns c
            LEFT JOIN leads l ON l.first_message = c.tag_line ${perfDateFilterOuter} ${perfLocationFilter}
            WHERE c.status = 'active'
            GROUP BY c.id, c.tag_line, c.ad_spend
        `, [...dateParams, ...dateParams, ...(location ? [location] : [])]);

        let totalAdSpend = currentAdSpend;
        if (isAll) {
            totalAdSpend = campaignPerformance.reduce((sum, c) => sum + parseFloat(c.ad_spend || 0), 0);
        }

        const [locationDistribution] = await pool.query(`
            SELECT l.city, COUNT(*) as count 
            FROM leads l 
            WHERE l.city IS NOT NULL AND l.city != '' ${campaignFilter} ${dateFilter} ${locationFilter}
            GROUP BY l.city
            ORDER BY count DESC
            LIMIT 10
        `, queryParams);

        res.json({
            campaign_tag: isAll ? 'All Campaigns' : tagLine,
            ad_spend: totalAdSpend,
            total_leads: leadsData.total_leads || 0,
            total_sales: salesData.total_sales || 0,
            total_revenue: revenueData.total_revenue || 0,
            date_distribution: dateDistribution,
            campaign_performance: campaignPerformance,
            location_distribution: locationDistribution
        });
    } catch (error) {
        console.error('Campaign Analytics Error:', error);
        res.status(500).json({ message: 'Failed to fetch campaign analytics.' });
    }
};

exports.getLocations = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT city FROM leads WHERE city IS NOT NULL AND city != "" ORDER BY city ASC');
        res.json(rows.map(row => row.city));
    } catch (error) {
        console.error('Locations Error:', error);
        res.status(500).json({ message: 'Failed to fetch locations.' });
    }
};
