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
let currentPbViewMode = 'single'; // 'single' | 'monthly'
let pbMonthInitialized = false;
let repProductMultiSelect = null;

function getSelectedReportProducts() {
    if (repProductMultiSelect) return repProductMultiSelect.getSelected();
    const el = document.getElementById('repProductSelect');
    if (el && el.tagName === 'SELECT') return el.value ? [el.value] : [];
    return [];
}

function initReportProductMultiSelect() {
    if (repProductMultiSelect || !window.DealerProductMultiSelect) return repProductMultiSelect;
    repProductMultiSelect = window.DealerProductMultiSelect.create('repProductSelect', {
        compact: true,
        placeholder: 'All Products',
        onChange: () => applyReportsFilters()
    });
    return repProductMultiSelect;
}

function isReportsAdminUser() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const role = String(user.role || '').trim().toLowerCase();
        return role === 'admin' || role === 'super-admin' || role === 'super_admin';
    } catch (_) {
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.requireAuth && !window.requireAuth(['admin', 'super-admin', 'dealer', 'dealer_manager', 'dealer_executive', 'dealer_viewer'], 'dealer_reports')) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const profileElem = document.getElementById('profileName');
    if (profileElem) profileElem.textContent = user.name || user.email || 'admin';

    const salespersonSelect = document.getElementById('repSalespersonSelect');
    if (salespersonSelect) {
        if (isReportsAdminUser()) {
            salespersonSelect.style.display = '';
        } else {
            salespersonSelect.style.display = 'none';
            salespersonSelect.value = '';
        }
    }

    // Leave date inputs empty by default so All Dealers shows all dealer records & lifetime order stats
    const startDateInput = document.getElementById('repStartDate');
    const endDateInput = document.getElementById('repEndDate');
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';

    const topSearch = document.getElementById('topNavSearch');
    if (topSearch) {
        topSearch.addEventListener('input', () => renderProductBreakdownTable());
    }

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
    populateProductBreakdownMonthDropdown();
    updateSummaryMetrics();
    renderProductBreakdownTable();
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
    if (salespersonSelect && isReportsAdminUser()) {
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
    } else if (salespersonSelect) {
        salespersonSelect.style.display = 'none';
        salespersonSelect.value = '';
    }

    const productContainer = document.getElementById('repProductSelect');
    if (productContainer) {
        const products = new Set();
        allOrdersData.forEach(o => {
            if (o.items_detailed) {
                o.items_detailed.split('||').forEach(it => {
                    const pName = (it.split('::')[0] || '').trim();
                    if (pName) products.add(pName);
                });
            }
            if (o.items_summary) {
                const items = o.items_summary.split('||');
                items.forEach(i => {
                    const pName = i.split(' x ')[0].trim();
                    if (pName) products.add(pName);
                });
            }
        });

        const ms = initReportProductMultiSelect();
        if (ms) {
            ms.setOptions(Array.from(products));
        }
    }
}

