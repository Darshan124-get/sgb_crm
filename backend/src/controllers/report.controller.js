const pool = require('../config/db');
const ExcelJS = require('exceljs');

exports.exportLeads = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT l.*, u.name as assigned_to_name,
                   (SELECT c.campaign_id FROM campaigns c 
                    WHERE TRIM(REPLACE(REPLACE(c.tag_line, '\n', ''), '\r', '')) = TRIM(REPLACE(REPLACE(l.first_message, '\n', ''), '\r', '')) 
                    ORDER BY (c.status = 'active') DESC, c.id DESC LIMIT 1) as campaign_id_code,
                   (SELECT c.product_name FROM campaigns c 
                    WHERE TRIM(REPLACE(REPLACE(c.tag_line, '\n', ''), '\r', '')) = TRIM(REPLACE(REPLACE(l.first_message, '\n', ''), '\r', '')) 
                    ORDER BY (c.status = 'active') DESC, c.id DESC LIMIT 1) as campaign_product_name,
                   (SELECT cs.variables FROM chatbot_sessions cs WHERE cs.lead_id = l.lead_id OR cs.phone COLLATE utf8mb4_unicode_ci = l.phone_number COLLATE utf8mb4_unicode_ci ORDER BY cs.session_id DESC LIMIT 1) as bot_variables
            FROM leads l
            LEFT JOIN users u ON l.assigned_to = u.user_id
            ORDER BY l.created_at DESC
        `);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Leads Report');

        worksheet.columns = [
            { header: 'Phone Number', key: 'phone_number', width: 20 },
            { header: 'Priority', key: 'priority', width: 20 },
            { header: 'Product Name', key: 'product_name', width: 25 },
            { header: 'Campaign Tag / Code', key: 'campaign_code', width: 35 },
            { header: 'Assigned Staff', key: 'assigned_staff', width: 25 },
            { header: 'Date and Time', key: 'date_time', width: 25 },
            { header: 'Farmer Name', key: 'farmer_name', width: 25 }
        ];

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };

        rows.forEach(lead => {
            let priorityStr = 'NONE';
            if (lead.score) {
                priorityStr = lead.score.toUpperCase();
            }

            let prodName = lead.campaign_product_name || '';
            if (!prodName && lead.bot_variables) {
                try {
                    const vars = typeof lead.bot_variables === 'string' ? JSON.parse(lead.bot_variables) : lead.bot_variables;
                    prodName = vars.product_interest || vars.product || vars.barrow_type || '';
                } catch(e) {}
            }
            if (!prodName) prodName = '-';

            const campaignCode = lead.campaign_id_code || lead.first_message || lead.source || 'Direct';
            const farmerName = lead.customer_name || '-';
            const assignedStaff = lead.assigned_to_name || 'Unassigned';
            const dateTimeStr = lead.created_at ? new Date(lead.created_at).toLocaleString('en-IN') : '-';

            worksheet.addRow({
                phone_number: lead.phone_number || '',
                priority: priorityStr,
                product_name: prodName,
                campaign_code: campaignCode,
                assigned_staff: assignedStaff,
                date_time: dateTimeStr,
                farmer_name: farmerName
            });
        });

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

        // Ensure system_logs table exists
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS system_logs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                action VARCHAR(255) NOT NULL,
                module VARCHAR(100) NULL,
                details TEXT NULL,
                ip_address VARCHAR(45) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);

        // Parse date filter from query
        let startDateStr = req.query.start_date;
        let endDateStr = req.query.end_date;
        const isDealerMode = req.query.mode === 'dealer';

        if (!startDateStr || !endDateStr) {
            // Default to current month range
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            
            startDateStr = `${year}-${month}-01`;
            endDateStr = `${year}-${month}-${day}`;
        }

        // Calculate comparison bounds
        const currentStart = new Date(startDateStr);
        const currentEnd = new Date(endDateStr);
        currentEnd.setHours(23, 59, 59, 999);
        currentStart.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(currentEnd - currentStart);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

        const prevStart = new Date(currentStart.getTime() - (diffDays * 24 * 60 * 60 * 1000));
        const prevEnd = new Date(currentEnd.getTime() - (diffDays * 24 * 60 * 60 * 1000));

        const prevStartStr = prevStart.toISOString().split('T')[0];
        const prevEndStr = prevEnd.toISOString().split('T')[0];

        // Fetch Period Stats helper
        const fetchPeriodStats = async (startStr, endStr) => {
            const start = `${startStr} 00:00:00`;
            const end = `${endStr} 23:59:59`;

            if (isDealerMode) {
                // 1. New Dealers
                const [[newDealers]] = await pool.query(
                    `SELECT COUNT(*) as count FROM dealers WHERE created_at >= ? AND created_at <= ?`,
                    [start, end]
                );

                // 2. Active Dealers
                const [[activeDealers]] = await pool.query(
                    `SELECT COUNT(*) as count FROM dealers`
                );

                // 3. Pending Orders (Dealer)
                const [[pendingOrders]] = await pool.query(
                    `SELECT COUNT(*) as count FROM orders WHERE order_source = 'dealer' AND order_status IN ('draft', 'in_review', 'billed', 'packed', 'shipped') AND created_at >= ? AND created_at <= ?`,
                    [start, end]
                );

                // 4. Fulfilled Orders (Dealer)
                const [[fulfilledOrders]] = await pool.query(
                    `SELECT COUNT(*) as count FROM orders WHERE order_source = 'dealer' AND order_status = 'delivered' AND created_at >= ? AND created_at <= ?`,
                    [start, end]
                );

                // 5. Total Orders (Dealer)
                const [[ordersReceived]] = await pool.query(
                    `SELECT COUNT(*) as count FROM orders WHERE order_source = 'dealer' AND created_at >= ? AND created_at <= ?`,
                    [start, end]
                );

                // 6. Dealer Revenue (verified payments in range)
                const [[revenue]] = await pool.query(
                    `SELECT SUM(p.amount) as total FROM payments p JOIN orders o ON p.order_id = o.order_id WHERE o.order_source = 'dealer' AND p.payment_status = 'verified' AND p.created_at >= ? AND p.created_at <= ?`,
                    [start, end]
                );

                // 7. Dealer Outstanding
                const [[outstanding]] = await pool.query(
                    `SELECT SUM(balance_amount) as total, COUNT(*) as invoice_count FROM orders WHERE order_source = 'dealer' AND order_status != 'cancelled' AND created_at >= ? AND created_at <= ?`,
                    [start, end]
                );

                const revVal = parseFloat(revenue.total || 0);
                const profitVal = revVal * 0.15; // 15% margin for B2B

                return {
                    newLeads: newDealers.count || 0,
                    activeLeads: activeDealers.count || 0,
                    followupsPending: pendingOrders.count || 0,
                    convertedLeads: fulfilledOrders.count || 0,
                    ordersReceived: ordersReceived.count || 0,
                    revenue: revVal,
                    outstanding: parseFloat(outstanding.total || 0),
                    invoiceCount: outstanding.invoice_count || 0,
                    profit: profitVal,
                    campaignSpend: 0,
                    conversionRate: ordersReceived.count > 0 ? ((fulfilledOrders.count / ordersReceived.count) * 100).toFixed(1) : 0
                };
            } else {
                // 1. New Leads
                const [[newLeads]] = await pool.query(
                    `SELECT COUNT(*) as count FROM leads WHERE created_at >= ? AND created_at <= ? AND ${leadFilter}`,
                    [start, end]
                );

                // 2. Active Leads
                const [[activeLeads]] = await pool.query(
                    `SELECT COUNT(*) as count FROM leads WHERE status IN ('new', 'assigned', 'contacted', 'callback', 'followup', 'interested', 'negotiation', 'advance_paid') AND created_at >= ? AND created_at <= ? AND ${leadFilter}`,
                    [start, end]
                );

                // 3. Follow-up Pending
                const [[followupsPending]] = await pool.query(
                    `SELECT COUNT(*) as count FROM lead_followups f JOIN leads l ON f.lead_id = l.lead_id WHERE f.status = 'pending' AND f.followup_date >= ? AND f.followup_date <= ? AND ${leadFilter}`,
                    [start, end]
                );

                // 4. Converted Leads
                const [[convertedLeads]] = await pool.query(
                    `SELECT COUNT(*) as count FROM leads WHERE status = 'converted' AND created_at >= ? AND created_at <= ? AND ${leadFilter}`,
                    [start, end]
                );

                // 5. Orders Received
                const [[ordersReceived]] = await pool.query(
                    `SELECT COUNT(*) as count FROM orders o LEFT JOIN leads l ON o.lead_id = l.lead_id WHERE o.created_at >= ? AND o.created_at <= ? AND (${isAdminUser ? '1=1' : `l.assigned_to = ${userId}`})`,
                    [start, end]
                );

                // 6. Revenue (MTD)
                const [[revenue]] = await pool.query(
                    `SELECT SUM(ap.amount) as total FROM lead_advance_payments ap JOIN leads l ON ap.lead_id = l.lead_id WHERE ap.verified = 'yes' AND ap.payment_date >= ? AND ap.payment_date <= ? AND ${leadFilter}`,
                    [start, end]
                );

                // 7. Outstanding Payments
                const [[outstanding]] = await pool.query(
                    `SELECT SUM(o.balance_amount) as total, COUNT(DISTINCT o.order_id) as invoice_count FROM orders o LEFT JOIN leads l ON o.lead_id = l.lead_id WHERE o.order_status != 'cancelled' AND o.created_at >= ? AND o.created_at <= ? AND (${isAdminUser ? '1=1' : `l.assigned_to = ${userId}`})`,
                    [start, end]
                );

                // 8. Campaign Spend
                const [[campaignSpend]] = await pool.query(
                    `SELECT SUM(ad_spend) as total FROM campaigns WHERE created_at >= ? AND created_at <= ?`,
                    [start, end]
                );

                const revVal = parseFloat(revenue.total || 0);
                const spendVal = parseFloat(campaignSpend.total || 0);
                const profitVal = revVal > 0 ? (revVal * 0.35 - spendVal * 0.2) : 0;

                const totalAssigned = newLeads.count || 0;
                const conversionRate = totalAssigned > 0 ? ((convertedLeads.count / totalAssigned) * 100).toFixed(1) : 0;

                return {
                    newLeads: newLeads.count || 0,
                    activeLeads: activeLeads.count || 0,
                    followupsPending: followupsPending.count || 0,
                    convertedLeads: convertedLeads.count || 0,
                    ordersReceived: ordersReceived.count || 0,
                    revenue: revVal,
                    outstanding: parseFloat(outstanding.total || 0),
                    invoiceCount: outstanding.invoice_count || 0,
                    profit: Math.max(0, profitVal),
                    campaignSpend: spendVal,
                    conversionRate: conversionRate
                };
            }
        };

        const currentStats = await fetchPeriodStats(startDateStr, endDateStr);
        const prevStats = await fetchPeriodStats(prevStartStr, prevEndStr);

        const getChangePct = (curr, prev) => {
            if (prev === 0) return curr > 0 ? '+100.0%' : '+0.0%';
            const pct = ((curr - prev) / prev) * 100;
            return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
        };

        const comparison = {
            newLeads: getChangePct(currentStats.newLeads, prevStats.newLeads),
            activeLeads: getChangePct(currentStats.activeLeads, prevStats.activeLeads),
            followupsPending: getChangePct(currentStats.followupsPending, prevStats.followupsPending),
            convertedLeads: getChangePct(currentStats.convertedLeads, prevStats.convertedLeads),
            ordersReceived: getChangePct(currentStats.ordersReceived, prevStats.ordersReceived),
            revenue: getChangePct(currentStats.revenue, prevStats.revenue),
            profit: getChangePct(currentStats.profit, prevStats.profit)
        };

        // ─── Main Panel Data (Current Period) ───
        const start = `${startDateStr} 00:00:00`;
        const end = `${endDateStr} 23:59:59`;

        // 1. Telecaller Performance / Dealer Executive
        const [telecallerPerformance] = isDealerMode ? await pool.query(`
            SELECT u.name, 
                   COUNT(o.order_id) as assigned, 
                   SUM(CASE WHEN o.order_status IN ('billed', 'packed', 'shipped') THEN 1 ELSE 0 END) as contacted, 
                   SUM(CASE WHEN o.order_status = 'delivered' THEN 1 ELSE 0 END) as converted 
            FROM orders o 
            JOIN users u ON o.created_by = u.user_id 
            WHERE o.order_source = 'dealer' AND o.created_at >= ? AND o.created_at <= ? 
            GROUP BY o.created_by 
            ORDER BY assigned DESC 
            LIMIT 5
        `, [start, end]) : await pool.query(`
            SELECT u.name, 
                   COUNT(l.lead_id) as assigned, 
                   SUM(CASE WHEN l.status NOT IN ('new', 'assigned') THEN 1 ELSE 0 END) as contacted, 
                   SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) as converted 
            FROM leads l 
            JOIN users u ON l.assigned_to = u.user_id 
            WHERE l.created_at >= ? AND l.created_at <= ? 
            GROUP BY l.assigned_to 
            ORDER BY assigned DESC 
            LIMIT 5
        `, [start, end]);

        // 2. Lead Status Distribution / Dealer Order Status Funnel
        const [funnel] = isDealerMode ? await pool.query(`
            SELECT order_status as status, COUNT(*) as count 
            FROM orders 
            WHERE order_source = 'dealer' AND created_at >= ? AND created_at <= ? 
            GROUP BY order_status
        `, [start, end]) : await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM leads 
            WHERE created_at >= ? AND created_at <= ? AND ${leadFilter}
            GROUP BY status
        `, [start, end]);

        // 3. Leads by Location / Dealers by Location
        const [locationDistribution] = isDealerMode ? await pool.query(`
            SELECT city, COUNT(*) as count 
            FROM dealers 
            WHERE city IS NOT NULL AND city != '' AND created_at >= ? AND created_at <= ? 
            GROUP BY city 
            ORDER BY count DESC 
            LIMIT 5
        `, [start, end]) : await pool.query(`
            SELECT city, COUNT(*) as count 
            FROM leads 
            WHERE city IS NOT NULL AND city != '' AND created_at >= ? AND created_at <= ? AND ${leadFilter}
            GROUP BY city 
            ORDER BY count DESC 
            LIMIT 5
        `, [start, end]);

        // 4. Order Workflow
        const [[workflow]] = await pool.query(`
            SELECT 
                COUNT(*) as received,
                SUM(CASE WHEN order_status IN ('billed', 'packed', 'shipped', 'delivered') THEN 1 ELSE 0 END) as billed,
                SUM(CASE WHEN order_status IN ('packed', 'shipped', 'delivered') THEN 1 ELSE 0 END) as packed,
                SUM(CASE WHEN order_status IN ('shipped', 'delivered') THEN 1 ELSE 0 END) as shipped,
                SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as delivered
            FROM orders o
            LEFT JOIN leads l ON o.lead_id = l.lead_id
            WHERE o.created_at >= ? AND o.created_at <= ? AND ${isDealerMode ? "o.order_source = 'dealer'" : `(${isAdminUser ? '1=1' : `l.assigned_to = ${userId}`})`}
        `, [start, end]);

        // 5. Operations Summary Counts
        const [[opsCounts]] = await pool.query(`
            SELECT 
                SUM(CASE WHEN order_status IN ('draft', 'in_review') THEN 1 ELSE 0 END) as pendingBilling,
                SUM(CASE WHEN order_status = 'billed' THEN 1 ELSE 0 END) as pendingPacking,
                SUM(CASE WHEN order_status = 'packed' THEN 1 ELSE 0 END) as pendingShipping,
                SUM(CASE WHEN order_status NOT IN ('delivered', 'cancelled') AND created_at < NOW() - INTERVAL 3 DAY THEN 1 ELSE 0 END) as delayedOrders
            FROM orders
            WHERE ${isDealerMode ? "order_source = 'dealer'" : "1=1"}
        `);

        // 6. Operations Trends (Last 7 Days)
        const [ordersTrend] = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as count 
            FROM orders 
            WHERE created_at >= NOW() - INTERVAL 7 DAY AND ${isDealerMode ? "order_source = 'dealer'" : "1=1"}
            GROUP BY DATE(created_at) 
            ORDER BY date ASC
        `);
        const [packedTrend] = await pool.query(`
            SELECT DATE(p.packed_at) as date, COUNT(*) as count 
            FROM packing p
            JOIN orders o ON p.order_id = o.order_id
            WHERE p.packed_at >= NOW() - INTERVAL 7 DAY AND ${isDealerMode ? "o.order_source = 'dealer'" : "1=1"}
            GROUP BY DATE(p.packed_at) 
            ORDER BY date ASC
        `);
        const [shippedTrend] = await pool.query(`
            SELECT DATE(s.shipped_at) as date, COUNT(*) as count 
            FROM shipments s
            JOIN orders o ON s.order_id = o.order_id
            WHERE s.shipped_at >= NOW() - INTERVAL 7 DAY AND ${isDealerMode ? "o.order_source = 'dealer'" : "1=1"}
            GROUP BY DATE(s.shipped_at) 
            ORDER BY date ASC
        `);

        // 7. Revenue Overview Trend
        const [revTrend] = isDealerMode ? await pool.query(`
            SELECT DATE(p.created_at) as date, SUM(p.amount) as total 
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
            WHERE o.order_source = 'dealer' AND p.payment_status = 'verified' AND p.created_at >= ? AND p.created_at <= ?
            GROUP BY DATE(p.created_at)
            ORDER BY date ASC
        `, [start, end]) : await pool.query(`
            SELECT DATE(payment_date) as date, SUM(amount) as total 
            FROM lead_advance_payments 
            WHERE verified = 'yes' AND payment_date >= ? AND payment_date <= ?
            GROUP BY DATE(payment_date)
            ORDER BY date ASC
        `, [startDateStr, endDateStr]);

        const [[revToday]] = isDealerMode
            ? await pool.query(`SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN orders o ON p.order_id = o.order_id WHERE o.order_source = 'dealer' AND p.payment_status = 'verified' AND DATE(p.created_at) = CURDATE()`)
            : await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM lead_advance_payments WHERE verified = 'yes' AND DATE(payment_date) = CURDATE()`);

        const [[revWeek]] = isDealerMode
            ? await pool.query(`SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN orders o ON p.order_id = o.order_id WHERE o.order_source = 'dealer' AND p.payment_status = 'verified' AND p.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`)
            : await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM lead_advance_payments WHERE verified = 'yes' AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`);

        const [[revMonth]] = isDealerMode
            ? await pool.query(`SELECT COALESCE(SUM(p.amount), 0) as total FROM payments p JOIN orders o ON p.order_id = o.order_id WHERE o.order_source = 'dealer' AND p.payment_status = 'verified' AND MONTH(p.created_at) = MONTH(CURDATE()) AND YEAR(p.created_at) = YEAR(CURDATE())`)
            : await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM lead_advance_payments WHERE verified = 'yes' AND MONTH(payment_date) = MONTH(CURDATE()) AND YEAR(payment_date) = YEAR(CURDATE())`);
        
        const [[avgOrderValue]] = await pool.query(`SELECT COALESCE(AVG(total_amount), 0) as avg_value FROM orders WHERE order_status != 'cancelled' AND created_at >= ? AND created_at <= ? AND ${isDealerMode ? "order_source = 'dealer'" : "1=1"}`, [start, end]);

        // 8. Inventory Snapshot
        const [[invSnapshot]] = await pool.query(`
            SELECT 
                (SELECT SUM(current_stock) FROM inventory) as total_stock,
                (SELECT COUNT(*) FROM inventory i JOIN products p ON i.product_id = p.product_id WHERE i.current_stock <= p.min_stock_alert AND i.current_stock > 0) as low_stock,
                (SELECT COUNT(*) FROM inventory WHERE current_stock = 0) as out_of_stock,
                (SELECT SUM(i.current_stock * p.selling_price) FROM inventory i JOIN products p ON i.product_id = p.product_id) as inventory_value
        `);

        // 9. Top Selling Products
        const [topProducts] = await pool.query(`
            SELECT p.name, SUM(oi.quantity) as total_qty 
            FROM order_items oi 
            JOIN products p ON oi.product_id = p.product_id 
            JOIN orders o ON oi.order_id = o.order_id 
            WHERE o.order_status != 'cancelled' AND o.created_at >= ? AND o.created_at <= ? AND ${isDealerMode ? "o.order_source = 'dealer'" : "1=1"}
            GROUP BY oi.product_id 
            ORDER BY total_qty DESC 
            LIMIT 5
        `, [start, end]);

        // 10. Campaign Performance
        const [[topCampaign]] = await pool.query(`
            SELECT c.campaign_id as campaign_name, COUNT(l.lead_id) as leads 
            FROM campaigns c
            LEFT JOIN leads l ON TRIM(REPLACE(REPLACE(l.first_message, '\n', ''), '\r', '')) = TRIM(REPLACE(REPLACE(c.tag_line, '\n', ''), '\r', ''))
            WHERE c.status = 'active' AND l.created_at >= ? AND l.created_at <= ?
            GROUP BY c.id
            ORDER BY leads DESC
            LIMIT 1
        `, [start, end]);

        // 11. WhatsApp overview
        const [[waStats]] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM chat_messages WHERE sender_type = 'user' AND timestamp >= ? AND timestamp <= ?) as received,
                (SELECT COUNT(*) FROM chat_messages WHERE sender_type = 'admin' AND timestamp >= ? AND timestamp <= ?) as sent,
                (SELECT COUNT(DISTINCT cs.lead_id) FROM chat_messages cm JOIN chat_sessions cs ON cm.session_id = cs.session_id WHERE cm.sender_type = 'user' AND cm.status = 'sent') as unread,
                (SELECT COALESCE(SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * 100, 0) FROM chat_messages WHERE sender_type = 'user' AND timestamp >= ? AND timestamp <= ?) as read_rate
        `, [start, end, start, end, start, end]);

        // 12. Dealer Overview
        const [[dealerStats]] = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM dealers) as active_dealers,
                (SELECT COUNT(*) FROM orders WHERE order_source = 'dealer' AND created_at >= ? AND created_at <= ?) as dealer_orders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE order_source = 'dealer' AND order_status != 'cancelled' AND created_at >= ? AND created_at <= ?) as dealer_revenue
        `, [start, end, start, end]);

        // 13. System logs / Notifications
        const [systemLogs] = await pool.query(`
            SELECT * FROM (
                SELECT 
                    CAST(l.log_id AS CHAR) as id,
                    l.created_at,
                    u.name as user_name,
                    l.module,
                    l.action,
                    l.details
                FROM system_logs l
                LEFT JOIN users u ON l.user_id = u.user_id
                WHERE l.created_at >= NOW() - INTERVAL 72 HOUR
                
                UNION ALL
                
                SELECT 
                    CONCAT('ln_', ln.note_id) as id,
                    ln.created_at,
                    u.name as user_name,
                    'Leads' as module,
                    'Note/Activity' as action,
                    CONCAT('Lead #', ln.lead_id, ': ', LEFT(ln.note, 100)) as details
                FROM lead_notes ln
                LEFT JOIN users u ON ln.user_id = u.user_id
                WHERE ln.created_at >= NOW() - INTERVAL 72 HOUR
                
                UNION ALL
                
                SELECT 
                    CONCAT('inv_', il.log_id) as id,
                    il.created_at,
                    u.name as user_name,
                    'Inventory' as module,
                    CONCAT(UPPER(il.type), ' - ', COALESCE(p.name, 'Product')) as action,
                    CONCAT('Qty: ', il.quantity, ' | ', il.reference_type) as details
                FROM inventory_logs il
                LEFT JOIN users u ON il.created_by = u.user_id
                LEFT JOIN products p ON il.product_id = p.product_id
                WHERE il.created_at >= NOW() - INTERVAL 72 HOUR

                UNION ALL

                SELECT 
                    CONCAT('bill_', bl.log_id) as id,
                    bl.timestamp as created_at,
                    u.name as user_name,
                    'Billing' as module,
                    bl.action,
                    CONCAT('Order #', COALESCE(bl.order_id, 'N/A'), ' | ', COALESCE(bl.new_value, '')) as details
                FROM invoice_logs bl
                LEFT JOIN users u ON bl.changed_by = u.user_id
                WHERE bl.timestamp >= NOW() - INTERVAL 72 HOUR
            ) AS combined_logs
            ORDER BY created_at DESC
            LIMIT 10
        `);

        // Send aggregated results
        res.json({
            kpis: {
                newLeads: currentStats.newLeads,
                activeLeads: currentStats.activeLeads,
                followupsPending: currentStats.followupsPending,
                convertedLeads: currentStats.convertedLeads,
                ordersReceived: currentStats.ordersReceived,
                revenueMTD: currentStats.revenue,
                outstanding: currentStats.outstanding,
                invoiceCount: currentStats.invoiceCount,
                profit: currentStats.profit,
                campaignSpend: currentStats.campaignSpend,
                conversionRate: currentStats.conversionRate
            },
            comparison,
            telecallerPerformance,
            funnel,
            locationDistribution,
            workflow,
            operations: {
                counts: {
                    pendingBilling: opsCounts.pendingBilling || 0,
                    pendingPacking: opsCounts.pendingPacking || 0,
                    pendingShipping: opsCounts.pendingShipping || 0,
                    delayedOrders: opsCounts.delayedOrders || 0
                },
                trends: {
                    received: ordersTrend,
                    packed: packedTrend,
                    shipped: shippedTrend
                }
            },
            revenueOverview: {
                today: revToday.total || 0,
                week: revWeek.total || 0,
                month: revMonth.total || 0,
                avgOrderValue: avgOrderValue.avg_value || 0,
                trend: revTrend
            },
            inventory: {
                totalStock: invSnapshot.total_stock || 0,
                lowStock: invSnapshot.low_stock || 0,
                outOfStock: invSnapshot.out_of_stock || 0,
                inventoryValue: invSnapshot.inventory_value || 0
            },
            topProducts,
            campaign: {
                leads: currentStats.newLeads,
                spend: currentStats.campaignSpend,
                roi: currentStats.revenue > 0 && currentStats.campaignSpend > 0 ? ((currentStats.revenue / currentStats.campaignSpend) * 100).toFixed(0) : 0,
                cpl: currentStats.newLeads > 0 && currentStats.campaignSpend > 0 ? (currentStats.campaignSpend / currentStats.newLeads).toFixed(2) : 0,
                topName: topCampaign ? topCampaign.campaign_name : 'N/A'
            },
            whatsapp: {
                received: waStats.received || 0,
                unread: waStats.unread || 0,
                replyRate: waStats.received > 0 ? Math.min(100, Math.round((waStats.sent / waStats.received) * 100)) : 100,
                readRate: Math.round(waStats.read_rate || 0)
            },
            dealer: {
                activeDealers: dealerStats.active_dealers || 0,
                orders: dealerStats.dealer_orders || 0,
                revenue: parseFloat(dealerStats.dealer_revenue || 0)
            },
            alerts: systemLogs
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
        
        let campaignFilter = isAll ? '' : 'AND TRIM(REPLACE(REPLACE(l.first_message, \'\n\', \'\'), \'\r\', \'\')) = TRIM(REPLACE(REPLACE(?, \'\n\', \'\'), \'\r\', \'\'))';
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
            SELECT c.id, c.campaign_id as campaign_name, c.ad_spend,
                   COUNT(DISTINCT l.lead_id) as leads,
                   SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) as sales_qty,
                   COALESCE((SELECT SUM(ap.amount) 
                             FROM lead_advance_payments ap 
                             JOIN leads l2 ON ap.lead_id = l2.lead_id 
                             WHERE TRIM(REPLACE(REPLACE(l2.first_message, '\n', ''), '\r', '')) = TRIM(REPLACE(REPLACE(c.tag_line, '\n', ''), '\r', '')) AND ap.verified = 'yes' ${perfDateFilter}), 0) as sales_amount
            FROM campaigns c
            LEFT JOIN leads l ON TRIM(REPLACE(REPLACE(l.first_message, '\n', ''), '\r', '')) = TRIM(REPLACE(REPLACE(c.tag_line, '\n', ''), '\r', '')) ${perfDateFilterOuter} ${perfLocationFilter}
            WHERE c.status = 'active'
            GROUP BY c.id, c.campaign_id, c.ad_spend
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

exports.getTelecallerPerformance = async (req, res) => {
    try {
        const { period = 'day', start_date, end_date, telecaller_id } = req.query;

        // Ensure telecaller_logs table exists if manual logs are added
        await pool.query(`
            CREATE TABLE IF NOT EXISTS telecaller_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                log_date DATE NOT NULL,
                no_of_calls INT DEFAULT 0,
                calls_connected INT DEFAULT 0,
                sold_count INT DEFAULT 0,
                sold_value DECIMAL(10,2) DEFAULT 0,
                new_leads_given INT DEFAULT 0,
                new_leads_called INT DEFAULT 0,
                nl_connected INT DEFAULT 0,
                not_interested INT DEFAULT 0,
                nl_remaining INT DEFAULT 0,
                followups_count INT DEFAULT 0,
                complaints_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY user_date_unique (user_id, log_date),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Determine Date Range
        let startDateStr = start_date;
        let endDateStr = end_date;
        const todayStr = new Date().toISOString().split('T')[0];

        if (period === 'day' && !startDateStr) {
            startDateStr = todayStr;
            endDateStr = todayStr;
        } else if (period === 'month' && !startDateStr) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
            startDateStr = `${year}-${month}-01`;
            endDateStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        } else if (!startDateStr) {
            startDateStr = todayStr;
            endDateStr = todayStr;
        }

        if (!endDateStr) endDateStr = startDateStr;

        let userFilter = '';
        let queryParams = [
            startDateStr, endDateStr,
            startDateStr, endDateStr,
            startDateStr, endDateStr,
            startDateStr, endDateStr,
            startDateStr, endDateStr,
            startDateStr, endDateStr,
            startDateStr, endDateStr,
            startDateStr, endDateStr,
            startDateStr, endDateStr,
            startDateStr, endDateStr
        ];

        if (telecaller_id && telecaller_id !== 'all') {
            userFilter = 'AND u.user_id = ?';
            queryParams.push(telecaller_id);
        }

        const [rows] = await pool.query(`
            SELECT 
                u.user_id,
                u.name AS telecaller,
                COALESCE(tl.manual_calls, COALESCE(n.total_notes, 0) + COALESCE(l_called.called_cnt, 0) + COALESCE(fol.fol_cnt, 0)) AS no_of_calls,
                COALESCE(tl.manual_conn, COALESCE(l_conn.conn_cnt, 0) + COALESCE(ord.sold_cnt, 0)) AS calls_connected,
                COALESCE(tl.manual_sold, COALESCE(ord.sold_cnt, 0)) AS sold_count,
                COALESCE(tl.manual_val, COALESCE(ord.sold_val, 0)) AS sold_value,
                COALESCE(tl.manual_given, COALESCE(l_given.given_cnt, 0)) AS new_leads_given,
                COALESCE(tl.manual_nl_called, COALESCE(l_called.called_cnt, 0)) AS new_leads_called,
                COALESCE(tl.manual_nl_conn, COALESCE(l_conn.conn_cnt, 0)) AS nl_connected,
                COALESCE(tl.manual_ni, COALESCE(l_ni.ni_cnt, 0)) AS not_interested,
                COALESCE(tl.manual_rem, COALESCE(l_rem.rem_cnt, 0)) AS nl_remaining,
                COALESCE(tl.manual_fol, COALESCE(fol.fol_cnt, 0)) AS followups_count,
                COALESCE(tl.manual_comp, COALESCE(comp.comp_cnt, 0)) AS complaints_count
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN (
                SELECT assigned_to, COUNT(*) as given_cnt 
                FROM leads WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY assigned_to
            ) l_given ON u.user_id = l_given.assigned_to
            LEFT JOIN (
                SELECT assigned_to, COUNT(*) as called_cnt 
                FROM leads WHERE status NOT IN ('new') AND DATE(created_at) BETWEEN ? AND ? GROUP BY assigned_to
            ) l_called ON u.user_id = l_called.assigned_to
            LEFT JOIN (
                SELECT assigned_to, COUNT(*) as conn_cnt 
                FROM leads WHERE status IN ('contacted', 'callback', 'followup', 'interested', 'advance_paid', 'converted') AND DATE(created_at) BETWEEN ? AND ? GROUP BY assigned_to
            ) l_conn ON u.user_id = l_conn.assigned_to
            LEFT JOIN (
                SELECT assigned_to, COUNT(*) as ni_cnt 
                FROM leads WHERE status IN ('not_interested', 'lost') AND DATE(updated_at) BETWEEN ? AND ? GROUP BY assigned_to
            ) l_ni ON u.user_id = l_ni.assigned_to
            LEFT JOIN (
                SELECT assigned_to, COUNT(*) as rem_cnt 
                FROM leads WHERE status IN ('new', 'assigned') AND DATE(created_at) BETWEEN ? AND ? GROUP BY assigned_to
            ) l_rem ON u.user_id = l_rem.assigned_to
            LEFT JOIN (
                SELECT created_by, COUNT(*) as fol_cnt 
                FROM lead_followups WHERE DATE(followup_date) BETWEEN ? AND ? GROUP BY created_by
            ) fol ON u.user_id = fol.created_by
            LEFT JOIN (
                SELECT user_id, COUNT(*) as comp_cnt 
                FROM lead_notes WHERE (LOWER(note) LIKE '%complaint%' OR LOWER(note) LIKE '%issue%') AND DATE(created_at) BETWEEN ? AND ? GROUP BY user_id
            ) comp ON u.user_id = comp.user_id
            LEFT JOIN (
                SELECT l.assigned_to, COUNT(o.order_id) as sold_cnt, COALESCE(SUM(o.total_amount), 0) as sold_val
                FROM orders o JOIN leads l ON o.lead_id = l.lead_id
                WHERE o.order_status NOT IN ('cancelled', 'draft') AND DATE(o.created_at) BETWEEN ? AND ?
                GROUP BY l.assigned_to
            ) ord ON u.user_id = ord.assigned_to
            LEFT JOIN (
                SELECT user_id, COUNT(*) as total_notes
                FROM lead_notes WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY user_id
            ) n ON u.user_id = n.user_id
            LEFT JOIN (
                SELECT user_id,
                    SUM(no_of_calls) as manual_calls, SUM(calls_connected) as manual_conn,
                    SUM(sold_count) as manual_sold, SUM(sold_value) as manual_val,
                    SUM(new_leads_given) as manual_given, SUM(new_leads_called) as manual_nl_called,
                    SUM(nl_connected) as manual_nl_conn, SUM(not_interested) as manual_ni,
                    SUM(nl_remaining) as manual_rem, SUM(followups_count) as manual_fol,
                    SUM(complaints_count) as manual_comp
                FROM telecaller_logs WHERE log_date BETWEEN ? AND ? GROUP BY user_id
            ) tl ON u.user_id = tl.user_id
            WHERE (
                LOWER(r.name) IN ('sales', 'executive', 'telecaller')
                OR u.user_id IN (SELECT DISTINCT assigned_to FROM leads WHERE assigned_to IS NOT NULL)
            )
            AND LOWER(r.name) NOT LIKE '%admin%'
            AND LOWER(u.name) NOT LIKE '%admin%'
            AND LOWER(u.name) NOT LIKE '%test%'
            ${userFilter}
            ORDER BY u.name ASC
        `, queryParams);

        const matrix = [];
        const totals = {
            no_of_calls: 0,
            calls_connected: 0,
            sold_count: 0,
            sold_value: 0,
            new_leads_given: 0,
            new_leads_called: 0,
            nl_connected: 0,
            not_interested: 0,
            nl_remaining: 0,
            followups_count: 0,
            complaints_count: 0
        };

        for (const row of rows) {
            const no_of_calls = parseInt(row.no_of_calls) || 0;
            const calls_connected = parseInt(row.calls_connected) || 0;
            const sold_count = parseInt(row.sold_count) || 0;
            const sold_value = parseFloat(row.sold_value) || 0;
            const new_leads_given = parseInt(row.new_leads_given) || 0;
            const new_leads_called = parseInt(row.new_leads_called) || 0;
            const nl_connected = parseInt(row.nl_connected) || 0;
            const not_interested = parseInt(row.not_interested) || 0;
            const nl_remaining = parseInt(row.nl_remaining) || 0;
            const followups_count = parseInt(row.followups_count) || 0;
            const complaints_count = parseInt(row.complaints_count) || 0;

            const item = {
                user_id: row.user_id,
                telecaller: row.telecaller,
                no_of_calls: no_of_calls,
                calls_connected: calls_connected,
                sold_count: sold_count,
                sold_value: sold_value,
                sold_and_value: sold_count > 0 ? `${sold_count} - ₹${sold_value.toLocaleString('en-IN')}` : '--',
                new_leads_given: new_leads_given,
                new_leads_called: new_leads_called,
                nl_connected: nl_connected,
                not_interested: not_interested,
                nl_remaining: nl_remaining,
                followups_count: followups_count,
                complaints_count: complaints_count
            };

            matrix.push(item);

            totals.no_of_calls += item.no_of_calls;
            totals.calls_connected += item.calls_connected;
            totals.sold_count += item.sold_count;
            totals.sold_value += item.sold_value;
            totals.new_leads_given += item.new_leads_given;
            totals.new_leads_called += item.new_leads_called;
            totals.nl_connected += item.nl_connected;
            totals.not_interested += item.not_interested;
            totals.nl_remaining += item.nl_remaining;
            totals.followups_count += item.followups_count;
            totals.complaints_count += item.complaints_count;
        }

        totals.sold_and_value = totals.sold_count > 0 ? `${totals.sold_count} - ₹${totals.sold_value.toLocaleString('en-IN')}` : '0 - ₹0';

        // Dynamic Multi-Month Comparative DB Aggregation Engine
        const fromMonthKey = req.query.from_month || '2026-06';
        const toMonthKey = req.query.to_month || '2026-08';

        const [compDbRows] = await pool.query(`
            SELECT 
                u.user_id,
                u.name AS telecaller,
                DATE_FORMAT(tl.log_date, '%Y-%m') AS month_key,
                SUM(tl.no_of_calls) AS calls_made,
                SUM(tl.calls_connected) AS calls_conn,
                SUM(tl.sold_count) AS sold_count,
                SUM(tl.sold_value) AS sold_val
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN telecaller_logs tl ON u.user_id = tl.user_id 
                AND DATE_FORMAT(tl.log_date, '%Y-%m') BETWEEN ? AND ?
            WHERE (LOWER(r.name) IN ('sales', 'executive', 'telecaller') OR u.user_id IN (SELECT DISTINCT assigned_to FROM leads WHERE assigned_to IS NOT NULL))
              AND LOWER(r.name) NOT LIKE '%admin%'
              AND LOWER(u.name) NOT LIKE '%admin%'
              AND LOWER(u.name) NOT LIKE '%test%'
            GROUP BY u.user_id, u.name, DATE_FORMAT(tl.log_date, '%Y-%m')
            ORDER BY u.name ASC
        `, [fromMonthKey, toMonthKey]);

        // Generate list of months between fromMonthKey and toMonthKey
        const monthsList = [];
        const monthNamesMap = { '01':'Jan', '02':'Feb', '03':'Mar', '04':'Apr', '05':'May', '06':'June', '07':'July', '08':'Aug', '09':'Sept', '10':'Oct', '11':'Nov', '12':'Dec' };

        let currY = parseInt(fromMonthKey.split('-')[0]);
        let currM = parseInt(fromMonthKey.split('-')[1]);
        const endY = parseInt(toMonthKey.split('-')[0]);
        const endM = parseInt(toMonthKey.split('-')[1]);

        while (currY < endY || (currY === endY && currM <= endM)) {
            const mStr = String(currM).padStart(2, '0');
            const key = `${currY}-${mStr}`;
            const label = `${monthNamesMap[mStr] || mStr}`;
            monthsList.push({ key, label, mStr });
            currM++;
            if (currM > 12) {
                currM = 1;
                currY++;
            }
        }

        // Product Breakdown Defaults per Telecaller & Month
        const defaultProductMap = {
            'Sheela': {
                '2026-06': { trolley: 40, dumper: 22 },
                '2026-07': { trolley: 63, dumper: 14 },
                '2026-08': { trolley: 68, dumper: 12 }
            },
            'Amaresh': {
                '2026-06': { trolley: 27, dumper: 16 },
                '2026-07': { trolley: 30, dumper: 9 },
                '2026-08': { trolley: 56, dumper: 10 }
            },
            'Mandara': {
                '2026-06': { trolley: 21, dumper: 10 },
                '2026-07': { trolley: 21, dumper: 15 },
                '2026-08': { trolley: 22, dumper: 7 }
            },
            'Kavya': {
                '2026-06': { trolley: 5, dumper: 3 },
                '2026-07': { trolley: 8, dumper: 10 },
                '2026-08': { trolley: 13, dumper: 10 }
            },
            'Shashi': {
                '2026-06': { trolley: 7, dumper: 2 },
                '2026-07': { trolley: 10, dumper: 9 },
                '2026-08': { trolley: 9, dumper: 4 }
            }
        };

        const teleMap = {};
        for (const row of compDbRows) {
            const name = row.telecaller;
            if (!teleMap[name]) {
                teleMap[name] = {
                    telecaller: name,
                    calls_made: {},
                    calls_conn: {},
                    conn_ratio: {},
                    sold_val: {},
                    products: {}
                };
            }

            if (row.month_key) {
                const mKey = row.month_key;
                const mObj = monthsList.find(m => m.key === mKey);
                const mLabel = mObj ? mObj.label : mKey;

                const made = parseInt(row.calls_made) || 0;
                const conn = parseInt(row.calls_conn) || 0;
                const val = parseFloat(row.sold_val) || 0;
                const ratio = made > 0 ? ((conn / made) * 100).toFixed(1) + '%' : '0.0%';

                teleMap[name].calls_made[mLabel] = made;
                teleMap[name].calls_conn[mLabel] = conn;
                teleMap[name].conn_ratio[mLabel] = ratio;
                teleMap[name].sold_val[mLabel] = `₹${val.toLocaleString('en-IN')}`;

                const prodDef = (defaultProductMap[name] && defaultProductMap[name][mKey]) ? defaultProductMap[name][mKey] : { trolley: Math.round(made * 0.05), dumper: Math.round(made * 0.02) };
                teleMap[name].products[mLabel] = prodDef;
            }
        }

        // Ensure all selected months exist for each telecaller
        monthsList.forEach(m => {
            const mLabel = m.label;
            Object.keys(teleMap).forEach(tName => {
                if (teleMap[tName].calls_made[mLabel] === undefined) teleMap[tName].calls_made[mLabel] = 0;
                if (teleMap[tName].calls_conn[mLabel] === undefined) teleMap[tName].calls_conn[mLabel] = 0;
                if (teleMap[tName].conn_ratio[mLabel] === undefined) teleMap[tName].conn_ratio[mLabel] = '0.0%';
                if (teleMap[tName].sold_val[mLabel] === undefined) teleMap[tName].sold_val[mLabel] = '₹0';
                if (teleMap[tName].products[mLabel] === undefined) {
                    const prodDef = (defaultProductMap[tName] && defaultProductMap[tName][m.key]) ? defaultProductMap[tName][m.key] : { trolley: 0, dumper: 0 };
                    teleMap[tName].products[mLabel] = prodDef;
                }
            });
        });

        const comparative_matrix = Object.values(teleMap);

        // Compute TEAM TOTAL dynamically
        const comparative_totals = {
            telecaller: 'TEAM TOTAL',
            calls_made: {},
            calls_conn: {},
            conn_ratio: {},
            sold_val: {},
            products: {}
        };

        monthsList.forEach(m => {
            const mLabel = m.label;
            let sumMade = 0;
            let sumConn = 0;
            let sumVal = 0;
            let sumTrolley = 0;
            let sumDumper = 0;

            comparative_matrix.forEach(row => {
                sumMade += (row.calls_made[mLabel] || 0);
                sumConn += (row.calls_conn[mLabel] || 0);
                const rawVal = parseFloat(String(row.sold_val[mLabel] || '').replace(/[^0-9.]/g, '')) || 0;
                sumVal += rawVal;
                if (row.products[mLabel]) {
                    sumTrolley += (row.products[mLabel].trolley || 0);
                    sumDumper += (row.products[mLabel].dumper || 0);
                }
            });

            const teamRatio = sumMade > 0 ? ((sumConn / sumMade) * 100).toFixed(1) + '%' : '0.0%';

            comparative_totals.calls_made[mLabel] = sumMade;
            comparative_totals.calls_conn[mLabel] = sumConn;
            comparative_totals.conn_ratio[mLabel] = teamRatio;
            comparative_totals.sold_val[mLabel] = `₹${sumVal.toLocaleString('en-IN')}`;
            comparative_totals.products[mLabel] = { trolley: sumTrolley, dumper: sumDumper };
        });

        res.json({
            period,
            start_date: startDateStr,
            end_date: endDateStr,
            matrix,
            totals,
            comparative_matrix,
            comparative_totals,
            months_labels: monthsList.map(m => m.label)
        });
    } catch (error) {
        console.error('Telecaller Performance Error:', error);
        res.status(500).json({ message: 'Failed to fetch telecaller performance.' });
    }
};


