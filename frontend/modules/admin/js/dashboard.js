document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['admin'])) return;

    const API_URL = window.API_URL;
    const token   = localStorage.getItem('token');
    const user    = window.getCurrentUser();

    // Personalize Topbar
    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg) welcomeMsg.textContent = `${user.name || 'Admin'}'s Control Tower`;
    
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = user.name || 'Administrator';

    // Chart instances storage
    let charts = {
        telecallers: null,
        status: null,
        location: null,
        ops: null,
        revenue: null
    };

    // Date range picker instance
    let fp = null;

    // Initialize Flatpickr Datepicker
    fp = flatpickr("#dashboardDateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        defaultDate: [
            new Date(new Date().getFullYear(), new Date().getMonth(), 1), // 1st of current month
            new Date() // Today
        ],
        onClose: function(selectedDates, dateStr, instance) {
            // Trigger fetch when range selection is completed
            if (selectedDates.length === 2) {
                // Set active filter tab to Custom
                setActiveTab('custom');
                fetchStats();
            }
        }
    });

    // Handle Quick Date Filters
    const tabBtns = document.querySelectorAll('.filter-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const range = btn.dataset.range;
            if (range === 'custom') {
                if (fp) fp.open();
                return;
            }
            setActiveTab(range);
            const dates = getDatesForRange(range);
            if (fp) fp.setDate([new Date(dates.start), new Date(dates.end)]);
            fetchStats();
        });
    });

    // Refresh Button Click
    document.getElementById('btnRefresh')?.addEventListener('click', fetchStats);

    // Initial Fetch
    fetchStats();

    // Fetch and populate stats
    async function fetchStats() {
        const dateRangeVal = document.getElementById('dashboardDateRange').value;
        let startDate = '';
        let endDate = '';
        if (dateRangeVal) {
            const parts = dateRangeVal.split(' to ');
            startDate = parts[0];
            endDate = parts.length > 1 ? parts[1] : parts[0];
        }

        try {
            let url = `${API_URL}/reports/dashboard-stats`;
            const isDealerMode = localStorage.getItem('dealerMode') === 'true';
            const params = [];
            if (startDate && endDate) {
                params.push(`start_date=${startDate}`);
                params.push(`end_date=${endDate}`);
            }
            if (isDealerMode) {
                params.push('mode=dealer');
            }
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401) { window.doLogout(); return; }
            const data = await res.json();

            // Populate KPI Cards
            populateKPIs(data);

            // Populate Workflow
            populateWorkflow(data);

            // Populate Operations Summary Counts
            populateOperationsCounts(data);

            // Populate Inventory Snapshot
            populateInventory(data);

            // Populate Products List
            populateProducts(data);

            // Populate Campaign, WhatsApp & Dealer Panels
            populatePanels(data);

            // Populate Alerts & Notifications
            populateAlerts(data);

            // Initialize/Update Charts
            initTelecallersChart(data.telecallerPerformance);
            initStatusChart(data);
            initLocationChart(data);
            initOpsChart(data.operations.trends);
            initRevenueChart(data.revenueOverview.trend);

        } catch (e) {
            console.error('Dashboard statistics load error:', e);
        }
    }

    // Set active class on filter tab buttons
    function setActiveTab(range) {
        tabBtns.forEach(btn => {
            if (btn.dataset.range === range) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Helper to calculate date ranges
    function getDatesForRange(range) {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        if (range === 'today') {
            // Today is default
        } else if (range === 'yesterday') {
            start.setDate(today.getDate() - 1);
            end.setDate(today.getDate() - 1);
        } else if (range === 'this_week') {
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
            start.setDate(diff);
        } else if (range === 'this_month') {
            start.setDate(1);
        } else if (range === 'this_year') {
            start.setMonth(0, 1);
        }
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }

    // Populate KPIs
    function populateKPIs(data) {
        const isDealerMode = localStorage.getItem('dealerMode') === 'true';
        
        // Dynamic re-labeling for Dealer Mode (B2B)
        const labelNewLeads = document.getElementById('kpiNewLeads').previousElementSibling;
        const labelActiveLeads = document.getElementById('kpiActiveLeads').previousElementSibling;
        const labelFollowups = document.getElementById('kpiFollowups').previousElementSibling;
        const labelConverted = document.getElementById('kpiConverted').previousElementSibling;
        const labelOrders = document.getElementById('kpiOrders').previousElementSibling;
        const labelRevenue = document.getElementById('kpiRevenue').previousElementSibling;

        if (isDealerMode) {
            if (labelNewLeads) labelNewLeads.textContent = "New Dealers";
            if (labelActiveLeads) labelActiveLeads.textContent = "Active Dealers";
            if (labelFollowups) labelFollowups.textContent = "Pending Orders";
            if (labelConverted) labelConverted.textContent = "Fulfilled Orders";
            if (labelOrders) labelOrders.textContent = "Total Dealer Orders";
            if (labelRevenue) labelRevenue.textContent = "Dealer Revenue";
            
            const welcomeMsg = document.getElementById('welcomeMessage');
            if (welcomeMsg) welcomeMsg.textContent = `${user.name || 'Admin'}'s Dealer Panel`;

            const titles = document.querySelectorAll('.panel-title-text');
            titles.forEach(title => {
                if (title.textContent.includes('Telecaller Performance')) {
                    title.innerHTML = '<i class="fas fa-users-cog"></i> Dealer Executive Performance <span class="subtitle-text">(This Month)</span>';
                }
                if (title.textContent.includes('Lead Status Distribution')) {
                    title.innerHTML = '<i class="fas fa-chart-pie"></i> Order Status Distribution';
                }
                if (title.textContent.includes('Lead by Location')) {
                    title.innerHTML = '<i class="fas fa-map-marker-alt"></i> Dealers by Location';
                }
            });
        } else {
            if (labelNewLeads) labelNewLeads.textContent = "New Leads";
            if (labelActiveLeads) labelActiveLeads.textContent = "Active Leads";
            if (labelFollowups) labelFollowups.textContent = "Follow-up Pending";
            if (labelConverted) labelConverted.textContent = "Converted (MTD)";
            if (labelOrders) labelOrders.textContent = "Orders Received";
            if (labelRevenue) labelRevenue.textContent = "Revenue (MTD)";
            
            const welcomeMsg = document.getElementById('welcomeMessage');
            if (welcomeMsg) welcomeMsg.textContent = `${user.name || 'Admin'}'s Control Tower`;
        }

        document.getElementById('kpiNewLeads').textContent = parseFloat(data.kpis.newLeads).toLocaleString();
        setTrendBadge('trendNewLeads', data.comparison.newLeads);

        document.getElementById('kpiActiveLeads').textContent = parseFloat(data.kpis.activeLeads).toLocaleString();
        setTrendBadge('trendActiveLeads', data.comparison.activeLeads);

        document.getElementById('kpiFollowups').textContent = parseFloat(data.kpis.followupsPending).toLocaleString();
        setTrendBadge('trendFollowups', data.comparison.followupsPending);

        document.getElementById('kpiConverted').textContent = parseFloat(data.kpis.convertedLeads).toLocaleString();
        setTrendBadge('trendConverted', data.comparison.convertedLeads);

        document.getElementById('kpiOrders').textContent = parseFloat(data.kpis.ordersReceived).toLocaleString();
        setTrendBadge('trendOrders', data.comparison.ordersReceived);

        document.getElementById('kpiRevenue').textContent = `₹${parseFloat(data.kpis.revenueMTD).toLocaleString('en-IN')}`;
        setTrendBadge('trendRevenue', data.comparison.revenue);

        document.getElementById('kpiOutstanding').textContent = `₹${parseFloat(data.kpis.outstanding).toLocaleString('en-IN')}`;
        document.getElementById('outstandingInvoices').textContent = `${data.kpis.invoiceCount} Invoices`;

        document.getElementById('kpiProfit').textContent = `₹${parseFloat(data.kpis.profit).toLocaleString('en-IN')}`;
        setTrendBadge('trendProfit', data.comparison.profit);
        
        // Header Alert Badge Update
        const bellBadge = document.getElementById('notifBadge');
        if (bellBadge) bellBadge.textContent = data.kpis.followupsPending;
        
        const mailBadge = document.getElementById('msgBadge');
        if (mailBadge) mailBadge.textContent = data.whatsapp.unread;
    }

    // Set values and arrow indicators for trend badges
    function setTrendBadge(elementId, changeStr) {
        const badge = document.getElementById(elementId);
        if (!badge) return;
        
        const isNegative = changeStr.startsWith('-');
        const isNeutral = changeStr.startsWith('+0.0') || changeStr.startsWith('+0%') || changeStr === '0.0%';

        badge.style.color = isNeutral ? '#94a3b8' : (isNegative ? '#ef4444' : '#10b981');
        badge.innerHTML = `<i class="fa-solid ${isNeutral ? 'fa-minus' : (isNegative ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up')}"></i> ${changeStr.replace('+', '')} vs last period`;
    }

    // Populate Order Workflow Overview
    function populateWorkflow(data) {
        document.getElementById('workflowReceived').textContent = parseFloat(data.workflow.received).toLocaleString();
        document.getElementById('workflowBilled').textContent = parseFloat(data.workflow.billed).toLocaleString();
        document.getElementById('workflowPacked').textContent = parseFloat(data.workflow.packed).toLocaleString();
        document.getElementById('workflowShipped').textContent = parseFloat(data.workflow.shipped).toLocaleString();
        document.getElementById('workflowDelivered').textContent = parseFloat(data.workflow.delivered).toLocaleString();

        const pctBilled = data.workflow.received > 0 ? Math.round((data.workflow.billed / data.workflow.received) * 100) : 0;
        const pctPacked = data.workflow.received > 0 ? Math.round((data.workflow.packed / data.workflow.received) * 100) : 0;
        const pctShipped = data.workflow.received > 0 ? Math.round((data.workflow.shipped / data.workflow.received) * 100) : 0;
        const pctDelivered = data.workflow.received > 0 ? Math.round((data.workflow.delivered / data.workflow.received) * 100) : 0;

        document.getElementById('workflowBilled').nextElementSibling.textContent = `Billing (${pctBilled}%)`;
        document.getElementById('workflowPacked').nextElementSibling.textContent = `Packing (${pctPacked}%)`;
        document.getElementById('workflowShipped').nextElementSibling.textContent = `Shipping (${pctShipped}%)`;
        document.getElementById('workflowDelivered').nextElementSibling.textContent = `Delivered (${pctDelivered}%)`;

        // Update active steps
        const steps = document.querySelectorAll('.workflow-step');
        steps[0]?.classList.add('active'); // Received is always active
        steps[1]?.classList.toggle('active', data.workflow.billed > 0);
        steps[2]?.classList.toggle('active', data.workflow.packed > 0);
        steps[3]?.classList.toggle('active', data.workflow.shipped > 0);
        steps[4]?.classList.toggle('active', data.workflow.delivered > 0);
    }

    // Populate Operations Summary Counts
    function populateOperationsCounts(data) {
        document.getElementById('opsPendingBilling').textContent = parseFloat(data.operations.counts.pendingBilling).toLocaleString();
        document.getElementById('opsPendingPacking').textContent = parseFloat(data.operations.counts.pendingPacking).toLocaleString();
        document.getElementById('opsPendingShipping').textContent = parseFloat(data.operations.counts.pendingShipping).toLocaleString();
        document.getElementById('opsDelayed').textContent = parseFloat(data.operations.counts.delayedOrders).toLocaleString();
    }

    // Populate Inventory Snapshot
    function populateInventory(data) {
        document.getElementById('invTotalStock').textContent = parseFloat(data.inventory.totalStock).toLocaleString();
        document.getElementById('invLowStock').textContent = parseFloat(data.inventory.lowStock).toLocaleString();
        document.getElementById('invOutOfStock').textContent = parseFloat(data.inventory.outOfStock).toLocaleString();
        document.getElementById('invValue').textContent = `₹${parseFloat(data.inventory.inventoryValue).toLocaleString('en-IN')}`;
    }

    // Populate Top Selling Products List
    function populateProducts(data) {
        const list = document.getElementById('topProductsList');
        if (!list) return;
        list.innerHTML = '';

        if (!data.topProducts || data.topProducts.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:1.5rem; font-size:0.7rem; color:#94a3b8;"><i class="fa-solid fa-ban" style="font-size:1.5rem; margin-bottom:0.5rem; display:block;"></i>No Top Products Found</div>`;
            return;
        }

        const maxQty = Math.max(...data.topProducts.map(p => parseInt(p.total_qty) || 1), 1);
        data.topProducts.forEach(prod => {
            const pct = Math.round((parseInt(prod.total_qty) / maxQty) * 100);
            const item = document.createElement('div');
            item.style.marginBottom = '0.35rem';
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-size:0.6rem; font-weight:700; color:#475569;">
                    <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:70%;">${prod.name}</span>
                    <span style="color:#0f172a;">${parseFloat(prod.total_qty).toLocaleString()}</span>
                </div>
                <div style="height:4px; background:#f1f5f9; border-radius:2px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:#10b981; border-radius:2px;"></div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    // Populate Campaign, WhatsApp & Dealer Panels
    function populatePanels(data) {
        // Campaigns
        document.getElementById('campSpend').textContent = `₹${parseFloat(data.campaign.spend).toLocaleString('en-IN')}`;
        document.getElementById('campROI').textContent = `${data.campaign.roi}%`;
        document.getElementById('campCPL').textContent = `₹${parseFloat(data.campaign.cpl).toLocaleString('en-IN')}`;
        document.getElementById('campLeads').textContent = parseFloat(data.campaign.leads).toLocaleString();
        document.getElementById('campTopName').textContent = data.campaign.topName || 'N/A';

        // WhatsApp
        document.getElementById('waReceived').textContent = parseFloat(data.whatsapp.received).toLocaleString();
        document.getElementById('waReplyRate').textContent = `${data.whatsapp.replyRate}%`;
        document.getElementById('waUnread').textContent = parseFloat(data.whatsapp.unread).toLocaleString();
        document.getElementById('waReadRate').textContent = `${data.whatsapp.readRate}%`;

        // Dealers
        document.getElementById('dealerActive').textContent = parseFloat(data.dealer.activeDealers).toLocaleString();
        document.getElementById('dealerOrders').textContent = parseFloat(data.dealer.orders).toLocaleString();
        document.getElementById('dealerRevenue').textContent = `₹${parseFloat(data.dealer.revenue).toLocaleString('en-IN')}`;
    }

    // Populate Alerts & Notifications List
    function populateAlerts(data) {
        const stream = document.getElementById('alertStream');
        if (!stream) return;
        stream.innerHTML = '';

        if (!data.alerts || data.alerts.length === 0) {
            stream.innerHTML = `<div style="text-align:center; padding:1.5rem; font-size:0.7rem; color:#94a3b8;"><i class="fa-solid fa-bell-slash" style="font-size:1.5rem; margin-bottom:0.5rem; display:block;"></i>No New Notifications</div>`;
            return;
        }

        data.alerts.forEach(log => {
            const item = document.createElement('div');
            let typeClass = 'info';
            let icon = 'fa-info-circle';
            if (log.module === 'Inventory') {
                typeClass = 'warning';
                icon = 'fa-triangle-exclamation';
            } else if (log.module === 'Billing') {
                typeClass = 'success';
                icon = 'fa-file-invoice-dollar';
            } else if (log.action && log.action.includes('Converted')) {
                typeClass = 'success';
                icon = 'fa-check-circle';
            } else if (log.action && (log.action.includes('adjustment') || log.action.includes('OUT'))) {
                typeClass = 'danger';
                icon = 'fa-arrow-down-wide-short';
            }

            const timeStr = new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            item.className = `alert-item ${typeClass}`;
            item.innerHTML = `
                <i class="fa-solid ${icon}" style="margin-top:2px; font-size:0.8rem;"></i>
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:700; color:#1e293b; font-size:0.65rem;">${log.module || 'System'}</span>
                        <span style="color:#94a3b8; font-size:0.55rem; font-weight:600; margin-left:auto;">${timeStr}</span>
                    </div>
                    <p style="margin:0; color:#64748b; line-height:1.2; font-size:0.6rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${log.details || log.action}</p>
                </div>
            `;
            stream.appendChild(item);
        });
    }

    // Chart 1: Horizontal Bar for Telecaller Performance
    function initTelecallersChart(performance = []) {
        const ctx = document.getElementById('telecallerPerformanceChart');
        if (!ctx) return;

        if (charts.telecallers) { charts.telecallers.destroy(); }
        const isDealerMode = localStorage.getItem('dealerMode') === 'true';

        const names = performance.map(p => p.name || 'Unknown');
        const assigned = performance.map(p => p.assigned || 0);
        const contacted = performance.map(p => p.contacted || 0);
        const converted = performance.map(p => p.converted || 0);

        charts.telecallers = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: names,
                datasets: [
                    { label: isDealerMode ? 'Total Orders' : 'Assigned', data: assigned, backgroundColor: '#3b82f6', borderRadius: 4 },
                    { label: isDealerMode ? 'In Process' : 'Contacted', data: contacted, backgroundColor: '#10b981', borderRadius: 4 },
                    { label: isDealerMode ? 'Completed' : 'Converted', data: converted, backgroundColor: '#8b5cf6', borderRadius: 4 }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 10, font: { size: 9 }, padding: 8 } }
                },
                scales: {
                    x: { stacked: false, grid: { display: false }, ticks: { font: { size: 8 } } },
                    y: { stacked: false, grid: { display: false }, ticks: { font: { size: 8 } } }
                }
            }
        });
    }

    // Chart 2: Doughnut for Lead Status
    function initStatusChart(data) {
        const ctx = document.getElementById('leadStatusChart');
        if (!ctx) return;

        if (charts.status) { charts.status.destroy(); }

        const isDealerMode = localStorage.getItem('dealerMode') === 'true';
        let statusMap = {};
        if (isDealerMode) {
            statusMap = {
                'draft': { label: 'Draft', color: '#64748b' },
                'in_review': { label: 'In Review', color: '#f59e0b' },
                'billed': { label: 'Billed', color: '#3b82f6' },
                'packed': { label: 'Packed', color: '#8b5cf6' },
                'shipped': { label: 'Shipped', color: '#10b981' },
                'delivered': { label: 'Delivered', color: '#ec4899' },
                'cancelled': { label: 'Cancelled', color: '#ef4444' }
            };
        } else {
            statusMap = {
                'new': { label: 'New', color: '#3b82f6' },
                'contacted': { label: 'Contacted', color: '#10b981' },
                'interested': { label: 'Interested', color: '#f59e0b' },
                'followup': { label: 'Follow-up', color: '#8b5cf6' },
                'converted': { label: 'Converted', color: '#ec4899' },
                'lost': { label: 'Lost', color: '#ef4444' }
            };
        }

        const labels = [];
        const counts = [];
        const colors = [];
        let total = 0;

        (data.funnel || []).forEach(item => {
            const meta = statusMap[item.status];
            if (meta) {
                labels.push(`${meta.label} (${item.count})`);
                counts.push(item.count);
                colors.push(meta.color);
                total += item.count;
            }
        });

        // Set center label count
        document.getElementById('statusCenterValue').textContent = total;
        const centerLabel = document.getElementById('statusCenterLabel');
        if (centerLabel) centerLabel.textContent = isDealerMode ? 'TOTAL ORDERS' : 'TOTAL LEADS';

        if (counts.length === 0) {
            charts.status = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Data'],
                    datasets: [{ data: [1], backgroundColor: ['#f1f5f9'] }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    cutout: '75%'
                }
            });
            return;
        }

        charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 8, font: { size: 8 }, usePointStyle: true, padding: 6 }
                    }
                },
                cutout: '75%'
            }
        });
    }

    // Chart 3: Doughnut for Locations
    function initLocationChart(data) {
        const ctx = document.getElementById('leadLocationChart');
        if (!ctx) return;

        if (charts.location) { charts.location.destroy(); }
        const isDealerMode = localStorage.getItem('dealerMode') === 'true';

        const distribution = data.locationDistribution || [];
        const labels = [];
        const counts = [];
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#94a3b8'];
        let total = 0;

        distribution.forEach((item, idx) => {
            labels.push(`${item.city} (${item.count})`);
            counts.push(item.count);
            total += item.count;
        });

        document.getElementById('locationCenterValue').textContent = total;
        const locationCenterLabel = document.getElementById('locationCenterLabel');
        if (locationCenterLabel) locationCenterLabel.textContent = isDealerMode ? 'DEALERS' : 'LEADS';

        if (counts.length === 0) {
            charts.location = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Data'],
                    datasets: [{ data: [1], backgroundColor: ['#f1f5f9'] }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    cutout: '75%'
                }
            });
            return;
        }

        charts.location = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: colors.slice(0, counts.length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 8, font: { size: 8 }, usePointStyle: true, padding: 6 }
                    }
                },
                cutout: '75%'
            }
        });
    }

    // Chart 4: Multi-Line for Operations Summary Trend (Last 7 Days)
    function initOpsChart(trends) {
        const ctx = document.getElementById('opsTrendChart');
        if (!ctx) return;

        if (charts.ops) { charts.ops.destroy(); }

        // Align daily trends
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        const labels = days.map(d => {
            const parts = d.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
        });

        const receivedData = days.map(d => {
            const found = (trends.received || []).find(r => r.date.split('T')[0] === d);
            return found ? found.count : 0;
        });
        const packedData = days.map(d => {
            const found = (trends.packed || []).find(p => p.date.split('T')[0] === d);
            return found ? found.count : 0;
        });
        const shippedData = days.map(d => {
            const found = (trends.shipped || []).find(s => s.date.split('T')[0] === d);
            return found ? found.count : 0;
        });

        charts.ops = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Received', data: receivedData, borderColor: '#3b82f6', tension: 0.3, borderWidth: 2, pointRadius: 2, fill: false },
                    { label: 'Packed', data: packedData, borderColor: '#f59e0b', tension: 0.3, borderWidth: 2, pointRadius: 2, fill: false },
                    { label: 'Shipped', data: shippedData, borderColor: '#10b981', tension: 0.3, borderWidth: 2, pointRadius: 2, fill: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { boxWidth: 8, font: { size: 7.5 }, padding: 4 } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 7.5 } } },
                    y: { grid: { display: false }, ticks: { font: { size: 7.5 } } }
                }
            }
        });
    }

    // Chart 5: Line for Revenue Overview Trend
    function initRevenueChart(trend = []) {
        const ctx = document.getElementById('revTrendChart');
        if (!ctx) return;

        if (charts.revenue) { charts.revenue.destroy(); }

        const labels = trend.map(t => {
            const parts = t.date.split('T')[0].split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]}`;
        });
        const totals = trend.map(t => parseFloat(t.total) || 0);

        charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue Trend',
                    data: totals,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 7.5 } } },
                    y: { grid: { display: false }, ticks: { font: { size: 7.5 } } }
                }
            }
        });
    }
});
