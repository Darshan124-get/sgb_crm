const pool = require('../config/db');
const PDFDocument = require('pdfkit');

class TelecallerReportService {
    /**
     * Helper to format seconds into mm:ss
     */
    static formatDuration(totalSeconds) {
        const s = Math.round(Number(totalSeconds) || 0);
        if (s <= 0) return '0m 00s';
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }

    /**
     * Fetches daily telecaller summary metrics from real database tables
     */
    static async getDailySummary({ userId = null, date = null }) {
        let targetDate = date;

        // If no date passed, default strictly to today's local date (IST)
        if (!targetDate || targetDate === 'today') {
            targetDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        }

        // Fetch User Info if userId provided
        let telecallerName = 'All Telecallers / Team';
        let telecallerEmail = '';
        let telecallerPhone = '';
        let employeeId = 'N/A';

        if (userId) {
            const [users] = await pool.query(
                'SELECT user_id, name, email, phone, employee_id FROM users WHERE user_id = ?',
                [userId]
            );
            if (users.length > 0) {
                telecallerName = users[0].name || telecallerName;
                telecallerEmail = users[0].email || '';
                telecallerPhone = users[0].phone || '';
                employeeId = users[0].employee_id || 'N/A';
            }
        }

        // 1. Leads Assigned Today
        let assignedSql = `
            SELECT COUNT(*) as count 
            FROM leads 
            WHERE (DATE(assigned_at) = ? OR (assigned_at IS NULL AND DATE(created_at) = ?))
        `;
        const assignedParams = [targetDate, targetDate];
        if (userId) {
            assignedSql += ' AND assigned_to = ?';
            assignedParams.push(userId);
        }
        const [[assignedRow]] = await pool.query(assignedSql, assignedParams);
        const assignedToday = parseInt(assignedRow?.count || 0, 10);

        // 2. CDR Calls Made Today (Unique Called Leads, Attempts, Connected, Missed, Duration)
        let callsSql = `
            SELECT 
                COUNT(DISTINCT COALESCE(NULLIF(customer_phone, ''), CAST(lead_id AS CHAR))) as total_called_leads,
                COUNT(*) as total_attempts,
                COUNT(DISTINCT CASE WHEN technical_status IN ('CONNECTED', 'ANSWERED', 'COMPLETED') AND talk_time_seconds > 0 THEN COALESCE(NULLIF(customer_phone, ''), CAST(lead_id AS CHAR)) END) as connected_leads,
                COALESCE(AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds ELSE NULL END), 0) as avg_duration,
                COALESCE(SUM(talk_time_seconds), 0) as total_talk_time
            FROM telephony_calls
            WHERE DATE(started_at) = ?
        `;
        const callsParams = [targetDate];
        if (userId) {
            callsSql += ' AND crm_user_id = ?';
            callsParams.push(userId);
        }
        const [[callsRow]] = await pool.query(callsSql, callsParams);

        const totalCalledLeads = parseInt(callsRow?.total_called_leads || 0, 10);
        const totalAttempts = parseInt(callsRow?.total_attempts || 0, 10);
        const connectedLeads = parseInt(callsRow?.connected_leads || 0, 10);
        const missedLeads = Math.max(0, totalCalledLeads - connectedLeads);
        const avgDurationSec = Math.round(parseFloat(callsRow?.avg_duration || 0));
        const totalTalkTimeSec = parseInt(callsRow?.total_talk_time || 0, 10);

        const connectedPct = totalCalledLeads > 0 ? ((connectedLeads / totalCalledLeads) * 100).toFixed(1) : '0.0';
        const missedPct = totalCalledLeads > 0 ? ((missedLeads / totalCalledLeads) * 100).toFixed(1) : '0.0';

        // 3. Follow-ups Scheduled for Today
        let followupsSql = `
            SELECT COUNT(DISTINCT l.lead_id) as count
            FROM leads l
            LEFT JOIN lead_followups lf ON l.lead_id = lf.lead_id
            WHERE (DATE(l.next_followup_date) = ? OR DATE(lf.followup_date) = ?)
        `;
        const followupsParams = [targetDate, targetDate];
        if (userId) {
            followupsSql += ' AND l.assigned_to = ?';
            followupsParams.push(userId);
        }
        const [[followupsRow]] = await pool.query(followupsSql, followupsParams);
        const followupsScheduled = parseInt(followupsRow?.count || 0, 10);

        // 4. Converted Orders & Revenue Today
        let ordersSql = `
            SELECT 
                COUNT(*) as count,
                COALESCE(SUM(total_amount), 0) as total_revenue
            FROM orders o
            LEFT JOIN leads l ON o.lead_id = l.lead_id
            WHERE DATE(o.created_at) = ?
        `;
        const ordersParams = [targetDate];
        if (userId) {
            ordersSql += ' AND (o.created_by = ? OR l.assigned_to = ?)';
            ordersParams.push(userId, userId);
        }
        const [[ordersRow]] = await pool.query(ordersSql, ordersParams);
        const convertedOrdersCount = parseInt(ordersRow?.count || 0, 10);
        const convertedOrdersValue = parseFloat(ordersRow?.total_revenue || 0);

        // 5. Pending Leads to Call Today (Assigned today, but not called in CDR today)
        let pendingTodaySql = `
            SELECT l.lead_id, l.customer_name, l.phone_number, l.district, l.current_crop, l.status, l.created_at
            FROM leads l
            WHERE (DATE(l.assigned_at) = ? OR (l.assigned_at IS NULL AND DATE(l.created_at) = ?))
              ${userId ? 'AND l.assigned_to = ?' : ''}
              AND l.lead_id NOT IN (
                  SELECT DISTINCT tc.lead_id 
                  FROM telephony_calls tc 
                  WHERE tc.lead_id IS NOT NULL AND DATE(tc.started_at) = ?
              )
              AND l.phone_number COLLATE utf8mb4_unicode_ci NOT IN (
                  SELECT DISTINCT tc.customer_phone COLLATE utf8mb4_unicode_ci 
                  FROM telephony_calls tc 
                  WHERE tc.customer_phone IS NOT NULL AND DATE(tc.started_at) = ?
              )
            ORDER BY l.created_at DESC
            LIMIT 50
        `;
        const pendingTodayParams = [targetDate, targetDate];
        if (userId) pendingTodayParams.push(userId);
        pendingTodayParams.push(targetDate, targetDate);

        const [pendingTodayLeads] = await pool.query(pendingTodaySql, pendingTodayParams);
        const pendingLeadsCount = pendingTodayLeads.length;

        // 6. Carryover / Pending from Yesterday (Uncontacted leads assigned before targetDate)
        let carryoverSql = `
            SELECT l.lead_id, l.customer_name, l.phone_number, l.district, l.current_crop, l.status, l.created_at
            FROM leads l
            WHERE (DATE(l.assigned_at) < ? OR (l.assigned_at IS NULL AND DATE(l.created_at) < ?))
              ${userId ? 'AND l.assigned_to = ?' : ''}
              AND l.status IN ('new', 'assigned')
              AND (l.call_count = 0 OR l.call_count IS NULL)
            ORDER BY l.created_at DESC
            LIMIT 50
        `;
        const carryoverParams = [targetDate, targetDate];
        if (userId) carryoverParams.push(userId);

        const [carryoverLeads] = await pool.query(carryoverSql, carryoverParams);
        const carryoverCount = carryoverLeads.length;

        return {
            date: targetDate,
            telecaller: {
                id: userId,
                name: telecallerName,
                email: telecallerEmail,
                phone: telecallerPhone,
                employee_id: employeeId
            },
            metrics: {
                assigned_today: assignedToday,
                calls_made_today: totalCalledLeads,
                total_called_leads: totalCalledLeads,
                total_call_attempts: totalAttempts,
                connected_calls: connectedLeads,
                connected_pct: connectedPct,
                missed_calls: missedLeads,
                missed_pct: missedPct,
                followups_scheduled: followupsScheduled,
                converted_orders: convertedOrdersCount,
                converted_orders_value: convertedOrdersValue,
                converted_orders_formatted: `${convertedOrdersCount} Orders (₹${convertedOrdersValue.toLocaleString('en-IN')})`,
                avg_call_duration_seconds: avgDurationSec,
                avg_call_duration_formatted: this.formatDuration(avgDurationSec),
                total_talk_time_seconds: totalTalkTimeSec,
                total_talk_time_formatted: this.formatDuration(totalTalkTimeSec),
                pending_leads_today: pendingLeadsCount,
                carryover_pending_yesterday: carryoverCount
            },
            pending_leads_today_sample: pendingTodayLeads.slice(0, 20),
            carryover_pending_sample: carryoverLeads.slice(0, 20)
        };
    }

