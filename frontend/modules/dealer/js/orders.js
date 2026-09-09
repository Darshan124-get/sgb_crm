// ============================================================
// orders.js — Dealer Orders Management Script
// Handles order listing, status badges, balance payments & modals
// ============================================================

const API_BASE = `${window.API_URL}/dealers`;
const token = () => localStorage.getItem('token') || '';

let allOrders = [];
let filteredOrders = [];
let selectedOrderIds = new Set();
let currentPage = 1;
let pageSize = 10;

document.addEventListener('DOMContentLoaded', () => {
    fetchDealerOrders();
});

async function fetchDealerOrders() {
    const tbody = document.getElementById('dealerOrdersTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="padding:3rem;text-align:center;color:#94a3b8;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="margin-bottom:0.5rem;display:block;"></i>
                    Loading dealer orders...
                </td>
            </tr>`;
    }

    try {
        const res = await fetch(`${API_BASE}/orders`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });

        if (res.ok) {
            allOrders = await res.json();
            await populateDealerDropdown();
            filterDealerOrders();
        } else {
            console.error('Failed to fetch dealer orders');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="10" style="padding:2rem;text-align:center;color:#ef4444;">Failed to load orders. Please refresh page.</td></tr>`;
            }
        }
    } catch (err) {
        console.error('Error fetching dealer orders:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" style="padding:2rem;text-align:center;color:#ef4444;">Network connection error.</td></tr>`;
        }
    }
}

function getLocalYmdFromDate(dateVal) {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch (e) {
        return '';
    }
}

function syncOrderSearch(source) {
    if (source === 'top') {
        const topVal = document.getElementById('topNavOrderSearch')?.value || '';
        const mainInput = document.getElementById('orderSearchInput');
        if (mainInput) mainInput.value = topVal;
    } else {
        const mainVal = document.getElementById('orderSearchInput')?.value || '';
        const topInput = document.getElementById('topNavOrderSearch');
        if (topInput) topInput.value = mainVal;
    }
    filterDealerOrders();
}

async function populateDealerDropdown() {
    const select = document.getElementById('dealerSelectFilter');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">All Dealers</option>';

    const dealerMap = new Map();

    // 1. Fetch all dealers from API
    try {
        const res = await fetch(API_BASE, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (res.ok) {
            const dealers = await res.json();
            if (Array.isArray(dealers)) {
                dealers.forEach(d => {
                    const name = d.firm_name || d.dealer_name || d.owner_name;
                    if (d.dealer_id && name) {
                        dealerMap.set(String(d.dealer_id), name);
                    }
                });
            }
        }
    } catch (e) { }

    // 2. Supplement with any dealer in allOrders
    allOrders.forEach(o => {
        const name = o.dealer_name || o.firm_name || o.customer_name;
        if (o.dealer_id && name) {
            dealerMap.set(String(o.dealer_id), name);
        } else if (name) {
            dealerMap.set(name.toLowerCase(), name);
        }
    });

    const sortedDealers = Array.from(dealerMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    sortedDealers.forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = name;
        select.appendChild(opt);
    });

    select.value = currentVal;
}

function resetOrderFilters() {
    const s1 = document.getElementById('orderSearchInput');
    const s2 = document.getElementById('topNavOrderSearch');
    const dSel = document.getElementById('dealerSelectFilter');
    const st = document.getElementById('statusFilter');
    const paySt = document.getElementById('paymentStatusFilter');
    const from = document.getElementById('fromDateFilter');
    const to = document.getElementById('toDateFilter');

    if (s1) s1.value = '';
    if (s2) s2.value = '';
    if (dSel) dSel.value = '';
    if (st) st.value = '';
    if (paySt) paySt.value = '';
    if (from) from.value = '';
    if (to) to.value = '';

    filterDealerOrders();
}

function filterDealerOrders() {
    const q1 = (document.getElementById('orderSearchInput')?.value || '').toLowerCase().trim();
    const q2 = (document.getElementById('topNavOrderSearch')?.value || '').toLowerCase().trim();
    const search = q1 || q2;
    const selectedDealer = (document.getElementById('dealerSelectFilter')?.value || '').toLowerCase().trim();
    const status = (document.getElementById('statusFilter')?.value || '').toLowerCase().trim();
    const paymentStatus = (document.getElementById('paymentStatusFilter')?.value || '').toLowerCase().trim();
    const fromDate = document.getElementById('fromDateFilter')?.value || '';
    const toDate = document.getElementById('toDateFilter')?.value || '';

    filteredOrders = allOrders.filter(o => {
        // Dealer, city, order ID, items text matching
        const dealerName = (o.dealer_name || o.firm_name || o.customer_name || '').toLowerCase();
        const dealerId = String(o.dealer_id || '').toLowerCase();
        const city = (o.dealer_city || o.city || '').toLowerCase();
        const orderIdStr = String(o.order_id || '').toLowerCase();
        const formattedIdStr = (window.formatOrderId ? window.formatOrderId(o.order_id, o.created_at) : `#ORD-${o.order_id}`).toLowerCase();
        const itemsStr = (o.items_summary || '').toLowerCase();

        const matchesSearch = !search ||
            dealerName.includes(search) ||
            city.includes(search) ||
            orderIdStr.includes(search) ||
            formattedIdStr.includes(search) ||
            itemsStr.includes(search);

        let matchesDealer = true;
        if (selectedDealer) {
            matchesDealer = (dealerId === selectedDealer || dealerName === selectedDealer || dealerName.includes(selectedDealer));
        }

        // Status matching (handling empty/draft as 'ordered')
        let oStatus = (o.order_status || o.status || '').toString().toLowerCase().trim();
        if (!oStatus || oStatus === 'draft') {
            oStatus = 'ordered';
        }

        let matchesStatus = true;
        if (status) {
            if (status === 'ordered') {
                matchesStatus = (oStatus === 'ordered' || oStatus === 'pending' || oStatus === 'new');
            } else {
                matchesStatus = (oStatus === status);
            }
        }

        // Payment status matching (Pending vs Cleared)
        let matchesPaymentStatus = true;
        if (paymentStatus) {
            const totalVal = parseFloat(o.total_amount || 0);
            const paidVal = parseFloat(o.advance_amount || 0);
            const balVal = (o.balance_amount !== undefined && o.balance_amount !== null) ? parseFloat(o.balance_amount) : Math.max(0, totalVal - paidVal);
            const isCleared = (balVal <= 0.01) || (totalVal > 0 && paidVal >= totalVal);

            if (paymentStatus === 'cleared' || paymentStatus === 'paid') {
                matchesPaymentStatus = isCleared;
            } else if (paymentStatus === 'pending' || paymentStatus === 'unpaid') {
                matchesPaymentStatus = !isCleared;
            }
        }

        // Date matching using local date
        let matchesDate = true;
        if (fromDate || toDate) {
            const orderYmd = getLocalYmdFromDate(o.created_at || o.order_date);
            if (orderYmd) {
                if (fromDate && orderYmd < fromDate) {
                    matchesDate = false;
                }
                if (toDate && orderYmd > toDate) {
                    matchesDate = false;
                }
            }
        }

        return matchesSearch && matchesDealer && matchesStatus && matchesPaymentStatus && matchesDate;
    });

    currentPage = 1;
    renderDealerOrdersTable();
}