function getFilteredData() {
    const selectedDealerId = document.getElementById('repDealerSelect')?.value || '';
    const startDateVal = document.getElementById('repStartDate')?.value || '';
    const endDateVal = document.getElementById('repEndDate')?.value || '';
    const selectedSalesperson = isReportsAdminUser() ? (document.getElementById('repSalespersonSelect')?.value || '') : '';
    const selectedProducts = getSelectedReportProducts();

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

    if (selectedProducts.length > 0) {
        if (window.DealerProductMultiSelect) {
            filteredOrders = filteredOrders.filter(o => window.DealerProductMultiSelect.orderMatchesProducts(o, selectedProducts));
        } else {
            const pSet = new Set(selectedProducts.map(p => p.toLowerCase()));
            filteredOrders = filteredOrders.filter(o => {
                const summary = (o.items_summary || '').toLowerCase();
                return Array.from(pSet).some(p => summary.includes(p));
            });
        }
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

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getOrderMonthKey(createdAt) {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(ym) {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return 'All Months';
    const [yr, mo] = ym.split('-').map(Number);
    const d = new Date(yr, mo - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Shared parser extracting structured product lines from B2B order rows.
 * Respects optional productFilter so multi-item orders don't inflate unrelated products.
 */
function parseOrderProductItems(order, productFilter = '') {
    const matchesFilter = (itemName) => {
        if (window.DealerProductMultiSelect) {
            return window.DealerProductMultiSelect.itemNameMatchesProducts(itemName, productFilter);
        }
        const list = Array.isArray(productFilter) ? productFilter : (productFilter ? [productFilter] : []);
        const clean = list.map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
        if (clean.length === 0) return true;
        return clean.includes(String(itemName || '').trim().toLowerCase());
    };
    const out = [];

    if (order.items_detailed) {
        order.items_detailed.split('||').forEach(itemStr => {
            const parts = itemStr.split('::');
            if (parts.length < 2) return;
            const name = parts[0].trim() || 'Agri Product';
            if (!matchesFilter(name)) return;
            const qty = parseInt(parts[1].trim(), 10) || 1;
            const price = parseFloat(parts[2] || 0) || 0;
            const total = parseFloat(parts[3] || (qty * price)) || 0;
            out.push({ name, qty, amount: total });
        });
    } else if (order.items_summary) {
        const rawItems = order.items_summary.split('||');
        rawItems.forEach(itemStr => {
            const parts = itemStr.split(' x ');
            if (parts.length !== 2) return;
            const name = parts[0].trim() || 'Agri Product';
            if (!matchesFilter(name)) return;
            const qty = parseInt(parts[1].trim(), 10) || 0;
            const approxTotal = (parseFloat(order.total_amount || 0) || 0) / Math.max(1, rawItems.length);
            out.push({ name, qty, amount: approxTotal });
        });
    }

    return out;
}

/**
 * Aggregate orders into product-wise totals with distinct orders, dealer breakdown, qty, and revenue.
 */
function aggregateProductBreakdown(orders, productFilter = '') {
    const productMap = new Map();
    const distinctOrderIds = new Set();
    const distinctDealerKeys = new Set();

    orders.forEach(o => {
        const lineItems = parseOrderProductItems(o, productFilter);
        if (lineItems.length === 0) return;

        distinctOrderIds.add(o.order_id);
        const dealerKey = o.dealer_id ? `D-${o.dealer_id}` : `N-${(o.dealer_name || o.firm_name || o.customer_name || 'Dealer Store').trim()}`;
        const dealerName = (o.firm_name || o.dealer_name || o.customer_name || 'Dealer Store').trim();
        distinctDealerKeys.add(dealerKey);

        lineItems.forEach(item => {
            if (!productMap.has(item.name)) {
                productMap.set(item.name, {
                    name: item.name,
                    orderIds: new Set(),
                    dealerMap: new Map(),
                    qty: 0,
                    sales: 0
                });
            }
            const entry = productMap.get(item.name);
            entry.orderIds.add(o.order_id);
            entry.qty += item.qty;
            entry.sales += item.amount;

            if (!entry.dealerMap.has(dealerKey)) {
                entry.dealerMap.set(dealerKey, {
                    dealerName,
                    orderIds: new Set(),
                    qty: 0,
                    sales: 0
                });
            }
            const dEntry = entry.dealerMap.get(dealerKey);
            dEntry.orderIds.add(o.order_id);
            dEntry.qty += item.qty;
            dEntry.sales += item.amount;
        });
    });

    const grandSales = Array.from(productMap.values()).reduce((s, p) => s + p.sales, 0);
    const grandQty = Array.from(productMap.values()).reduce((s, p) => s + p.qty, 0);

    const rows = Array.from(productMap.values())
        .map(entry => {
            const dealers = Array.from(entry.dealerMap.values())
                .map(d => ({
                    dealerName: d.dealerName,
                    orderCount: d.orderIds.size,
                    qty: d.qty,
                    sales: Math.round(d.sales)
                }))
                .sort((a, b) => b.qty - a.qty || b.sales - a.sales);

            const salesRounded = Math.round(entry.sales);
            return {
                name: entry.name,
                orderCount: entry.orderIds.size,
                dealerCount: entry.dealerMap.size,
                dealers,
                qty: entry.qty,
                sales: salesRounded,
                avgRate: entry.qty > 0 ? Math.round(entry.sales / entry.qty) : 0,
                sharePct: grandSales > 0 ? ((entry.sales / grandSales) * 100) : 0
            };
        })
        .sort((a, b) => b.sales - a.sales || b.qty - a.qty);

    return {
        rows,
        totalOrders: distinctOrderIds.size,
        totalDealers: distinctDealerKeys.size,
        totalQty: grandQty,
        totalSales: Math.round(grandSales)
    };
}

function populateProductBreakdownMonthDropdown() {
    const sel = document.getElementById('pbMonthSelect');
    if (!sel) return;

    const prevVal = sel.value;
    const monthCounts = new Map();

    allOrdersData.forEach(o => {
        if ((o.order_status || '').toLowerCase() === 'cancelled') return;
        const ym = getOrderMonthKey(o.created_at);
        if (!ym) return;
        monthCounts.set(ym, (monthCounts.get(ym) || 0) + 1);
    });

    const sortedMonths = Array.from(monthCounts.keys()).sort((a, b) => b.localeCompare(a));
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let html = '<option value="">All Months (Overall)</option>';
    sortedMonths.forEach(ym => {
        const cnt = monthCounts.get(ym) || 0;
        const tag = ym === currentYM ? ' (This Month)' : '';
        html += `<option value="${ym}">${formatMonthLabel(ym)}${tag} — ${cnt} orders</option>`;
    });

    sel.innerHTML = html;

    if (!pbMonthInitialized) {
        pbMonthInitialized = true;
        if (monthCounts.has(currentYM)) {
            sel.value = currentYM;
        } else if (sortedMonths.length > 0) {
            sel.value = sortedMonths[0];
        } else {
            sel.value = '';
        }
    } else if (prevVal && (prevVal === '' || monthCounts.has(prevVal))) {
        sel.value = prevVal;
    }
}

function switchProductBreakdownMode(mode, btnEl) {
    currentPbViewMode = mode;
    const tabs = document.getElementById('pbViewModeTabs');
    if (tabs) {
        tabs.querySelectorAll('.pill-tab-btn').forEach(b => b.classList.remove('active'));
    }
    if (btnEl) btnEl.classList.add('active');

    const monthSel = document.getElementById('pbMonthSelect');
    if (monthSel) {
        monthSel.style.display = mode === 'monthly' ? 'none' : '';
    }
    renderProductBreakdownTable();
}

function toggleProductDealerDrawer(drawerId, btnEl) {
    const row = document.getElementById(drawerId);
    if (!row) return;
    const isOpen = row.style.display !== 'none';
    row.style.display = isOpen ? 'none' : 'table-row';
    if (btnEl) {
        const icon = btnEl.querySelector('i');
        if (icon) {
            icon.className = isOpen ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
        }
    }
}

function buildProductBreakdownRowHtml(p, idx, drawerPrefix, colors) {
    const drawerId = `${drawerPrefix}-${idx}`;
    const color = colors[idx % colors.length];
    const barWidth = Math.min(100, Math.max(2, Math.round(p.sharePct)));

    const dealerRowsHtml = p.dealers.map((d, dIdx) => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:0.45rem 0.65rem;color:#64748b;width:36px;">${dIdx + 1}</td>
            <td style="padding:0.45rem 0.65rem;font-weight:700;color:#1e293b;">
                <i class="fa-solid fa-store" style="color:#FF6B00;margin-right:6px;font-size:0.75rem;"></i>${escapeHtml(d.dealerName)}
            </td>
            <td style="padding:0.45rem 0.65rem;text-align:center;font-weight:600;color:#475569;">${d.orderCount}</td>
            <td style="padding:0.45rem 0.65rem;text-align:right;font-weight:700;color:#0f172a;">${d.qty.toLocaleString('en-IN')}</td>
            <td style="padding:0.45rem 0.65rem;text-align:right;font-weight:800;color:#0f172a;">₹${d.sales.toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    return `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:0.78rem 0.75rem;text-align:center;font-weight:700;color:#94a3b8;">${idx + 1}</td>
            <td style="padding:0.78rem 0.75rem;font-weight:700;color:#0f172a;">
                <i class="fa-solid fa-cubes" style="color:${color};margin-right:8px;"></i>${escapeHtml(p.name)}
            </td>
            <td style="padding:0.78rem 0.75rem;text-align:center;font-weight:700;color:#334155;">${p.orderCount}</td>
            <td style="padding:0.78rem 0.75rem;text-align:center;">
                <button type="button" onclick="toggleProductDealerDrawer('${drawerId}', this)"
                    style="background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;border-radius:9999px;padding:3px 10px;font-size:0.74rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;"
                    title="View dealer-wise quantities for ${escapeHtml(p.name)}">
                    <span>${p.dealerCount} ${p.dealerCount === 1 ? 'Dealer' : 'Dealers'}</span>
                    <i class="fa-solid fa-chevron-down" style="font-size:0.65rem;"></i>
                </button>
            </td>
            <td style="padding:0.78rem 0.75rem;text-align:right;font-weight:800;color:#0f172a;">${p.qty.toLocaleString('en-IN')}</td>
            <td style="padding:0.78rem 0.75rem;text-align:right;font-weight:600;color:#64748b;">₹${p.avgRate.toLocaleString('en-IN')}</td>
            <td style="padding:0.78rem 0.75rem;text-align:right;font-weight:800;color:#0f172a;">₹${p.sales.toLocaleString('en-IN')}</td>
            <td style="padding:0.78rem 0.75rem;text-align:right;">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
                    <div style="width:54px;height:6px;background:#e2e8f0;border-radius:9999px;overflow:hidden;">
                        <div style="width:${barWidth}%;height:100%;background:${color};border-radius:9999px;"></div>
                    </div>
                    <span style="font-weight:700;color:#334155;font-size:0.76rem;min-width:42px;text-align:right;">${p.sharePct.toFixed(1)}%</span>
                </div>
            </td>
        </tr>
        <tr id="${drawerId}" style="display:none;background:#f8fafc;">
            <td colspan="8" style="padding:0.75rem 1.25rem 0.9rem 3rem;border-bottom:1px solid #e2e8f0;">
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                    <div style="padding:0.5rem 0.75rem;background:#f1f5f9;font-size:0.74rem;font-weight:800;color:#334155;border-bottom:1px solid #e2e8f0;">
                        <i class="fa-solid fa-users" style="color:#FF6B00;margin-right:6px;"></i>Dealers ordering ${escapeHtml(p.name)}
                    </div>
                    <table style="width:100%;border-collapse:collapse;font-size:0.78rem;">
                        <thead>
                            <tr style="background:#f8fafc;color:#64748b;font-size:0.68rem;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">
                                <th style="padding:0.45rem 0.65rem;text-align:left;">#</th>
                                <th style="padding:0.45rem 0.65rem;text-align:left;">Dealer Name</th>
                                <th style="padding:0.45rem 0.65rem;text-align:center;">Orders</th>
                                <th style="padding:0.45rem 0.65rem;text-align:right;">Qty Ordered</th>
                                <th style="padding:0.45rem 0.65rem;text-align:right;">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>${dealerRowsHtml}</tbody>
                    </table>
                </div>
            </td>
        </tr>
    `;
}

function getActiveBreakdownScopeOrders() {
    const { orders } = getFilteredData();
    const startVal = document.getElementById('repStartDate')?.value || '';
    const endVal = document.getElementById('repEndDate')?.value || '';
    const selectedMonth = document.getElementById('pbMonthSelect')?.value || '';
    const searchQuery = (document.getElementById('topNavSearch')?.value || '').trim().toLowerCase();

    let scoped = orders;
    if (currentPbViewMode === 'single' && selectedMonth && !startVal && !endVal) {
        scoped = scoped.filter(o => getOrderMonthKey(o.created_at) === selectedMonth);
    }

    if (searchQuery) {
        scoped = scoped.filter(o => {
            const dealerText = (o.firm_name || o.dealer_name || o.customer_name || '').toLowerCase();
            const prodText = (o.items_summary || o.items_detailed || '').toLowerCase();
            return dealerText.includes(searchQuery) || prodText.includes(searchQuery);
        });
    }

    return {
        scopedOrders: scoped,
        selectedMonth,
        hasTopDateRange: Boolean(startVal || endVal),
        selectedProduct: getSelectedReportProducts()
    };
}

function renderProductBreakdownTable() {
    const tbody = document.getElementById('productBreakdownTbody');
    const tfoot = document.getElementById('productBreakdownTfoot');
    const metaEl = document.getElementById('pbPeriodSummaryMeta');
    if (!tbody) return;

    const { scopedOrders, selectedMonth, hasTopDateRange, selectedProduct } = getActiveBreakdownScopeOrders();
    const colors = ['#FF6B00', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'];

    if (currentPbViewMode === 'monthly') {
        // Group orders by month (descending) for Month-by-Month stacked view
        const monthGroups = new Map();
        scopedOrders.forEach(o => {
            const ym = getOrderMonthKey(o.created_at) || 'Unknown';
            if (!monthGroups.has(ym)) monthGroups.set(ym, []);
            monthGroups.get(ym).push(o);
        });

        const sortedMonths = Array.from(monthGroups.keys()).sort((a, b) => b.localeCompare(a));
        if (sortedMonths.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="padding:2rem;text-align:center;color:#64748b;">No B2B product sales found matching selected filters.</td></tr>`;
            if (tfoot) tfoot.style.display = 'none';
            if (metaEl) metaEl.textContent = 'Month-by-Month B2B summary — 0 orders';
            return;
        }

        const overallAgg = aggregateProductBreakdown(scopedOrders, selectedProduct);
        if (metaEl) {
            metaEl.textContent = `Month-by-Month Summary (${sortedMonths.length} ${sortedMonths.length === 1 ? 'month' : 'months'}) · ${overallAgg.totalOrders} Orders · ${overallAgg.totalQty.toLocaleString('en-IN')} Units · ₹${overallAgg.totalSales.toLocaleString('en-IN')}`;
        }

        let html = '';
        sortedMonths.forEach((ym, mIdx) => {
            const mOrders = monthGroups.get(ym);
            const agg = aggregateProductBreakdown(mOrders, selectedProduct);
            if (agg.rows.length === 0) return;

            html += `
                <tr style="background:#eff6ff;border-top:2px solid #bfdbfe;border-bottom:1px solid #bfdbfe;">
                    <td colspan="8" style="padding:0.65rem 0.9rem;font-weight:800;color:#1e3a8a;font-size:0.82rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                            <span><i class="fa-regular fa-calendar-check" style="margin-right:6px;"></i>${escapeHtml(formatMonthLabel(ym))}</span>
                            <span style="font-size:0.76rem;color:#1d4ed8;">
                                ${agg.totalOrders} Orders · ${agg.totalDealers} Dealers · ${agg.totalQty.toLocaleString('en-IN')} Units · ₹${agg.totalSales.toLocaleString('en-IN')}
                            </span>
                        </div>
                    </td>
                </tr>
            `;
            html += agg.rows.map((p, idx) => buildProductBreakdownRowHtml(p, idx, `pb-m${mIdx}`, colors)).join('');
        });

        tbody.innerHTML = html || `<tr><td colspan="8" style="padding:2rem;text-align:center;color:#64748b;">No B2B product sales found matching selected filters.</td></tr>`;
        if (tfoot) {
            tfoot.style.display = overallAgg.rows.length > 0 ? 'table-footer-group' : 'none';
            tfoot.innerHTML = `
                <tr>
                    <td colspan="2" style="padding:0.85rem 0.75rem;">OVERALL TOTAL (${sortedMonths.length} Months)</td>
                    <td style="padding:0.85rem 0.75rem;text-align:center;">${overallAgg.totalOrders}</td>
                    <td style="padding:0.85rem 0.75rem;text-align:center;">${overallAgg.totalDealers} Dealers</td>
                    <td style="padding:0.85rem 0.75rem;text-align:right;">${overallAgg.totalQty.toLocaleString('en-IN')}</td>
                    <td style="padding:0.85rem 0.75rem;text-align:right;color:#64748b;">—</td>
                    <td style="padding:0.85rem 0.75rem;text-align:right;">₹${overallAgg.totalSales.toLocaleString('en-IN')}</td>
                    <td style="padding:0.85rem 0.75rem;text-align:right;">100.0%</td>
                </tr>
            `;
        }
        return;
    }

    // Selected Month / Filtered Range view
    const agg = aggregateProductBreakdown(scopedOrders, selectedProduct);
    const periodLabel = hasTopDateRange
        ? 'Selected Date Range'
        : (selectedMonth ? formatMonthLabel(selectedMonth) : 'All Months');

    if (metaEl) {
        metaEl.textContent = `${periodLabel} · ${agg.rows.length} Products · ${agg.totalOrders} Orders · ${agg.totalQty.toLocaleString('en-IN')} Units · ₹${agg.totalSales.toLocaleString('en-IN')}`;
    }

    if (agg.rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="padding:2rem;text-align:center;color:#64748b;">
                    No dealer product orders found for ${escapeHtml(periodLabel)}. Try selecting another month or choosing "All Months".
                </td>
            </tr>`;
        if (tfoot) tfoot.style.display = 'none';
        return;
    }

    tbody.innerHTML = agg.rows.map((p, idx) => buildProductBreakdownRowHtml(p, idx, 'pb-s', colors)).join('');

    if (tfoot) {
        tfoot.style.display = 'table-footer-group';
        tfoot.innerHTML = `
            <tr>
                <td colspan="2" style="padding:0.85rem 0.75rem;">GRAND TOTAL (${escapeHtml(periodLabel)})</td>
                <td style="padding:0.85rem 0.75rem;text-align:center;">${agg.totalOrders}</td>
                <td style="padding:0.85rem 0.75rem;text-align:center;">${agg.totalDealers} Dealers</td>
                <td style="padding:0.85rem 0.75rem;text-align:right;">${agg.totalQty.toLocaleString('en-IN')}</td>
                <td style="padding:0.85rem 0.75rem;text-align:right;color:#64748b;">—</td>
                <td style="padding:0.85rem 0.75rem;text-align:right;">₹${agg.totalSales.toLocaleString('en-IN')}</td>
                <td style="padding:0.85rem 0.75rem;text-align:right;">100.0%</td>
            </tr>
        `;
    }
}

function updateTopProductsTable() {
    const tbody = document.getElementById('topSellingProductsTbody');
    if (!tbody) return;

    const { orders } = getFilteredData();
    const selectedProduct = getSelectedReportProducts();
    const agg = aggregateProductBreakdown(orders, selectedProduct);

    if (agg.rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center;padding:1.5rem;color:#64748b;">No product sales data available for selected filters.</td>
            </tr>`;
        return;
    }

    const sortedProducts = [...agg.rows].sort((a, b) => b.qty - a.qty);
    const colors = ['#FF6B00', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'];

    tbody.innerHTML = sortedProducts.map((p, idx) => `
        <tr>
            <td style="font-weight:700;color:#0f172a;"><i class="fa-solid fa-cubes" style="color:${colors[idx % colors.length]};margin-right:6px;"></i> ${escapeHtml(p.name)}</td>
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
    const startVal = document.getElementById('repStartDate')?.value || '';
    const endVal = document.getElementById('repEndDate')?.value || '';
    const pbMonthSel = document.getElementById('pbMonthSelect');
    if (pbMonthSel) {
        pbMonthSel.disabled = Boolean(startVal || endVal);
    }

    updateSummaryMetrics();
    renderProductBreakdownTable();
    updateTopDealersTable();
    updateTopProductsTable();
    updateChartsData();
}

function resetReportsFilters() {
    const dealerSelect = document.getElementById('repDealerSelect');
    const salespersonSelect = document.getElementById('repSalespersonSelect');
    const startDateInput = document.getElementById('repStartDate');
    const endDateInput = document.getElementById('repEndDate');
    const topSearch = document.getElementById('topNavSearch');

    if (dealerSelect) dealerSelect.value = '';
    if (salespersonSelect) salespersonSelect.value = '';
    if (repProductMultiSelect) repProductMultiSelect.clear();
    if (startDateInput) startDateInput.value = '';
    if (endDateInput) endDateInput.value = '';
    if (topSearch) topSearch.value = '';

    pbMonthInitialized = false;
    populateProductBreakdownMonthDropdown();

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
    const selectedProducts = getSelectedReportProducts();
    const productText = selectedProducts.length > 0 ? selectedProducts.join(', ') : 'All Products';

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

    // Top Selling Products (reusing shared aggregation helper)
    rows.push([sanitizeCell('--- PRODUCT-WISE BREAKDOWN (B2B OVERALL) ---')]);
    rows.push([
        sanitizeCell('Product Name'),
        sanitizeCell('Orders'),
        sanitizeCell('Dealers'),
        sanitizeCell('Quantity Sold'),
        sanitizeCell('Avg Rate (INR)'),
        sanitizeCell('Total Sales (INR)')
    ].join(','));

    const selectedProduct = getSelectedReportProducts();
    const aggOverall = aggregateProductBreakdown(orders, selectedProduct);

    if (aggOverall.rows.length === 0) {
        rows.push([sanitizeCell('No product sales data available for selected filters.')]);
    } else {
        aggOverall.rows.forEach(p => {
            rows.push([
                sanitizeCell(p.name),
                sanitizeCell(p.orderCount),
                sanitizeCell(p.dealerCount),
                sanitizeCell(p.qty),
                sanitizeCell(p.avgRate),
                sanitizeCell(p.sales)
            ].join(','));
        });
    }
    rows.push([]);

    // Monthly Product-wise Summary (B2B)
    rows.push([sanitizeCell('--- MONTHLY PRODUCT-WISE BREAKDOWN (B2B) ---')]);
    rows.push([
        sanitizeCell('Month'),
        sanitizeCell('Product Name'),
        sanitizeCell('Orders'),
        sanitizeCell('Dealers'),
        sanitizeCell('Quantity Sold'),
        sanitizeCell('Avg Rate (INR)'),
        sanitizeCell('Total Sales (INR)')
    ].join(','));

    const monthGroups = new Map();
    orders.forEach(o => {
        const ym = getOrderMonthKey(o.created_at) || 'Unknown';
        if (!monthGroups.has(ym)) monthGroups.set(ym, []);
        monthGroups.get(ym).push(o);
    });
    const sortedMonthKeys = Array.from(monthGroups.keys()).sort((a, b) => b.localeCompare(a));
    if (sortedMonthKeys.length === 0) {
        rows.push([sanitizeCell('No monthly product summary available.')]);
    } else {
        sortedMonthKeys.forEach(ym => {
            const mAgg = aggregateProductBreakdown(monthGroups.get(ym), selectedProduct);
            mAgg.rows.forEach(p => {
                rows.push([
                    sanitizeCell(formatMonthLabel(ym)),
                    sanitizeCell(p.name),
                    sanitizeCell(p.orderCount),
                    sanitizeCell(p.dealerCount),
                    sanitizeCell(p.qty),
                    sanitizeCell(p.avgRate),
                    sanitizeCell(p.sales)
                ].join(','));
            });
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

    downloadCsvRows(rows, `SGB_Agro_Reports_Analytics_${new Date().toISOString().slice(0, 10)}.csv`, 'Reports & Analytics data exported successfully as CSV!');
}

function csvCell(val) {
    if (val === null || val === undefined) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
}

function downloadCsvRows(rows, filename, successMsg) {
    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (window.recordDealerActivityClient) {
        window.recordDealerActivityClient('EXPORT', 'DEALER_REPORT', `CSV(${rows.length - 1})`, `Exported ${filename} (${rows.length - 1} rows)`);
    }

    if (window.showAlert) {
        window.showAlert('Export Successful', successMsg, 'success');
    } else {
        alert(successMsg);
    }
}

function exportProductBreakdownCSV() {
    const { scopedOrders, selectedMonth, hasTopDateRange, selectedProduct } = getActiveBreakdownScopeOrders();
    if (!scopedOrders || scopedOrders.length === 0) {
        if (window.showAlert) {
            window.showAlert('Export Notice', 'No B2B product breakdown data available to export.', 'info');
        } else {
            alert('No B2B product breakdown data available to export.');
        }
        return;
    }

    const rows = [];
    rows.push([csvCell('SGB AGRO - PRODUCT-WISE BREAKDOWN (B2B)')].join(','));
    rows.push([csvCell(`Exported On: ${new Date().toLocaleString('en-IN')}`)].join(','));

    if (currentPbViewMode === 'monthly') {
        rows.push([csvCell('Month'), csvCell('Product Name'), csvCell('Orders'), csvCell('Dealers Count'), csvCell('Dealer Names'), csvCell('Qty Sold'), csvCell('Avg Rate (INR)'), csvCell('Total Amount (INR)')].join(','));
        const monthGroups = new Map();
        scopedOrders.forEach(o => {
            const ym = getOrderMonthKey(o.created_at) || 'Unknown';
            if (!monthGroups.has(ym)) monthGroups.set(ym, []);
            monthGroups.get(ym).push(o);
        });
        Array.from(monthGroups.keys()).sort((a, b) => b.localeCompare(a)).forEach(ym => {
            const agg = aggregateProductBreakdown(monthGroups.get(ym), selectedProduct);
            agg.rows.forEach(p => {
                const dealerListStr = p.dealers.map(d => `${d.dealerName} (${d.qty})`).join('; ');
                rows.push([
                    csvCell(formatMonthLabel(ym)),
                    csvCell(p.name),
                    csvCell(p.orderCount),
                    csvCell(p.dealerCount),
                    csvCell(dealerListStr),
                    csvCell(p.qty),
                    csvCell(p.avgRate),
                    csvCell(p.sales)
                ].join(','));
            });
        });
        downloadCsvRows(rows, `SGB_B2B_Product_Breakdown_Monthly_${new Date().toISOString().slice(0, 10)}.csv`, 'Monthly B2B Product Breakdown exported as CSV!');
        return;
    }

    const periodLabel = hasTopDateRange ? 'Selected_Date_Range' : (selectedMonth || 'All_Months');
    rows.push([csvCell(`Period: ${hasTopDateRange ? 'Selected Date Range' : formatMonthLabel(selectedMonth)}`)].join(','));
    rows.push([csvCell('Product Name'), csvCell('Orders'), csvCell('Dealers Count'), csvCell('Dealer Breakdown (Qty)'), csvCell('Qty Sold'), csvCell('Avg Rate (INR)'), csvCell('Total Amount (INR)'), csvCell('Share (%)')].join(','));

    const agg = aggregateProductBreakdown(scopedOrders, selectedProduct);
    agg.rows.forEach(p => {
        const dealerListStr = p.dealers.map(d => `${d.dealerName} (${d.qty})`).join('; ');
        rows.push([
            csvCell(p.name),
            csvCell(p.orderCount),
            csvCell(p.dealerCount),
            csvCell(dealerListStr),
            csvCell(p.qty),
            csvCell(p.avgRate),
            csvCell(p.sales),
            csvCell(p.sharePct.toFixed(1))
        ].join(','));
    });

    downloadCsvRows(rows, `SGB_B2B_Product_Breakdown_${periodLabel}.csv`, 'B2B Product Breakdown exported as CSV!');
}

window.switchChartTimeTab = switchChartTimeTab;
window.toggleOverviewMetric = toggleOverviewMetric;
window.applyReportsFilters = applyReportsFilters;
window.resetReportsFilters = resetReportsFilters;
window.exportReportsAnalytics = exportReportsAnalytics;
window.switchProductBreakdownMode = switchProductBreakdownMode;
window.toggleProductDealerDrawer = toggleProductDealerDrawer;
window.renderProductBreakdownTable = renderProductBreakdownTable;
window.exportProductBreakdownCSV = exportProductBreakdownCSV;

