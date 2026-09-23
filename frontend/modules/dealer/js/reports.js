// ============================================================
// reports.js — Dealer Reports & Analytics Script
// ============================================================

const API_BASE = `${window.API_URL}/dealers`;
const token = () => localStorage.getItem('token') || '';

let allDealersData = [];
let allOrdersData = [];
let salesChartInstance = null;
let orderStatusChartInstance = null;
let paymentTypeChartInstance = null;
let currentMetricView = 'sales'; // 'sales' or 'orders'
let currentChartRange = 'month';

document.addEventListener('DOMContentLoaded', async () => {
    if (window.requireAuth && !window.requireAuth(['admin', 'super-admin', 'dealer', 'dealer_manager', 'dealer_executive', 'dealer_viewer'], 'dealer_reports')) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const profileElem = document.getElementById('profileName');
    if (profileElem) profileElem.textContent = user.name || user.email || 'admin';

    // Leave date inputs empty by default so All Dealers shows all dealer records & lifetime order stats
    const startDateInput = document.getElementById('repStartDate');
    const endDateInput = document.getElementById('repEndDate');
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';

    initOverviewCharts();
    await loadReportsData();
});

async function loadReportsData() {
    try {
        const [dealersRes, ordersRes] = await Promise.all([
            fetch(API_BASE, { headers: { 'Authorization': `Bearer ${token()}` } }),
            fetch(`${API_BASE}/orders`, { headers: { 'Authorization': `Bearer ${token()}` } })
        ]);

        if (dealersRes.ok) {
            allDealersData = await dealersRes.json();
        }
        if (ordersRes.ok) {
            allOrdersData = await ordersRes.json();
        }
    } catch (e) {
        console.error('Error fetching reports data:', e);
    }

    populateFilterDropdowns();
    updateSummaryMetrics();
    renderRecentOrdersTable();
    updateTopDealersTable();
    updateTopProductsTable();
    updateChartsData();
}

function populateFilterDropdowns() {
    const dealerSelect = document.getElementById('repDealerSelect');
    if (dealerSelect && allDealersData.length > 0) {
        const currentVal = dealerSelect.value;
        const optionsHTML = ['<option value="">All Dealers</option>']
            .concat(allDealersData.map(d => `<option value="${d.dealer_id}">${d.firm_name || d.dealer_name}</option>`))
            .join('');
        dealerSelect.innerHTML = optionsHTML;
        if (currentVal) dealerSelect.value = currentVal;
    }

    const salespersonSelect = document.getElementById('repSalespersonSelect');
    if (salespersonSelect) {
        const currentVal = salespersonSelect.value;
        const salespersons = new Set();
        allDealersData.forEach(d => { if (d.visited_by) salespersons.add(d.visited_by.trim()); });
        allOrdersData.forEach(o => { 
            const sp = o.created_by_name || o.salesperson_name || o.visited_by;
            if (sp) salespersons.add(sp.trim()); 
        });
        
        let spHtml = '<option value="">All Salespersons</option>';
        salespersons.forEach(sp => {
            spHtml += `<option value="${sp}">${sp}</option>`;
        });
        salespersonSelect.innerHTML = spHtml;
        if (currentVal) salespersonSelect.value = currentVal;
    }

    const productSelect = document.getElementById('repProductSelect');
    if (productSelect) {
        const currentVal = productSelect.value;
        const products = new Set();
        allOrdersData.forEach(o => {
            if (o.items_summary) {
                const items = o.items_summary.split('||');
                items.forEach(i => {
                    const pName = i.split(' x ')[0].trim();
                    if (pName) products.add(pName);
                });
            }
        });

        let prHtml = '<option value="">All Products</option>';
        products.forEach(p => {
            prHtml += `<option value="${p}">${p}</option>`;
        });
        productSelect.innerHTML = prHtml;
        if (currentVal) productSelect.value = currentVal;
    }
}

