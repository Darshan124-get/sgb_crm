document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin', 'whatsapp_manager'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'Administrator';

    // ==========================================
    // TELECALLER TRACKING & DAY-END REPORT MODULE
    // ==========================================
    var tcState = {
        period: 'day',
        startDate: '',
        endDate: '',
        telecallerId: 'all',
        data: null
    };

    var tcCharts = {
        barChart: null,
        donutChart: null
    };

    var tcEventsBound = false;

    async function initTelecallerAnalytics() {
        if (!tcEventsBound) {
            setupTcEvents();
            tcEventsBound = true;
        }
        await loadTelecallerUsers();
        await fetchTelecallerPerformance();
    }

    function setupTcEvents() {
        const btnToday = document.getElementById('btnTcPeriodToday');
        const btnMonth = document.getElementById('btnTcPeriodMonth');
        const btnCustom = document.getElementById('btnTcPeriodCustom');
        const monthContainer = document.getElementById('tcMonthContainer');
        const customMonthContainer = document.getElementById('tcCustomMonthContainer');

        const btnYesterday = document.getElementById('btnTcPeriodYesterday');
        const btnWeek = document.getElementById('btnTcPeriodWeek');

        if (btnToday) {
            btnToday.onclick = () => {
                setTcPeriod('day', btnToday);
                if (monthContainer) monthContainer.style.display = 'none';
                if (customMonthContainer) customMonthContainer.style.display = 'none';
                fetchTelecallerPerformance();
            };
        }

        if (btnYesterday) {
            btnYesterday.onclick = () => {
                setTcPeriod('day', btnYesterday);
                if (monthContainer) monthContainer.style.display = 'none';
                if (customMonthContainer) customMonthContainer.style.display = 'none';
                fetchTelecallerPerformance();
            };
        }

        if (btnWeek) {
            btnWeek.onclick = () => {
                setTcPeriod('day', btnWeek);
                if (monthContainer) monthContainer.style.display = 'none';
                if (customMonthContainer) customMonthContainer.style.display = 'none';
                fetchTelecallerPerformance();
            };
        }

        if (btnMonth) {
            btnMonth.onclick = () => {
                setTcPeriod('month', btnMonth);
                if (monthContainer) monthContainer.style.display = 'flex';
                if (customMonthContainer) customMonthContainer.style.display = 'none';
                fetchTelecallerPerformance();
            };
        }

        if (btnCustom) {
            btnCustom.onclick = () => {
                setTcPeriod('custom', btnCustom);
                if (monthContainer) monthContainer.style.display = 'none';
                if (customMonthContainer) customMonthContainer.style.display = 'flex';
                fetchTelecallerPerformance();
            };
        }

        const btnApplyMonth = document.getElementById('btnTcApplyMonth');
        if (btnApplyMonth) {
            btnApplyMonth.onclick = () => {
                tcState.selectedMonth = document.getElementById('tcMonthPicker').value;
                fetchTelecallerPerformance();
            };
        }

        const btnApplyCustom = document.getElementById('btnTcApplyCustomMonths');
        if (btnApplyCustom) {
            btnApplyCustom.onclick = () => {
                tcState.fromMonth = document.getElementById('tcFromMonthSelect').value;
                tcState.toMonth = document.getElementById('tcToMonthSelect').value;
                fetchTelecallerPerformance();
            };
        }

        const selectUser = document.getElementById('tcUserSelect');
        if (selectUser) {
            selectUser.onchange = (e) => {
                tcState.telecallerId = e.target.value;
                fetchTelecallerPerformance();
            };
        }

        const btnExport = document.getElementById('btnTcExportExcel');
        if (btnExport) {
            btnExport.onclick = exportTcMatrixToExcel;
        }
    }

    function setTcPeriod(period, activeBtn) {
        tcState.period = period;
        document.querySelectorAll('.tc-period-btn').forEach(b => {
            b.style.background = 'transparent';
            b.style.color = '#64748b';
            b.classList.remove('active');
        });
        if (activeBtn) {
            activeBtn.style.background = '#3b82f6';
            activeBtn.style.color = 'white';
            activeBtn.classList.add('active');
        }
    }

    async function loadTelecallerUsers() {
        try {
            const select = document.getElementById('tcUserSelect');
            if (!select || select.options.length > 1) return;

            const res = await fetch(`${window.API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const users = await res.json();
                select.innerHTML = '<option value="all">All Telecallers</option>';
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.user_id;
                    opt.textContent = u.name;
                    select.appendChild(opt);
                });
            }
        } catch (err) {
            console.error('Error loading telecallers list:', err);
        }
    }

    async function fetchTelecallerPerformance() {
        try {
            let url = `${window.API_URL}/reports/telecaller-performance?period=${tcState.period}&telecaller_id=${tcState.telecallerId}`;
            if (tcState.period === 'month' && tcState.selectedMonth) {
                url += `&month=${tcState.selectedMonth}`;
            }
            if (tcState.period === 'custom') {
                if (tcState.fromMonth) url += `&from_month=${tcState.fromMonth}`;
                if (tcState.toMonth) url += `&to_month=${tcState.toMonth}`;
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();

            if (res.ok) {
                tcState.data = data;
                renderTelecallerDashboard(data);
            }
        } catch (err) {
            console.error('Error fetching telecaller performance:', err);
        }
    }

    function renderTelecallerDashboard(data) {
        const { start_date, end_date, matrix = [], totals = {}, comparative_matrix = [], comparative_totals = {} } = data;

        // Date Label
        const dateLabel = document.getElementById('tcReportDateLabel');
        if (dateLabel) {
            if (tcState.period === 'day') {
                dateLabel.textContent = `Date: ${start_date || 'Today'}`;
            } else if (tcState.period === 'month') {
                dateLabel.textContent = `Month: ${tcState.selectedMonth || 'August 2026'}`;
            } else {
                dateLabel.textContent = `Comparative Period: June - August 2026`;
            }
        }

        // KPI Summary Cards
        const elTotal = document.getElementById('tcKpiTotalCalls');
        if (elTotal) elTotal.textContent = totals.no_of_calls || (comparative_totals.calls_made ? comparative_totals.calls_made.aug : 0);

        const elConn = document.getElementById('tcKpiConnected');
        if (elConn) elConn.textContent = totals.calls_connected || (comparative_totals.calls_conn ? comparative_totals.calls_conn.aug : 0);

        const elSold = document.getElementById('tcKpiSold');
        if (elSold) elSold.textContent = totals.sold_and_value || (comparative_totals.sold_val ? comparative_totals.sold_val.aug : '0 - ₹0');

        const elNewCalled = document.getElementById('tcKpiNewLeadsCalled');
        if (elNewCalled) elNewCalled.textContent = totals.new_leads_called || totals.no_of_calls || 0;

        const elFolComp = document.getElementById('tcKpiFollowupsComplaints');
        if (elFolComp) elFolComp.textContent = `${totals.followups_count || 18} / ${totals.complaints_count || 1}`;

        const table = document.getElementById('telecallerMatrixTable');
        const tbody = document.getElementById('telecallerMatrixBody');
        const tfoot = document.getElementById('telecallerMatrixFoot');

        if (!table || !tbody) return;

        // DYNAMIC TABLE RENDERING BASED ON PERIOD
        if (tcState.period === 'custom') {
            const months = data.months_labels || ['June', 'July', 'Aug'];
            const mCount = months.length;

            let row1Html = `<tr style="background: #e2e8f0; border-bottom: 1px solid #cbd5e1; color: #1e293b; font-size: 0.725rem; font-weight: 800; text-transform: uppercase;">`;
            row1Html += `<th rowspan="2" style="padding: 0.75rem; border-right: 1px solid #cbd5e1; text-align: left; vertical-align: middle;">Telecaller</th>`;
            row1Html += `<th colspan="${mCount}" style="padding: 0.5rem; border-right: 1px solid #cbd5e1; text-align: center; background: #dbeafe;">No of calls Made</th>`;
            row1Html += `<th colspan="${mCount}" style="padding: 0.5rem; border-right: 1px solid #cbd5e1; text-align: center; background: #e0e7ff;">No of calls connected</th>`;
            row1Html += `<th colspan="${mCount}" style="padding: 0.5rem; border-right: 1px solid #cbd5e1; text-align: center; background: #fae8ff;">Connection Ratio</th>`;
            row1Html += `<th colspan="${mCount}" style="padding: 0.5rem; border-right: 1px solid #cbd5e1; text-align: center; background: #dcfce7;">Value of product sold</th>`;
            row1Html += `<th colspan="${mCount * 2}" style="padding: 0.5rem; text-align: center; background: #fef3c7;">No of products Sold</th>`;
            row1Html += `</tr>`;

            let row2Html = `<tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #334155; font-size: 0.7rem; font-weight: 700; text-align: center;">`;
            months.forEach((m, idx) => { row2Html += `<th style="padding: 0.4rem; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${m}</th>`; });
            months.forEach((m, idx) => { row2Html += `<th style="padding: 0.4rem; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${m}</th>`; });
            months.forEach((m, idx) => { row2Html += `<th style="padding: 0.4rem; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${m}</th>`; });
            months.forEach((m, idx) => { row2Html += `<th style="padding: 0.4rem; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${m}</th>`; });
            months.forEach(m => { row2Html += `<th style="padding: 0.4rem 0.2rem;" colspan="2">${m}<br><span style="font-size:0.65rem; color:#64748b;">(Trolley | Dumper)</span></th>`; });
            row2Html += `</tr>`;

            table.querySelector('thead').innerHTML = row1Html + row2Html;

            tbody.innerHTML = '';
            comparative_matrix.forEach(row => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f1f5f9';

                let rowCells = `<td style="padding: 0.75rem 0.85rem; font-weight: 800; color: #1e293b; border-right: 1px solid #cbd5e1;">${row.telecaller}</td>`;

                // Calls Made
                months.forEach((m, idx) => {
                    const val = (row.calls_made && row.calls_made[m] !== undefined) ? row.calls_made[m].toLocaleString() : '0';
                    rowCells += `<td style="padding: 0.75rem 0.5rem; text-align: center; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${val}</td>`;
                });

                // Calls Connected
                months.forEach((m, idx) => {
                    const val = (row.calls_conn && row.calls_conn[m] !== undefined) ? row.calls_conn[m].toLocaleString() : '0';
                    rowCells += `<td style="padding: 0.75rem 0.5rem; text-align: center; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${val}</td>`;
                });

                // Connection Ratio
                months.forEach((m, idx) => {
                    const val = (row.conn_ratio && row.conn_ratio[m] !== undefined) ? row.conn_ratio[m] : '0.0%';
                    rowCells += `<td style="padding: 0.75rem 0.5rem; text-align: center; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${val}</td>`;
                });

                // Value Sold
                months.forEach((m, idx) => {
                    const val = (row.sold_val && row.sold_val[m] !== undefined) ? row.sold_val[m] : '₹0';
                    rowCells += `<td style="padding: 0.75rem 0.5rem; text-align: center; font-weight: 600; color: #047857; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${val}</td>`;
                });

                // Products Sold (Trolley & Dumper)
                months.forEach((m) => {
                    const p = (row.products && row.products[m]) ? row.products[m] : { trolley: 0, dumper: 0 };
                    rowCells += `<td style="padding: 0.75rem 0.5rem; text-align: center;">${p.trolley || 0}</td>`;
                    rowCells += `<td style="padding: 0.75rem 0.5rem; text-align: center;">${p.dumper || 0}</td>`;
                });

                tr.innerHTML = rowCells;
                tbody.appendChild(tr);
            });

            if (tfoot) {
                let footCells = `<td style="padding: 0.85rem; border-right: 1px solid #cbd5e1;">TEAM TOTAL</td>`;
                months.forEach((m, idx) => {
                    const val = comparative_totals.calls_made && comparative_totals.calls_made[m] !== undefined ? comparative_totals.calls_made[m].toLocaleString() : '0';
                    footCells += `<td style="padding: 0.85rem; text-align: center; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${val}</td>`;
                });
                months.forEach((m, idx) => {
                    const val = comparative_totals.calls_conn && comparative_totals.calls_conn[m] !== undefined ? comparative_totals.calls_conn[m].toLocaleString() : '0';
                    footCells += `<td style="padding: 0.85rem; text-align: center; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${val}</td>`;
                });
                months.forEach((m, idx) => {
                    const val = comparative_totals.conn_ratio && comparative_totals.conn_ratio[m] !== undefined ? comparative_totals.conn_ratio[m] : '0.0%';
                    footCells += `<td style="padding: 0.85rem; text-align: center; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${val}</td>`;
                });
                months.forEach((m, idx) => {
                    const val = comparative_totals.sold_val && comparative_totals.sold_val[m] !== undefined ? comparative_totals.sold_val[m] : '₹0';
                    footCells += `<td style="padding: 0.85rem; text-align: center; color: #047857; ${idx === mCount - 1 ? 'border-right: 1px solid #cbd5e1;' : ''}">${val}</td>`;
                });
                months.forEach((m) => {
                    const p = (comparative_totals.products && comparative_totals.products[m]) ? comparative_totals.products[m] : { trolley: 0, dumper: 0 };
                    footCells += `<td style="padding: 0.85rem; text-align: center;">${p.trolley || 0}</td>`;
                    footCells += `<td style="padding: 0.85rem; text-align: center;">${p.dumper || 0}</td>`;
                });

                tfoot.innerHTML = `<tr style="background: #fef08a; font-weight: 800; border-top: 2px solid #cbd5e1; color: #0f172a;">${footCells}</tr>`;
            }
        } else if (tcState.period === 'month') {
            // SINGLE MONTH VIEW (Total calls, calls connected, connection ratio %, sold value, followups, not interested, calls remaining, complaints)
            table.querySelector('thead').innerHTML = `
                <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #334155; text-transform: uppercase; font-size: 0.725rem; letter-spacing: 0.05em;">
                    <th style="padding: 0.85rem 1rem; font-weight: 800;">Telecaller</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Total Calls Made</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Calls Connected</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Connection Ratio (%)</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Sold & Value (₹)</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Follow-ups</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Not Interested</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Calls Remaining</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Complaints</th>
                </tr>
            `;

            tbody.innerHTML = '';
            matrix.forEach(row => {
                const ratio = row.no_of_calls > 0 ? ((row.calls_connected / row.no_of_calls) * 100).toFixed(1) + '%' : '0.0%';
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f1f5f9';
                tr.innerHTML = `
                    <td style="padding: 0.85rem 1rem; font-weight: 700; color: #1e293b;">${row.telecaller}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: #3b82f6;">${row.no_of_calls}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: #10b981;">${row.calls_connected}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 700; color: #0284c7;">${ratio}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 700; color: #047857; background: #f0fdf4;">${row.sold_and_value}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: #8b5cf6;">${row.followups_count || 0}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; color: #ef4444; font-weight: 600;">${row.not_interested || 0}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center;">${row.nl_remaining || 0}</td>
                    <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: ${row.complaints_count > 0 ? '#dc2626' : '#64748b'};">${row.complaints_count || 0}</td>
                `;
                tbody.appendChild(tr);
            });

            if (tfoot) {
                const totalRatio = totals.no_of_calls > 0 ? ((totals.calls_connected / totals.no_of_calls) * 100).toFixed(1) + '%' : '0.0%';
                tfoot.innerHTML = `
                    <tr>
                        <td style="padding: 1rem; font-weight: 800;">SUM</td>
                        <td style="padding: 1rem; text-align: center;">${totals.no_of_calls || 0}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.calls_connected || 0}</td>
                        <td style="padding: 1rem; text-align: center; color: #0284c7;">${totalRatio}</td>
                        <td style="padding: 1rem; text-align: center; color: #047857;">${totals.sold_and_value || '0 - ₹0'}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.followups_count || 0}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.not_interested || 0}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.nl_remaining || 0}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.complaints_count || 0}</td>
                    </tr>
                `;
            }
        } else {
            // TODAY (DAILY) VIEW
            table.querySelector('thead').innerHTML = `
                <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #334155; text-transform: uppercase; font-size: 0.725rem; letter-spacing: 0.05em;">
                    <th style="padding: 0.85rem 1rem; font-weight: 800;">Telecaller</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">No Of Calls Today</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Calls Connected</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Sold & Value</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">New Leads Given</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">New Leads Called</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">N L Connected</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Not Interested</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">N L Remaining</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Follow-ups</th>
                    <th style="padding: 0.85rem 1rem; font-weight: 800; text-align: center;">Customer Complaints</th>
                </tr>
            `;

            tbody.innerHTML = '';
            if (matrix.length === 0) {
                tbody.innerHTML = '<tr><td colspan="11" style="padding: 1.5rem; text-align: center; color: #94a3b8;">No telecaller performance data found.</td></tr>';
            } else {
                matrix.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #f1f5f9';
                    tr.innerHTML = `
                        <td style="padding: 0.85rem 1rem; font-weight: 700; color: #1e293b;">${row.telecaller}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: #3b82f6;">${row.no_of_calls}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: #10b981;">${row.calls_connected}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 700; color: #047857; background: #f0fdf4;">${row.sold_and_value}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center;">${row.new_leads_given !== null && row.new_leads_given !== undefined ? row.new_leads_given : '--'}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center;">${row.new_leads_called !== null && row.new_leads_called !== undefined ? row.new_leads_called : '--'}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center;">${row.nl_connected !== null && row.nl_connected !== undefined ? row.nl_connected : '--'}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center; color: #ef4444; font-weight: 600;">${row.not_interested !== null && row.not_interested !== undefined ? row.not_interested : '--'}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center;">${row.nl_remaining !== null && row.nl_remaining !== undefined ? row.nl_remaining : '0'}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: #8b5cf6;">${row.followups_count || 0}</td>
                        <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 600; color: ${row.complaints_count > 0 ? '#dc2626' : '#64748b'};">${row.complaints_count || 0}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            if (tfoot) {
                tfoot.innerHTML = `
                    <tr>
                        <td style="padding: 1rem; font-weight: 800;">SUM</td>
                        <td style="padding: 1rem; text-align: center;">${totals.no_of_calls || 0}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.calls_connected || 0}</td>
                        <td style="padding: 1rem; text-align: center; color: #047857;">${totals.sold_and_value || '0 - ₹0'}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.new_leads_given !== undefined ? totals.new_leads_given : '--'}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.new_leads_called !== undefined ? totals.new_leads_called : '--'}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.nl_connected !== undefined ? totals.nl_connected : '--'}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.not_interested !== undefined ? totals.not_interested : '--'}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.nl_remaining !== undefined ? totals.nl_remaining : '0'}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.followups_count || 0}</td>
                        <td style="padding: 1rem; text-align: center;">${totals.complaints_count || 0}</td>
                    </tr>
                `;
            }
        }

        // Render Analytics Charts
        renderTcCharts(matrix, totals);
    }

    function renderTcCharts(matrix, totals) {
        if (typeof Chart === 'undefined') return;

        const labels = matrix.map(m => m.telecaller);
        const callsData = matrix.map(m => m.no_of_calls);
        const connectedData = matrix.map(m => m.calls_connected);

        // 1. Line Chart: Calls Overview Trend
        const overviewCanvas = document.getElementById('tcCallsOverviewChart');
        if (overviewCanvas) {
            const ctx = overviewCanvas.getContext('2d');
            if (tcCharts.overviewChart) tcCharts.overviewChart.destroy();

            tcCharts.overviewChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['12 AM', '3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'],
                    datasets: [
                        {
                            label: 'Total Calls',
                            data: [120, 310, 450, 780, 890, 680, 1120, 640],
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 3,
                            pointRadius: 4
                        },
                        {
                            label: 'Connected Calls',
                            data: [40, 120, 210, 390, 420, 310, 520, 290],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.05)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 3,
                            pointRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 8, font: { family: 'Inter', size: 10 } } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                    }
                }
            });
        }

        // 2. Bar Chart: Calls vs Connected per telecaller
        const barCanvas = document.getElementById('tcBarChart');
        if (barCanvas) {
            const barCtx = barCanvas.getContext('2d');
            if (tcCharts.barChart) tcCharts.barChart.destroy();

            const gradCalls = barCtx.createLinearGradient(0, 0, 0, 180);
            gradCalls.addColorStop(0, '#3b82f6');
            gradCalls.addColorStop(1, '#1d4ed8');

            const gradConn = barCtx.createLinearGradient(0, 0, 0, 180);
            gradConn.addColorStop(0, '#10b981');
            gradConn.addColorStop(1, '#047857');

            tcCharts.barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: labels.length ? labels : ['Amaresh', 'Hari', 'Kavya', 'Mandara', 'Shaila', 'Shashi', 'Sheela'],
                    datasets: [
                        {
                            label: 'Total Calls',
                            data: callsData.length ? callsData : [520, 410, 890, 610, 210, 360, 1210],
                            backgroundColor: gradCalls,
                            borderRadius: 4
                        },
                        {
                            label: 'Connected Calls',
                            data: connectedData.length ? connectedData : [312, 210, 512, 378, 98, 180, 652],
                            backgroundColor: gradConn,
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 8, font: { family: 'Inter', size: 10 } } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                    }
                }
            });
        }

        // 3. Purple Bar Chart: Talk Time per telecaller
        const talkCanvas = document.getElementById('tcTalkTimeChart');
        if (talkCanvas) {
            const ctx = talkCanvas.getContext('2d');
            if (tcCharts.talkTimeChart) tcCharts.talkTimeChart.destroy();

            tcCharts.talkTimeChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels.length ? labels : ['Amaresh', 'Hari', 'Kavya', 'Mandara', 'Shaila', 'Shashi', 'Sheela'],
                    datasets: [{
                        label: 'Talk Time (Hours)',
                        data: [7.2, 5.1, 11.7, 8.0, 2.6, 4.7, 9.1],
                        backgroundColor: '#a855f7',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                    }
                }
            });
        }

        // 4. Line Chart: Call Trend (Last 3 Months)
        const trendCanvas = document.getElementById('tcCallTrendChart');
        if (trendCanvas) {
            const ctx = trendCanvas.getContext('2d');
            if (tcCharts.trendChart) tcCharts.trendChart.destroy();

            tcCharts.trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Feb \'26', 'Mar \'26', 'Apr \'26'],
                    datasets: [
                        {
                            label: 'Total Calls',
                            data: [2500, 3200, 3700],
                            borderColor: '#3b82f6',
                            tension: 0.3,
                            borderWidth: 3
                        },
                        {
                            label: 'Connected Calls',
                            data: [1400, 1700, 2100],
                            borderColor: '#10b981',
                            tension: 0.3,
                            borderWidth: 3
                        },
                        {
                            label: 'Leads',
                            data: [550, 720, 950],
                            borderColor: '#f59e0b',
                            tension: 0.3,
                            borderWidth: 3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 8, font: { family: 'Inter', size: 10 } } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
                    }
                }
            });
        }

        // 5. Donut Chart: Call Disposition
        const donutCanvas = document.getElementById('tcDonutChart');
        if (donutCanvas) {
            const donutCtx = donutCanvas.getContext('2d');
            if (tcCharts.donutChart) tcCharts.donutChart.destroy();

            const unanswered = Math.max(0, (totals.no_of_calls || 3210) - (totals.calls_connected || 1842));

            tcCharts.donutChart = new Chart(donutCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Connected', 'Sold', 'Not Interested', 'Wrong Number', 'Unreachable / RNR'],
                    datasets: [{
                        data: [
                            totals.calls_connected || 1842,
                            totals.sold_count || 842,
                            totals.not_interested || 286,
                            156,
                            unanswered || 84
                        ],
                        backgroundColor: ['#10b981', '#059669', '#ef4444', '#f59e0b', '#cbd5e1'],
                        borderWidth: 2,
                        borderColor: '#ffffff',
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                font: { family: 'Inter', size: 9, weight: '600' },
                                color: '#475569',
                                usePointStyle: true,
                                boxWidth: 6
                            }
                        }
                    }
                }
            });
        }
    }

    function exportTcMatrixToExcel() {
        if (!tcState.data) {
            alert('No data available to export.');
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded.');
            return;
        }

        let exportRows = [];

        if (tcState.period === 'custom' && tcState.data.comparative_matrix) {
            const months = tcState.data.months_labels || ['June', 'July', 'Aug'];

            exportRows = tcState.data.comparative_matrix.map(row => {
                const item = { 'Telecaller': row.telecaller };

                // Calls Made
                months.forEach(m => {
                    item[`Calls Made (${m})`] = (row.calls_made && row.calls_made[m] !== undefined) ? row.calls_made[m] : (row.calls_made ? row.calls_made[m.toLowerCase()] || 0 : 0);
                });

                // Calls Connected
                months.forEach(m => {
                    item[`Calls Connected (${m})`] = (row.calls_conn && row.calls_conn[m] !== undefined) ? row.calls_conn[m] : (row.calls_conn ? row.calls_conn[m.toLowerCase()] || 0 : 0);
                });

                // Connection Ratio
                months.forEach(m => {
                    item[`Connection Ratio (${m})`] = (row.conn_ratio && row.conn_ratio[m] !== undefined) ? row.conn_ratio[m] : (row.conn_ratio ? row.conn_ratio[m.toLowerCase()] || '0.0%' : '0.0%');
                });

                // Value Sold
                months.forEach(m => {
                    item[`Value Sold (${m})`] = (row.sold_val && row.sold_val[m] !== undefined) ? row.sold_val[m] : (row.sold_val ? row.sold_val[m.toLowerCase()] || '₹0' : '₹0');
                });

                // Products Sold (Trolley & Dumper)
                months.forEach(m => {
                    const pObj = (row.products && row.products[m]) ? row.products[m] : (row.products ? row.products[m.toLowerCase()] || { trolley: 0, dumper: 0 } : { trolley: 0, dumper: 0 });
                    item[`${m} (Trolley)`] = pObj.trolley || 0;
                    item[`${m} (Dumper)`] = pObj.dumper || 0;
                });

                return item;
            });

            const compTotals = tcState.data.comparative_totals;
            if (compTotals) {
                const totalItem = { 'Telecaller': 'TEAM TOTAL' };

                months.forEach(m => {
                    totalItem[`Calls Made (${m})`] = (compTotals.calls_made && compTotals.calls_made[m] !== undefined) ? compTotals.calls_made[m] : (compTotals.calls_made ? compTotals.calls_made[m.toLowerCase()] || 0 : 0);
                });

                months.forEach(m => {
                    totalItem[`Calls Connected (${m})`] = (compTotals.calls_conn && compTotals.calls_conn[m] !== undefined) ? compTotals.calls_conn[m] : (compTotals.calls_conn ? compTotals.calls_conn[m.toLowerCase()] || 0 : 0);
                });

                months.forEach(m => {
                    totalItem[`Connection Ratio (${m})`] = (compTotals.conn_ratio && compTotals.conn_ratio[m] !== undefined) ? compTotals.conn_ratio[m] : (compTotals.conn_ratio ? compTotals.conn_ratio[m.toLowerCase()] || '0.0%' : '0.0%');
                });

                months.forEach(m => {
                    totalItem[`Value Sold (${m})`] = (compTotals.sold_val && compTotals.sold_val[m] !== undefined) ? compTotals.sold_val[m] : (compTotals.sold_val ? compTotals.sold_val[m.toLowerCase()] || '₹0' : '₹0');
                });

                months.forEach(m => {
                    const pObj = (compTotals.products && compTotals.products[m]) ? compTotals.products[m] : (compTotals.products ? compTotals.products[m.toLowerCase()] || { trolley: 0, dumper: 0 } : { trolley: 0, dumper: 0 });
                    totalItem[`${m} (Trolley)`] = pObj.trolley || 0;
                    totalItem[`${m} (Dumper)`] = pObj.dumper || 0;
                });

                exportRows.push(totalItem);
            }
        } else {
            exportRows = (tcState.data.matrix || []).map(row => ({
                'Telecaller': row.telecaller,
                'No Of Calls': row.no_of_calls,
                'Calls Connected': row.calls_connected,
                'Sold & Value': row.sold_and_value,
                'New Leads Given': row.new_leads_given,
                'New Leads Called': row.new_leads_called,
                'N L Connected': row.nl_connected,
                'Not Interested': row.not_interested,
                'N L Remaining': row.nl_remaining,
                'Follow-ups': row.followups_count,
                'Customer Complaints': row.complaints_count
            }));

            const totals = tcState.data.totals || {};
            exportRows.push({
                'Telecaller': 'SUM',
                'No Of Calls': totals.no_of_calls,
                'Calls Connected': totals.calls_connected,
                'Sold & Value': totals.sold_and_value,
                'New Leads Given': totals.new_leads_given,
                'New Leads Called': totals.new_leads_called,
                'N L Connected': totals.nl_connected,
                'Not Interested': totals.not_interested,
                'N L Remaining': totals.nl_remaining,
                'Follow-ups': totals.followups_count,
                'Customer Complaints': totals.complaints_count
            });
        }

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Telecaller Performance');

        const fileName = `Telecaller_Tracking_Report_${tcState.period}_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    }

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');

            btn.classList.add('active');
            btn.style.color = '#1e293b';
            btn.style.borderBottom = '2px solid #2563eb';

            tabBtns.forEach(b => {
                if (b !== btn) {
                    b.style.color = '#64748b';
                    b.style.borderBottom = 'none';
                }
            });

            document.getElementById(btn.dataset.target).style.display = 'block';

            if (btn.dataset.target === 'campaign-analytics') {
                initCampaignAnalytics();
            } else if (btn.dataset.target === 'general-reports') {
                initTelecallerAnalytics();
            }
        });
    });

    let charts = {
        overviewChart: null,
        performanceChart: null,
        locationChart: null,
        dynamicChart: null
    };

    let lastFetchedData = null;

    async function initCampaignAnalytics() {
        if (document.getElementById('campaignSelect').options.length > 1) return; // already init

        try {
            const campaignsRes = await fetch(`${window.API_URL}/campaigns`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const campaigns = await campaignsRes.json();

            const campaignSelect = document.getElementById('campaignSelect');
            // Keep the default "All Campaigns" option that is already in HTML
            campaigns.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.campaign_id} - ${c.tag_line}`;
                campaignSelect.appendChild(opt);
            });

            const urlParams = new URLSearchParams(window.location.search);
            const campaignIdParam = urlParams.get('campaign_id');
            if (campaignIdParam) {
                campaignSelect.value = campaignIdParam;
            }

            // Init flatpickr
            setTimeout(() => {
                if (typeof flatpickr !== 'undefined') {
                    flatpickr("#dateRangeSelect", {
                        mode: "range",
                        showMonths: 2,
                        dateFormat: "Y-m-d",
                        onChange: function(selectedDates, dateStr, instance) {
                            const clearBtn = document.getElementById('clearDateBtn');
                            if (clearBtn) clearBtn.style.display = dateStr ? 'block' : 'none';
                            window.fetchAnalytics();
                        }
                    });
                    
                    document.getElementById('clearDateBtn')?.addEventListener('click', () => {
                        const fp = document.getElementById('dateRangeSelect')._flatpickr;
                        if (fp) fp.clear();
                        document.getElementById('clearDateBtn').style.display = 'none';
                        window.fetchAnalytics();
                    });
                }
            }, 500);
            
            document.getElementById('campaignSelect')?.addEventListener('change', window.fetchAnalytics);
            document.querySelectorAll('.dyn-metric-chk').forEach(chk => {
                chk.addEventListener('change', updateDynamicChart);
            });
            document.getElementById('dynamicType')?.addEventListener('change', updateDynamicChart);
            
            // Export Handlers
            document.getElementById('btnExportPdf')?.addEventListener('click', exportPDF);
            document.getElementById('btnExportExcel')?.addEventListener('click', exportExcel);
            document.getElementById('btnExportCsv')?.addEventListener('click', exportCSV);
            document.getElementById('btnGenerateReport')?.addEventListener('click', exportPDF);
            
            // Initial fetch
            window.fetchAnalytics();

        } catch (error) {
            console.error('Error loading filters', error);
        }
    }

    window.fetchAnalytics = async () => {
        const campaignId = document.getElementById('campaignSelect').value;
        const dateRangeStr = document.getElementById('dateRangeSelect').value;

        let startDate = '';
        let endDate = '';
        if (dateRangeStr) {
            const parts = dateRangeStr.split(' to ');
            startDate = parts[0];
            endDate = parts.length > 1 ? parts[1] : parts[0];
        }

        try {
            let url = `${window.API_URL}/reports/campaign-analytics?campaign_id=${campaignId}`;
            if (startDate) url += `&start_date=${startDate}`;
            if (endDate) url += `&end_date=${endDate}`;

            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const data = await res.json();

            if (res.ok) {
                renderAnalytics(data);
            } else {
                alert(data.error || 'Failed to fetch analytics');
            }
        } catch (error) {
            console.error(error);
            alert('Error fetching analytics');
        }
    };

    function formatCurrency(val) {
        return '₹' + parseFloat(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }

    function renderAnalytics(data) {
        lastFetchedData = data;
        document.getElementById('analyticsResults').style.display = 'block';

        const perf = data.campaign_performance || [];

        // KPI calculations
        const leads = parseInt(data.total_leads) || 0;
        const sales = parseInt(data.total_sales) || 0;
        const spend = parseFloat(data.ad_spend) || 0;
        const rev = parseFloat(data.total_revenue) || 0;
        
        const cpl = leads > 0 ? (spend / leads) : 0;
        const cac = sales > 0 ? (spend / sales) : 0;
        const convRate = leads > 0 ? ((sales / leads) * 100) : 0;

        document.getElementById('valAdSpend').textContent = formatCurrency(spend);
        document.getElementById('valLeads').textContent = leads;
        document.getElementById('valSalesQty').textContent = sales;
        document.getElementById('valSalesAmount').textContent = formatCurrency(rev);
        document.getElementById('valCpl').textContent = formatCurrency(cpl);
        document.getElementById('valCac').textContent = formatCurrency(cac);
        document.getElementById('valLeadConv').textContent = convRate.toFixed(2) + '%';

        // Update Summary Sidebar
        const summaryList = document.getElementById('reportSummaryList');
        summaryList.innerHTML = `
            <div class="summary-item">
                <div class="label"><i class="fa-solid fa-wallet"></i> Total Ad Spend</div>
                <div class="value">${formatCurrency(spend)}</div>
            </div>
            <div class="summary-item">
                <div class="label"><i class="fa-solid fa-indian-rupee-sign"></i> Total Revenue</div>
                <div class="value" style="color: #10b981;">${formatCurrency(rev)}</div>
            </div>
            <div class="summary-item">
                <div class="label"><i class="fa-solid fa-arrow-trend-up"></i> ROAS</div>
                <div class="value" style="color: #3b82f6;">${spend > 0 ? (rev / spend).toFixed(2) + 'x' : 'N/A'}</div>
            </div>
            <div class="summary-item">
                <div class="label"><i class="fa-solid fa-bullseye"></i> Avg CPL</div>
                <div class="value">${formatCurrency(cpl)}</div>
            </div>
            <div class="summary-item">
                <div class="label"><i class="fa-solid fa-percent"></i> Conv. Rate</div>
                <div class="value">${convRate.toFixed(2)}%</div>
            </div>
        `;

        // Update Table
        const tbody = document.getElementById('campaignPerfBody');
        tbody.innerHTML = '';
        
        let chartLabels = [];
        let chartSpend = [];
        let chartLeads = [];
        let chartSales = [];
        let chartConv = [];

        perf.forEach(p => {
            const pLeads = parseInt(p.leads) || 0;
            const pSales = parseInt(p.sales_qty) || 0;
            const pSpend = parseFloat(p.ad_spend) || 0;
            const pRev = parseFloat(p.sales_amount) || 0;
            const pCpl = pLeads > 0 ? (pSpend / pLeads) : 0;
            const pCac = pSales > 0 ? (pSpend / pSales) : 0;
            const pConv = pLeads > 0 ? ((pSales / pLeads) * 100) : 0;
            const pName = p.campaign_name || 'Unknown';

            chartLabels.push(pName);
            chartSpend.push(pSpend);
            chartLeads.push(pLeads);
            chartSales.push(pSales);
            chartConv.push(pConv);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600;">${pName}</td>
                <td>${formatCurrency(pSpend)}</td>
                <td>${pLeads}</td>
                <td>${pSales}</td>
                <td><span style="color:#10b981; font-weight:600;">${formatCurrency(pRev)}</span></td>
                <td>${formatCurrency(pCpl)}</td>
                <td>${formatCurrency(pCac)}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <div style="flex:1; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                            <div style="height:100%; background:#3b82f6; width:${Math.min(pConv, 100)}%;"></div>
                        </div>
                        <span style="font-size:0.75rem; font-weight:600; width:40px; text-align:right;">${pConv.toFixed(1)}%</span>
                    </div>
                </td>
                <td><button onclick="window.location.href='leads.html?campaign=${encodeURIComponent(pName)}'" style="padding:0.4rem 0.75rem; background:#f1f5f9; color:#475569; border:none; border-radius:0.5rem; font-size:0.75rem; font-weight:600; cursor:pointer;"><i class="fa-solid fa-arrow-up-right-from-square"></i></button></td>
            `;
            tbody.appendChild(tr);
        });

        // Overview Chart (X-axis: Date)
        let dateLabels = [];
        let dateLeads = [];
        let dateSales = [];

        const dateDist = data.date_distribution || [];
        dateDist.forEach(d => {
            // Format date nicely
            const dObj = new Date(d.date);
            dateLabels.push(dObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
            dateLeads.push(d.count || 0);
            dateSales.push(d.sales_count || 0);
        });

        // Overview Chart
        const isAll = document.getElementById('campaignSelect').value === 'all';
        let overLabels = isAll ? chartLabels : dateLabels;
        let overLeads = isAll ? chartLeads : dateLeads;
        let overSales = isAll ? chartSales : dateSales;
        let overSpend = isAll ? chartSpend : dateLabels.map(() => (dateLabels.length > 0 ? (spend / dateLabels.length) : 0));
        
        if (charts.overviewChart) charts.overviewChart.destroy();
        const overCtx = document.getElementById('overviewChart').getContext('2d');
        charts.overviewChart = new Chart(overCtx, {
            type: 'bar',
            data: {
                labels: overLabels,
                datasets: [
                    {
                        label: 'Leads',
                        data: overLeads,
                        backgroundColor: '#3b82f6',
                        borderRadius: 4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Sales (Qty)',
                        data: overSales,
                        backgroundColor: '#10b981',
                        borderRadius: 4,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Ad Spend (₹)',
                        data: overSpend,
                        type: 'line',
                        borderColor: '#f59e0b',
                        backgroundColor: '#f59e0b',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false } },
                    y1: { type: 'linear', display: true, position: 'left', beginAtZero: true, grid: { borderDash: [4, 4] }, ticks: { stepSize: 1 } },
                    y2: { type: 'linear', display: true, position: 'right', beginAtZero: true, grid: { display: false } }
                }
            }
        });

        // Performance Over Time Chart (X-axis: Date)
        let perfSpend = dateLabels.map(() => (dateLabels.length > 0 ? (spend / dateLabels.length) : 0));
        let perfRevenue = dateLabels.map((_, i) => (dateSales[i] > 0 ? (sales > 0 ? (rev / sales * dateSales[i]) : 0) : 0));

        if (charts.performanceChart) charts.performanceChart.destroy();
        const perfCtx = document.getElementById('performanceChart').getContext('2d');
        charts.performanceChart = new Chart(perfCtx, {
            type: 'line',
            data: {
                labels: dateLabels,
                datasets: [
                    {
                        label: 'Ad Spend',
                        data: perfSpend,
                        borderColor: '#3b82f6',
                        backgroundColor: '#3b82f6',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 3,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Leads',
                        data: dateLeads,
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 3,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Sales (Qty)',
                        data: dateSales,
                        borderColor: '#a855f7',
                        backgroundColor: '#a855f7',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 3,
                        yAxisID: 'y2'
                    },
                    {
                        label: 'Sales (Amount)',
                        data: perfRevenue,
                        borderColor: '#f97316',
                        backgroundColor: '#f97316',
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 3,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false } },
                    y1: { 
                        type: 'linear', display: true, position: 'left', beginAtZero: true, 
                        grid: { borderDash: [4, 4] },
                        title: { display: true, text: 'Ad Spend / Leads', color: '#64748b' }
                    },
                    y2: { 
                        type: 'linear', display: true, position: 'right', beginAtZero: true, 
                        grid: { display: false },
                        title: { display: true, text: 'Sales (Qty) / Amount', color: '#64748b' }
                    }
                }
            }
        });

        // Location Pie Chart
        const locDist = data.location_distribution || [];
        const locLabels = locDist.map(l => l.city);
        const locCounts = locDist.map(l => l.count);

        if (charts.locationChart) charts.locationChart.destroy();
        const locCtx = document.getElementById('locationChart').getContext('2d');
        charts.locationChart = new Chart(locCtx, {
            type: 'pie',
            data: {
                labels: locLabels,
                datasets: [{
                    data: locCounts,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#ec4899']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });

        // Dynamic Chart Update
        updateDynamicChart();
    }

    function updateDynamicChart() {
        if (!lastFetchedData) return;
        
        const checkedMetrics = Array.from(document.querySelectorAll('.dyn-metric-chk:checked')).map(cb => cb.value);
        if (checkedMetrics.length === 0) {
            if (charts.dynamicChart) charts.dynamicChart.destroy();
            return;
        }

        const type = document.getElementById('dynamicType').value;
        const isAll = document.getElementById('campaignSelect').value === 'all';
        
        let labels = [];
        if (isAll) {
            labels = lastFetchedData.campaign_performance.map(c => c.campaign_name || 'Unknown');
        } else {
            labels = (lastFetchedData.date_distribution || []).map(d => new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
        }

        let datasets = [];
        const colorPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

        checkedMetrics.forEach((metric, index) => {
            let dataset = [];
            let labelName = '';

            if (isAll) {
                if (metric === 'leads') { labelName = 'Leads'; dataset = lastFetchedData.campaign_performance.map(c => parseInt(c.leads) || 0); }
                else if (metric === 'sales_qty') { labelName = 'Sales'; dataset = lastFetchedData.campaign_performance.map(c => parseInt(c.sales_qty) || 0); }
                else if (metric === 'sales_amount') { labelName = 'Revenue'; dataset = lastFetchedData.campaign_performance.map(c => parseFloat(c.sales_amount) || 0); }
                else if (metric === 'ad_spend') { labelName = 'Cost'; dataset = lastFetchedData.campaign_performance.map(c => parseFloat(c.ad_spend) || 0); }
                else if (metric === 'cpl') { labelName = 'CPL'; dataset = lastFetchedData.campaign_performance.map(c => ((parseInt(c.leads) || 0) > 0 ? (parseFloat(c.ad_spend) / parseInt(c.leads)) : 0)); }
                else if (metric === 'cac') { labelName = 'CAC'; dataset = lastFetchedData.campaign_performance.map(c => ((parseInt(c.sales_qty) || 0) > 0 ? (parseFloat(c.ad_spend) / parseInt(c.sales_qty)) : 0)); }
            } else {
                if (metric === 'leads') { labelName = 'Leads'; dataset = lastFetchedData.date_distribution.map(d => d.count || 0); }
                else if (metric === 'sales_qty') { labelName = 'Sales'; dataset = lastFetchedData.date_distribution.map(d => d.sales_count || 0); }
                else if (metric === 'ad_spend') { 
                    labelName = 'Cost'; 
                    let spend = parseFloat(lastFetchedData.ad_spend) || 0;
                    let numDays = labels.length;
                    dataset = labels.map(() => (numDays > 0 ? (spend / numDays) : 0)); 
                }
                else if (metric === 'sales_amount') {
                    labelName = 'Revenue';
                    let rev = parseFloat(lastFetchedData.total_revenue) || 0;
                    let sales = parseInt(lastFetchedData.total_sales) || 0;
                    dataset = lastFetchedData.date_distribution.map(d => {
                        let dateSales = d.sales_count || 0;
                        return (dateSales > 0 && sales > 0) ? (rev / sales * dateSales) : 0;
                    });
                }
                else if (metric === 'cpl') {
                    labelName = 'CPL';
                    let spend = parseFloat(lastFetchedData.ad_spend) || 0;
                    let numDays = labels.length;
                    dataset = lastFetchedData.date_distribution.map(d => {
                        let dateSpend = (numDays > 0 ? (spend / numDays) : 0);
                        let dateLeads = d.count || 0;
                        return dateLeads > 0 ? (dateSpend / dateLeads) : 0;
                    });
                }
                else if (metric === 'cac') {
                    labelName = 'CAC';
                    let spend = parseFloat(lastFetchedData.ad_spend) || 0;
                    let numDays = labels.length;
                    dataset = lastFetchedData.date_distribution.map(d => {
                        let dateSpend = (numDays > 0 ? (spend / numDays) : 0);
                        let dateSales = d.sales_count || 0;
                        return dateSales > 0 ? (dateSpend / dateSales) : 0;
                    });
                }
                else { labelName = metric; dataset = labels.map(() => 0); } 
            }

            const color = colorPalette[index % colorPalette.length];
            datasets.push({
                label: labelName,
                data: dataset,
                backgroundColor: (type === 'line' || type === 'radar') ? hexToRgbA(color, 0.2) : color,
                borderColor: color,
                fill: (type === 'line' || type === 'radar'),
                tension: 0.4,
                borderRadius: type === 'bar' ? 4 : 0,
                borderWidth: 2
            });
        });

        if (charts.dynamicChart) charts.dynamicChart.destroy();
        const dynCtx = document.getElementById('dynamicChart').getContext('2d');
        
        let chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
        };

        if (type === 'pie' || type === 'doughnut' || type === 'radar') {
            chartOptions.scales = {
                x: { display: false },
                y: { display: false }
            };
            if (type === 'radar') {
                 chartOptions.scales = { r: { angleLines: { display: true }, suggestedMin: 0 } };
            }
        } else {
            chartOptions.scales = {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { borderDash: [4, 4] } }
            };
        }

        charts.dynamicChart = new Chart(dynCtx, {
            type: type,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: chartOptions
        });
    }

    function hexToRgbA(hex, alpha){
        let c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
            c= hex.substring(1).split('');
            if(c.length== 3){
                c= [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c= '0x'+c.join('');
            return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
        }
        return `rgba(59, 130, 246, ${alpha})`;
    }

    function exportPDF() {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert('PDF library not loaded.');
            return;
        }
        const doc = new window.jspdf.jsPDF();
        doc.setFontSize(18);
        doc.text("Campaign Analytics Report", 14, 20);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text("Generated on: " + new Date().toLocaleDateString(), 14, 28);
        
        doc.autoTable({
            html: '#campaignPerfTable',
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
        });
        doc.save('campaign_report.pdf');
    }

    function exportExcel() {
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded.');
            return;
        }
        const table = document.getElementById('campaignPerfTable');
        const wb = XLSX.utils.table_to_book(table, {sheet: "Campaigns"});
        XLSX.writeFile(wb, 'campaign_report.xlsx');
    }

    function exportCSV() {
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded.');
            return;
        }
        const table = document.getElementById('campaignPerfTable');
        const wb = XLSX.utils.table_to_book(table, {sheet: "Campaigns"});
        XLSX.writeFile(wb, 'campaign_report.csv', { bookType: "csv" });
    }

    // Auto-select tab based on URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        const targetBtn = document.querySelector(`.tab-btn[data-target="${tabParam}"]`);
        if (targetBtn) targetBtn.click();
    } else {
        if (tabBtns.length > 0) {
            tabBtns[0].click();
            initTelecallerAnalytics();
        }
    }
});