    /**
     * Generates a PDF Document stream for the Daily Telecaller Report
     */
    static async generateDailyReportPdf(res, { userId = null, date = null }) {
        const report = await this.getDailySummary({ userId, date });
        const m = report.metrics;
        const u = report.telecaller;

        const doc = new PDFDocument({
            size: 'A4',
            margin: 36,
            bufferPages: true,
            info: {
                Title: `Daily Telecaller Report - ${report.date}`,
                Author: 'SGB Agro CRM',
                Subject: 'Daily Telecaller Performance and CDR Metrics',
                Keywords: 'Telecaller, CDR, SGB Agro, Performance Report'
            }
        });

        // Set response headers for PDF download
        const filename = `Daily_Telecaller_Report_${report.date.replace(/-/g, '')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        const pageWidth = 595.28;
        const contentWidth = pageWidth - 72; // 523.28
        let y = 36;

        // ── TOP HEADER BANNER ──
        doc.rect(36, y, contentWidth, 70).fill('#0A5844');
        
        // Brand Title
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16)
           .text('SGB AGRO CRM', 50, y + 14);
        doc.font('Helvetica').fontSize(11).fillColor('#D1FAE5')
           .text('DAILY TELECALLER PERFORMANCE & CDR REPORT', 50, y + 34);

        // Date & Agent meta on right
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#FFFFFF')
           .text(`Report Date: ${report.date}`, 370, y + 14, { align: 'right', width: 175 });
        doc.font('Helvetica').fontSize(9).fillColor('#E2E8F0')
           .text(`Telecaller: ${u.name}`, 370, y + 28, { align: 'right', width: 175 })
           .text(`Emp ID: ${u.employee_id} | Generated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`, 370, y + 42, { align: 'right', width: 175 });

        y += 84;

        // ── SECTION 1: EXECUTIVE KPI SUMMARY CARDS ──
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A')
           .text('1. Executive Performance Summary', 36, y);
        y += 18;

        const cardWidth = (contentWidth - 16) / 3; // 3 columns
        const cardHeight = 52;

        const kpis = [
            { label: 'Leads Assigned Today', value: `${m.assigned_today} Leads`, color: '#0A5844', bg: '#F0FDF4' },
            { label: 'Total Called Leads (CDR)', value: `${m.calls_made_today} Leads`, color: '#0F172A', bg: '#F8FAFC' },
            { label: 'Connected Leads', value: `${m.connected_calls} (${m.connected_pct}%)`, color: '#16A34A', bg: '#DCFCE7' },
            { label: 'Missed / Unanswered', value: `${m.missed_calls} (${m.missed_pct}%)`, color: '#DC2626', bg: '#FEE2E2' },
            { label: 'Follow-ups Scheduled', value: `${m.followups_scheduled} Leads`, color: '#EA580C', bg: '#FFEDD5' },
            { label: 'Converted Orders', value: `${m.converted_orders} (₹${m.converted_orders_value.toLocaleString('en-IN')})`, color: '#0284C7', bg: '#E0F2FE' },
            { label: 'Average Call Duration', value: m.avg_call_duration_formatted, color: '#475569', bg: '#F1F5F9' },
            { label: 'Pending Calls (Today)', value: `${m.pending_leads_today} Leads`, color: '#D97706', bg: '#FEF3C7' },
            { label: 'Carryover (Yesterday)', value: `${m.carryover_pending_yesterday} Leads`, color: '#9333EA', bg: '#F3E8FF' }
        ];

        kpis.forEach((kpi, idx) => {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const cx = 36 + col * (cardWidth + 8);
            const cy = y + row * (cardHeight + 8);

            // Card Background & Border
            doc.rect(cx, cy, cardWidth, cardHeight).fill(kpi.bg);
            doc.rect(cx, cy, cardWidth, cardHeight).lineWidth(0.75).stroke('#CBD5E1');

            // Card Content
            doc.font('Helvetica').fontSize(8.5).fillColor('#64748B')
               .text(kpi.label, cx + 8, cy + 9, { width: cardWidth - 16 });
            doc.font('Helvetica-Bold').fontSize(12).fillColor(kpi.color)
               .text(kpi.value, cx + 8, cy + 24, { width: cardWidth - 16 });
        });

        y += (Math.ceil(kpis.length / 3)) * (cardHeight + 8) + 14;

        // ── SECTION 2: CALL OUTCOME & PIPELINE BREAKDOWN ──
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A')
           .text('2. Telephony Activity & Pipeline Efficiency', 36, y);
        y += 18;

        // Visual Outcome Bar
        doc.rect(36, y, contentWidth, 24).fill('#F1F5F9');
        const connWidth = m.calls_made_today > 0 ? (m.connected_calls / m.calls_made_today) * contentWidth : 0;
        const missWidth = m.calls_made_today > 0 ? (m.missed_calls / m.calls_made_today) * contentWidth : 0;

        if (connWidth > 0) {
            doc.rect(36, y, connWidth, 24).fill('#16A34A');
        }
        if (missWidth > 0) {
            doc.rect(36 + connWidth, y, missWidth, 24).fill('#EF4444');
        }
        doc.rect(36, y, contentWidth, 24).lineWidth(0.5).stroke('#CBD5E1');

        y += 30;

        // Legend below bar
        doc.rect(36, y + 2, 8, 8).fill('#16A34A');
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#16A34A')
           .text(`Connected: ${m.connected_calls} (${m.connected_pct}%)`, 48, y);

        doc.rect(170, y + 2, 8, 8).fill('#EF4444');
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#DC2626')
           .text(`Missed: ${m.missed_calls} (${m.missed_pct}%)`, 182, y);

        doc.font('Helvetica').fontSize(8.5).fillColor('#475569')
           .text(`Total Talk Time: ${m.total_talk_time_formatted} | Avg Duration: ${m.avg_call_duration_formatted}`, 320, y, { align: 'right', width: 239 });

        y += 24;

        // ── SECTION 3: UNCALLED & PENDING LEADS TO CALL ──
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F172A')
           .text('3. Action Required: Uncalled & Pending Leads (Today & Carryover)', 36, y);
        y += 16;

        // Combine samples
        const allPending = [
            ...report.pending_leads_today_sample.map(l => ({ ...l, type: 'Today' })),
            ...report.carryover_pending_sample.map(l => ({ ...l, type: 'Carryover' }))
        ].slice(0, 15);

        // Table Header
        const tableCols = [
            { header: '#', width: 22, align: 'center' },
            { header: 'Type', width: 55, align: 'left' },
            { header: 'Lead ID', width: 50, align: 'left' },
            { header: 'Customer Name', width: 110, align: 'left' },
            { header: 'Phone Number', width: 85, align: 'left' },
            { header: 'District / City', width: 85, align: 'left' },
            { header: 'Crop / Context', width: 70, align: 'left' },
            { header: 'Status', width: 46, align: 'center' }
        ];

        doc.rect(36, y, contentWidth, 18).fill('#0A5844');
        let colX = 36;
        tableCols.forEach(col => {
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF')
               .text(col.header, colX + 3, y + 5, { width: col.width - 6, align: col.align });
            colX += col.width;
        });

        y += 18;

        if (allPending.length === 0) {
            doc.rect(36, y, contentWidth, 24).fill('#F8FAFC');
            doc.font('Helvetica').fontSize(8.5).fillColor('#64748B')
               .text('All assigned leads have been called. Zero pending calls!', 36, y + 7, { align: 'center', width: contentWidth });
            y += 24;
        } else {
            allPending.forEach((lead, idx) => {
                const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
                doc.rect(36, y, contentWidth, 16).fill(bg);
                doc.rect(36, y, contentWidth, 16).lineWidth(0.25).stroke('#E2E8F0');

                let cx = 36;
                const rowData = [
                    String(idx + 1),
                    lead.type,
                    `#${lead.lead_id || '-'}`,
                    (lead.customer_name || 'Customer').substring(0, 18),
                    lead.phone_number || '--',
                    (lead.district || lead.city || '-').substring(0, 14),
                    (lead.current_crop || 'Agro').substring(0, 12),
                    lead.status || 'New'
                ];

                tableCols.forEach((col, cIdx) => {
                    const text = rowData[cIdx];
                    const isType = cIdx === 1;
                    const isPhone = cIdx === 4;
                    doc.font(isPhone || isType ? 'Helvetica-Bold' : 'Helvetica')
                       .fontSize(7.5)
                       .fillColor(isType && text === 'Carryover' ? '#9333EA' : (isPhone ? '#0A5844' : '#1E293B'))
                       .text(text, cx + 3, y + 4, { width: col.width - 6, align: col.align });
                    cx += col.width;
                });

                y += 16;
            });
        }

        // ── FOOTER ON ALL PAGES ──
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.rect(36, 800, contentWidth, 0.5).fill('#CBD5E1');
            doc.font('Helvetica').fontSize(7.5).fillColor('#94A3B8')
               .text('Confidential - SGB Agro CRM Automated Telecaller CDR Report', 36, 806)
               .text(`Page ${i + 1} of ${pages.count}`, 36, 806, { align: 'right', width: contentWidth });
        }

        doc.end();
    }
}

module.exports = TelecallerReportService;