function getFilteredData() {
    const selectedDealerId = document.getElementById('repDealerSelect')?.value || '';
    const startDateVal = document.getElementById('repStartDate')?.value || '';
    const endDateVal = document.getElementById('repEndDate')?.value || '';
    const selectedSalesperson = document.getElementById('repSalespersonSelect')?.value || '';
    const selectedProduct = document.getElementById('repProductSelect')?.value || '';

    // Filter Dealers list
    let filteredDealers = allDealersData;
    if (selectedDealerId) {
        filteredDealers = allDealersData.filter(d => String(d.dealer_id) === String(selectedDealerId));
    }

    // Filter Orders list
    let filteredOrders = allOrdersData.filter(o => (o.order_status || '').toLowerCase() !== 'cancelled');

    if (selectedDealerId) {
        filteredOrders = filteredOrders.filter(o => String(o.dealer_id) === String(selectedDealerId));
    }

    if (startDateVal) {
        const sTime = new Date(startDateVal + 'T00:00:00').getTime();
        filteredOrders = filteredOrders.filter(o => {
            const oTime = new Date(o.created_at || 0).getTime();
            return oTime >= sTime;
        });
    }

    if (endDateVal) {
        const eTime = new Date(endDateVal + 'T23:59:59').getTime();
        filteredOrders = filteredOrders.filter(o => {
            const oTime = new Date(o.created_at || 0).getTime();
            return oTime <= eTime;
        });
    }

    if (selectedSalesperson) {
        const spLower = selectedSalesperson.toLowerCase();
        filteredOrders = filteredOrders.filter(o => {
            const name = (o.created_by_name || o.salesperson_name || o.visited_by || '').toLowerCase();
            return name.includes(spLower);
        });
    }

    if (selectedProduct) {
        const pLower = selectedProduct.toLowerCase();
        filteredOrders = filteredOrders.filter(o => {
            const summary = (o.items_summary || '').toLowerCase();
            return summary.includes(pLower);
        });
    }

    return {
        dealers: filteredDealers,
        orders: filteredOrders
    };
}

function updateSummaryMetrics() {
    const { dealers, orders } = getFilteredData();

    const totalDealers = dealers.length;
    const activeDealers = dealers.filter(d => (d.status || '').toLowerCase() === 'active').length;
    const totalOrders = orders.length;

    let totalSalesSum = 0;
    let totalPaidSum = 0;

    orders.forEach(o => {
        totalSalesSum += parseFloat(o.total_amount || 0);
        totalPaidSum += parseFloat(o.advance_amount || 0);
    });

    const outstanding = Math.max(0, totalSalesSum - totalPaidSum);
    const avgOrderVal = totalOrders > 0 ? Math.round(totalSalesSum / totalOrders) : 0;

    const elTotalDealers = document.getElementById('statTotalDealers');
    const elActiveDealers = document.getElementById('statActiveDealers');
    const elTotalOrders = document.getElementById('statTotalOrders');
    const elTotalSales = document.getElementById('statTotalSales');
    const elAmountCollected = document.getElementById('statAmountCollected');
    const elOutstanding = document.getElementById('statOutstanding');

    if (elTotalDealers) elTotalDealers.textContent = totalDealers;
    if (elActiveDealers) elActiveDealers.textContent = activeDealers;
    if (elTotalOrders) elTotalOrders.textContent = totalOrders;
    if (elTotalSales) elTotalSales.textContent = `₹${totalSalesSum.toLocaleString('en-IN')}`;
    if (elAmountCollected) elAmountCollected.textContent = `₹${totalPaidSum.toLocaleString('en-IN')}`;
    if (elOutstanding) elOutstanding.textContent = `₹${outstanding.toLocaleString('en-IN')}`;

    // Summary Card Details
    const elSumSales = document.getElementById('summaryTotalSales');
    const elSumPaid = document.getElementById('summaryTotalPaid');
    const elSumOut = document.getElementById('summaryOutstanding');
    const elSumOrders = document.getElementById('summaryTotalOrders');
    const elSumAvg = document.getElementById('summaryAvgOrderVal');

    if (elSumSales) elSumSales.textContent = `₹${totalSalesSum.toLocaleString('en-IN')}`;
    if (elSumPaid) elSumPaid.textContent = `₹${totalPaidSum.toLocaleString('en-IN')}`;
    if (elSumOut) elSumOut.textContent = `₹${outstanding.toLocaleString('en-IN')}`;
    if (elSumOrders) elSumOrders.textContent = totalOrders;
    if (elSumAvg) elSumAvg.textContent = `₹${avgOrderVal.toLocaleString('en-IN')}`;
}