function updateSelectedOrdersUI() {
    const badge = document.getElementById('selectedOrdersBadge');
    const countSpan = document.getElementById('selectedOrdersCount');
    const btnDelete = document.getElementById('btnDeleteSelectedOrders');
    const btnClearPayment = document.getElementById('btnClearSelectedPayments');
    const bulkStatusContainer = document.getElementById('bulkStatusContainer');
    const btnExportLabel = document.getElementById('btnExportLabel');
    const masterChk = document.getElementById('selectAllOrdersCheckbox');

    const count = selectedOrderIds.size;
    if (count > 0) {
        if (badge) { badge.style.display = 'inline-flex'; }
        if (countSpan) { countSpan.textContent = count; }
        if (btnDelete) { btnDelete.style.display = 'inline-flex'; }
        if (btnClearPayment) { btnClearPayment.style.display = 'inline-flex'; }
        if (bulkStatusContainer) { bulkStatusContainer.style.display = 'inline-block'; }
        if (btnExportLabel) { btnExportLabel.textContent = `Export Selected (${count})`; }
    } else {
        if (badge) { badge.style.display = 'none'; }
        if (btnDelete) { btnDelete.style.display = 'none'; }
        if (btnClearPayment) { btnClearPayment.style.display = 'none'; }
        if (bulkStatusContainer) { bulkStatusContainer.style.display = 'none'; }
        if (btnExportLabel) { btnExportLabel.textContent = 'Export'; }
    }

    if (masterChk) {
        const visibleOrderIds = (filteredOrders || []).slice((currentPage - 1) * pageSize, currentPage * pageSize).map(o => String(o.order_id));
        if (visibleOrderIds.length > 0 && visibleOrderIds.every(id => selectedOrderIds.has(id))) {
            masterChk.checked = true;
            masterChk.indeterminate = false;
        } else if (visibleOrderIds.some(id => selectedOrderIds.has(id))) {
            masterChk.checked = false;
            masterChk.indeterminate = true;
        } else {
            masterChk.checked = false;
            masterChk.indeterminate = false;
        }
    }
}

