const pool = require('../src/config/db');

// Mock request and response
const req = {
    query: {
        dateRange: 'today'
    }
};

const res = {
    json: (data) => {
        console.log("SUCCESS!");
        console.log(JSON.stringify(data, null, 2));
        process.exit(0);
    },
    status: (code) => {
        console.log("STATUS:", code);
        return res;
    }
};

// Copy getStats code here to run it directly
const getStats = async (req, res) => {
    try {
        const { dateRange = 'today', billingUser, paymentStatus, customerType, salesExecutive } = req.query;

        // 1. Build common filters for orders (o)
        let orderConds = [];
        let orderParams = [];

        if (billingUser) {
            orderConds.push('o.billing_done_by = ?');
            orderParams.push(billingUser);
        }
        if (customerType) {
            orderConds.push('o.order_source = ?');
            orderParams.push(customerType);
        }
        if (salesExecutive) {
            orderConds.push('o.created_by = ?');
            orderParams.push(salesExecutive);
        }
        if (paymentStatus) {
            orderConds.push('(SELECT COUNT(*) FROM payments p WHERE p.order_id = o.order_id AND p.payment_status = ?) > 0');
            orderParams.push(paymentStatus);
        }

        // 2. Build common filters for invoices (i) (joins orders o)
        let invoiceConds = [];
        let invoiceParams = [];

        if (billingUser) {
            invoiceConds.push('i.created_by = ?');
            invoiceParams.push(billingUser);
        }
        if (customerType) {
            invoiceConds.push('o.order_source = ?');
            invoiceParams.push(customerType);
        }
        if (salesExecutive) {
            invoiceConds.push('o.created_by = ?');
            invoiceParams.push(salesExecutive);
        }
        if (paymentStatus) {
            invoiceConds.push('(SELECT COUNT(*) FROM payments p WHERE p.order_id = o.order_id AND p.payment_status = ?) > 0');
            invoiceParams.push(paymentStatus);
        }

        // Helpers to construct date clauses
        const getDateRangeSQL = (col, range) => {
            if (range === 'today') {
                return `DATE(${col}) = CURRENT_DATE`;
            } else if (range === 'yesterday') {
                return `DATE(${col}) = CURRENT_DATE - INTERVAL 1 DAY`;
            } else if (range === 'last_7_days') {
                return `DATE(${col}) >= CURRENT_DATE - INTERVAL 6 DAY`;
            } else if (range === 'this_month') {
                return `MONTH(${col}) = MONTH(CURRENT_DATE) AND YEAR(${col}) = YEAR(CURRENT_DATE)`;
            } else if (range === 'this_year') {
                return `YEAR(${col}) = YEAR(CURRENT_DATE)`;
            }
            return `DATE(${col}) = CURRENT_DATE`;
        };

        const getPrevDateRangeSQL = (col, range) => {
            if (range === 'today') {
                return `DATE(${col}) = CURRENT_DATE - INTERVAL 1 DAY`;
            } else if (range === 'yesterday') {
                return `DATE(${col}) = CURRENT_DATE - INTERVAL 2 DAY`;
            } else if (range === 'last_7_days') {
                return `DATE(${col}) >= CURRENT_DATE - INTERVAL 13 DAY AND DATE(${col}) < CURRENT_DATE - INTERVAL 6 DAY`;
            } else if (range === 'this_month') {
                return `MONTH(${col}) = MONTH(CURRENT_DATE - INTERVAL 1 MONTH) AND YEAR(${col}) = YEAR(CURRENT_DATE - INTERVAL 1 MONTH)`;
            } else if (range === 'this_year') {
                return `YEAR(${col}) = YEAR(CURRENT_DATE) - 1`;
            }
            return `DATE(${col}) = CURRENT_DATE - INTERVAL 1 DAY`;
        };

        const dateClauseOrderCur = getDateRangeSQL('o.created_at', dateRange);
        const dateClauseOrderPrev = getPrevDateRangeSQL('o.created_at', dateRange);

        const dateClauseInvoiceCur = getDateRangeSQL('i.created_at', dateRange);
        const dateClauseInvoicePrev = getPrevDateRangeSQL('i.created_at', dateRange);

        const runQuery = async (baseQuery, conditions, params) => {
            const finalQuery = baseQuery + (conditions.length ? ' AND ' + conditions.join(' AND ') : '');
            const [rows] = await pool.query(finalQuery, params);
            return rows;
        };

        // KPI 1: New Orders (filtered period vs previous)
        const ordersCurRow = await runQuery(`SELECT COUNT(*) as count FROM orders o WHERE ${dateClauseOrderCur}`, orderConds, orderParams);
        const ordersPrevRow = await runQuery(`SELECT COUNT(*) as count FROM orders o WHERE ${dateClauseOrderPrev}`, orderConds, orderParams);

        // KPI 2: Pending Orders (Draft + In Review)
        const pendingTotalRow = await runQuery(`SELECT COUNT(*) as count FROM orders o WHERE o.order_status IN ('draft', 'in_review')`, orderConds, orderParams);
        const pendingCurRow = await runQuery(`SELECT COUNT(*) as count FROM orders o WHERE o.order_status IN ('draft', 'in_review') AND ${dateClauseOrderCur}`, orderConds, orderParams);
        const pendingPrevRow = await runQuery(`SELECT COUNT(*) as count FROM orders o WHERE o.order_status IN ('draft', 'in_review') AND ${dateClauseOrderPrev}`, orderConds, orderParams);

        // KPI 3: Billing (Draft Invoices)
        const billingTotalRow = await runQuery(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'draft'`, invoiceConds, invoiceParams);
        const billingCurRow = await runQuery(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'draft' AND ${dateClauseInvoiceCur}`, invoiceConds, invoiceParams);
        const billingPrevRow = await runQuery(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'draft' AND ${dateClauseInvoicePrev}`, invoiceConds, invoiceParams);

        // KPI 4: Bills Generated
        const billsCurRow = await runQuery(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND ${dateClauseInvoiceCur}`, invoiceConds, invoiceParams);
        const billsPrevRow = await runQuery(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND ${dateClauseInvoicePrev}`, invoiceConds, invoiceParams);

        // KPI 5: Revenue Billed
        const revenueCurRow = await runQuery(`SELECT SUM(i.total_amount) as total FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND ${dateClauseInvoiceCur}`, invoiceConds, invoiceParams);
        const revenuePrevRow = await runQuery(`SELECT SUM(i.total_amount) as total FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND ${dateClauseInvoicePrev}`, invoiceConds, invoiceParams);

        // Bottom KPI 1: Average Invoice Value
        const avgInvoiceCurRow = await runQuery(`SELECT AVG(i.total_amount) as total FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND ${dateClauseInvoiceCur}`, invoiceConds, invoiceParams);
        const avgInvoicePrevRow = await runQuery(`SELECT AVG(i.total_amount) as total FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND ${dateClauseInvoicePrev}`, invoiceConds, invoiceParams);

        // Bottom KPI 2: Avg. Billing Time
        const avgTimeCurRow = await runQuery(`SELECT AVG(TIMESTAMPDIFF(SECOND, o.created_at, i.created_at)) as seconds FROM invoices i JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND ${dateClauseInvoiceCur}`, invoiceConds, invoiceParams);
        const avgTimePrevRow = await runQuery(`SELECT AVG(TIMESTAMPDIFF(SECOND, o.created_at, i.created_at)) as seconds FROM invoices i JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND ${dateClauseInvoicePrev}`, invoiceConds, invoiceParams);

        // Bottom KPI 3: Bills Pending
        let payConds = [];
        let payParams = [];
        if (customerType) {
            payConds.push('o.order_source = ?');
            payParams.push(customerType);
        }
        if (salesExecutive) {
            payConds.push('o.created_by = ?');
            payParams.push(salesExecutive);
        }
        const pendingVerificationRow = await runQuery(`SELECT COUNT(*) as count FROM payments p LEFT JOIN orders o ON p.order_id = o.order_id WHERE p.payment_status = 'pending'`, payConds, payParams);
        const pendingVerificationCurRow = await runQuery(`SELECT COUNT(*) as count FROM payments p LEFT JOIN orders o ON p.order_id = o.order_id WHERE p.payment_status = 'pending' AND DATE(p.created_at) = CURRENT_DATE`, payConds, payParams);
        const pendingVerificationPrevRow = await runQuery(`SELECT COUNT(*) as count FROM payments p LEFT JOIN orders o ON p.order_id = o.order_id WHERE p.payment_status = 'pending' AND DATE(p.created_at) = CURRENT_DATE - INTERVAL 1 DAY`, payConds, payParams);

        // Target
        const [targetRows] = await pool.query("SELECT setting_value FROM settings WHERE setting_key = 'daily_billing_target'");
        const dailyTarget = parseFloat(targetRows[0]?.setting_value || 500000);

        // Sparklines
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toISOString().split('T')[0]);
        }

        const fetchSparkline = async (baseQuery, conditions, params, dateCol) => {
            const query = baseQuery + ` AND DATE(${dateCol}) >= CURRENT_DATE - INTERVAL 6 DAY` + (conditions.length ? ' AND ' + conditions.join(' AND ') : '') + ` GROUP BY DATE(${dateCol})`;
            const [rows] = await pool.query(query, params);
            const dataMap = {};
            rows.forEach(r => {
                const dateKey = new Date(r.date).toISOString().split('T')[0];
                dataMap[dateKey] = r.value;
            });
            return last7Days.map(d => dataMap[d] || 0);
        };

        const sparkNewOrders = await fetchSparkline(`SELECT DATE(o.created_at) as date, COUNT(*) as value FROM orders o WHERE 1=1`, orderConds, orderParams, 'o.created_at');
        const sparkPendingOrders = await fetchSparkline(`SELECT DATE(o.created_at) as date, COUNT(*) as value FROM orders o WHERE o.order_status IN ('draft', 'in_review')`, orderConds, orderParams, 'o.created_at');
        const sparkBillingDrafts = await fetchSparkline(`SELECT DATE(i.created_at) as date, COUNT(*) as value FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'draft'`, invoiceConds, invoiceParams, 'i.created_at');
        const sparkBillsGenerated = await fetchSparkline(`SELECT DATE(i.created_at) as date, COUNT(*) as value FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized'`, invoiceConds, invoiceParams, 'i.created_at');
        const sparkRevenue = await fetchSparkline(`SELECT DATE(i.created_at) as date, SUM(i.total_amount) as value FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized'`, invoiceConds, invoiceParams, 'i.created_at');

        // Revenue Trend
        const last14Days = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last14Days.push(d.toISOString().split('T')[0]);
        }
        const [revTrendRows] = await pool.query(
            `SELECT DATE(i.created_at) as date, SUM(i.total_amount) as total 
             FROM invoices i 
             LEFT JOIN orders o ON i.order_id = o.order_id
             WHERE i.invoice_status = 'finalized' AND DATE(i.created_at) >= CURRENT_DATE - INTERVAL 13 DAY` +
            (invoiceConds.length ? ' AND ' + invoiceConds.join(' AND ') : '') +
            ' GROUP BY DATE(i.created_at)',
            invoiceParams
        );
        const revTrendMap = {};
        revTrendRows.forEach(r => {
            const k = new Date(r.date).toISOString().split('T')[0];
            revTrendMap[k] = parseFloat(r.total || 0);
        });
        const revTrendData = last14Days.map(d => revTrendMap[d] || 0);
        
        const revenueTrend = {
            labels: last14Days.slice(7).map(d => {
                const parts = d.split('-');
                return `${parts[2]} ${new Date(d).toLocaleString('default', { month: 'short' })}`;
            }),
            lastWeek: revTrendData.slice(0, 7),
            thisWeek: revTrendData.slice(7)
        };

        // Status Distribution
        const distGen = await runQuery(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'finalized' AND DATE(i.created_at) = CURRENT_DATE`, invoiceConds, invoiceParams);
        const distPend = await runQuery(`SELECT COUNT(*) as count FROM invoices i LEFT JOIN orders o ON i.order_id = o.order_id WHERE i.invoice_status = 'draft' AND DATE(i.created_at) = CURRENT_DATE`, invoiceConds, invoiceParams);
        const distVer = await runQuery(`SELECT COUNT(*) as count FROM payments p LEFT JOIN orders o ON p.order_id = o.order_id WHERE p.payment_status = 'verified' AND DATE(p.verified_at) = CURRENT_DATE`, payConds, payParams);
        const distRej = await runQuery(`SELECT COUNT(*) as count FROM payments p LEFT JOIN orders o ON p.order_id = o.order_id WHERE p.payment_status = 'rejected' AND DATE(p.verified_at) = CURRENT_DATE`, payConds, payParams);

        const statusDistribution = {
            generated: distGen[0]?.count || 0,
            pending: distPend[0]?.count || 0,
            verified: distVer[0]?.count || 0,
            rejected: distRej[0]?.count || 0,
            total: (distGen[0]?.count || 0) + (distPend[0]?.count || 0) + (distVer[0]?.count || 0) + (distRej[0]?.count || 0)
        };

        // Monthly
        const fetchMonthly = async (yearOffset) => {
            const [rows] = await pool.query(
                `SELECT MONTH(i.created_at) as month, SUM(i.total_amount) as total 
                 FROM invoices i 
                 LEFT JOIN orders o ON i.order_id = o.order_id
                 WHERE i.invoice_status = 'finalized' AND YEAR(i.created_at) = YEAR(CURRENT_DATE) - ?` +
                (invoiceConds.length ? ' AND ' + invoiceConds.join(' AND ') : '') +
                ' GROUP BY MONTH(i.created_at)',
                [yearOffset, ...invoiceParams]
            );
            const monthlyData = Array(12).fill(0);
            rows.forEach(r => {
                monthlyData[r.month - 1] = parseFloat(r.total || 0);
            });
            return monthlyData;
        };
        const monthlyThisYear = await fetchMonthly(0);
        const monthlyLastYear = await fetchMonthly(1);

        // Billing Users
        const [billingUsers] = await pool.query(`
            SELECT DISTINCT u.user_id, u.name 
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE (r.name LIKE '%billing%' OR r.name LIKE '%admin%') AND u.status = 'active'
            ORDER BY u.name ASC
        `);

        const formatTrend = (cur, prev) => {
            const currentVal = parseFloat(cur || 0);
            const prevVal = parseFloat(prev || 0);
            if (prevVal === 0) {
                return currentVal > 0 ? '+100.0%' : '0.0%';
            }
            const pct = ((currentVal - prevVal) / prevVal) * 100;
            return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
        };

        res.json({
            pendingBilling: pendingTotalRow[0]?.count || 0,
            billedToday: billsCurRow[0]?.count || 0,
            revenueToday: parseFloat(revenueCurRow[0]?.total || 0),
            pendingVerification: pendingVerificationRow[0]?.count || 0,
            billingUsers,
            kpis: {
                newOrders: {
                    value: ordersCurRow[0]?.count || 0,
                    trend: formatTrend(ordersCurRow[0]?.count, ordersPrevRow[0]?.count),
                    sparkline: sparkNewOrders
                },
                pendingOrders: {
                    value: pendingTotalRow[0]?.count || 0,
                    trend: formatTrend(pendingCurRow[0]?.count, pendingPrevRow[0]?.count),
                    sparkline: sparkPendingOrders
                },
                billingDrafts: {
                    value: billingTotalRow[0]?.count || 0,
                    trend: formatTrend(billingCurRow[0]?.count, billingPrevRow[0]?.count),
                    sparkline: sparkBillingDrafts
                },
                billsGenerated: {
                    value: billsCurRow[0]?.count || 0,
                    trend: formatTrend(billsCurRow[0]?.count, billsPrevRow[0]?.count),
                    sparkline: sparkBillsGenerated
                },
                revenueBilled: {
                    value: parseFloat(revenueCurRow[0]?.total || 0),
                    trend: formatTrend(revenueCurRow[0]?.total, revenuePrevRow[0]?.total),
                    sparkline: sparkRevenue
                }
            },
            bottomKpis: {
                avgInvoiceValue: {
                    value: parseFloat(avgInvoiceCurRow[0]?.total || 0),
                    trend: formatTrend(avgInvoiceCurRow[0]?.total, avgInvoicePrevRow[0]?.total)
                },
                avgBillingTime: {
                    value: avgTimeCurRow[0]?.seconds ? Math.round(parseFloat(avgTimeCurRow[0]?.seconds)) : 0,
                    trend: formatTrend(avgTimeCurRow[0]?.seconds, avgTimePrevRow[0]?.seconds)
                },
                billsPending: {
                    value: pendingVerificationRow[0]?.count || 0,
                    trend: formatTrend(pendingVerificationCurRow[0]?.count, pendingVerificationPrevRow[0]?.count)
                },
                dailyTarget: {
                    value: dailyTarget,
                    achievedPercent: dailyTarget > 0 ? Math.min(Math.round((parseFloat(revenueCurRow[0]?.total || 0) / dailyTarget) * 100), 100) : 0
                }
            },
            revenueTrend,
            statusDistribution,
            monthlyRevenue: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                thisYear: monthlyThisYear,
                lastYear: monthlyLastYear
            }
        });
    } catch (err) {
        console.error('getStats redesign error:', err);
        res.status(500).json({ message: 'Error fetching stats: ' + err.message });
        process.exit(1);
    }
};

getStats(req, res);