function initOverviewCharts() {
    // 1. Sales & Orders Overview Chart
    const ctxSales = document.getElementById('salesOverviewChart')?.getContext('2d');
    if (ctxSales) {
        salesChartInstance = new Chart(ctxSales, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Sales (₹)',
                        data: [],
                        backgroundColor: 'rgba(59, 130, 246, 0.35)',
                        borderColor: '#3B82F6',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Orders',
                        data: [],
                        type: 'line',
                        borderColor: '#10B981',
                        backgroundColor: '#10B981',
                        pointRadius: 4,
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        position: 'left',
                        beginAtZero: true,
                        ticks: { callback: value => value >= 1000 ? (value / 1000) + 'K' : value }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        grid: { display: false },
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // 2. Order Status Donut Chart
    const ctxStatus = document.getElementById('orderStatusChart')?.getContext('2d');
    if (ctxStatus) {
        orderStatusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Ordered', 'Shipped', 'Delivered'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#FF6B00', '#3B82F6', '#10B981'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '76%',
                plugins: { legend: { display: false } }
            }
        });
    }

    // 3. Payment Type Donut Chart
    const ctxPay = document.getElementById('paymentTypeChart')?.getContext('2d');
    if (ctxPay) {
        paymentTypeChartInstance = new Chart(ctxPay, {
            type: 'doughnut',
            data: {
                labels: ['Full Payment', 'Partial Payment', 'No Advance'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#10B981', '#FF6B00', '#EF4444'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '76%',
                plugins: { legend: { display: false } }
            }
        });
    }
}

function updateChartsData() {
    updateOverviewTrendChart(currentChartRange);
    updateOrderStatusChart();
    updatePaymentTypeChart();
}

function updateOrderStatusChart() {
    if (!orderStatusChartInstance) return;
    const { orders } = getFilteredData();
    const total = orders.length;

    const countOrdered = orders.filter(o => ['ordered', 'draft', 'in_review'].includes((o.order_status || '').toLowerCase())).length;
    const countShipped = orders.filter(o => (o.order_status || '').toLowerCase() === 'shipped').length;
    const countDelivered = orders.filter(o => (o.order_status || '').toLowerCase() === 'delivered').length;

    orderStatusChartInstance.data.datasets[0].data = [countOrdered, countShipped, countDelivered];
    orderStatusChartInstance.update();

    const donutCountEl = document.getElementById('donutTotalOrdersCount');
    if (donutCountEl) donutCountEl.textContent = total;

    // Update legend UI text dynamically
    const legendContainer = document.getElementById('orderStatusChart')?.closest('.card-box')?.querySelector('div[style*="flex-direction:column;gap:0.5rem"]');
    if (legendContainer) {
        const pOrdered = total > 0 ? ((countOrdered / total) * 100).toFixed(1) : '0.0';
        const pShipped = total > 0 ? ((countShipped / total) * 100).toFixed(1) : '0.0';
        const pDelivered = total > 0 ? ((countDelivered / total) * 100).toFixed(1) : '0.0';

        legendContainer.innerHTML = `
            <div style="display:flex;justify-content: space-between;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;color:#475569;font-weight:600;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#FF6B00;display:inline-block;"></span> Ordered
                </span>
                <span style="font-weight:700;color:#0f172a;">${countOrdered} (${pOrdered}%)</span>
            </div>
            <div style="display:flex;justify-content: space-between;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;color:#475569;font-weight:600;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#3B82F6;display:inline-block;"></span> Shipped
                </span>
                <span style="font-weight:700;color:#0f172a;">${countShipped} (${pShipped}%)</span>
            </div>
            <div style="display:flex;justify-content: space-between;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;color:#475569;font-weight:600;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#10B981;display:inline-block;"></span> Delivered
                </span>
                <span style="font-weight:700;color:#0f172a;">${countDelivered} (${pDelivered}%)</span>
            </div>
        `;
    }
}

function updatePaymentTypeChart() {
    if (!paymentTypeChartInstance) return;
    const { orders } = getFilteredData();
    const total = orders.length;

    let fullCount = 0;
    let partialCount = 0;
    let noAdvanceCount = 0;

    orders.forEach(o => {
        const tot = parseFloat(o.total_amount || 0);
        const paid = parseFloat(o.advance_amount || 0);
        if (paid >= tot && tot > 0) {
            fullCount++;
        } else if (paid > 0) {
            partialCount++;
        } else {
            noAdvanceCount++;
        }
    });

    paymentTypeChartInstance.data.datasets[0].data = [fullCount, partialCount, noAdvanceCount];
    paymentTypeChartInstance.update();

    const donutPayCountEl = document.getElementById('donutPaymentTotalCount');
    if (donutPayCountEl) donutPayCountEl.textContent = total;

    // Update payment summary legend UI text dynamically
    const legendContainer = document.getElementById('paymentTypeChart')?.closest('.card-box')?.querySelector('div[style*="flex-direction:column;gap:0.5rem"]');
    if (legendContainer) {
        const pFull = total > 0 ? ((fullCount / total) * 100).toFixed(1) : '0.0';
        const pPartial = total > 0 ? ((partialCount / total) * 100).toFixed(1) : '0.0';
        const pNo = total > 0 ? ((noAdvanceCount / total) * 100).toFixed(1) : '0.0';

        legendContainer.innerHTML = `
            <div style="display:flex;justify-content: space-between;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;color:#475569;font-weight:600;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#10B981;display:inline-block;"></span> Full Payment
                </span>
                <span style="font-weight:700;color:#0f172a;">${fullCount} (${pFull}%)</span>
            </div>
            <div style="display:flex;justify-content: space-between;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;color:#475569;font-weight:600;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#FF6B00;display:inline-block;"></span> Partial Payment
                </span>
                <span style="font-weight:700;color:#0f172a;">${partialCount} (${pPartial}%)</span>
            </div>
            <div style="display:flex;justify-content: space-between;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;color:#475569;font-weight:600;">
                    <span style="width:10px;height:10px;border-radius:50%;background:#EF4444;display:inline-block;"></span> No Advance
                </span>
                <span style="font-weight:700;color:#0f172a;">${noAdvanceCount} (${pNo}%)</span>
            </div>
        `;
    }
}