function toggleSelectAllOrders(masterChk) {
    const visibleOrders = (filteredOrders || []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
    if (masterChk.checked) {
        visibleOrders.forEach(o => selectedOrderIds.add(String(o.order_id)));
    } else {
        visibleOrders.forEach(o => selectedOrderIds.delete(String(o.order_id)));
    }
    renderDealerOrdersTable();
}

function handleOrderSelectChange(chk, orderIdStr) {
    if (chk.checked) {
        selectedOrderIds.add(String(orderIdStr));
    } else {
        selectedOrderIds.delete(String(orderIdStr));
    }
    updateSelectedOrdersUI();
}

function renderDealerOrdersTable() {
    const tbody = document.getElementById('dealerOrdersTableBody');
    if (!tbody) return;

    if (filteredOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="padding:3rem;text-align:center;color:#94a3b8;">
                    <i class="fa-solid fa-box-open fa-2x" style="margin-bottom:0.5rem;display:block;color:#cbd5e1;"></i>
                    No dealer orders found matching criteria.
                </td>
            </tr>`;
        updatePaginationSummary(0, 0, 0);
        updateSelectedOrdersUI();
        return;
    }

    const totalOrders = filteredOrders.length;
    const totalPages = Math.ceil(totalOrders / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalOrders);
    const pageOrders = filteredOrders.slice(startIdx, endIdx);

    tbody.innerHTML = pageOrders.map(o => {
        const isSelected = selectedOrderIds.has(String(o.order_id));
        const dealerStoreName = o.dealer_name || o.firm_name || o.customer_name || 'Agri Dealer Store';
        const city = o.dealer_city || o.city || 'Karnataka';

        // Format Items & Quantity
        let itemsFormatted = 'Agri Products';
        if (o.items_summary) {
            const itemsList = o.items_summary.split('||');
            if (itemsList.length > 2) {
                itemsFormatted = `${itemsList.slice(0, 2).join('<br>')}<br><span style="color:#FF6B00;font-size:0.725rem;font-weight:600;">+${itemsList.length - 2} more</span>`;
            } else {
                itemsFormatted = itemsList.join('<br>');
            }
        }

        const totalVal = parseFloat(o.total_amount || 0);
        const paidVal = parseFloat(o.advance_amount || 0);
        const balVal = Math.max(0, totalVal - paidVal);

        // Status pill styling & icons
        const status = (o.order_status || 'ordered').toLowerCase();
        let statusClass = 'status-ordered';
        let statusLabel = 'ORDERED';
        let statusIcon = 'fa-cart-shopping';

        if (status === 'shipped') {
            statusClass = 'status-shipped';
            statusLabel = 'SHIPPED';
            statusIcon = 'fa-truck-fast';
        } else if (status === 'packed') {
            statusClass = 'status-packed';
            statusLabel = 'PACKED';
            statusIcon = 'fa-box';
        } else if (status === 'delivered') {
            statusClass = 'status-delivered';
            statusLabel = 'DELIVERED';
            statusIcon = 'fa-circle-check';
        } else if (status === 'cancelled') {
            statusClass = 'status-cancelled';
            statusLabel = 'CANCELLED';
            statusIcon = 'fa-ban';
        } else if (status === 'draft') {
            statusClass = 'status-ordered';
            statusLabel = 'ORDERED';
            statusIcon = 'fa-cart-shopping';
        }

        // Date formatting
        const purchasedDate = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '—';
        let shippedDate = '—';
        if (o.shipped_date) {
            if (typeof o.shipped_date === 'string' && o.shipped_date.includes('-')) {
                const parts = o.shipped_date.slice(0, 10).split('-');
                if (parts.length === 3) {
                    shippedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                    shippedDate = new Date(o.shipped_date).toLocaleDateString('en-GB');
                }
            } else {
                shippedDate = new Date(o.shipped_date).toLocaleDateString('en-GB');
            }
        }

        const orderIdText = window.formatOrderId ? window.formatOrderId(o.order_id, o.created_at) : `#ORD-${o.order_id}`;

        return `
            <tr style="border-bottom:1px solid #f1f5f9;transition:background 0.15s ease;${isSelected ? 'background-color:#F0F9FF;' : ''}" onmouseover="if(!${isSelected}) this.style.background='#f8fafc'" onmouseout="if(!${isSelected}) this.style.background='transparent'">
                <td style="padding:1rem 0.75rem;text-align:center;">
                    <input type="checkbox" class="order-chk" value="${o.order_id}" ${isSelected ? 'checked' : ''} onchange="handleOrderSelectChange(this, '${o.order_id}')" style="width:16px;height:16px;cursor:pointer;accent-color:#FF6B00;">
                </td>
                <td style="padding:1rem 1.25rem;white-space:nowrap;">
                    <span style="background:#f1f5f9;color:#334155;padding:0.25rem 0.6rem;border-radius:6px;border:1px solid #e2e8f0;font-size:0.75rem;font-weight:700;">
                        ${orderIdText}
                    </span>
                </td>
                <td style="padding:1rem 1.25rem;">
                    <div style="font-weight:700;color:#0f172a;font-size:0.875rem;">${dealerStoreName}</div>
                    <div style="font-size:0.75rem;color:#64748b;">${city}</div>
                </td>
                <td style="padding:1rem 1.25rem;font-size:0.825rem;color:#334155;line-height:1.4;">${itemsFormatted}</td>
                <td style="padding:1rem 1.25rem;font-size:0.825rem;color:#475569;white-space:nowrap;">${purchasedDate}</td>
                <td style="padding:1rem 1.25rem;font-size:0.825rem;color:#475569;white-space:nowrap;">${shippedDate}</td>
                <td style="padding:1rem 1.25rem;text-align:right;font-weight:700;color:#0f172a;">${totalVal.toLocaleString('en-IN')}.00</td>
                <td style="padding:1rem 1.25rem;text-align:right;font-weight:700;color:#16a34a;">${paidVal.toLocaleString('en-IN')}.00</td>
                <td style="padding:1rem 1.25rem;text-align:right;font-weight:700;">
                    ${balVal > 0 ? `<span style="color:#ef4444;">${balVal.toLocaleString('en-IN')}.00</span>` : `<span style="color:#16a34a;font-weight:700;font-size:0.75rem;background:#f0fdf4;padding:4px 8px;border-radius:6px;border:1px solid #bbf7d0;display:inline-block;white-space:nowrap;"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i> Payment Cleared</span>`}
                </td>
                <td style="padding:1rem 1.25rem;text-align:center;">
                    <span class="status-pill ${statusClass}"><i class="fa-solid ${statusIcon}"></i> ${statusLabel}</span>
                </td>
                <td style="padding:1rem 1.25rem;text-align:center;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:0.45rem;flex-wrap:nowrap;">
                        <button class="action-btn-square" title="View Order Details" onclick="openOrderDetailsModal(${o.order_id})">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                        <button class="action-btn-square" title="Record Payment / Pay Balance" style="color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;" onclick="openPayBalanceModal(${o.order_id})">
                            <i class="fa-solid fa-indian-rupee-sign"></i>
                        </button>
                        <button class="action-btn-square" title="Edit Order" onclick="openEditOrderModal(${o.order_id})">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button class="action-btn-square" title="Delete Order" style="color:#ef4444;background:#fef2f2;border:1px solid #fecaca;" onclick="deleteDealerOrder(${o.order_id})">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updatePaginationSummary(startIdx + 1, endIdx, totalOrders);
    renderPaginationButtons(totalPages);
    updateSelectedOrdersUI();
}

function updatePaginationSummary(start, end, total) {
    const elem = document.getElementById('ordersPaginationSummary');
    if (elem) {
        elem.textContent = total > 0 ? `Showing ${start} to ${end} of ${total} orders` : `Showing 0 orders`;
    }
}

function renderPaginationButtons(totalPages) {
    const container = document.getElementById('ordersPaginationButtons');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentPage;
        html += `<button onclick="goToOrdersPage(${i})" style="padding:0.35rem 0.65rem;border-radius:6px;border:1px solid ${isActive ? '#FF6B00' : '#cbd5e1'};background:${isActive ? '#FF6B00' : '#ffffff'};color:${isActive ? '#ffffff' : '#475569'};font-weight:700;font-size:0.8rem;cursor:pointer;">${i}</button>`;
    }
    container.innerHTML = html;
}

function goToOrdersPage(page) {
    currentPage = page;
    renderDealerOrdersTable();
}

function changeOrdersPageSize(val) {
    if (val === 'custom') {
        const customVal = prompt("Enter custom page size (items per page):", pageSize);
        if (customVal !== null) {
            const parsed = parseInt(customVal.trim(), 10);
            if (parsed && parsed > 0) {
                pageSize = parsed;
                const selectEl = document.getElementById('ordersPageSize');
                if (selectEl) {
                    let opt = Array.from(selectEl.options).find(o => o.value == String(parsed));
                    if (!opt) {
                        opt = document.createElement('option');
                        opt.value = String(parsed);
                        opt.textContent = `${parsed} / page`;
                        const customOpt = Array.from(selectEl.options).find(o => o.value === 'custom');
                        if (customOpt) selectEl.insertBefore(opt, customOpt);
                        else selectEl.appendChild(opt);
                    }
                    selectEl.value = String(parsed);
                }
            } else {
                alert("Please enter a valid positive number.");
                const selectEl = document.getElementById('ordersPageSize');
                if (selectEl) selectEl.value = String(pageSize);
                return;
            }
        } else {
            const selectEl = document.getElementById('ordersPageSize');
            if (selectEl) selectEl.value = String(pageSize);
            return;
        }
    } else {
        pageSize = parseInt(val, 10) || 10;
    }
    currentPage = 1;
    renderDealerOrdersTable();
}

// ==========================================
// PAY REMAINING BALANCE MODAL LOGIC
// ==========================================
function openPayBalanceModal(orderId) {
    const o = allOrders.find(item => item.order_id == orderId);
    if (!o) return;

    const totalVal = parseFloat(o.total_amount || 0);
    const paidVal = parseFloat(o.advance_amount || 0);
    const balVal = Math.max(0, totalVal - paidVal);

    document.getElementById('pay_order_id').value = o.order_id;
    document.getElementById('payDealerName').textContent = o.dealer_name || o.firm_name || o.customer_name || 'Dealer Store';
    document.getElementById('payTotalAmount').textContent = `₹${totalVal.toLocaleString('en-IN')}.00`;
    document.getElementById('payAlreadyPaid').textContent = `₹${paidVal.toLocaleString('en-IN')}.00`;
    document.getElementById('payCurrentBalance').innerHTML = balVal > 0 ? `₹${balVal.toLocaleString('en-IN')}.00` : `<span style="color:#16a34a;font-weight:700;"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i> Payment Cleared</span>`;

    const payInput = document.getElementById('pay_amount');
    payInput.value = balVal > 0 ? balVal : '';
    payInput.max = balVal;

    document.getElementById('pay_notes').value = '';
    const payMethodSelect = document.getElementById('pay_method');
    if (payMethodSelect) payMethodSelect.value = '';

    fetchPayBalanceModalPaymentHistory(o);

    const modal = document.getElementById('payBalanceModal');
    if (modal) modal.style.display = 'flex';
}

async function fetchPayBalanceModalPaymentHistory(order) {
    const tbody = document.getElementById('payBalanceModalHistoryBody');
    const badge = document.getElementById('payModalPaymentCountBadge');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="padding:0.75rem;text-align:center;color:#94A3B8;"><i class="fa-solid fa-spinner fa-spin"></i> Loading payments...</td></tr>`;

    let historyRecords = [];
    try {
        const res = await fetch(`${API_BASE}/orders/${order.order_id}/payments`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (res.ok) {
            historyRecords = await res.json();
        }
    } catch (e) {
        console.error('Error fetching payments:', e);
    }

    const paidVal = parseFloat(order.advance_amount || 0);

    if (historyRecords.length === 0) {
        if (paidVal > 0) {
            if (badge) badge.textContent = '1 record';
            const orderDateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : '—';
            tbody.innerHTML = `
                <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:0.5rem 0.75rem;font-weight:700;color:#64748B;">1</td>
                    <td style="padding:0.5rem 0.75rem;color:#475569;white-space:nowrap;">${orderDateStr}</td>
                    <td style="padding:0.5rem 0.75rem;text-align:right;font-weight:700;color:#16A34A;">₹${paidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="padding:0.5rem 0.75rem;color:#334155;"><span style="background:#F1F5F9;color:#475569;padding:2px 6px;border-radius:4px;font-size:0.75rem;">Bank Transfer / Cash</span></td>
                    <td style="padding:0.5rem 0.75rem;color:#64748B;">Initial Payment / Advance</td>
                </tr>
            `;
        } else {
            if (badge) badge.textContent = '0 records';
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding:0.75rem;text-align:center;color:#94A3B8;">
                        <i class="fa-solid fa-receipt" style="margin-right:6px;opacity:0.6;"></i> No payment records found.
                    </td>
                </tr>`;
        }
        return;
    }

    if (badge) badge.textContent = `${historyRecords.length} record${historyRecords.length > 1 ? 's' : ''}`;

    tbody.innerHTML = historyRecords.map((p, idx) => {
        const amt = parseFloat(p.amount || 0);
        const pDate = p.payment_date || (p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : '—');

        return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:0.55rem 0.75rem;font-weight:700;color:#64748B;">${idx + 1}</td>
                <td style="padding:0.55rem 0.75rem;color:#475569;white-space:nowrap;">${pDate}</td>
                <td style="padding:0.55rem 0.75rem;text-align:right;font-weight:700;color:#16A34A;">₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="padding:0.55rem 0.75rem;color:#334155;"><span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;font-weight:500;background:#EFF6FF;color:#1D4ED8;">${p.payment_method || 'Bank Transfer'}</span></td>
                <td style="padding:0.55rem 0.75rem;color:#64748B;">${p.notes || 'Payment Received'}</td>
            </tr>
        `;
    }).join('');
}

function closePayBalanceModal() {
    const modal = document.getElementById('payBalanceModal');
    if (modal) modal.style.display = 'none';
}

async function handlePayBalanceSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const orderId = document.getElementById('pay_order_id').value;
    const payVal = parseFloat(document.getElementById('pay_amount').value) || 0;
    const payMethod = document.getElementById('pay_method').value;
    const notes = document.getElementById('pay_notes').value.trim();

    if (!payMethod) {
        if (window.showAlert) {
            window.showAlert('Validation Error', 'Please select a Payment Method. Payment Method is mandatory.', 'warning');
        } else {
            alert('Please select a Payment Method. Payment Method is mandatory.');
        }
        const methodInput = document.getElementById('pay_method');
        if (methodInput) methodInput.focus();
        return;
    }

    if (payVal <= 0) {
        alert('Please enter a valid payment amount.');
        return;
    }

    const submitBtn = document.getElementById('paySubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
    }

    try {
        const res = await fetch(`${API_BASE}/orders/${orderId}/pay-balance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify({
                payment_amount: payVal,
                payment_method: payMethod,
                notes: notes
            })
        });

        if (res.ok) {
            const idx = allOrders.findIndex(o => String(o.order_id) === String(orderId));
            if (idx !== -1) {
                const currentAdv = parseFloat(allOrders[idx].advance_amount || 0);
                const currentTot = parseFloat(allOrders[idx].total_amount || 0);
                const newAdv = currentAdv + payVal;
                allOrders[idx].advance_amount = newAdv;
                allOrders[idx].balance_amount = Math.max(0, currentTot - newAdv);
            }
            closePayBalanceModal();
            filterDealerOrders();
            if (window.showAlert) {
                window.showAlert('Payment Success', `Payment of ₹${payVal.toLocaleString('en-IN')} recorded successfully!`, 'success');
            } else {
                alert(`Payment of ₹${payVal.toLocaleString('en-IN')} recorded successfully!`);
            }
            await fetchDealerOrders();
        } else {
            const errData = await res.json().catch(() => ({}));
            alert('Failed to record payment: ' + (errData.message || 'Server error'));
        }
    } catch (err) {
        console.error('Error submitting balance payment:', err);
        alert('Server connection error while submitting payment.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Submit Payment`;
        }
    }
}

// ==========================================
// VIEW ORDER DETAILS MODAL LOGIC
// ==========================================
function openOrderDetailsModal(orderId) {
    const o = allOrders.find(item => item.order_id == orderId);
    if (!o) return;

    const modal = document.getElementById('orderDetailsModal');
    const content = document.getElementById('viewModalContent');
    const headerStatus = document.getElementById('viewModalHeaderStatus');
    const footerLeft = document.getElementById('viewModalFooterLeft');
    if (!modal || !content) return;

    const totalVal = parseFloat(o.total_amount || 0);
    const discVal = parseFloat(o.discount || 0);
    const paidVal = parseFloat(o.advance_amount || 0);
    const balVal = Math.max(0, totalVal - paidVal);

    const orderIdText = window.formatOrderId ? window.formatOrderId(o.order_id, o.created_at) : `#SGB-ORD-${o.order_id}`;
    document.getElementById('viewModalOrderId').textContent = orderIdText;
    document.getElementById('viewModalOrderDate').textContent = `Placed on: ${o.created_at ? new Date(o.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}`;

    // Status pill
    const status = (o.order_status || 'ordered').toLowerCase();
    let statusClass = 'status-ordered';
    let statusLabel = 'ORDERED';
    let statusIcon = 'fa-cart-shopping';

    if (status === 'shipped') {
        statusClass = 'status-shipped';
        statusLabel = 'SHIPPED';
        statusIcon = 'fa-truck-fast';
    } else if (status === 'packed') {
        statusClass = 'status-packed';
        statusLabel = 'PACKED';
        statusIcon = 'fa-box';
    } else if (status === 'delivered') {
        statusClass = 'status-delivered';
        statusLabel = 'DELIVERED';
        statusIcon = 'fa-circle-check';
    } else if (status === 'cancelled') {
        statusClass = 'status-cancelled';
        statusLabel = 'CANCELLED';
        statusIcon = 'fa-ban';
    }

    if (headerStatus) {
        headerStatus.innerHTML = `<span class="status-pill ${statusClass}" style="font-size:0.75rem;"><i class="fa-solid ${statusIcon}"></i> ${statusLabel}</span>`;
    }

    // Dealer & Shipping Info
    const firmName = o.dealer_name || o.firm_name || o.customer_name || 'Dealer Store';
    const ownerName = o.contact_person || o.owner_name || o.customer_name || '—';
    const phone = o.phone_number || o.phone || '—';
    const city = o.dealer_city || o.city || 'Karnataka';
    const town = o.town_village || o.village || '';
    const taluk = o.taluk || o.sub_district || '';
    const district = o.dealer_district || o.district || city;
    const pincode = o.dealer_pincode || o.pincode || '';
    const gstNo = o.gst_no || 'Unregistered';
    const fullAddress = o.address || `${town ? town + ', ' : ''}${taluk ? taluk + ' Taluk, ' : ''}${city}${pincode ? ' - ' + pincode : ''}`;

    // Delivery & Logistics Info
    const deliveryType = o.delivery_type || 'Post office COD';
    const shippedDate = o.shipped_date ? new Date(o.shipped_date).toLocaleDateString('en-GB') : '—';
    const dispatchVia = o.dispatch_through || o.vrl_code || o.nearest_vrl || 'Standard Dispatch';
    const placedBy = o.created_by_name || o.salesperson_name || o.visited_by || (o.created_by ? (isNaN(o.created_by) ? o.created_by : `User #${o.created_by}`) : '');

    // Itemized table parsing
    let itemsRowsHtml = '';
    if (o.items_detailed) {
        const items = o.items_detailed.split('||');
        itemsRowsHtml = items.map((it, idx) => {
            const parts = it.split('::');
            const name = parts[0] || 'Agri Product';
            const qty = parseInt(parts[1] || 1, 10);
            const price = parseFloat(parts[2] || 0);
            const subtotal = parseFloat(parts[3] || (qty * price));

            return `
                <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:0.75rem 0.85rem;color:#64748B;font-weight:600;">${idx + 1}</td>
                    <td style="padding:0.75rem 0.85rem;">
                        <div style="font-weight:700;color:#0F172A;">${name}</div>
                    </td>
                    <td style="padding:0.75rem 0.85rem;text-align:center;font-weight:700;color:#0F172A;">${qty}</td>
                    <td style="padding:0.75rem 0.85rem;text-align:right;color:#475569;font-weight:600;">₹${price.toLocaleString('en-IN')}.00</td>
                    <td style="padding:0.75rem 0.85rem;text-align:right;font-weight:700;color:#0F172A;">₹${subtotal.toLocaleString('en-IN')}.00</td>
                </tr>
            `;
        }).join('');
    } else if (o.items_summary) {
        itemsRowsHtml = o.items_summary.split('||').map((item, idx) => `
            <tr style="border-bottom:1px solid #F1F5F9;">
                <td style="padding:0.75rem 0.85rem;color:#64748B;font-weight:600;">${idx + 1}</td>
                <td style="padding:0.75rem 0.85rem;font-weight:700;color:#0F172A;">${item}</td>
                <td style="padding:0.75rem 0.85rem;text-align:center;color:#64748B;">—</td>
                <td style="padding:0.75rem 0.85rem;text-align:right;color:#64748B;">—</td>
                <td style="padding:0.75rem 0.85rem;text-align:right;font-weight:700;color:#0F172A;">—</td>
            </tr>
        `).join('');
    } else {
        itemsRowsHtml = `<tr><td colspan="5" style="padding:1.5rem;text-align:center;color:#94a3b8;">No products listed.</td></tr>`;
    }

    content.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
            <!-- 1. Dealer Info & Logistics Overview Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:1rem;">
                <!-- Dealer Card -->
                <div style="background:#FFFBF7;border:1px solid #FFEDD5;border-radius:12px;padding:1.15rem;">
                    <div style="font-size:0.7rem;color:#C2410C;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:0.35rem;display:flex;align-items:center;gap:5px;">
                        <i class="fa-solid fa-store" style="color:#FF6B00;"></i> DEALER STORE INFORMATION
                    </div>
                    <div style="font-size:1.1rem;font-weight:800;color:#0F172A;">${firmName}</div>
                    <div style="font-size:0.85rem;color:#475569;margin-top:0.25rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                        <span><i class="fa-regular fa-user" style="color:#94A3B8;"></i> ${ownerName}</span>
                        ${phone !== '—' ? `<span>•</span> <a href="tel:${phone}" style="color:#FF6B00;text-decoration:none;font-weight:700;"><i class="fa-solid fa-phone"></i> ${phone}</a>` : ''}
                    </div>
                    <div style="font-size:0.825rem;color:#64748B;margin-top:0.4rem;line-height:1.4;">
                        <i class="fa-solid fa-location-dot" style="color:#EF4444;margin-right:4px;"></i> ${fullAddress}
                    </div>
                    <div style="margin-top:0.5rem;display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;background:#FFFFFF;border:1px solid #FED7AA;padding:3px 8px;border-radius:6px;color:#9A3412;font-weight:600;">
                        <span>GSTIN: <strong>${gstNo}</strong></span>
                    </div>
                </div>

                <!-- Logistics Card -->
                <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:1.15rem;display:flex;flex-direction:column;justify-content:space-between;">
                    <div>
                        <div style="font-size:0.7rem;color:#475569;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:0.35rem;display:flex;align-items:center;gap:5px;">
                            <i class="fa-solid fa-truck-ramp-box" style="color:#FF6B00;"></i> LOGISTICS & DELIVERY
                        </div>
                        <div style="display:flex;flex-direction:column;gap:0.45rem;margin-top:0.5rem;font-size:0.85rem;">
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#64748B;">Delivery Method:</span>
                                <span style="font-weight:700;color:#0F172A;background:#FFEDD5;color:#C2410C;padding:2px 8px;border-radius:4px;font-size:0.775rem;">${deliveryType}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#64748B;">Shipped Date:</span>
                                <span style="font-weight:700;color:#0F172A;">${shippedDate}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:#64748B;">Dispatch Through:</span>
                                <span style="font-weight:700;color:#0F172A;">${dispatchVia}</span>
                            </div>
                        </div>
                    </div>
                    ${placedBy ? `
                        <div style="margin-top:0.6rem;padding-top:0.5rem;border-top:1px dashed #E2E8F0;font-size:0.75rem;color:#64748B;">
                            Order Placed By: <strong style="color:#0F172A;">${placedBy}</strong>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- 2. Ordered Products Table -->
            <div>
                <div style="font-size:0.875rem;font-weight:800;color:#0F172A;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;">
                    <span><i class="fa-solid fa-boxes-stacked" style="color:#FF6B00;margin-right:6px;"></i> ORDERED PRODUCTS</span>
                </div>
                <div style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;background:#FFFFFF;">
                    <table style="width:100%;border-collapse:collapse;text-align:left;font-size:0.825rem;">
                        <thead style="background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
                            <tr>
                                <th style="padding:0.65rem 0.85rem;color:#64748B;font-size:0.725rem;text-transform:uppercase;width:40px;">#</th>
                                <th style="padding:0.65rem 0.85rem;color:#64748B;font-size:0.725rem;text-transform:uppercase;">Product / Bundle Name</th>
                                <th style="padding:0.65rem 0.85rem;color:#64748B;font-size:0.725rem;text-transform:uppercase;text-align:center;width:80px;">Qty</th>
                                <th style="padding:0.65rem 0.85rem;color:#64748B;font-size:0.725rem;text-transform:uppercase;text-align:right;width:120px;">Unit Price (₹)</th>
                                <th style="padding:0.65rem 0.85rem;color:#64748B;font-size:0.725rem;text-transform:uppercase;text-align:right;width:130px;">Subtotal (₹)</th>
                            </tr>
                        </thead>
                        <tbody>${itemsRowsHtml}</tbody>
                    </table>
                </div>
            </div>

            <!-- 3. Financial Breakdown Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:0.75rem;">
                <div style="background:#F8FAFC;padding:0.85rem;border-radius:10px;border:1px solid #E2E8F0;">
                    <div style="font-size:0.7rem;color:#64748B;font-weight:700;text-transform:uppercase;">Gross Total</div>
                    <div style="font-size:1.1rem;font-weight:800;color:#0F172A;margin-top:2px;">₹${(totalVal + discVal).toLocaleString('en-IN')}.00</div>
                </div>

                ${discVal > 0 ? `
                    <div style="background:#FFF7ED;padding:0.85rem;border-radius:10px;border:1px solid #FED7AA;">
                        <div style="font-size:0.7rem;color:#C2410C;font-weight:700;text-transform:uppercase;">Discount</div>
                        <div style="font-size:1.1rem;font-weight:800;color:#EA580C;margin-top:2px;">- ₹${discVal.toLocaleString('en-IN')}.00</div>
                    </div>
                ` : ''}

                <div style="background:#F8FAFC;padding:0.85rem;border-radius:10px;border:1px solid #E2E8F0;">
                    <div style="font-size:0.7rem;color:#64748B;font-weight:700;text-transform:uppercase;">Final Net Amount</div>
                    <div style="font-size:1.1rem;font-weight:800;color:#0F172A;margin-top:2px;">₹${totalVal.toLocaleString('en-IN')}.00</div>
                </div>

                <div style="background:#F0FDF4;padding:0.85rem;border-radius:10px;border:1px solid #BBF7D0;">
                    <div style="font-size:0.7rem;color:#166534;font-weight:700;text-transform:uppercase;">Total Paid</div>
                    <div style="font-size:1.1rem;font-weight:800;color:#16A34A;margin-top:2px;">₹${paidVal.toLocaleString('en-IN')}.00</div>
                </div>

                <div style="background:${balVal > 0 ? '#FEF2F2' : '#F0FDF4'};padding:0.85rem;border-radius:10px;border:1px solid ${balVal > 0 ? '#FECACA' : '#BBF7D0'};">
                    <div style="font-size:0.7rem;color:${balVal > 0 ? '#991B1B' : '#166534'};font-weight:700;text-transform:uppercase;">Balance Due</div>
                    <div style="font-size:1.1rem;font-weight:800;color:${balVal > 0 ? '#EF4444' : '#16A34A'};margin-top:2px;">
                        ${balVal > 0 ? `₹${balVal.toLocaleString('en-IN')}.00` : '✓ Cleared'}
                    </div>
                </div>
            </div>

            <!-- 4. Payment History Log -->
            <div>
                <div style="font-size:0.875rem;font-weight:800;color:#0F172A;margin-bottom:0.5rem;display:flex;justify-content:space-between;align-items:center;">
                    <span><i class="fa-solid fa-receipt" style="color:#FF6B00;margin-right:6px;"></i> PAYMENT TRANSACTIONS</span>
                </div>
                <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">
                    <table style="width:100%;border-collapse:collapse;text-align:left;font-size:0.825rem;">
                        <thead style="background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
                            <tr>
                                <th style="padding:0.65rem 0.85rem;font-size:0.7rem;color:#64748B;text-transform:uppercase;width:35px;">#</th>
                                <th style="padding:0.65rem 0.85rem;font-size:0.7rem;color:#64748B;text-transform:uppercase;width:120px;">Payment Date</th>
                                <th style="padding:0.65rem 0.85rem;font-size:0.7rem;color:#64748B;text-transform:uppercase;text-align:right;width:120px;">Amount Paid (₹)</th>
                                <th style="padding:0.65rem 0.85rem;font-size:0.7rem;color:#64748B;text-transform:uppercase;">Method</th>
                                <th style="padding:0.65rem 0.85rem;font-size:0.7rem;color:#64748B;text-transform:uppercase;">Notes / Reference</th>
                            </tr>
                        </thead>
                        <tbody id="modalPaymentHistoryBody">
                            <tr><td colspan="5" style="padding:1.25rem;text-align:center;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Loading payments...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Footer actions
    if (footerLeft) {
        footerLeft.innerHTML = `
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button type="button" class="btn-outline-card" onclick="openEditOrderModal(${o.order_id})" style="padding:0.5rem 1rem;font-size:0.825rem;font-weight:700;">
                    <i class="fa-regular fa-pen-to-square"></i> Edit Order
                </button>
                ${balVal > 0 ? `
                    <button type="button" onclick="closeOrderDetailsModal(); openPayBalanceModal(${o.order_id});" style="background:#16a34a;color:#ffffff;border:none;border-radius:8px;padding:0.5rem 1.15rem;font-weight:700;font-size:0.825rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem;">
                        <i class="fa-solid fa-indian-rupee-sign"></i> Pay Remaining Balance
                    </button>
                ` : ''}
            </div>
        `;
    }

    modal.style.display = 'flex';

    // Asynchronously fetch payment history records
    fetchOrderPaymentHistory(o);
}

async function fetchOrderPaymentHistory(order) {
    const tbody = document.getElementById('modalPaymentHistoryBody');
    if (!tbody) return;

    let historyRecords = [];

    try {
        const res = await fetch(`${API_BASE}/orders/${order.order_id}/payments`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (res.ok) {
            historyRecords = await res.json();
        }
    } catch (e) {
        console.error('Error fetching payments:', e);
    }

    const paidVal = parseFloat(order.advance_amount || 0);

    if (historyRecords.length === 0) {
        if (paidVal > 0) {
            tbody.innerHTML = `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:0.6rem 0.85rem;font-weight:700;color:#64748b;">1</td>
                    <td style="padding:0.6rem 0.85rem;color:#475569;">${order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : '—'}</td>
                    <td style="padding:0.6rem 0.85rem;text-align:right;font-weight:700;color:#16a34a;">₹${paidVal.toLocaleString('en-IN')}.00</td>
                    <td style="padding:0.6rem 0.85rem;color:#334155;">Bank Transfer / Cash</td>
                    <td style="padding:0.6rem 0.85rem;color:#64748b;">Initial Advance Payment</td>
                </tr>
            `;
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding:1rem;text-align:center;color:#94a3b8;">
                        No payment records found. Balance is pending.
                    </td>
                </tr>`;
        }
        return;
    }

    tbody.innerHTML = historyRecords.map((p, idx) => {
        const amt = parseFloat(p.amount || 0);
        const pDate = p.payment_date || (p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : '—');

        return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:0.65rem 0.85rem;font-weight:700;color:#64748b;">${idx + 1}</td>
                <td style="padding:0.65rem 0.85rem;color:#475569;white-space:nowrap;">${pDate}</td>
                <td style="padding:0.65rem 0.85rem;text-align:right;font-weight:700;color:#16a34a;">₹${amt.toLocaleString('en-IN')}.00</td>
                <td style="padding:0.65rem 0.85rem;color:#334155;">${p.payment_method || 'Bank Transfer'}</td>
                <td style="padding:0.65rem 0.85rem;color:#64748b;">${p.notes || 'Payment Received'}</td>
            </tr>
        `;
    }).join('');
}

function closeOrderDetailsModal() {
    const modal = document.getElementById('orderDetailsModal');
    if (modal) modal.style.display = 'none';
}

function exportOrdersCSV() {
    let listToExport = [];
    if (selectedOrderIds.size > 0) {
        listToExport = allOrders.filter(o => selectedOrderIds.has(String(o.order_id)));
    } else {
        listToExport = (filteredOrders && filteredOrders.length > 0) ? filteredOrders : allOrders;
    }

    if (!listToExport || listToExport.length === 0) {
        if (window.showAlert) {
            window.showAlert("Export Failed", "No order records available to export.", "info");
        } else {
            alert("No order records available to export.");
        }
        return;
    }

    const headers = [
        "Order ID",
        "Dealer / Store Name",
        "Contact Person",
        "Phone Number",
        "City",
        "Address",
        "Products & Quantities",
        "Purchased Date",
        "Shipped Date",
        "Total Amount (₹)",
        "Paid Amount (₹)",
        "Remaining Balance (₹)",
        "Payment Status",
        "Order Status"
    ];

    const sanitize = (val) => `"${String(val !== undefined && val !== null ? val : '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

    let csvContent = headers.map(h => sanitize(h)).join(",") + "\n";

    listToExport.forEach(o => {
        const orderIdText = window.formatOrderId ? window.formatOrderId(o.order_id, o.created_at) : `#SGB-ORD-${o.order_id}`;
        const total = parseFloat(o.total_amount || 0);
        const paid = parseFloat(o.advance_amount || 0);
        const bal = Math.max(0, total - paid);
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '';
        let shippedDate = '';
        if (o.shipped_date) {
            if (typeof o.shipped_date === 'string' && o.shipped_date.includes('-')) {
                const parts = o.shipped_date.slice(0, 10).split('-');
                if (parts.length === 3) {
                    shippedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                } else {
                    shippedDate = new Date(o.shipped_date).toLocaleDateString('en-GB');
                }
            } else {
                shippedDate = new Date(o.shipped_date).toLocaleDateString('en-GB');
            }
        }

        let itemsSummary = '';
        if (o.items && Array.isArray(o.items) && o.items.length > 0) {
            itemsSummary = o.items.map(it => `${it.product_name || it.name || 'Item'} (x${it.quantity || 1})`).join('; ');
        } else if (o.items_summary) {
            itemsSummary = o.items_summary.replace(/<br\s*\/?>/gi, '; ').replace(/\|\|/g, '; ');
        }

        const paymentStatus = bal === 0 ? 'Cleared' : (paid > 0 ? 'Partial' : 'Pending');

        const row = [
            orderIdText,
            o.dealer_name || o.firm_name || o.customer_name || '',
            o.contact_person || o.owner_name || '',
            o.phone || o.phone_number || '',
            o.city || '',
            o.address || '',
            itemsSummary,
            date,
            shippedDate,
            total,
            paid,
            bal,
            paymentStatus,
            (o.order_status || 'Draft').toUpperCase()
        ];

        csvContent += row.map(v => sanitize(v)).join(",") + "\n";
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    const fileNameSuffix = selectedOrderIds.size > 0 ? `selected_${selectedOrderIds.size}_orders` : 'dealer_orders';
    a.setAttribute('download', `${fileNameSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

async function deleteSelectedOrders() {
    if (!selectedOrderIds || selectedOrderIds.size === 0) {
        if (window.showAlert) {
            window.showAlert("Selection Required", "Please select at least one order to delete.", "info");
        } else {
            alert("Please select at least one order to delete.");
        }
        return;
    }

    const count = selectedOrderIds.size;
    const confirmMsg = `Are you sure you want to delete ${count} selected order(s)? This action cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    const btnDelete = document.getElementById('btnDeleteSelectedOrders');
    if (btnDelete) {
        btnDelete.disabled = true;
        btnDelete.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deleting...`;
    }

    try {
        const orderIdsArr = Array.from(selectedOrderIds).map(id => parseInt(id, 10)).filter(Boolean);
        const res = await fetch(`${API_BASE}/orders/bulk-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify({ orderIds: orderIdsArr })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            allOrders = allOrders.filter(o => !selectedOrderIds.has(String(o.order_id)));
            selectedOrderIds.clear();
            filterDealerOrders();
            if (window.showAlert) {
                window.showAlert("Orders Deleted", `Successfully deleted ${data.count || count} selected order(s).`, "success");
            } else {
                alert(`Successfully deleted ${data.count || count} selected order(s).`);
            }
        } else {
            alert("Failed to delete selected orders: " + (data.message || "Unknown error"));
        }
    } catch (err) {
        console.error("Error deleting selected orders:", err);
        alert("Network error deleting orders: " + err.message);
    } finally {
        if (btnDelete) {
            btnDelete.disabled = false;
            btnDelete.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Selected`;
        }
    }
}

async function clearSelectedPayments() {
    if (!selectedOrderIds || selectedOrderIds.size === 0) {
        if (window.showAlert) {
            window.showAlert("Selection Required", "Please select at least one order to clear payment.", "info");
        } else {
            alert("Please select at least one order to clear payment.");
        }
        return;
    }

    const count = selectedOrderIds.size;
    const confirmMsg = `Are you sure you want to clear the payment for ${count} selected order(s)?`;
    if (!confirm(confirmMsg)) return;

    const btnClearPayment = document.getElementById('btnClearSelectedPayments');
    if (btnClearPayment) {
        btnClearPayment.disabled = true;
        btnClearPayment.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Clearing...`;
    }

    try {
        const orderIdsArr = Array.from(selectedOrderIds).map(id => parseInt(id, 10)).filter(Boolean);
        const res = await fetch(`${API_BASE}/orders/bulk-clear-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify({ orderIds: orderIdsArr })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            // Update local memory state for selected orders
            allOrders.forEach(o => {
                if (selectedOrderIds.has(String(o.order_id))) {
                    o.advance_amount = parseFloat(o.total_amount || 0);
                    o.balance_amount = 0;
                }
            });
            selectedOrderIds.clear();
            filterDealerOrders();
            if (window.showAlert) {
                window.showAlert("Payment Cleared", `Successfully cleared payment for ${data.count || count} selected order(s).`, "success");
            } else {
                alert(`Successfully cleared payment for ${data.count || count} selected order(s).`);
            }
        } else {
            alert("Failed to clear payment for selected orders: " + (data.message || "Unknown error"));
        }
    } catch (err) {
        console.error("Error clearing selected payments:", err);
        alert("Network error clearing payments: " + err.message);
    } finally {
        if (btnClearPayment) {
            btnClearPayment.disabled = false;
            btnClearPayment.innerHTML = `<i class="fa-solid fa-indian-rupee-sign"></i> Clear Payment`;
        }
    }
}

async function updateSelectedOrdersStatus(newStatus) {
    if (!newStatus) return;

    const selectEl = document.getElementById('bulkOrderStatusSelect');

    if (!selectedOrderIds || selectedOrderIds.size === 0) {
        if (window.showAlert) {
            window.showAlert("Selection Required", "Please select at least one order to update status.", "info");
        } else {
            alert("Please select at least one order to update status.");
        }
        if (selectEl) selectEl.value = '';
        return;
    }

    const count = selectedOrderIds.size;
    const formattedStatus = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    const confirmMsg = `Are you sure you want to update status to '${formattedStatus}' for ${count} selected order(s)?`;

    if (!confirm(confirmMsg)) {
        if (selectEl) selectEl.value = '';
        return;
    }

    if (selectEl) selectEl.disabled = true;

    try {
        const orderIdsArr = Array.from(selectedOrderIds).map(id => parseInt(id, 10)).filter(Boolean);
        const res = await fetch(`${API_BASE}/orders/bulk-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify({
                orderIds: orderIdsArr,
                order_status: newStatus
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            allOrders.forEach(o => {
                if (selectedOrderIds.has(String(o.order_id))) {
                    o.order_status = newStatus;
                    if (newStatus === 'shipped' && !o.shipped_date) {
                        o.shipped_date = new Date().toISOString();
                    }
                }
            });

            selectedOrderIds.clear();
            filterDealerOrders();

            if (window.showAlert) {
                window.showAlert("Status Updated", `Successfully updated ${data.count || count} order(s) to '${formattedStatus}'.`, "success");
            } else {
                alert(`Successfully updated ${data.count || count} order(s) to '${formattedStatus}'.`);
            }
        } else {
            alert("Failed to update orders status: " + (data.message || "Unknown error"));
        }
    } catch (err) {
        console.error("Error updating selected orders status:", err);
        alert("Network error updating order status: " + err.message);
    } finally {
        if (selectEl) {
            selectEl.disabled = false;
            selectEl.value = '';
        }
    }
}

// ==========================================
// EDIT ORDER MODAL LOGIC
// ==========================================
function openEditOrderModal(orderId) {
    const o = allOrders.find(item => item.order_id == orderId);
    if (!o) return;

    const modal = document.getElementById('editOrderModal');
    if (!modal) return;

    document.getElementById('edit_order_id').value = o.order_id;
    document.getElementById('editModalOrderTitle').textContent = `Edit Order #SGB-ORD-${o.order_id}`;

    // Pre-fill Status
    const statusSelect = document.getElementById('edit_order_status');
    if (statusSelect) {
        statusSelect.value = (o.order_status || 'ordered').toLowerCase();
        statusSelect.onchange = handleEditOrderStatusChange;
    }

    // Pre-fill Shipped Date
    const shippedInput = document.getElementById('edit_shipped_date');
    if (shippedInput) {
        if (o.shipped_date) {
            shippedInput.value = new Date(o.shipped_date).toISOString().slice(0, 10);
        } else {
            shippedInput.value = '';
        }
    }

    // Pre-fill Total Amount (read-only)
    const totalVal = parseFloat(o.total_amount || 0);
    document.getElementById('edit_total_amount').value = totalVal.toLocaleString('en-IN') + '.00';

    handleEditOrderStatusChange();

    modal.style.display = 'flex';
}

function handleEditOrderStatusChange() {
    const statusSelect = document.getElementById('edit_order_status');
    const shippedInput = document.getElementById('edit_shipped_date');
    const asterisk = document.getElementById('shippedDateRequiredAsterisk');
    if (!statusSelect || !shippedInput) return;

    const val = statusSelect.value;
    if (val === 'shipped') {
        shippedInput.disabled = false;
        shippedInput.style.background = '#ffffff';
        shippedInput.style.cursor = 'pointer';
        shippedInput.setAttribute('required', 'required');
        if (asterisk) asterisk.style.display = 'inline';
        if (!shippedInput.value) {
            shippedInput.value = new Date().toISOString().slice(0, 10);
        }
        shippedInput.focus();
    } else {
        shippedInput.disabled = true;
        shippedInput.style.background = '#f1f5f9';
        shippedInput.style.cursor = 'not-allowed';
        shippedInput.removeAttribute('required');
        if (asterisk) asterisk.style.display = 'none';
    }
}

async function fetchEditOrderPaymentHistory(order) {
    const tbody = document.getElementById('editOrderPaymentHistoryBody');
    const badge = document.getElementById('editPaymentCountBadge');
    if (!tbody) return;

    let historyRecords = [];

    try {
        const res = await fetch(`${API_BASE}/orders/${order.order_id}/payments`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (res.ok) {
            historyRecords = await res.json();
        }
    } catch (e) {
        console.error('Error fetching edit modal payments:', e);
    }

    const paidVal = parseFloat(order.advance_amount || 0);

    if (historyRecords.length === 0) {
        if (paidVal > 0) {
            if (badge) badge.textContent = '1 record';
            const orderDateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB') : '—';
            tbody.innerHTML = `
                <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:0.5rem 0.75rem;font-weight:700;color:#64748B;">1</td>
                    <td style="padding:0.5rem 0.75rem;color:#475569;white-space:nowrap;">${orderDateStr}</td>
                    <td style="padding:0.5rem 0.75rem;text-align:right;font-weight:700;color:#16A34A;">₹${paidVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="padding:0.5rem 0.75rem;color:#334155;"><span style="background:#F1F5F9;color:#475569;padding:2px 6px;border-radius:4px;font-size:0.75rem;">Bank Transfer / Cash</span></td>
                    <td style="padding:0.5rem 0.75rem;color:#64748B;">Initial Advance Payment</td>
                </tr>
            `;
        } else {
            if (badge) badge.textContent = '0 records';
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding:1rem;text-align:center;color:#94A3B8;">
                        <i class="fa-solid fa-receipt" style="margin-right:6px;opacity:0.6;"></i> No previous payment records found.
                    </td>
                </tr>`;
        }
        return;
    }

    if (badge) badge.textContent = `${historyRecords.length} record${historyRecords.length > 1 ? 's' : ''}`;

    tbody.innerHTML = historyRecords.map((p, idx) => {
        const amt = parseFloat(p.amount || 0);
        let pDate = '—';
        if (p.payment_date) {
            pDate = new Date(p.payment_date).toLocaleDateString('en-GB');
        } else if (p.created_at) {
            pDate = new Date(p.created_at).toLocaleDateString('en-GB');
        }

        return `
            <tr style="border-bottom:1px solid #F1F5F9;">
                <td style="padding:0.55rem 0.75rem;font-weight:700;color:#64748B;">${idx + 1}</td>
                <td style="padding:0.55rem 0.75rem;color:#475569;white-space:nowrap;">${pDate}</td>
                <td style="padding:0.55rem 0.75rem;text-align:right;font-weight:700;color:#16A34A;">₹${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="padding:0.55rem 0.75rem;color:#334155;"><span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;font-weight:500;background:#EFF6FF;color:#1D4ED8;">${p.payment_method || 'Bank Transfer'}</span></td>
                <td style="padding:0.55rem 0.75rem;color:#64748B;">${p.notes || 'Payment Received'}</td>
            </tr>
        `;
    }).join('');
}

function closeEditOrderModal() {
    const modal = document.getElementById('editOrderModal');
    if (modal) modal.style.display = 'none';
}

function recalcEditBalance() {
    const total = parseFloat(document.getElementById('edit_total_amount').value) || 0;
    const paid = parseFloat(document.getElementById('edit_advance_amount').value) || 0;
    const addPay = parseFloat(document.getElementById('edit_new_payment')?.value) || 0;

    const totalPaid = paid + addPay;
    const bal = Math.max(0, total - totalPaid);
    document.getElementById('edit_balance_amount').value = bal;
}

async function handleEditOrderSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const orderId = document.getElementById('edit_order_id').value;
    const status = document.getElementById('edit_order_status').value;
    const shippedDate = document.getElementById('edit_shipped_date').value;
    const totalVal = parseFloat(String(document.getElementById('edit_total_amount').value).replace(/,/g, '')) || 0;

    if (status === 'shipped' && !shippedDate) {
        if (window.showAlert) {
            window.showAlert('Validation Error', 'Please select a Shipped Date when status is set to Shipped.', 'warning');
        } else {
            alert('Please select a Shipped Date when status is set to Shipped.');
        }
        const shippedInput = document.getElementById('edit_shipped_date');
        if (shippedInput) shippedInput.focus();
        return;
    }

    const submitBtn = document.getElementById('editOrderSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    }

    try {
        const res = await fetch(`${API_BASE}/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify({
                order_status: status,
                shipped_date: shippedDate || null,
                total_amount: totalVal
            })
        });

        if (res.ok) {
            const idx = allOrders.findIndex(o => String(o.order_id) === String(orderId));
            if (idx !== -1) {
                allOrders[idx].order_status = status;
                if (shippedDate) allOrders[idx].shipped_date = shippedDate;
                if (totalVal) allOrders[idx].total_amount = totalVal;
            }
            closeEditOrderModal();
            filterDealerOrders();
            if (window.showAlert) {
                window.showAlert('Order Updated', `Order #SGB-ORD-${orderId} details updated successfully!`, 'success');
            } else {
                alert(`Order #SGB-ORD-${orderId} details updated successfully!`);
            }
            await fetchDealerOrders();
        } else {
            const errData = await res.json().catch(() => ({}));
            alert('Failed to update order: ' + (errData.message || 'Server error'));
        }
    } catch (err) {
        console.error('Error updating order:', err);
        alert('Server connection error while updating order.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Changes`;
        }
    }
}

async function deleteDealerOrder(orderId) {
    if (!orderId) return;

    const confirmMsg = `Are you sure you want to delete order #${orderId}? This action cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    try {
        let res = await fetch(`${API_BASE}/orders/${orderId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token()}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.status === 404) {
            res = await fetch(`${window.API_URL}/orders/${orderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token()}`,
                    'Content-Type': 'application/json'
                }
            });
        }

        if (res.ok) {
            allOrders = allOrders.filter(o => String(o.order_id) !== String(orderId));
            selectedOrderIds.delete(String(orderId));
            filterDealerOrders();
            if (window.showAlert) {
                window.showAlert('Deleted', `Order #${orderId} deleted successfully!`, 'success');
            } else {
                alert(`Order #${orderId} deleted successfully!`);
            }
            await fetchDealerOrders();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.message || data.error || 'Failed to delete order.');
        }
    } catch (err) {
        console.error('Error deleting order:', err);
        alert('Server connection error while deleting order.');
    }
}

// Window Exports
window.fetchDealerOrders = fetchDealerOrders;
window.populateDealerDropdown = populateDealerDropdown;
window.filterDealerOrders = filterDealerOrders;
window.renderDealerOrdersTable = renderDealerOrdersTable;
window.goToOrdersPage = goToOrdersPage;
window.changeOrdersPageSize = changeOrdersPageSize;
window.openPayBalanceModal = openPayBalanceModal;
window.closePayBalanceModal = closePayBalanceModal;
window.handlePayBalanceSubmit = handlePayBalanceSubmit;
window.openOrderDetailsModal = openOrderDetailsModal;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.openEditOrderModal = openEditOrderModal;
window.closeEditOrderModal = closeEditOrderModal;
window.recalcEditBalance = recalcEditBalance;
window.handleEditOrderSubmit = handleEditOrderSubmit;
window.fetchEditOrderPaymentHistory = fetchEditOrderPaymentHistory;
window.exportOrdersCSV = exportOrdersCSV;
window.deleteDealerOrder = deleteDealerOrder;
window.deleteSelectedOrders = deleteSelectedOrders;
window.toggleSelectAllOrders = toggleSelectAllOrders;
window.handleOrderSelectChange = handleOrderSelectChange;
window.resetOrderFilters = resetOrderFilters;
window.syncOrderSearch = syncOrderSearch;
