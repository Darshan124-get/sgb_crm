document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin', 'whatsapp_manager'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'Administrator';

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
        if (tabBtns.length > 0) tabBtns[0].click();
    }
});