function updateOverviewTrendChart(range) {
    if (!salesChartInstance) return;

    const { orders } = getFilteredData();
    const now = new Date();
    let startDate = new Date();

    if (range === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else if (range === '3m') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (range === '6m') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } else if (range === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    // Build bucket labels and maps
    let labels = [];
    let salesMap = {};
    let ordersMap = {};

    if (range === 'month' || range === 'last_month') {
        const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
        const monthShort = startDate.toLocaleDateString('en-US', { month: 'short' });
        
        for (let day = 1; day <= daysInMonth; day += 5) {
            const label = `${String(day).padStart(2, '0')} ${monthShort}`;
            labels.push(label);
            salesMap[label] = 0;
            ordersMap[label] = 0;
        }

        orders.forEach(o => {
            const oDate = new Date(o.created_at || Date.now());
            if (oDate.getMonth() === startDate.getMonth() && oDate.getFullYear() === startDate.getFullYear()) {
                const day = oDate.getDate();
                const bucketDay = Math.min(daysInMonth, Math.floor((day - 1) / 5) * 5 + 1);
                const label = `${String(bucketDay).padStart(2, '0')} ${monthShort}`;
                if (salesMap[label] !== undefined) {
                    salesMap[label] += parseFloat(o.total_amount || 0);
                    ordersMap[label] += 1;
                }
            }
        });
    } else {
        const monthsCount = range === '3m' ? 3 : (range === '6m' ? 6 : 12);
        for (let i = monthsCount - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleDateString('en-US', { month: 'short' });
            labels.push(label);
            salesMap[label] = 0;
            ordersMap[label] = 0;
        }

        orders.forEach(o => {
            const oDate = new Date(o.created_at || Date.now());
            const label = oDate.toLocaleDateString('en-US', { month: 'short' });
            if (salesMap[label] !== undefined) {
                salesMap[label] += parseFloat(o.total_amount || 0);
                ordersMap[label] += 1;
            }
        });
    }

    salesChartInstance.data.labels = labels;
    salesChartInstance.data.datasets[0].data = labels.map(l => salesMap[l] || 0);
    salesChartInstance.data.datasets[1].data = labels.map(l => ordersMap[l] || 0);

    if (currentMetricView === 'sales') {
        salesChartInstance.data.datasets[0].hidden = false;
        salesChartInstance.data.datasets[1].hidden = false;
    } else {
        salesChartInstance.data.datasets[0].hidden = true;
        salesChartInstance.data.datasets[1].hidden = false;
    }
    salesChartInstance.update();
}

function switchChartTimeTab(range, btnEl) {
    currentChartRange = range;
    const parent = btnEl.closest('.pill-tabs');
    if (parent) {
        parent.querySelectorAll('.pill-tab-btn').forEach(b => b.classList.remove('active'));
    }
    btnEl.classList.add('active');
    updateOverviewTrendChart(range);
}

function toggleOverviewMetric(metricType) {
    currentMetricView = metricType;
    const btnSales = document.getElementById('btnToggleSales');
    const btnOrders = document.getElementById('btnToggleOrders');

    if (metricType === 'sales') {
        if (btnSales) btnSales.classList.add('active');
        if (btnOrders) btnOrders.classList.remove('active');
    } else {
        if (btnOrders) btnOrders.classList.add('active');
        if (btnSales) btnSales.classList.remove('active');
    }
    updateChartsData();
}

function renderRecentOrdersTable() {
    const tbody = document.getElementById('recentOrdersTbody');
    if (!tbody) return;

    const { orders } = getFilteredData();

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding:2rem;text-align:center;color:#64748b;">No recent dealer orders found matching selected filters.</td>
            </tr>`;
        return;
    }

    const recent = orders.slice(0, 8);
    tbody.innerHTML = recent.map(o => {
        const orderIdCode = typeof window.formatOrderId === 'function' ? window.formatOrderId(o.order_id, o.created_at) : `#SGB-${o.order_id}`;
        const dealerName = o.dealer_name || o.firm_name || o.customer_name || 'Dealer Store';
        const orderDate = new Date(o.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const total = parseFloat(o.total_amount || 0);
        const paid = parseFloat(o.advance_amount || 0);
        const balance = Math.max(0, total - paid);

        let statusBg = '#fff7ed';
        let statusColor = '#ea580c';
        let statusText = 'Ordered';

        const st = (o.order_status || '').toLowerCase();
        if (st === 'shipped') {
            statusBg = '#eff6ff';
            statusColor = '#2563eb';
            statusText = 'Shipped';
        } else if (st === 'delivered') {
            statusBg = '#ecfdf5';
            statusColor = '#059669';
            statusText = 'Delivered';
        }

        return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:0.85rem 1rem;font-weight:700;color:#0f172a;white-space:nowrap;">${orderIdCode}</td>
                <td style="padding:0.85rem 1rem;font-weight:600;">${dealerName}</td>
                <td style="padding:0.85rem 1rem;color:#64748b;">${orderDate}</td>
                <td style="padding:0.85rem 1rem;text-align:right;font-weight:700;">₹${total.toLocaleString('en-IN')}</td>
                <td style="padding:0.85rem 1rem;text-align:right;color:#10b981;font-weight:700;">₹${paid.toLocaleString('en-IN')}</td>
                <td style="padding:0.85rem 1rem;text-align:right;color:${balance > 0 ? '#ef4444' : '#10b981'};font-weight:700;">₹${balance.toLocaleString('en-IN')}</td>
                <td style="padding:0.85rem 1rem;text-align:center;"><span class="status-pill" style="background:${statusBg};color:${statusColor};padding:3px 8px;border-radius:6px;font-weight:700;font-size:0.75rem;">${statusText}</span></td>
                <td style="padding:0.85rem 1rem;color:#475569;">${o.delivery_type || 'Post office COD'}</td>
            </tr>
        `;
    }).join('');
}

function updateTopProductsTable() {
    const tbody = document.getElementById('topSellingProductsTbody');
    if (!tbody) return;

    const { orders } = getFilteredData();

    const productMap = new Map();
    orders.forEach(o => {
        if (o.items_detailed) {
            const items = o.items_detailed.split('||');
            items.forEach(itemStr => {
                const parts = itemStr.split('::');
                if (parts.length >= 2) {
                    const pName = parts[0].trim();
                    const qty = parseInt(parts[1].trim()) || 1;
                    const price = parseFloat(parts[2] || 0);
                    const total = parseFloat(parts[3] || (qty * price));
                    if (!productMap.has(pName)) {
                        productMap.set(pName, { qty: 0, sales: 0 });
                    }
                    const itemData = productMap.get(pName);
                    itemData.qty += qty;
                    itemData.sales += total;
                }
            });
        } else if (o.items_summary) {
            const items = o.items_summary.split('||');
            items.forEach(itemStr => {
                const parts = itemStr.split(' x ');
                if (parts.length === 2) {
                    const pName = parts[0].trim();
                    const qty = parseInt(parts[1].trim()) || 0;
                    if (!productMap.has(pName)) {
                        productMap.set(pName, { qty: 0, sales: 0 });
                    }
                    const itemData = productMap.get(pName);
                    itemData.qty += qty;
                    itemData.sales += (parseFloat(o.total_amount || 0) / Math.max(1, items.length));
                }
            });
        }
    });

    if (productMap.size === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center;padding:1.5rem;color:#64748b;">No product sales data available for selected filters.</td>
            </tr>`;
        return;
    }

    const sortedProducts = Array.from(productMap.entries())
        .map(([name, stat]) => ({ name, qty: stat.qty, sales: Math.round(stat.sales) }))
        .sort((a, b) => b.qty - a.qty);

    const colors = ['#FF6B00', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'];

    tbody.innerHTML = sortedProducts.map((p, idx) => `
        <tr>
            <td style="font-weight:700;color:#0f172a;"><i class="fa-solid fa-cubes" style="color:${colors[idx % colors.length]};margin-right:6px;"></i> ${p.name}</td>
            <td style="text-align:center;font-weight:700;">${p.qty}</td>
            <td style="text-align:right;font-weight:800;color:#0f172a;">₹${p.sales.toLocaleString('en-IN')}</td>
        </tr>
    `).join('');
}

function updateTopDealersTable() {
    const tbody = document.getElementById('topDealersTbody');
    if (!tbody) return;

    const { dealers, orders } = getFilteredData();

    if (dealers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="padding:1.5rem;text-align:center;color:#64748b;">No dealer performance data available for selected filters.</td>
            </tr>`;
        return;
    }

    const dealersWithStats = dealers.map(d => {
        const dOrders = orders.filter(o => String(o.dealer_id) === String(d.dealer_id));
        const totalPurchased = dOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) || parseFloat(d.total_business || 0);
        const paidAmount = dOrders.reduce((sum, o) => sum + parseFloat(o.advance_amount || 0), 0);
        const outstanding = Math.max(0, totalPurchased - paidAmount);
        return {
            ...d,
            orderCount: dOrders.length || d.order_count || (totalPurchased > 0 ? 1 : 0),
            totalPurchased,
            paidAmount,
            outstanding
        };
    });

    const sorted = dealersWithStats.sort((a, b) => b.totalPurchased - a.totalPurchased).slice(0, 5);

    tbody.innerHTML = sorted.map(d => {
        const dealerName = d.firm_name || d.dealer_name || 'Dealer Store';
        return `
            <tr>
                <td style="font-weight:700;color:#0f172a;"><i class="fa-solid fa-store" style="color:#FF6B00;margin-right:6px;"></i> ${dealerName}</td>
                <td style="text-align:center;font-weight:700;">${d.orderCount}</td>
                <td style="text-align:right;font-weight:700;">₹${d.totalPurchased.toLocaleString('en-IN')}</td>
                <td style="text-align:right;font-weight:700;color:#10b981;">₹${d.paidAmount.toLocaleString('en-IN')}</td>
                <td style="text-align:right;font-weight:800;color:${d.outstanding > 0 ? '#ef4444' : '#10b981'};">₹${d.outstanding.toLocaleString('en-IN')}</td>
            </tr>
        `;
    }).join('');
}

function applyReportsFilters() {
    updateSummaryMetrics();
    renderRecentOrdersTable();
    updateTopDealersTable();
    updateTopProductsTable();
    updateChartsData();
}

function resetReportsFilters() {
    const dealerSelect = document.getElementById('repDealerSelect');
    const salespersonSelect = document.getElementById('repSalespersonSelect');
    const productSelect = document.getElementById('repProductSelect');
    const startDateInput = document.getElementById('repStartDate');
    const endDateInput = document.getElementById('repEndDate');

    if (dealerSelect) dealerSelect.value = '';
    if (salespersonSelect) salespersonSelect.value = '';
    if (productSelect) productSelect.value = '';
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';

    applyReportsFilters();
}

function exportReportsAnalytics() {
    const { dealers, orders } = getFilteredData();

    if ((!dealers || dealers.length === 0) && (!orders || orders.length === 0)) {
        if (window.showAlert) {
            window.showAlert('Export Notice', 'No data available to export based on current filters.', 'info');
        } else {
            alert('No data available to export based on current filters.');
        }
        return;
    }

    const sanitizeCell = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const startDateVal = document.getElementById('repStartDate')?.value || '';
    const endDateVal = document.getElementById('repEndDate')?.value || '';
    const dealerSelect = document.getElementById('repDealerSelect');
    const dealerText = dealerSelect && dealerSelect.selectedIndex >= 0 ? dealerSelect.options[dealerSelect.selectedIndex].text : 'All Dealers';
    const salespersonSelect = document.getElementById('repSalespersonSelect');
    const salespersonText = salespersonSelect && salespersonSelect.selectedIndex >= 0 ? salespersonSelect.options[salespersonSelect.selectedIndex].text : 'All Salespersons';
    const productSelect = document.getElementById('repProductSelect');
    const productText = productSelect && productSelect.selectedIndex >= 0 ? productSelect.options[productSelect.selectedIndex].text : 'All Products';

    let dateRangeStr = 'All Time';
    if (startDateVal && endDateVal) {
        dateRangeStr = `${startDateVal} to ${endDateVal}`;
    } else if (startDateVal) {
        dateRangeStr = `From ${startDateVal}`;
    } else if (endDateVal) {
        dateRangeStr = `Until ${endDateVal}`;
    }

    // Metrics calculation
    const totalDealers = dealers.length;
    const activeDealers = dealers.filter(d => (d.status || '').toLowerCase() === 'active').length;
    const totalOrders = orders.length;

    let totalSalesSum = 0;
    let totalPaidSum = 0;

    orders.forEach(o => {
        totalSalesSum += parseFloat(o.total_amount || 0);
        totalPaidSum += parseFloat(o.advance_amount || 0);
    });

    const outstanding = Math.max(0, totalSalesSum - totalPaidSum);
    const avgOrderVal = totalOrders > 0 ? Math.round(totalSalesSum / totalOrders) : 0;

    const rows = [];

    // Metadata Header
    rows.push([sanitizeCell('SGB AGRO - REPORTS & ANALYTICS REPORT')]);
    rows.push([sanitizeCell(`Export Date: ${new Date().toLocaleString('en-IN')}`)]);
    rows.push([
        sanitizeCell(`Date Range: ${dateRangeStr}`),
        sanitizeCell(`Dealer: ${dealerText}`),
        sanitizeCell(`Salesperson: ${salespersonText}`),
        sanitizeCell(`Product: ${productText}`)
    ].join(','));
    rows.push([]);

    // Executive Summary
    rows.push([sanitizeCell('--- EXECUTIVE SUMMARY ---')]);
    rows.push([
        sanitizeCell('Total Dealers'),
        sanitizeCell('Active Dealers'),
        sanitizeCell('Total Orders'),
        sanitizeCell('Total Sales (INR)'),
        sanitizeCell('Amount Collected (INR)'),
        sanitizeCell('Outstanding Balance (INR)'),
        sanitizeCell('Average Order Value (INR)')
    ].join(','));
    rows.push([
        sanitizeCell(totalDealers),
        sanitizeCell(activeDealers),
        sanitizeCell(totalOrders),
        sanitizeCell(totalSalesSum),
        sanitizeCell(totalPaidSum),
        sanitizeCell(outstanding),
        sanitizeCell(avgOrderVal)
    ].join(','));
    rows.push([]);

    // Orders Breakdown
    rows.push([sanitizeCell('--- ORDERS DETAILS ---')]);
    rows.push([
        sanitizeCell('Order ID'),
        sanitizeCell('Dealer Store / Customer'),
        sanitizeCell('Salesperson / Visited By'),
        sanitizeCell('Order Date'),
        sanitizeCell('Shipped Date'),
        sanitizeCell('Total Amount (INR)'),
        sanitizeCell('Paid Amount (INR)'),
        sanitizeCell('Outstanding (INR)'),
        sanitizeCell('Status'),
        sanitizeCell('Delivery Type'),
        sanitizeCell('Items Summary')
    ].join(','));

    if (orders.length === 0) {
        rows.push([sanitizeCell('No order records match the selected filters.')]);
    } else {
        orders.forEach(o => {
            const orderIdCode = typeof window.formatOrderId === 'function' ? window.formatOrderId(o.order_id, o.created_at) : `#SGB-${o.order_id}`;
            const dealerName = o.dealer_name || o.firm_name || o.customer_name || 'Dealer Store';
            const salesperson = o.created_by_name || o.salesperson_name || o.visited_by || '-';
            const orderDate = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '';

            let shippedDate = '-';
            const rawShipped = o.shipped_date || o.shipped_at || o.dispatch_date;
            if (rawShipped) {
                if (typeof rawShipped === 'string' && rawShipped.includes('-')) {
                    const parts = rawShipped.slice(0, 10).split('-');
                    if (parts.length === 3) {
                        shippedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    } else {
                        shippedDate = new Date(rawShipped).toLocaleDateString('en-GB');
                    }
                } else {
                    shippedDate = new Date(rawShipped).toLocaleDateString('en-GB');
                }
                if (shippedDate === 'Invalid Date') shippedDate = '-';
            }

            const total = parseFloat(o.total_amount || 0);
            const paid = parseFloat(o.advance_amount || 0);
            const bal = Math.max(0, total - paid);
            const items = (o.items_summary || '').replace(/<br\s*\/?>/gi, '; ').replace(/\|\|/g, '; ');

            rows.push([
                sanitizeCell(orderIdCode),
                sanitizeCell(dealerName),
                sanitizeCell(salesperson),
                sanitizeCell(orderDate),
                sanitizeCell(shippedDate),
                sanitizeCell(total),
                sanitizeCell(paid),
                sanitizeCell(bal),
                sanitizeCell((o.order_status || 'Ordered').toUpperCase()),
                sanitizeCell(o.delivery_type || 'Post office COD'),
                sanitizeCell(items)
            ].join(','));
        });
    }
    rows.push([]);

    // Top Selling Products
    rows.push([sanitizeCell('--- TOP SELLING PRODUCTS ---')]);
    rows.push([
        sanitizeCell('Product Name'),
        sanitizeCell('Quantity Sold'),
        sanitizeCell('Total Sales (INR)')
    ].join(','));

    const productMap = new Map();
    orders.forEach(o => {
        if (o.items_detailed) {
            const items = o.items_detailed.split('||');
            items.forEach(itemStr => {
                const parts = itemStr.split('::');
                if (parts.length >= 2) {
                    const pName = parts[0].trim();
                    const qty = parseInt(parts[1].trim()) || 1;
                    const price = parseFloat(parts[2] || 0);
                    const total = parseFloat(parts[3] || (qty * price));
                    if (!productMap.has(pName)) productMap.set(pName, { qty: 0, sales: 0 });
                    const itemData = productMap.get(pName);
                    itemData.qty += qty;
                    itemData.sales += total;
                }
            });
        } else if (o.items_summary) {
            const items = o.items_summary.split('||');
            items.forEach(itemStr => {
                const parts = itemStr.split(' x ');
                if (parts.length === 2) {
                    const pName = parts[0].trim();
                    const qty = parseInt(parts[1].trim()) || 0;
                    if (!productMap.has(pName)) productMap.set(pName, { qty: 0, sales: 0 });
                    const itemData = productMap.get(pName);
                    itemData.qty += qty;
                    itemData.sales += (parseFloat(o.total_amount || 0) / Math.max(1, items.length));
                }
            });
        }
    });

    if (productMap.size === 0) {
        rows.push([sanitizeCell('No product sales data available for selected filters.')]);
    } else {
        const sortedProducts = Array.from(productMap.entries())
            .map(([name, stat]) => ({ name, qty: stat.qty, sales: Math.round(stat.sales) }))
            .sort((a, b) => b.qty - a.qty);

        sortedProducts.forEach(p => {
            rows.push([
                sanitizeCell(p.name),
                sanitizeCell(p.qty),
                sanitizeCell(p.sales)
            ].join(','));
        });
    }
    rows.push([]);

    // Dealer Performance Breakdown
    rows.push([sanitizeCell('--- DEALER PERFORMANCE ---')]);
    rows.push([
        sanitizeCell('Dealer Firm / Name'),
        sanitizeCell('Order Count'),
        sanitizeCell('Total Purchased (INR)'),
        sanitizeCell('Paid Amount (INR)'),
        sanitizeCell('Outstanding Balance (INR)')
    ].join(','));

    if (dealers.length === 0) {
        rows.push([sanitizeCell('No dealer performance data available.')]);
    } else {
        const dealersWithStats = dealers.map(d => {
            const dOrders = orders.filter(o => String(o.dealer_id) === String(d.dealer_id));
            const totalPurchased = dOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) || parseFloat(d.total_business || 0);
            const paidAmount = dOrders.reduce((sum, o) => sum + parseFloat(o.advance_amount || 0), 0);
            const outstanding = Math.max(0, totalPurchased - paidAmount);
            return {
                name: d.firm_name || d.dealer_name || 'Dealer Store',
                orderCount: dOrders.length || d.order_count || (totalPurchased > 0 ? 1 : 0),
                totalPurchased,
                paidAmount,
                outstanding
            };
        }).sort((a, b) => b.totalPurchased - a.totalPurchased);

        dealersWithStats.forEach(d => {
            rows.push([
                sanitizeCell(d.name),
                sanitizeCell(d.orderCount),
                sanitizeCell(d.totalPurchased),
                sanitizeCell(d.paidAmount),
                sanitizeCell(d.outstanding)
            ].join(','));
        });
    }

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `SGB_Agro_Reports_Analytics_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (window.showAlert) {
        window.showAlert('Export Successful', 'Reports & Analytics data exported successfully as CSV!', 'success');
    } else {
        alert('Reports & Analytics data exported successfully as CSV!');
    }
}

window.switchChartTimeTab = switchChartTimeTab;
window.toggleOverviewMetric = toggleOverviewMetric;
window.applyReportsFilters = applyReportsFilters;
window.resetReportsFilters = resetReportsFilters;
window.exportReportsAnalytics = exportReportsAnalytics;

