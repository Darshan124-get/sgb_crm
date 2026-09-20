// ============================================================
// dealer.js — Dealers List & Add Dealer Module Logic
// ============================================================

const API_BASE = `${window.API_URL}/dealers`;
const token = () => localStorage.getItem('token');

let allDealers = [];
let filteredDealers = [];
let currentPage = 1;
let pageSize = 10;
let isManageAllowed = true;
let currentProfileDealer = null;
let customVisitQuestionCounter = 0;
let pendingImportDealersList = [];

document.addEventListener('DOMContentLoaded', () => {
    if (window.requireAuth && !window.requireAuth([])) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const profileElem = document.getElementById('profileName');
    if (profileElem) profileElem.textContent = user.name || user.email || 'admin';

    const role = (user.role || '').toLowerCase();
    isManageAllowed = (role === 'admin' || role === 'super-admin' || role === 'sales');

    const addBtn = document.getElementById('addDealerBtn');
    if (addBtn && !isManageAllowed) {
        addBtn.style.display = 'none';
    }

    setTimeout(() => {
        const navDealers = document.getElementById('nav-dealers');
        if (navDealers) {
            document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));
            navDealers.classList.add('active');
        }
    }, 250);

    window.addEventListener('popstate', () => {
        restoreActiveViewState();
    });

    const btnImport = document.getElementById('btnImportDealers');
    if (btnImport) {
        btnImport.addEventListener('click', (e) => {
            openImportDealersModal(e);
        });
    }

    fetchDealers(true);
});

// Fetch dealers from API
async function fetchDealers(isInitial = false) {
    try {
        const res = await fetch(API_BASE, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (res.ok) {
            const data = await res.json();
            allDealers = Array.isArray(data) ? data : [];
        } else {
            allDealers = [];
        }
    } catch (e) {
        console.error('API error fetching dealers:', e);
        allDealers = [];
    }
    
    // Automatically calculate live total business for each dealer from all orders
    try {
        const ordersRes = await fetch(`${API_BASE}/orders`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (ordersRes.ok) {
            const ordersData = await ordersRes.json();
            const totalsMap = new Map();
            const countsMap = new Map();
            (Array.isArray(ordersData) ? ordersData : []).forEach(o => {
                const status = (o.order_status || '').toLowerCase();
                if (o.dealer_id && status !== 'cancelled') {
                    const amt = parseFloat(o.total_amount || 0);
                    const idNum = Number(o.dealer_id);
                    totalsMap.set(idNum, (totalsMap.get(idNum) || 0) + amt);
                    countsMap.set(idNum, (countsMap.get(idNum) || 0) + 1);
                }
            });

            allDealers.forEach(d => {
                const mapVal = totalsMap.get(Number(d.dealer_id));
                const countVal = countsMap.get(Number(d.dealer_id)) || 0;
                d.total_orders = countVal;
                if (mapVal !== undefined) {
                    d.total_business = mapVal;
                } else if (!d.total_business) {
                    d.total_business = 0;
                }
            });
        }
    } catch (err) {
        console.error('Error fetching dealer orders for total business:', err);
    }

    // Sort by highest total business / purchase amount first
    allDealers.sort((a, b) => (parseFloat(b.total_business) || 0) - (parseFloat(a.total_business) || 0));

    updateStatCounters();
    filterDealers();

    if (isInitial) {
        restoreActiveViewState();
    }
}

// Calculate 45-day active status info from most recent order date
function calculateDealerStatusInfo(d, orders = null) {
    let lastOrderDate = null;

    if (orders && Array.isArray(orders)) {
        const validOrders = orders
            .filter(o => o.dealer_id == d.dealer_id && (o.order_status || '').toLowerCase() !== 'cancelled')
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        
        if (validOrders.length > 0 && validOrders[0].created_at) {
            lastOrderDate = new Date(validOrders[0].created_at);
        }
    } else if (d.last_order_date) {
        const parsed = new Date(d.last_order_date);
        if (!isNaN(parsed.getTime())) {
            lastOrderDate = parsed;
        }
    }

    const now = new Date();
    let isActive = false;
    let daysRemaining = 0;
    let activeUntilDate = null;
    const hasOrders = !!lastOrderDate;

    if (lastOrderDate) {
        const effectiveOrderDate = lastOrderDate.getTime() > now.getTime() ? now : lastOrderDate;
        activeUntilDate = new Date(effectiveOrderDate.getTime() + 45 * 24 * 60 * 60 * 1000);
        const msDiff = activeUntilDate.getTime() - now.getTime();
        const rawDays = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
        daysRemaining = Math.min(45, Math.max(0, rawDays));
        if (daysRemaining > 0) {
            isActive = true;
        } else {
            isActive = false;
            daysRemaining = 0;
        }
    }

    // Status Tier Logic:
    // 🟢 Green = safe → > 30 days remaining
    // 🟡 Yellow = attention → 16–30 days
    // 🟠 Orange = urgent → 1–15 days
    // 🔴 Red = inactive → 0 days
    let statusTier = 'inactive';
    let statusClass = 'inactive';
    let statusLabel = 'INACTIVE';
    let statusColor = '#dc2626';

    if (isActive && daysRemaining > 30) {
        statusTier = 'safe';
        statusClass = 'active';
        statusLabel = 'ACTIVE';
        statusColor = '#16a34a';
    } else if (isActive && daysRemaining >= 16) {
        statusTier = 'attention';
        statusClass = 'attention';
        statusLabel = 'ACTIVE';
        statusColor = '#ca8a04';
    } else if (isActive && daysRemaining >= 1) {
        statusTier = 'urgent';
        statusClass = 'urgent';
        statusLabel = 'ACTIVE';
        statusColor = '#c2410c';
    } else {
        statusTier = 'inactive';
        statusClass = 'inactive';
        statusLabel = 'INACTIVE';
        statusColor = '#dc2626';
    }

    return {
        status: isActive ? 'Active' : 'Inactive',
        statusTier: statusTier,
        statusLabel: statusLabel,
        statusClass: statusClass,
        statusColor: statusColor,
        daysRemaining: daysRemaining,
        lastOrderDate: lastOrderDate,
        activeUntilDate: activeUntilDate,
        hasOrders: hasOrders,
        lastOrderDateFormatted: lastOrderDate ? lastOrderDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No orders',
        activeUntilFormatted: activeUntilDate ? activeUntilDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'
    };
}

// Update summary stats
function updateStatCounters() {
    const total = allDealers.length;
    let active = 0;
    let inactive = 0;

    allDealers.forEach(d => {
        const info = calculateDealerStatusInfo(d);
        if (info.status === 'Active') {
            active++;
        } else {
            inactive++;
        }
    });

    const tElem = document.getElementById('totalDealersCount');
    const aElem = document.getElementById('activeDealersCount');
    const iElem = document.getElementById('inactiveDealersCount');

    if (tElem) tElem.textContent = total;
    if (aElem) aElem.textContent = active;
    if (iElem) iElem.textContent = inactive;
}

function formatVisitedDate(dateStr, createdAt) {
    if (dateStr && dateStr.trim()) {
        const val = dateStr.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            const [y, m, d] = val.split('-');
            return `${d}/${m}/${y}`;
        }
        return val;
    }
    if (createdAt) {
        try {
            const dt = new Date(createdAt);
            if (!isNaN(dt.getTime())) {
                const day = String(dt.getDate()).padStart(2, '0');
                const month = String(dt.getMonth() + 1).padStart(2, '0');
                const year = dt.getFullYear();
                return `${day}/${month}/${year}`;
            }
        } catch (e) {}
    }
    return '—';
}

function formatVisitedBy(visitedByStr) {
    if (visitedByStr && visitedByStr.trim()) {
        return visitedByStr.trim();
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.name || user.email || 'SGB Sales';
}

function formatGstNo(gstStr) {
    if (gstStr && gstStr.trim()) {
        return gstStr.trim();
    }
    return 'Unregistered';
}

let selectedDealerIds = new Set();

function updateSelectedDealersUI() {
    const badge = document.getElementById('selectedDealersBadge');
    const countSpan = document.getElementById('selectedDealersCount');
    const btnDelete = document.getElementById('btnDeleteSelectedDealers');
    const btnExportLabel = document.getElementById('btnExportDealersLabel');
    const masterChk = document.getElementById('selectAllDealersCheckbox');

    const count = selectedDealerIds.size;
    if (count > 0) {
        if (badge) badge.style.display = 'inline-flex';
        if (countSpan) countSpan.textContent = count;
        if (btnDelete) btnDelete.style.display = 'inline-flex';
        if (btnExportLabel) btnExportLabel.textContent = `Export Selected (${count})`;
    } else {
        if (badge) badge.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
        if (btnExportLabel) btnExportLabel.textContent = 'Export';
    }

    if (masterChk) {
        const visibleDealerIds = (filteredDealers || []).slice((currentPage - 1) * pageSize, currentPage * pageSize).map(d => String(d.dealer_id));
        if (visibleDealerIds.length > 0 && visibleDealerIds.every(id => selectedDealerIds.has(id))) {
            masterChk.checked = true;
            masterChk.indeterminate = false;
        } else if (visibleDealerIds.some(id => selectedDealerIds.has(id))) {
            masterChk.checked = false;
            masterChk.indeterminate = true;
        } else {
            masterChk.checked = false;
            masterChk.indeterminate = false;
        }
    }
}

function toggleSelectAllDealers(masterChk) {
    const visibleDealers = (filteredDealers || []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
    if (masterChk.checked) {
        visibleDealers.forEach(d => selectedDealerIds.add(String(d.dealer_id)));
    } else {
        visibleDealers.forEach(d => selectedDealerIds.delete(String(d.dealer_id)));
    }
    renderDealersTable();
}

function handleDealerSelectChange(chk, dealerIdStr) {
    if (chk.checked) {
        selectedDealerIds.add(String(dealerIdStr));
    } else {
        selectedDealerIds.delete(String(dealerIdStr));
    }
    updateSelectedDealersUI();
}

async function deleteSelectedDealers() {
    if (!selectedDealerIds || selectedDealerIds.size === 0) {
        if (window.showAlert) {
            window.showAlert("Selection Required", "Please select at least one dealer to delete.", "info");
        } else {
            alert("Please select at least one dealer to delete.");
        }
        return;
    }

    const count = selectedDealerIds.size;
    const confirmMsg = `Are you sure you want to delete ${count} selected dealer(s)? All orders and data associated with these dealers will also be removed. This cannot be undone!`;
    if (!confirm(confirmMsg)) return;

    const btnDelete = document.getElementById('btnDeleteSelectedDealers');
    if (btnDelete) {
        btnDelete.disabled = true;
        btnDelete.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Deleting...`;
    }

    try {
        const dealerIdsArr = Array.from(selectedDealerIds).map(id => parseInt(id, 10)).filter(Boolean);
        const res = await fetch(`${API_BASE}/bulk-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify({ dealerIds: dealerIdsArr })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            allDealers = allDealers.filter(d => !selectedDealerIds.has(String(d.dealer_id)));
            selectedDealerIds.clear();
            updateStatCounters();
            filterDealers();
            if (window.showAlert) {
                window.showAlert("Dealers Deleted", `Successfully deleted ${data.count || count} selected dealer(s).`, "success");
            } else {
                alert(`Successfully deleted ${data.count || count} selected dealer(s).`);
            }
        } else {
            alert("Failed to delete selected dealers: " + (data.message || "Unknown error"));
        }
    } catch (err) {
        console.error("Error deleting selected dealers:", err);
        alert("Network error deleting dealers: " + err.message);
    } finally {
        if (btnDelete) {
            btnDelete.disabled = false;
            btnDelete.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Selected`;
        }
    }
}

// Render Table with pagination
function renderDealersTable() {
    const tbody = document.getElementById('dealerTableBody');
    if (!tbody) return;

    if (filteredDealers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="padding:3rem;text-align:center;color:#94a3b8;">
                    <i class="fa-solid fa-store-slash fa-2x" style="margin-bottom:0.5rem;display:block;color:#cbd5e1;"></i>
                    No dealer records found matching your search.
                </td>
            </tr>`;
        updatePaginationControls(0, 0, 0);
        updateSelectedDealersUI();
        return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredDealers.length);
    const paginatedItems = filteredDealers.slice(startIndex, endIndex);

    tbody.innerHTML = paginatedItems.map(d => {
        const isSelected = selectedDealerIds.has(String(d.dealer_id));
        const dealerCode = d.dealer_code || `SGB-${String(d.dealer_id).padStart(3, '0')}`;
        const firmName = d.firm_name || d.dealer_name || 'Agri Store';
        const dealerName = d.owner_name || d.contact_person || '—';
        const phone = d.phone_number || d.phone || '—';

        // Format address multi-line nicely
        let address = d.address || '';
        if (!address && d.city) {
            address = `${d.taluk ? d.taluk + ' Taluk,\n' : ''}${d.city}, ${d.state || 'Karnataka'}${d.pincode ? ' - ' + d.pincode : ''}`;
        }
        address = address.replace(/,/g, ', ').replace(/\n/g, '<br>');

        const gstNo = formatGstNo(d.gst_no || d.gst_number);
        const totalBusinessVal = parseFloat(d.total_business) || 0;

        const statusInfo = calculateDealerStatusInfo(d);

        let statusSubtext = '';
        if (statusInfo.status === 'Active') {
            statusSubtext = `
                <div style="font-size:0.725rem;color:${statusInfo.statusColor};font-weight:700;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:4px;">
                    <span style="font-size:0.6rem;">●</span> ${statusInfo.daysRemaining} day${statusInfo.daysRemaining === 1 ? '' : 's'} left
                </div>
            `;
        } else {
            if (statusInfo.hasOrders) {
                statusSubtext = `
                    <div style="font-size:0.7rem;color:#dc2626;font-weight:600;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:4px;">
                        45-day period expired
                    </div>
                `;
            } else {
                statusSubtext = `
                    <div style="font-size:0.7rem;color:#64748b;font-weight:600;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:4px;">
                        No orders placed
                    </div>
                `;
            }
        }

        return `
            <tr style="border-bottom:1px solid #f1f5f9;transition:background-color 0.15s ease;${isSelected ? 'background-color:#F0F9FF;' : ''}" onmouseover="if(!${isSelected}) this.style.backgroundColor='#f8fafc'" onmouseout="if(!${isSelected}) this.style.backgroundColor='transparent'">
                <td style="padding:1rem 0.75rem;text-align:center;">
                    <input type="checkbox" class="dealer-chk" value="${d.dealer_id}" ${isSelected ? 'checked' : ''} onchange="handleDealerSelectChange(this, '${d.dealer_id}')" style="width:16px;height:16px;cursor:pointer;accent-color:#FF6B00;">
                </td>
                <td style="padding:1rem 1.25rem;white-space:nowrap;">
                    <span onclick="event.stopPropagation(); viewDealerById(${d.dealer_id})" title="Click to view details for ${dealerCode}" style="background:#FFEDD5;color:#C2410C;font-weight:800;padding:4px 8px;border-radius:6px;font-family:monospace;font-size:0.8rem;border:1px solid #FDBA74;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all 0.15s ease;" onmouseover="this.style.background='#FED7AA';this.style.borderColor='#FB923C';" onmouseout="this.style.background='#FFEDD5';this.style.borderColor='#FDBA74';">
                        <i class="fa-solid fa-id-badge" style="font-size:0.75rem;"></i> ${dealerCode}
                    </span>
                </td>
                <td style="padding:1rem 1.25rem;">
                    <div style="font-weight:700;color:#0f172a;font-size:0.875rem;display:flex;align-items:center;gap:6px;">
                        <i class="fa-solid fa-store" style="color:#FF6B00;font-size:0.85rem;flex-shrink:0;"></i>
                        <span>${firmName}</span>
                    </div>
                    ${dealerName && dealerName !== '—' ? `
                        <div style="font-size:0.775rem;color:#64748b;font-weight:500;margin-top:4px;display:flex;align-items:center;gap:5px;">
                            <i class="fa-regular fa-user" style="color:#94a3b8;font-size:0.75rem;flex-shrink:0;"></i>
                            <span>${dealerName}</span>
                        </div>
                    ` : ''}
                </td>
                <td style="padding:1rem 1.25rem;color:#334155;white-space:nowrap;">
                    <i class="fa-solid fa-phone" style="color:#94a3b8;font-size:0.75rem;margin-right:6px;"></i>${phone}
                </td>
                <td style="padding:1rem 1.25rem;color:#475569;font-size:0.825rem;line-height:1.4;">${address}</td>
                <td style="padding:1rem 1.25rem;text-align:center;white-space:nowrap;">
                    <span style="background:#EFF6FF;color:#1D4ED8;font-weight:800;padding:3px 10px;border-radius:12px;font-size:0.8rem;border:1px solid #BFDBFE;display:inline-block;">${d.total_orders || 0} order${(d.total_orders || 0) === 1 ? '' : 's'}</span>
                </td>
                <td style="padding:1rem 1.25rem;white-space:nowrap;">
                    <strong style="color:#0f172a;font-size:0.875rem;font-weight:800;">₹${totalBusinessVal.toLocaleString('en-IN')}.00</strong>
                </td>
                <td style="padding:1rem 1.25rem;color:#475569;font-size:0.825rem;white-space:nowrap;">
                    ${statusInfo.hasOrders ? `<i class="fa-regular fa-calendar-check" style="color:#16a34a;font-size:0.8rem;margin-right:6px;"></i><strong style="color:#0f172a;">${statusInfo.lastOrderDateFormatted}</strong>` : `<span style="color:#94a3b8;">No orders</span>`}
                </td>
                <td style="padding:1rem 1.25rem;color:#475569;font-size:0.8rem;font-family:monospace;letter-spacing:0.02em;">${gstNo}</td>
                <td style="padding:1rem 1.25rem;text-align:center;">
                    <span class="status-pill ${statusInfo.statusClass}">${statusInfo.statusLabel}</span>
                    ${statusSubtext}
                </td>
                <td style="padding:1rem 1.25rem;text-align:center;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:0.4rem;">
                        ${isManageAllowed ? `
                            <button class="action-btn-square" title="Place Order" style="color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;" onclick="event.stopPropagation(); openOrderPageForDealer(${d.dealer_id})">
                                <i class="fa-solid fa-cart-plus"></i>
                            </button>
                            <button class="action-btn-square" title="Edit Dealer" onclick="event.stopPropagation(); editDealerById(${d.dealer_id})">
                                <i class="fa-regular fa-pen-to-square"></i>
                            </button>
                            <button class="action-btn-square" title="Delete Dealer" style="color:#ef4444;" onclick="event.stopPropagation(); deleteDealer(${d.dealer_id})">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updatePaginationControls(startIndex + 1, endIndex, filteredDealers.length);
    updateSelectedDealersUI();
}

// Pagination Controls update
function updatePaginationControls(start, end, total) {
    const infoElem = document.getElementById('paginationInfo');
    if (infoElem) {
        infoElem.textContent = total > 0 ? `Showing ${start} to ${end} of ${total} entries` : 'Showing 0 entries';
    }

    const pagesElem = document.getElementById('paginationPages');
    if (!pagesElem) return;

    const totalPages = Math.ceil(total / pageSize) || 1;
    if (totalPages <= 1) {
        pagesElem.innerHTML = '';
        return;
    }

    let startPage = Math.max(1, currentPage - 1);
    let endPage = startPage + 2;

    if (endPage > totalPages) {
        endPage = totalPages;
        startPage = Math.max(1, endPage - 2);
    }

    let pageHtml = `<button class="page-btn" ${currentPage === 1 ? 'disabled style="opacity:0.5;cursor:default;"' : ''} onclick="changePage(${currentPage - 1})" title="Previous Page"><i class="fa-solid fa-chevron-left"></i></button>`;

    for (let i = startPage; i <= endPage; i++) {
        pageHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageHtml += `<span style="color:#94a3b8;padding:0 4px;font-size:0.8rem;font-weight:700;">...</span>`;
        }
        pageHtml += `<button class="page-btn ${totalPages === currentPage ? 'active' : ''}" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    pageHtml += `<button class="page-btn" ${currentPage === totalPages ? 'disabled style="opacity:0.5;cursor:default;"' : ''} onclick="changePage(${currentPage + 1})" title="Next Page"><i class="fa-solid fa-chevron-right"></i></button>`;

    pagesElem.innerHTML = pageHtml;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredDealers.length / pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderDealersTable();
}

function changePageSize(val) {
    if (val === 'custom') {
        const customVal = prompt("Enter custom page size (items per page):", pageSize);
        if (customVal !== null) {
            const parsed = parseInt(customVal.trim(), 10);
            if (parsed && parsed > 0) {
                pageSize = parsed;
                const selectEl = document.getElementById('pageSizeSelect');
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
                const selectEl = document.getElementById('pageSizeSelect');
                if (selectEl) selectEl.value = String(pageSize);
                return;
            }
        } else {
            const selectEl = document.getElementById('pageSizeSelect');
            if (selectEl) selectEl.value = String(pageSize);
            return;
        }
    } else {
        pageSize = parseInt(val, 10) || 10;
    }
    currentPage = 1;
    renderDealersTable();
}

// Filtering & Status Filter
let currentStatusFilter = 'ALL';
let currentDaysFilter = 'ALL';
let currentSortFilter = 'ALL';

function setStatusFilter(status) {
    currentStatusFilter = (status || 'ALL').toUpperCase();
    const selectElem = document.getElementById('dealerStatusFilter');
    if (selectElem) selectElem.value = currentStatusFilter;
    filterDealers();
}

function handleStatusFilterChange(val) {
    setStatusFilter(val);
}

function setDaysFilter(daysRange) {
    currentDaysFilter = (daysRange || 'ALL').toUpperCase();
    const selectElem = document.getElementById('dealerDaysFilter');
    if (selectElem) selectElem.value = currentDaysFilter;
    filterDealers();
}

function handleDaysFilterChange(val) {
    setDaysFilter(val);
}

function setSortFilter(sort) {
    currentSortFilter = (sort || 'ALL').toUpperCase();
    const selectElem = document.getElementById('dealerSortFilter');
    if (selectElem) selectElem.value = currentSortFilter;
    filterDealers();
}

function handleSortFilterChange(val) {
    setSortFilter(val);
}

function filterDealers() {
    const q1 = (document.getElementById('dealerTableSearch')?.value || '').toLowerCase().trim();
    const q2 = (document.getElementById('topNavSearch')?.value || '').toLowerCase().trim();
    const query = q1 || q2;

    filteredDealers = allDealers.filter(d => {
        const statusInfo = calculateDealerStatusInfo(d);

        // Status filter check
        if (currentStatusFilter !== 'ALL') {
            if (currentStatusFilter === 'ACTIVE' && statusInfo.status !== 'Active') {
                return false;
            }
            if (currentStatusFilter === 'SAFE' && statusInfo.statusTier !== 'safe') {
                return false;
            }
            if (currentStatusFilter === 'ATTENTION' && statusInfo.statusTier !== 'attention') {
                return false;
            }
            if (currentStatusFilter === 'URGENT' && statusInfo.statusTier !== 'urgent') {
                return false;
            }
            if (currentStatusFilter === 'INACTIVE' && statusInfo.status !== 'Inactive') {
                return false;
            }
        }

        // Days range filter check
        if (currentDaysFilter !== 'ALL') {
            const days = statusInfo.daysRemaining;
            if (currentDaysFilter === '1_10' && !(days >= 1 && days <= 10)) {
                return false;
            }
            if (currentDaysFilter === '11_25' && !(days >= 11 && days <= 25)) {
                return false;
            }
            if (currentDaysFilter === '26_35' && !(days >= 26 && days <= 35)) {
                return false;
            }
            if (currentDaysFilter === '36_45' && !(days >= 36 && days <= 45)) {
                return false;
            }
            if (currentDaysFilter === '0' && days !== 0) {
                return false;
            }
        }

        // Search text check
        const firm = (d.firm_name || d.dealer_name || '').toLowerCase();
        const owner = (d.owner_name || d.contact_person || '').toLowerCase();
        const phone = (d.phone_number || d.phone || '').toLowerCase();
        const city = (d.city || '').toLowerCase();
        const gst = (d.gst_no || '').toLowerCase();
        const code = (d.dealer_code || `sgb-${String(d.dealer_id).padStart(3, '0')}`).toLowerCase();

        return firm.includes(query) || owner.includes(query) || phone.includes(query) || city.includes(query) || gst.includes(query) || code.includes(query);
    });

    // Firm / Shop Name Sorting
    if (currentSortFilter === 'A_Z') {
        filteredDealers.sort((a, b) => {
            const nameA = (a.firm_name || a.dealer_name || '').trim();
            const nameB = (b.firm_name || b.dealer_name || '').trim();
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
        });
    } else if (currentSortFilter === 'Z_A') {
        filteredDealers.sort((a, b) => {
            const nameA = (a.firm_name || a.dealer_name || '').trim();
            const nameB = (b.firm_name || b.dealer_name || '').trim();
            return nameB.localeCompare(nameA, undefined, { sensitivity: 'base', numeric: true });
        });
    }

    currentPage = 1;
    renderDealersTable();
}

function handleTopSearch() {
    const topVal = document.getElementById('topNavSearch').value;
    const tableSearch = document.getElementById('dealerTableSearch');
    if (tableSearch) tableSearch.value = topVal;
    filterDealers();
}

// State Persistence Helpers for Page Reload
function updateViewUrl(view, params = {}) {
    const searchParams = new URLSearchParams();
    if (view && view !== 'list') {
        searchParams.set('view', view);
        Object.keys(params).forEach(k => {
            if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
                searchParams.set(k, params[k]);
            }
        });
    }
    const queryString = searchParams.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    try {
        window.history.replaceState({ view, ...params }, '', newUrl);
        sessionStorage.setItem('dealer_active_view_state', JSON.stringify({ view, ...params }));
    } catch (e) {}
}

function restoreActiveViewState() {
    let view = '';
    let id = '';
    let tab = 'overview';

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('view')) {
        view = urlParams.get('view');
        id = urlParams.get('id');
        tab = urlParams.get('tab') || 'overview';
    } else {
        try {
            const saved = JSON.parse(sessionStorage.getItem('dealer_active_view_state') || '{}');
            if (saved && saved.view) {
                view = saved.view;
                id = saved.id;
                tab = saved.tab || 'overview';
            }
        } catch (e) {}
    }

    if (!view || view === 'list') {
        openDealersListView(false);
        return;
    }

    if (view === 'details' && id) {
        const d = allDealers.find(item => item.dealer_id == id);
        if (d) {
            openDealerDetailsPageView(d, false);
            if (tab) {
                setTimeout(() => switchDpTab(tab), 60);
            }
        } else {
            openDealersListView(false);
        }
    } else if (view === 'order' && id) {
        openOrderPageForDealer(id, false);
    } else if (view === 'edit' && id) {
        const d = allDealers.find(item => item.dealer_id == id);
        if (d) {
            openEditDealerView(d, false);
        } else {
            openDealersListView(false);
        }
    } else if (view === 'add') {
        openAddDealerView(false);
    } else {
        openDealersListView(false);
    }
}

// View Switches
function openDealersListView(updateUrl = true) {
    document.getElementById('dealers-list-view').style.display = 'block';
    document.getElementById('add-dealer-view').style.display = 'none';
    const detailsPageView = document.getElementById('dealer-details-page-view');
    if (detailsPageView) detailsPageView.style.display = 'none';
    const orderView = document.getElementById('order-dealer-view');
    if (orderView) orderView.style.display = 'none';

    document.getElementById('dealerForm').reset();
    document.getElementById('edit-id').value = '';
    if (updateUrl) updateViewUrl('list');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openAddDealerView(updateUrl = true) {
    document.getElementById('dealers-list-view').style.display = 'none';
    document.getElementById('add-dealer-view').style.display = 'block';
    const detailsPageView = document.getElementById('dealer-details-page-view');
    if (detailsPageView) detailsPageView.style.display = 'none';
    const orderView = document.getElementById('order-dealer-view');
    if (orderView) orderView.style.display = 'none';

    document.getElementById('dealerForm').reset();
    document.getElementById('edit-id').value = '';
    const imgUrlInput = document.getElementById('dealer_image_url');
    const previewImg = document.getElementById('dealerImagePreviewImg');
    const defaultIcon = document.getElementById('dealerImageDefaultIcon');
    const removeBtn = document.getElementById('dealerImageRemoveBtn');
    if (imgUrlInput) imgUrlInput.value = '';
    if (previewImg) previewImg.style.display = 'none';
    if (defaultIcon) defaultIcon.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';

    document.getElementById('formPageTitle').textContent = 'Add Dealer';
    document.getElementById('formPageSubTitle').textContent = 'Enter the dealer details to add a new dealer to your network.';
    document.getElementById('statusGroup').style.display = 'block';
    if (document.getElementById('dealer_status')) document.getElementById('dealer_status').value = 'Active';
    if (updateUrl) updateViewUrl('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatIsoDateForInput(dateStr) {
    if (!dateStr || !dateStr.trim()) return '';
    const val = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return val;
    }
    const parts = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (parts) {
        const d = parts[1].padStart(2, '0');
        const m = parts[2].padStart(2, '0');
        const y = parts[3];
        return `${y}-${m}-${d}`;
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }
    return '';
}

function editDealerById(id) {
    const d = allDealers.find(item => item.dealer_id == id);
    if (d) {
        openEditDealerView(d);
    } else {
        console.error('Dealer not found with id:', id);
    }
}

function viewDealerById(id) {
    const d = allDealers.find(item => item.dealer_id == id);
    if (d) {
        openDealerDetailsPageView(d);
    } else {
        console.error('Dealer not found with id:', id);
    }
}

function handleDealerImageFileSelect(e) {
    const file = e.target.files ? e.target.files[0] : null;
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
        const rawBase64 = evt.target.result;
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 400;

            if (width > height) {
                if (width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                }
            } else {
                if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);

            const hiddenInput = document.getElementById('dealer_image_url');
            const previewImg = document.getElementById('dealerImagePreviewImg');
            const defaultIcon = document.getElementById('dealerImageDefaultIcon');
            const removeBtn = document.getElementById('dealerImageRemoveBtn');

            if (hiddenInput) hiddenInput.value = compressedBase64;
            if (previewImg) {
                previewImg.src = compressedBase64;
                previewImg.style.display = 'block';
            }
            if (defaultIcon) defaultIcon.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'inline-flex';
        };
        img.onerror = function() {
            const hiddenInput = document.getElementById('dealer_image_url');
            if (hiddenInput) hiddenInput.value = rawBase64;
        };
        img.src = rawBase64;
    };
    reader.readAsDataURL(file);
}
window.handleDealerImageFileSelect = handleDealerImageFileSelect;

function removeDealerImage() {
    const hiddenInput = document.getElementById('dealer_image_url');
    const fileInput = document.getElementById('dealer_image_input');
    const previewImg = document.getElementById('dealerImagePreviewImg');
    const defaultIcon = document.getElementById('dealerImageDefaultIcon');
    const removeBtn = document.getElementById('dealerImageRemoveBtn');

    if (hiddenInput) hiddenInput.value = '';
    if (fileInput) fileInput.value = '';
    if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
    }
    if (defaultIcon) defaultIcon.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';
}
window.removeDealerImage = removeDealerImage;

function openEditDealerView(d, updateUrl = true) {
    openAddDealerView(false);
    document.getElementById('formPageTitle').textContent = 'Edit Dealer';
    document.getElementById('formPageSubTitle').textContent = 'Update dealer parameters and logistics info.';
    document.getElementById('statusGroup').style.display = 'block';
    if (updateUrl && d && d.dealer_id) updateViewUrl('edit', { id: d.dealer_id });

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const defaultUser = user.name || user.email || 'admin';

    document.getElementById('edit-id').value = d.dealer_id || '';
    document.getElementById('firm_name').value = d.firm_name || d.dealer_name || '';
    document.getElementById('owner_name').value = d.owner_name || d.contact_person || '';
    document.getElementById('phone_number').value = d.phone_number || d.phone || '';
    
    // Visited Date & By
    if (document.getElementById('visited_date')) document.getElementById('visited_date').value = formatIsoDateForInput(d.visited_date) || new Date().toISOString().slice(0, 10);
    if (document.getElementById('visited_by')) document.getElementById('visited_by').value = (d.visited_by && d.visited_by.trim()) ? d.visited_by.trim() : defaultUser;
    document.getElementById('gst_no').value = d.gst_no || d.gst_number || '';

    // Dealer Image
    const imgUrl = d.image_url || d.image || '';
    const imgInput = document.getElementById('dealer_image_url');
    const previewImg = document.getElementById('dealerImagePreviewImg');
    const defaultIcon = document.getElementById('dealerImageDefaultIcon');
    const removeBtn = document.getElementById('dealerImageRemoveBtn');
    if (imgInput) imgInput.value = imgUrl;
    if (imgUrl && previewImg) {
        previewImg.src = imgUrl;
        previewImg.style.display = 'block';
        if (defaultIcon) defaultIcon.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
        if (previewImg) previewImg.style.display = 'none';
        if (defaultIcon) defaultIcon.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
    }

    // Location
    document.getElementById('town_village').value = d.town_village || '';
    document.getElementById('city').value = d.city || '';
    document.getElementById('taluk').value = d.taluk || '';
    document.getElementById('district').value = d.district || '';

    // Pincode
    let pincodeVal = d.pincode || d.pin_code || '';
    if (!pincodeVal && d.address) {
        const match = d.address.match(/\b\d{6}\b/);
        if (match) pincodeVal = match[0];
    }
    document.getElementById('pincode').value = pincodeVal;

    // State select match
    const stateSelect = document.getElementById('state');
    if (stateSelect) {
        const stateVal = (d.state || 'Karnataka').trim().toLowerCase();
        let foundMatch = false;
        for (let i = 0; i < stateSelect.options.length; i++) {
            if (stateSelect.options[i].value.toLowerCase() === stateVal) {
                stateSelect.selectedIndex = i;
                foundMatch = true;
                break;
            }
        }
        if (!foundMatch) stateSelect.value = 'Karnataka';
    }

    // Logistics VRL
    document.getElementById('nearest_vrl').value = d.nearest_vrl || '';
    document.getElementById('vrl_code').value = d.vrl_code || '';

    // Status select case-insensitive match
    const statusSelect = document.getElementById('dealer_status');
    if (statusSelect) {
        const statusVal = (d.status || 'Active').trim().toLowerCase();
        let foundMatch = false;
        for (let i = 0; i < statusSelect.options.length; i++) {
            if (statusSelect.options[i].value.toLowerCase() === statusVal) {
                statusSelect.selectedIndex = i;
                foundMatch = true;
                break;
            }
        }
        if (!foundMatch) statusSelect.value = 'Active';
    }
}

// Handle Form Submission (Save Dealer)
async function handleDealerSubmit(e) {
    if (e) e.preventDefault();

    const saveBtn = document.getElementById('saveDealerSubmitBtn');
    if (saveBtn && saveBtn.disabled) return;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    }

    const id = document.getElementById('edit-id').value;

    const formData = {
        firm_name: document.getElementById('firm_name').value.trim(),
        dealer_name: document.getElementById('firm_name').value.trim(),
        owner_name: document.getElementById('owner_name').value.trim(),
        contact_person: document.getElementById('owner_name').value.trim(),
        phone_number: document.getElementById('phone_number').value.trim(),
        phone: document.getElementById('phone_number').value.trim(),
        visited_date: document.getElementById('visited_date') ? document.getElementById('visited_date').value.trim() : '',
        visited_by: document.getElementById('visited_by') ? document.getElementById('visited_by').value.trim() : '',
        gst_no: document.getElementById('gst_no').value.trim(),
        image_url: document.getElementById('dealer_image_url') ? document.getElementById('dealer_image_url').value : '',
        town_village: document.getElementById('town_village').value.trim(),
        city: document.getElementById('city').value.trim(),
        taluk: document.getElementById('taluk').value.trim(),
        district: document.getElementById('district').value.trim(),
        state: document.getElementById('state').value,
        pincode: document.getElementById('pincode').value.trim(),
        nearest_vrl: document.getElementById('nearest_vrl').value.trim(),
        vrl_code: document.getElementById('vrl_code').value.trim(),
        status: document.getElementById('dealer_status') ? document.getElementById('dealer_status').value : 'Active'
    };

    // Construct full address line for compatibility
    formData.address = `${formData.town_village}, ${formData.taluk} Taluk,\n${formData.city}, ${formData.state} - ${formData.pincode}`;

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/${id}` : API_BASE;

    try {
        let res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify(formData)
        });

        // Auto-retry once on 500 or timeout
        if (!res.ok && res.status >= 500) {
            console.warn('[Dealer] Save attempt 1 failed with 500, retrying once...');
            res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token()}`
                },
                body: JSON.stringify(formData)
            });
        }

        if (res.ok) {
            await fetchDealers();
            if (id && currentProfileDealer && currentProfileDealer.dealer_id == id) {
                const updatedDealer = allDealers.find(item => item.dealer_id == id);
                if (updatedDealer) {
                    openDealerDetailsPageView(updatedDealer);
                } else {
                    openDealersListView();
                }
            } else {
                openDealersListView();
            }

            if (window.showAlert) {
                window.showAlert('Success', `Dealer '${formData.firm_name}' ${id ? 'updated' : 'added'} successfully!`, 'success');
            } else {
                alert(`Dealer '${formData.firm_name}' ${id ? 'updated' : 'added'} successfully!`);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            alert('Save failed: ' + (errData.message || 'Server error'));
        }
    } catch (err) {
        console.error('Error saving dealer to backend:', err);
        alert('Server connection error while saving dealer.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-regular fa-floppy-disk"></i> Save Dealer`;
    }
}

// Delete Dealer
async function deleteDealer(id) {
    if (!confirm('Are you sure you want to delete this dealer account?')) return;
    try {
        const res = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (res.ok) {
            await fetchDealers();
            if (window.showAlert) {
                window.showAlert('Deleted', 'Dealer deleted successfully.', 'success');
            }
        } else {
            alert('Failed to delete dealer.');
        }
    } catch (e) {
        console.error('Delete error:', e);
        alert('Error connecting to server.');
    }
}

// Full Page Dealer Details View
function openDealerDetailsPageView(d, updateUrl = true) {
    currentProfileDealer = d;
    document.getElementById('dealers-list-view').style.display = 'none';
    document.getElementById('add-dealer-view').style.display = 'none';
    const orderView = document.getElementById('order-dealer-view');
    if (orderView) orderView.style.display = 'none';

    const detailsPageView = document.getElementById('dealer-details-page-view');
    if (detailsPageView) detailsPageView.style.display = 'block';
    if (updateUrl && d && d.dealer_id) updateViewUrl('details', { id: d.dealer_id, tab: 'overview' });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const firmName = d.firm_name || d.dealer_name || 'Agri Dealer Store';
    const ownerName = d.owner_name || d.contact_person || '—';
    const phone = d.phone_number || d.phone || '—';
    const email = d.email || '—';
    const gstNo = d.gst_no || d.gst_number || 'Unregistered';
    const vrlCode = d.vrl_code || '—';
    const nearestVrl = d.nearest_vrl || '—';
    const city = d.city || '—';
    const district = d.district || city || '—';
    const state = d.state || 'Karnataka';
    const pincode = d.pincode || d.pin_code || '—';
    const townVillage = d.town_village || city || '—';
    const taluk = d.taluk || city || '—';
    const fullAddr = d.address || `${townVillage}, ${taluk} Taluk, ${city}, ${state}${pincode ? ' - ' + pincode : ''}`;

    // Set DOM Elements & Image
    document.getElementById('dpFirmName').textContent = firmName;
    document.getElementById('dpOwnerName').textContent = ownerName;
    document.getElementById('dpPhone').textContent = phone;
    document.getElementById('dpAddress').innerHTML = `<i class="fa-solid fa-location-dot" style="color:#ef4444;margin-right:4px;"></i> ${fullAddr}`;
    document.getElementById('dpGstNo').textContent = gstNo;
    document.getElementById('dpVrlCode').textContent = vrlCode;
    document.getElementById('dpNearestVrl').textContent = nearestVrl;

    // Header Profile Image vs Icon
    const avatarIcon = document.getElementById('dpHeaderAvatarIcon');
    const avatarImg = document.getElementById('dpHeaderAvatarImg');
    const dealerImgUrl = (d.image_url || d.image || '').trim();

    if (avatarImg) {
        avatarImg.onerror = function () {
            this.style.display = 'none';
            if (avatarIcon) avatarIcon.style.display = 'block';
        };
        if (dealerImgUrl && dealerImgUrl !== 'null' && dealerImgUrl !== 'undefined') {
            avatarImg.src = dealerImgUrl;
            avatarImg.style.display = 'block';
            if (avatarIcon) avatarIcon.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            if (avatarIcon) avatarIcon.style.display = 'block';
        }
    }

    // Status Badge & 45-day validity info
    const initialStatusInfo = calculateDealerStatusInfo(d);
    updateDealerProfileStatusElements(initialStatusInfo);

    // Edit button click handler
    document.getElementById('dpEditBtn').onclick = function () { editDealerById(d.dealer_id); };

    // Overview Tab Info Cards
    document.getElementById('dpInfoFirm').textContent = firmName;
    document.getElementById('dpInfoOwner').textContent = ownerName;
    document.getElementById('dpInfoPhone').textContent = phone;
    document.getElementById('dpInfoGst').textContent = gstNo;
    document.getElementById('dpInfoVrlCode').textContent = vrlCode;
    document.getElementById('dpInfoNearestVrl').textContent = nearestVrl;

    document.getElementById('dpInfoAddress').textContent = fullAddr;
    document.getElementById('dpInfoCity').textContent = city;
    document.getElementById('dpInfoDistrict').textContent = district;
    document.getElementById('dpInfoState').textContent = state;
    document.getElementById('dpInfoPincode').textContent = pincode;

    // Reset Tabs to Overview
    switchDpTab('overview');

    // Fetch Orders for this Dealer to calculate accurate status and totals
    fetch(`${API_BASE}/orders`, {
        headers: { 'Authorization': `Bearer ${token()}` }
    }).then(res => res.json()).then(orders => {
        const dOrders = (orders || []).filter(o => o.dealer_id == d.dealer_id);

        const validOrders = dOrders.filter(o => (o.order_status || '').toLowerCase() !== 'cancelled');
        const statusInfo = calculateDealerStatusInfo(d, dOrders);
        updateDealerProfileStatusElements(statusInfo);

        const totalOrdersCount = dOrders.length;
        let totalPurchased = 0;
        let totalPaid = 0;

        validOrders.forEach(o => {
            totalPurchased += parseFloat(o.total_amount || 0);
            totalPaid += parseFloat(o.advance_amount || 0);
        });
        const outstanding = Math.max(0, totalPurchased - totalPaid);

        document.getElementById('dpTotalOrders').textContent = totalOrdersCount;
        document.getElementById('dpTotalPurchased').textContent = `₹${totalPurchased.toLocaleString('en-IN')}.00`;
        document.getElementById('dpTotalPaid').textContent = `₹${totalPaid.toLocaleString('en-IN')}.00`;
        document.getElementById('dpOutstanding').textContent = `₹${outstanding.toLocaleString('en-IN')}.00`;

        renderDpOrdersTable('dpRecentOrdersTbody', dOrders.slice(0, 5));
        renderDpOrdersTable('dpAllOrdersTbody', dOrders);
        renderDpPaymentsTable(dOrders);
        renderDpVisitsTable(d);
    }).catch(err => {
        console.error('Error loading dealer orders for profile:', err);
    });
}

function updateDealerProfileStatusElements(statusInfo) {
    const badgeElem = document.getElementById('dpStatusBadge');
    if (badgeElem) {
        badgeElem.className = `status-pill ${statusInfo.statusClass}`;
        badgeElem.textContent = statusInfo.statusLabel;
    }

    const daysTextElem = document.getElementById('dpStatusDaysText');
    if (daysTextElem) {
        if (statusInfo.status === 'Active') {
            daysTextElem.innerHTML = `<span style="color:${statusInfo.statusColor};font-weight:700;"><span style="font-size:0.6rem;">●</span> ${statusInfo.daysRemaining} day${statusInfo.daysRemaining === 1 ? '' : 's'} left</span>`;
        } else if (statusInfo.hasOrders) {
            daysTextElem.innerHTML = `<span style="color:#dc2626;font-weight:600;">(45-day period expired)</span>`;
        } else {
            daysTextElem.innerHTML = `<span style="color:#64748b;font-weight:600;">(No orders placed)</span>`;
        }
    }

    const lastOrderElem = document.getElementById('dpLastOrderDate');
    if (lastOrderElem) lastOrderElem.textContent = statusInfo.lastOrderDateFormatted;

    const activeUntilElem = document.getElementById('dpActiveUntil');
    if (activeUntilElem) activeUntilElem.textContent = statusInfo.activeUntilFormatted;

    // Overview Tab Card 3
    const ovBadge = document.getElementById('dpOverviewStatusBadge');
    if (ovBadge) {
        ovBadge.className = `status-pill ${statusInfo.statusClass}`;
        ovBadge.textContent = statusInfo.statusLabel;
    }
    const ovDays = document.getElementById('dpOverviewDaysRemaining');
    if (ovDays) {
        ovDays.textContent = statusInfo.status === 'Active' ? `${statusInfo.daysRemaining} days left` : (statusInfo.hasOrders ? '0 days (Expired)' : '0 days (No orders)');
        ovDays.style.color = statusInfo.statusColor;
    }
    const ovLastOrder = document.getElementById('dpOverviewLastOrderDate');
    if (ovLastOrder) ovLastOrder.textContent = statusInfo.lastOrderDateFormatted;

    const ovActiveUntil = document.getElementById('dpOverviewActiveUntil');
    if (ovActiveUntil) ovActiveUntil.textContent = statusInfo.activeUntilFormatted;
}

function switchDpTab(tabName, el) {
    document.querySelectorAll('.dp-tab-content').forEach(tc => tc.style.display = 'none');
    document.querySelectorAll('.dealer-dp-tab').forEach(t => {
        t.classList.remove('active');
        t.style.color = '#64748b';
        t.style.borderBottomColor = 'transparent';
        t.style.fontWeight = '600';
    });

    const targetTab = document.getElementById(tabName === 'overview' ? 'dpTabOverview' : tabName === 'orders' ? 'dpTabOrders' : tabName === 'payments' ? 'dpTabPayments' : 'dpTabVisits');
    if (targetTab) targetTab.style.display = 'block';

    if (el) {
        el.classList.add('active');
        el.style.color = '#ff6b00';
        el.style.borderBottomColor = '#ff6b00';
        el.style.fontWeight = '700';
    } else {
        const btn = document.querySelector(`.dealer-dp-tab[onclick*="${tabName}"]`);
        if (btn) {
            btn.classList.add('active');
            btn.style.color = '#ff6b00';
            btn.style.borderBottomColor = '#ff6b00';
            btn.style.fontWeight = '700';
        }
    }

    if (currentProfileDealer && currentProfileDealer.dealer_id) {
        updateViewUrl('details', { id: currentProfileDealer.dealer_id, tab: tabName });
    }
}

function renderDpOrdersTable(tbodyId, orders) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!orders || orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding:2rem;text-align:center;color:#94a3b8;">No orders recorded yet.</td></tr>`;
        return;
    }

    // Sort orders descending by created_at date to calculate gap to preceding order accurately
    const sortedOrders = [...orders].sort((a, b) => {
        const dA = new Date(a.created_at || a.order_date || 0);
        const dB = new Date(b.created_at || b.order_date || 0);
        return dB - dA;
    });

    tbody.innerHTML = sortedOrders.map((o, idx) => {
        const oId = window.formatOrderId ? window.formatOrderId(o.order_id, o.created_at) : `#ORD-${o.order_id}`;
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '—';

        // Order Gap calculation (difference in days from the previous chronological order)
        let gapHtml = `<span style="background:#f8fafc;color:#64748b;font-weight:600;padding:3px 8px;border-radius:6px;font-size:0.75rem;border:1px solid #e2e8f0;display:inline-block;white-space:nowrap;">1st Order</span>`;
        if (idx < sortedOrders.length - 1) {
            const nextOrder = sortedOrders[idx + 1];
            const currentDate = new Date(o.created_at || o.order_date);
            const prevDate = new Date(nextOrder.created_at || nextOrder.order_date);

            if (!isNaN(currentDate.getTime()) && !isNaN(prevDate.getTime())) {
                const d1 = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                const d2 = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
                const diffTime = d1 - d2;
                const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

                if (diffDays === 0) {
                    gapHtml = `<span style="background:#f1f5f9;color:#475569;font-weight:600;padding:3px 8px;border-radius:6px;font-size:0.75rem;display:inline-block;white-space:nowrap;">Same Day</span>`;
                } else {
                    gapHtml = `<span style="background:#eff6ff;color:#1d4ed8;font-weight:700;padding:3px 8px;border-radius:6px;font-size:0.75rem;display:inline-block;white-space:nowrap;border:1px solid #bfdbfe;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:4px;color:#3b82f6;"></i>${diffDays} Day${diffDays > 1 ? 's' : ''}</span>`;
                }
            }
        }

        let items = 'Agri Products';
        if (o.items_summary) {
            items = o.items_summary.split('||').join('<br>');
        }
        const delType = o.delivery_type || '—';
        const tot = parseFloat(o.total_amount || 0);
        const paid = parseFloat(o.advance_amount || 0);
        const bal = Math.max(0, tot - paid);

        const st = (o.order_status || 'ordered').toLowerCase();
        let stBadge = `<span class="status-pill status-ordered">Ordered</span>`;
        if (st === 'shipped') stBadge = `<span class="status-pill status-shipped">Shipped</span>`;
        else if (st === 'packed') stBadge = `<span class="status-pill status-packed">Packed</span>`;
        else if (st === 'delivered') stBadge = `<span class="status-pill status-delivered">Delivered</span>`;
        else if (st === 'cancelled') stBadge = `<span class="status-pill status-cancelled">Cancelled</span>`;

        return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:0.75rem 0.85rem;font-weight:700;color:#ff6b00;">${oId}</td>
                <td style="padding:0.75rem 0.85rem;color:#475569;white-space:nowrap;">${date}</td>
                <td style="padding:0.75rem 0.85rem;text-align:center;white-space:nowrap;">${gapHtml}</td>
                <td style="padding:0.75rem 0.85rem;color:#334155;line-height:1.4;">${items}</td>
                <td style="padding:0.75rem 0.85rem;color:#0f172a;font-weight:700;white-space:nowrap;">
                    <span style="background:#f1f5f9;color:#334155;font-weight:700;padding:3px 8px;border-radius:6px;font-size:0.775rem;border:1px solid #cbd5e1;display:inline-block;">${delType}</span>
                </td>
                <td style="padding:0.75rem 0.85rem;text-align:right;font-weight:700;color:#0f172a;">${tot.toLocaleString('en-IN')}.00</td>
                <td style="padding:0.75rem 0.85rem;text-align:right;font-weight:700;color:#16a34a;">${paid.toLocaleString('en-IN')}.00</td>
                <td style="padding:0.75rem 0.85rem;text-align:right;font-weight:700;">
                    ${bal > 0 ? `<span style="color:#ef4444;">${bal.toLocaleString('en-IN')}.00</span>` : `<span style="color:#16a34a;font-weight:700;font-size:0.75rem;background:#f0fdf4;padding:3px 7px;border-radius:6px;border:1px solid #bbf7d0;display:inline-block;white-space:nowrap;"><i class="fa-solid fa-circle-check" style="margin-right:4px;"></i> Payment Cleared</span>`}
                </td>
                <td style="padding:0.75rem 0.85rem;text-align:center;">${stBadge}</td>
            </tr>
        `;
    }).join('');
}

function renderDpPaymentsTable(orders) {
    const tbody = document.getElementById('dpPaymentsTbody');
    if (!tbody) return;

    let payments = [];
    (orders || []).forEach(o => {
        const oId = window.formatOrderId ? window.formatOrderId(o.order_id, o.created_at) : `#ORD-${o.order_id}`;
        if (o.payment_history_str) {
            const entries = o.payment_history_str.split('||');
            entries.forEach(e => {
                const parts = e.split('::');
                payments.push({
                    orderId: oId,
                    amount: parseFloat(parts[0]) || 0,
                    method: parts[1] || 'Bank Transfer',
                    date: parts[2] || (o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '—'),
                    notes: parts[3] || 'Payment'
                });
            });
        } else if (parseFloat(o.advance_amount || 0) > 0) {
            payments.push({
                orderId: oId,
                amount: parseFloat(o.advance_amount),
                method: 'Advance Payment',
                date: o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB') : '—',
                notes: 'Advance Received'
            });
        }
    });

    if (payments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:2rem;text-align:center;color:#94a3b8;">No payment records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = payments.map(p => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:0.75rem 0.85rem;font-weight:700;color:#ff6b00;">${p.orderId}</td>
            <td style="padding:0.75rem 0.85rem;color:#475569;white-space:nowrap;">${p.date}</td>
            <td style="padding:0.75rem 0.85rem;text-align:right;font-weight:700;color:#16a34a;">₹${p.amount.toLocaleString('en-IN')}.00</td>
            <td style="padding:0.75rem 0.85rem;color:#334155;">${p.method}</td>
            <td style="padding:0.75rem 0.85rem;color:#64748b;">${p.notes}</td>
        </tr>
    `).join('');
}

function renderDpVisitsTable(d) {
    const tbody = document.getElementById('dpVisitsTbody');
    if (!tbody) return;
    if (!d) return;

    let visitsKey = 'sgb_dealer_visits_' + d.dealer_id;
    let visits = [];
    try {
        visits = JSON.parse(localStorage.getItem(visitsKey)) || [];
    } catch (e) { visits = []; }

    // If no visits saved yet in localStorage, seed initial visit from dealer record if available
    if (visits.length === 0 && d.visited_date) {
        const vDate = formatVisitedDate(d.visited_date, d.created_at);
        const vBy = formatVisitedBy(d.visited_by);
        const status = d.status || 'Active';
        visits.push({
            id: 'VISIT-INIT-' + d.dealer_id,
            dealer_id: d.dealer_id,
            visited_date: vDate,
            visited_by: vBy,
            status: status,
            is_initial: true
        });
    }

    if (visits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="padding:2rem;text-align:center;color:#94a3b8;">No visit logs recorded yet. Click <strong>+ New Visit</strong> above to fill a visit form.</td></tr>`;
        return;
    }

    tbody.innerHTML = visits.map((v, index) => {
        const hasQnA = !!(v.formData);
        const isLatestWithData = hasQnA && (index === 0);

        let qnaDetailsHtml = '';
        if (hasQnA) {
            const fd = v.formData;
            const stockRowsHtml = (fd.stockData && fd.stockData.length) ? fd.stockData.map(st => `
                <tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:0.45rem 0.75rem;font-weight:700;color:#1E293B;white-space:nowrap;">${st.product}</td>
                    <td style="padding:0.45rem 0.75rem;text-align:center;font-weight:600;color:#64748B;">${st.purchased}</td>
                    <td style="padding:0.45rem 0.75rem;text-align:center;font-weight:700;color:#16A34A;">${st.currentStock || '0'}</td>
                </tr>
            `).join('') : '';

            const customQHtml = (fd.customQuestions && fd.customQuestions.length) ? fd.customQuestions.map((cq, idx) => `
                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">${12 + idx}. ${cq.title}:</div>
                    <div style="font-weight:600;color:#0F172A;white-space:pre-line;">${cq.answer || '—'}</div>
                </div>
            `).join('') : '';

            qnaDetailsHtml = `
                <tr id="visitQnA_${v.id}" class="visit-qna-row" style="display:${isLatestWithData ? 'table-row' : 'none'};background:#F8FAFC;border-bottom:2px solid #E2E8F0;">
                    <td colspan="3" style="padding:1.25rem 1.5rem;">
                        <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #F1F5F9;padding-bottom:0.75rem;margin-bottom:1rem;">
                                <h4 style="font-size:0.95rem;font-weight:800;color:#0F172A;margin:0;display:flex;align-items:center;gap:0.5rem;">
                                    <i class="fa-solid fa-clipboard-list" style="color:#FF6B00;"></i> Visit Form Questions & Answers
                                </h4>
                                <span style="font-size:0.75rem;color:#64748B;background:#F1F5F9;padding:3px 10px;border-radius:12px;font-weight:600;">Recorded by ${v.visited_by || 'Staff'}</span>
                            </div>

                            <!-- Q&A Grid -->
                            <div class="visit-qna-grid">
                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">1. Main Requirements:</div>
                                    <div style="font-weight:600;color:#0F172A;white-space:pre-line;">${fd.req || '—'}</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">2. Major Crops:</div>
                                    <div style="font-weight:600;color:#0F172A;white-space:pre-line;">${fd.crops || '—'}</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">3. Products Sold Most:</div>
                                    <div style="font-weight:600;color:#0F172A;white-space:pre-line;">${fd.topProducts || '—'}</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">4. Brush Cutters Sold / Year:</div>
                                    <div style="font-weight:600;color:#0F172A;">${fd.brushCuttersQty || '0'} units</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">5. Brush Cutter Brands Sold:</div>
                                    <div style="font-weight:600;color:#0F172A;white-space:pre-line;">${fd.brushCuttersBrands || '—'}</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">6. Major Competitors:</div>
                                    <div style="font-weight:600;color:#0F172A;white-space:pre-line;">${fd.competitors || '—'}</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">7. Branches & Locations:</div>
                                    <div style="font-weight:600;color:#0F172A;white-space:pre-line;">${fd.branches || '—'}</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">8. Staff Count:</div>
                                    <div style="font-weight:600;color:#0F172A;">${fd.staffCount || '0'} people</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">9. Selling Model:</div>
                                    <div style="font-weight:600;color:#FF6B00;">${fd.salesType || 'B2B'}</div>
                                </div>

                                <div style="background:#F8FAFC;padding:0.85rem 1rem;border-radius:8px;border:1px solid #F1F5F9;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:4px;">10. Years in Business:</div>
                                    <div style="font-weight:600;color:#0F172A;">${fd.businessYears || '0'} years</div>
                                </div>
                            </div>

                            ${stockRowsHtml ? `
                                <div style="margin-top:1rem;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:0.4rem;font-size:0.825rem;">11. Current Product Stock Log:</div>
                                    <div style="border:1px solid #E2E8F0;border-radius:10px;overflow-x:auto;max-width:450px;">
                                        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
                                            <thead style="background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
                                                <tr>
                                                    <th style="padding:0.5rem 0.75rem;text-align:left;color:#64748B;font-weight:700;white-space:nowrap;">Product</th>
                                                    <th style="padding:0.5rem 0.75rem;text-align:center;color:#64748B;font-weight:700;white-space:nowrap;">Purchased Qty</th>
                                                    <th style="padding:0.5rem 0.75rem;text-align:center;color:#64748B;font-weight:700;white-space:nowrap;">Current Stock</th>
                                                </tr>
                                            </thead>
                                            <tbody>${stockRowsHtml}</tbody>
                                        </table>
                                    </div>
                                </div>
                            ` : ''}

                            ${customQHtml ? `
                                <div style="margin-top:1rem;border-top:1px solid #F1F5F9;padding-top:0.75rem;">
                                    <div style="font-weight:700;color:#475569;margin-bottom:0.5rem;font-size:0.825rem;">Additional Custom Questions:</div>
                                    <div class="visit-qna-grid">
                                        ${customQHtml}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }

        return `
            <tr style="border-bottom:1px solid #f1f5f9;background:#ffffff;">
                <td style="padding:0.75rem 0.85rem;font-weight:600;color:#334155;">${v.visited_date}</td>
                <td style="padding:0.75rem 0.85rem;color:#334155;">${v.visited_by || '—'}</td>
                <td style="padding:0.75rem 0.85rem;text-align:center;">
                    ${hasQnA ? `<button type="button" onclick="toggleVisitQnAExpand('${v.id}')" title="Toggle Q&A Answers" style="background:#FFF7ED;border:1px solid #FFEDD5;color:#C2410C;border-radius:6px;padding:4px 10px;font-weight:700;font-size:0.75rem;cursor:pointer;margin-right:6px;display:inline-flex;align-items:center;gap:4px;"><i class="fa-solid ${isLatestWithData ? 'fa-chevron-up' : 'fa-chevron-down'}" id="chevron_${v.id}"></i> Q&A</button>` : ''}
                    <button type="button" onclick="viewVisitDetailsModal('${v.id}')" title="View Visit Details Form Modal" style="background:none;border:none;color:#FF6B00;cursor:pointer;font-size:1.05rem;padding:4px;"><i class="fa-regular fa-eye"></i></button>
                    ${!v.is_initial ? `<button type="button" onclick="deleteVisitRecord('${v.id}')" title="Delete Visit Log" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.05rem;padding:4px;margin-left:4px;"><i class="fa-regular fa-trash-can"></i></button>` : ''}
                </td>
            </tr>
            ${qnaDetailsHtml}
        `;
    }).join('');
}

function toggleVisitQnAExpand(visitId) {
    const row = document.getElementById('visitQnA_' + visitId);
    const chevron = document.getElementById('chevron_' + visitId);
    if (!row) return;

    if (row.style.display === 'none' || !row.style.display) {
        row.style.display = 'table-row';
        if (chevron) chevron.className = 'fa-solid fa-chevron-up';
    } else {
        row.style.display = 'none';
        if (chevron) chevron.className = 'fa-solid fa-chevron-down';
    }
}

// ── Dealer Visit Form Modal Logic ──

function openDealerVisitModal() {
    const modal = document.getElementById('dealerVisitModal');
    if (!modal) return;

    if (!currentProfileDealer) {
        alert('Please select a dealer profile first.');
        return;
    }

    document.getElementById('visit_dealer_id').value = currentProfileDealer.dealer_id;
    
    // Reset form inputs
    const form = document.getElementById('dealerVisitForm');
    if (form) form.reset();

    document.getElementById('customVisitQuestionsContainer').innerHTML = '';
    customVisitQuestionCounter = 0;

    // Reset stock inputs
    document.querySelectorAll('#visitCurrentStockTbody .stock-input').forEach(inp => inp.value = '');

    toggleVisitFormInputsReadOnly(false);
    modal.style.display = 'flex';
}

function closeDealerVisitModal() {
    const modal = document.getElementById('dealerVisitModal');
    if (modal) modal.style.display = 'none';
}

function addCustomVisitQuestion() {
    openAddQuestionModal();
}

function openAddQuestionModal() {
    const modal = document.getElementById('addQuestionModal');
    if (!modal) return;

    const form = document.getElementById('addQuestionForm');
    if (form) form.reset();

    const typeSelect = document.getElementById('newQType');
    if (typeSelect) typeSelect.value = 'textarea';

    handleAnswerTypeChange();
    modal.style.display = 'flex';
}

function closeAddQuestionModal() {
    const modal = document.getElementById('addQuestionModal');
    if (modal) modal.style.display = 'none';
}

function handleAnswerTypeChange() {
    const typeSelect = document.getElementById('newQType');
    const optionsSec = document.getElementById('newQOptionsSection');
    const optionsInp = document.getElementById('newQOptionsInput');

    if (!typeSelect || !optionsSec) return;

    const val = typeSelect.value;
    if (val === 'radio' || val === 'checkbox' || val === 'dropdown') {
        optionsSec.style.display = 'block';
        if (optionsInp) optionsInp.required = true;
    } else {
        optionsSec.style.display = 'none';
        if (optionsInp) optionsInp.required = false;
    }
}

function handleAddQuestionSubmit(e) {
    e.preventDefault();

    const titleInp = document.getElementById('newQTitle');
    const typeSelect = document.getElementById('newQType');
    const optionsInp = document.getElementById('newQOptionsInput');
    const reqCheckbox = document.getElementById('newQIsRequired');

    if (!titleInp || !typeSelect) return;

    const qTitle = titleInp.value.trim();
    const qType = typeSelect.value;
    const isRequired = reqCheckbox ? reqCheckbox.checked : true;

    let optionsList = [];
    if (qType === 'radio' || qType === 'checkbox' || qType === 'dropdown') {
        const rawOpts = optionsInp ? optionsInp.value.trim() : '';
        optionsList = rawOpts.split(',').map(s => s.trim()).filter(Boolean);
        if (optionsList.length === 0) {
            optionsList = ['Option 1', 'Option 2'];
        }
    }

    createCustomQuestionInForm({
        title: qTitle,
        type: qType,
        options: optionsList,
        isRequired: isRequired
    });

    closeAddQuestionModal();
}

function createCustomQuestionInForm(qData) {
    const container = document.getElementById('customVisitQuestionsContainer');
    if (!container) return;

    customVisitQuestionCounter++;
    const qIndex = 11 + customVisitQuestionCounter;
    const qId = 'customQ_' + customVisitQuestionCounter;

    const div = document.createElement('div');
    div.id = qId;
    div.className = 'custom-question-card';
    div.dataset.qtitle = qData.title;
    div.dataset.qtype = qData.type;
    div.dataset.qoptions = JSON.stringify(qData.options || []);
    div.dataset.qrequired = qData.isRequired ? 'true' : 'false';

    div.style.cssText = 'background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:1rem;position:relative;animation:entrance 0.2s ease-out;';

    const reqBadge = qData.isRequired ? '<span style="color:#EF4444;">*</span>' : '<span style="color:#94a3b8;font-size:0.75rem;font-weight:400;">(Optional)</span>';

    let inputControlHtml = '';

    if (qData.type === 'textarea') {
        inputControlHtml = `
            <textarea class="custom-answer-input" rows="2" placeholder="Type your answer..." ${qData.isRequired ? 'required' : ''} style="width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:0.6rem 0.85rem;font-size:0.85rem;color:#1E293B;outline:none;resize:vertical;background:#ffffff;font-family:inherit;"></textarea>
        `;
    } else if (qData.type === 'text') {
        inputControlHtml = `
            <input type="text" class="custom-answer-input" placeholder="Type your answer..." ${qData.isRequired ? 'required' : ''} style="width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:0.6rem 0.85rem;font-size:0.85rem;color:#1E293B;outline:none;background:#ffffff;">
        `;
    } else if (qData.type === 'number') {
        inputControlHtml = `
            <input type="number" class="custom-answer-input" min="0" placeholder="Type a number..." ${qData.isRequired ? 'required' : ''} style="width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:0.6rem 0.85rem;font-size:0.85rem;color:#1E293B;outline:none;background:#ffffff;">
        `;
    } else if (qData.type === 'radio') {
        const radioGroup = 'custom_radio_' + qId;
        const radiosHtml = qData.options.map((opt, idx) => `
            <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;color:#334155;cursor:pointer;">
                <input type="radio" name="${radioGroup}" value="${opt}" ${idx === 0 ? 'checked' : ''} style="accent-color:#FF6B00;"> ${opt}
            </label>
        `).join('');
        inputControlHtml = `<div class="custom-answer-radio-group" style="display:flex;flex-direction:column;gap:0.6rem;margin-top:0.35rem;">${radiosHtml}</div>`;
    } else if (qData.type === 'checkbox') {
        const cbHtml = qData.options.map(opt => `
            <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;color:#334155;cursor:pointer;">
                <input type="checkbox" class="custom-cb-item" value="${opt}" style="accent-color:#FF6B00;width:15px;height:15px;"> ${opt}
            </label>
        `).join('');
        inputControlHtml = `<div class="custom-answer-cb-group" style="display:flex;flex-direction:column;gap:0.6rem;margin-top:0.35rem;">${cbHtml}</div>`;
    } else if (qData.type === 'dropdown') {
        const optsHtml = qData.options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
        inputControlHtml = `
            <select class="custom-answer-input" ${qData.isRequired ? 'required' : ''} style="width:100%;border:1px solid #E2E8F0;border-radius:8px;padding:0.6rem 0.85rem;font-size:0.85rem;color:#1E293B;outline:none;background:#ffffff;font-weight:600;">
                <option value="" disabled selected>Select an option...</option>
                ${optsHtml}
            </select>
        `;
    }

    div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
            <label style="font-weight:700;font-size:0.875rem;color:#0F172A;margin:0;">
                ${qIndex}. ${qData.title} ${reqBadge}
            </label>
            <button type="button" onclick="removeCustomVisitQuestion('${qId}')" style="background:none;border:none;color:#EF4444;cursor:pointer;font-size:0.9rem;padding:2px;margin-left:0.5rem;"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        ${inputControlHtml}
    `;

    container.appendChild(div);
}

function removeCustomVisitQuestion(qId) {
    const qElem = document.getElementById(qId);
    if (qElem) qElem.remove();
}

function saveDealerVisitForm(e) {
    e.preventDefault();

    if (!currentProfileDealer) {
        alert('No dealer selected.');
        return;
    }

    const req = document.getElementById('visitReq').value.trim();
    const crops = document.getElementById('visitCrops').value.trim();
    const topProducts = document.getElementById('visitTopProducts').value.trim();
    const brushCuttersQty = document.getElementById('visitBrushCuttersQty').value.trim();
    const brushCuttersBrands = document.getElementById('visitBrushCuttersBrands').value.trim();
    const competitors = document.getElementById('visitCompetitors').value.trim();
    const branches = document.getElementById('visitBranches').value.trim();
    const staffCount = document.getElementById('visitStaffCount').value.trim();
    
    const salesTypeElem = document.querySelector('input[name="visitSalesType"]:checked');
    const salesType = salesTypeElem ? salesTypeElem.value : 'B2B – Business to Business';

    const businessYears = document.getElementById('visitBusinessYears').value.trim();

    // Stock inputs
    const stockInputs = document.querySelectorAll('#visitCurrentStockTbody .stock-input');
    const stockData = [];
    stockInputs.forEach(inp => {
        stockData.push({
            product: inp.getAttribute('data-product'),
            purchased: inp.getAttribute('data-purchased'),
            currentStock: inp.value.trim()
        });
    });

    // Custom questions answer extraction
    const customQuestions = [];
    document.querySelectorAll('#customVisitQuestionsContainer > .custom-question-card').forEach(div => {
        const qTitle = div.dataset.qtitle;
        const qType = div.dataset.qtype;
        let qOptions = [];
        try { qOptions = JSON.parse(div.dataset.qoptions || '[]'); } catch (err) {}
        const qRequired = div.dataset.qrequired === 'true';

        let qAnswer = '';

        if (qType === 'radio') {
            const checkedRadio = div.querySelector('input[type="radio"]:checked');
            qAnswer = checkedRadio ? checkedRadio.value : '';
        } else if (qType === 'checkbox') {
            const checkedCbs = Array.from(div.querySelectorAll('.custom-cb-item:checked')).map(cb => cb.value);
            qAnswer = checkedCbs.join(', ');
        } else {
            const inp = div.querySelector('.custom-answer-input');
            qAnswer = inp ? inp.value.trim() : '';
        }

        customQuestions.push({
            title: qTitle,
            type: qType,
            options: qOptions,
            isRequired: qRequired,
            answer: qAnswer
        });
    });

    // Get current user name
    let currentUserName = 'danu';
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const u = JSON.parse(userStr);
            if (u.name) currentUserName = u.name;
        }
    } catch (err) {}

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const formattedVisitedDate = `${dateStr} ${timeStr}`;

    const newVisit = {
        id: 'VISIT-' + Date.now(),
        dealer_id: currentProfileDealer.dealer_id,
        visited_date: formattedVisitedDate,
        visited_by: currentUserName,
        status: currentProfileDealer.status || 'Active',
        formData: {
            req,
            crops,
            topProducts,
            brushCuttersQty,
            brushCuttersBrands,
            competitors,
            branches,
            staffCount,
            salesType,
            businessYears,
            stockData,
            customQuestions
        }
    };

    let visitsKey = 'sgb_dealer_visits_' + currentProfileDealer.dealer_id;
    let visits = [];
    try {
        visits = JSON.parse(localStorage.getItem(visitsKey)) || [];
    } catch (err) { visits = []; }

    visits.unshift(newVisit);
    localStorage.setItem(visitsKey, JSON.stringify(visits));

    closeDealerVisitModal();
    renderDpVisitsTable(currentProfileDealer);

    if (window.showAlert) {
        window.showAlert('Visit Saved', `Dealer visit form saved successfully!`, 'success');
    } else {
        alert('Dealer visit form saved successfully!');
    }
}

function viewVisitDetailsModal(visitId) {
    if (!currentProfileDealer) return;
    let visitsKey = 'sgb_dealer_visits_' + currentProfileDealer.dealer_id;
    let visits = [];
    try {
        visits = JSON.parse(localStorage.getItem(visitsKey)) || [];
    } catch (e) { visits = []; }

    const visit = visits.find(v => v.id === visitId);
    if (!visit || !visit.formData) {
        alert('Visit details: Date ' + (visit ? visit.visited_date : '—') + ' by ' + (visit ? visit.visited_by : '—'));
        return;
    }

    openDealerVisitModal();

    const fd = visit.formData;
    document.getElementById('visitReq').value = fd.req || '';
    document.getElementById('visitCrops').value = fd.crops || '';
    document.getElementById('visitTopProducts').value = fd.topProducts || '';
    document.getElementById('visitBrushCuttersQty').value = fd.brushCuttersQty || '';
    document.getElementById('visitBrushCuttersBrands').value = fd.brushCuttersBrands || '';
    document.getElementById('visitCompetitors').value = fd.competitors || '';
    document.getElementById('visitBranches').value = fd.branches || '';
    document.getElementById('visitStaffCount').value = fd.staffCount || '';
    document.getElementById('visitBusinessYears').value = fd.businessYears || '';

    if (fd.salesType) {
        const rBtn = document.querySelector(`input[name="visitSalesType"][value="${fd.salesType}"]`);
        if (rBtn) rBtn.checked = true;
    }

    if (fd.stockData && Array.isArray(fd.stockData)) {
        fd.stockData.forEach(item => {
            const inp = document.querySelector(`#visitCurrentStockTbody .stock-input[data-product="${item.product}"]`);
            if (inp) inp.value = item.currentStock || '';
        });
    }

    if (fd.customQuestions && Array.isArray(fd.customQuestions)) {
        fd.customQuestions.forEach(cq => {
            createCustomQuestionInForm({
                title: cq.title,
                type: cq.type,
                options: cq.options || [],
                isRequired: cq.isRequired
            });

            const container = document.getElementById('customVisitQuestionsContainer');
            const lastDiv = container.lastElementChild;
            if (lastDiv) {
                if (cq.type === 'radio') {
                    const r = lastDiv.querySelector(`input[type="radio"][value="${cq.answer}"]`);
                    if (r) r.checked = true;
                } else if (cq.type === 'checkbox') {
                    const ansArr = (cq.answer || '').split(',').map(s => s.trim());
                    lastDiv.querySelectorAll('.custom-cb-item').forEach(cb => {
                        if (ansArr.includes(cb.value)) cb.checked = true;
                    });
                } else {
                    const inp = lastDiv.querySelector('.custom-answer-input');
                    if (inp) inp.value = cq.answer || '';
                }
            }
        });
    }

    toggleVisitFormInputsReadOnly(true);
}

function toggleVisitFormInputsReadOnly(isReadOnly) {
    const form = document.getElementById('dealerVisitForm');
    if (!form) return;
    const inputs = form.querySelectorAll('input, textarea, select, button');
    inputs.forEach(el => {
        if (el.id === 'saveVisitSubmitBtn' || el.id === 'addQuestionBtn') {
            el.style.display = isReadOnly ? 'none' : 'inline-flex';
        } else if (el.tagName === 'BUTTON' && (el.innerText.includes('Cancel') || el.querySelector('.fa-xmark'))) {
            // Keep close buttons active
        } else {
            el.disabled = isReadOnly;
        }
    });
}

function deleteVisitRecord(visitId) {
    if (!currentProfileDealer) return;
    if (!confirm('Are you sure you want to delete this visit log?')) return;

    let visitsKey = 'sgb_dealer_visits_' + currentProfileDealer.dealer_id;
    let visits = [];
    try {
        visits = JSON.parse(localStorage.getItem(visitsKey)) || [];
    } catch (e) { visits = []; }

    visits = visits.filter(v => v.id !== visitId);
    localStorage.setItem(visitsKey, JSON.stringify(visits));
    renderDpVisitsTable(currentProfileDealer);
}

// Detail View Modal
function viewDealerDetails(d) {
    const modal = document.getElementById('dealerDetailsModal');
    const content = document.getElementById('viewDealerContent');
    const firmNameElem = document.getElementById('viewFirmName');
    const modalEditBtn = document.getElementById('modalEditBtn');

    if (!modal || !content) return;

    firmNameElem.textContent = d.firm_name || d.dealer_name || 'Dealer Profile';

    const statusInfo = calculateDealerStatusInfo(d);
    let subStatusText = '';
    if (statusInfo.status === 'Active') {
        subStatusText = `<span style="font-size:0.75rem;color:${statusInfo.statusColor};font-weight:700;margin-left:6px;"><span style="font-size:0.6rem;">●</span> ${statusInfo.daysRemaining} days left</span>`;
    } else if (statusInfo.hasOrders) {
        subStatusText = `<span style="font-size:0.75rem;color:#dc2626;font-weight:600;margin-left:6px;">(45-day period expired)</span>`;
    } else {
        subStatusText = `<span style="font-size:0.75rem;color:#64748b;font-weight:600;margin-left:6px;">(No orders placed)</span>`;
    }

    document.getElementById('viewStatusBadge').innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span class="status-pill ${statusInfo.statusClass}">${statusInfo.statusLabel}</span>
            ${subStatusText}
        </div>
    `;

    content.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:1.25rem;">
            <div style="background:#F8FAFC;padding:1rem;border-radius:10px;border:1px solid #F1F5F9;">
                <div style="font-size:0.75rem;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Dealer Name</div>
                <div style="font-size:0.95rem;font-weight:700;color:#0F172A;">${d.owner_name || d.contact_person || '—'}</div>
            </div>

            <div style="background:#F8FAFC;padding:1rem;border-radius:10px;border:1px solid #F1F5F9;">
                <div style="font-size:0.75rem;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Contact Number</div>
                <div style="font-size:0.95rem;font-weight:700;color:#0F172A;"><i class="fa-solid fa-phone" style="color:#FF6B00;margin-right:6px;"></i>${d.phone_number || d.phone || '—'}</div>
            </div>

            <!-- 45-Day Order Validity Details -->
            <div style="background:#F0FDF4;padding:1rem;border-radius:10px;border:1px solid #DCFCE7;">
                <div style="font-size:0.75rem;color:#166534;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Last Order Date</div>
                <div style="font-size:0.95rem;font-weight:700;color:#14532D;"><i class="fa-regular fa-calendar-check" style="margin-right:6px;"></i>${statusInfo.lastOrderDateFormatted}</div>
            </div>

            <div style="background:#F0FDF4;padding:1rem;border-radius:10px;border:1px solid #DCFCE7;">
                <div style="font-size:0.75rem;color:#166534;font-weight:700;text-transform:uppercase;margin-bottom:4px;">Active Until (45 Days)</div>
                <div style="font-size:0.95rem;font-weight:700;color:#14532D;"><i class="fa-solid fa-clock-rotate-left" style="margin-right:6px;"></i>${statusInfo.activeUntilFormatted}</div>
            </div>

            <div style="background:#F8FAFC;padding:1rem;border-radius:10px;border:1px solid #F1F5F9;">
                <div style="font-size:0.75rem;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Visited Date</div>
                <div style="font-size:0.9rem;font-weight:600;color:#334155;"><i class="fa-regular fa-calendar" style="color:#64748B;margin-right:6px;"></i>${d.visited_date || '—'}</div>
            </div>

            <div style="background:#F8FAFC;padding:1rem;border-radius:10px;border:1px solid #F1F5F9;">
                <div style="font-size:0.75rem;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Visited By</div>
                <div style="font-size:0.9rem;font-weight:600;color:#334155;"><i class="fa-regular fa-user" style="color:#64748B;margin-right:6px;"></i>${d.visited_by || '—'}</div>
            </div>

            <div style="background:#F8FAFC;padding:1rem;border-radius:10px;border:1px solid #F1F5F9;grid-column:span 2;">
                <div style="font-size:0.75rem;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px;">GST Number</div>
                <div style="font-size:0.9rem;font-weight:600;color:#334155;font-family:monospace;">${d.gst_no || d.gst_number || 'Not Registered'}</div>
            </div>

            <div style="background:#F8FAFC;padding:1rem;border-radius:10px;border:1px solid #F1F5F9;grid-column:span 2;">
                <div style="font-size:0.75rem;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Address & Location</div>
                <div style="font-size:0.875rem;color:#334155;line-height:1.5;">${(d.address || `${d.town_village || ''}, ${d.city || ''}, ${d.state || ''}`).replace(/\n/g, '<br>')}</div>
            </div>

            <div style="background:#FFF7ED;padding:1rem;border-radius:10px;border:1px solid #FFEDD5;grid-column:span 2;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:0.725rem;color:#C2410C;font-weight:700;text-transform:uppercase;">Nearest VRL Hub</div>
                    <div style="font-size:0.9rem;font-weight:700;color:#9A3412;">${d.nearest_vrl || 'Not Specified'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.725rem;color:#C2410C;font-weight:700;text-transform:uppercase;">VRL Code</div>
                    <div style="font-size:0.9rem;font-weight:700;color:#9A3412;font-family:monospace;">${d.vrl_code || '—'}</div>
                </div>
            </div>
        </div>
    `;

    modalEditBtn.onclick = () => {
        closeDealerDetailsModal();
        openEditDealerView(d);
    };

    modal.style.display = 'flex';
}

function closeDealerDetailsModal() {
    const modal = document.getElementById('dealerDetailsModal');
    if (modal) modal.style.display = 'none';
}

// Misc controls
function toggleFilterOptions() {
    if (window.showAlert) {
        window.showAlert('Filter', 'Filter options: Active, Inactive dealers.', 'info');
    }
}

function exportDealersData() {
    let listToExport = [];
    if (selectedDealerIds.size > 0) {
        listToExport = allDealers.filter(d => selectedDealerIds.has(String(d.dealer_id)));
    } else {
        listToExport = (filteredDealers && filteredDealers.length > 0) ? filteredDealers : allDealers;
    }

    if (!listToExport || listToExport.length === 0) {
        if (window.showAlert) {
            window.showAlert("Export Failed", "No dealer records available to export.", "info");
        } else {
            alert("No dealer records available to export.");
        }
        return;
    }

    const headers = [
        "DEALER ID",
        "FIRM / SHOP NAME",
        "CONTACT",
        "ADDRESS",
        "TOTAL ORDERS",
        "TOTAL BUSINESS",
        "LAST ORDER",
        "GST NO.",
        "CURRENT STATUS"
    ];

    const sanitize = (val) => `"${String(val !== undefined && val !== null ? val : '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

    let csvContent = headers.map(h => sanitize(h)).join(",") + "\n";

    listToExport.forEach(d => {
        const dealerIdCode = d.dealer_code || `SGB-${String(d.dealer_id).padStart(3, '0')}`;
        const firmName = d.firm_name || d.dealer_name || '';
        const phone = d.phone_number || d.phone || '';

        let fullAddress = d.address || '';
        if (!fullAddress && (d.city || d.state || d.town_village || d.taluk || d.district)) {
            fullAddress = [
                d.town_village,
                d.taluk ? d.taluk + ' Taluk' : '',
                d.city,
                d.district,
                d.state,
                d.pincode
            ].filter(Boolean).join(', ');
        }

        const totalOrdersCount = parseInt(d.total_orders || 0, 10);
        const totalBusinessVal = parseFloat(d.total_business || 0);
        const totalBusinessStr = `₹${totalBusinessVal.toLocaleString('en-IN')}.00`;

        const statusInfo = calculateDealerStatusInfo(d);
        const lastOrderStr = statusInfo.hasOrders ? statusInfo.lastOrderDateFormatted : 'No orders';
        const gstNoStr = formatGstNo(d.gst_no || d.gst_number);

        let currentStatusStr = '';
        if (statusInfo.status === 'Active') {
            currentStatusStr = `${statusInfo.statusLabel} (${statusInfo.daysRemaining} days left)`;
        } else if (statusInfo.hasOrders) {
            currentStatusStr = `INACTIVE (Expired)`;
        } else {
            currentStatusStr = `INACTIVE (No orders)`;
        }

        const row = [
            dealerIdCode,
            firmName,
            phone,
            fullAddress,
            totalOrdersCount,
            totalBusinessStr,
            lastOrderStr,
            gstNoStr,
            currentStatusStr
        ];

        csvContent += row.map(v => sanitize(v)).join(",") + "\n";
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    const fileNameSuffix = selectedDealerIds.size > 0 ? `selected_${selectedDealerIds.size}_dealers` : 'dealers_export';
    a.setAttribute('download', `${fileNameSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Order Product Page Logic
// ==========================================
// 1-CLICK PRODUCT SELECTION & ORDER CONFIGURATION
// ==========================================
let availableProducts = [];
let loadedDealerProductSets = [];

async function fetchAvailableProductsAndSets() {
    try {
        const tokenVal = token();
        // 1. Fetch Product Sets / Bundles
        try {
            const setsRes = await fetch(`${window.API_URL}/product-sets`, {
                headers: { 'Authorization': `Bearer ${tokenVal}` }
            });
            if (setsRes.ok) {
                loadedDealerProductSets = await setsRes.json();
            }
        } catch (e) {
            loadedDealerProductSets = [];
        }

        // 2. Fetch Products
        const res = await fetch(`${window.API_URL}/products`, {
            headers: { 'Authorization': `Bearer ${tokenVal}` }
        });
        if (res.ok) {
            availableProducts = await res.json();
        }
        renderDealerProductGrid();
    } catch (e) {
        console.error('Error fetching products and sets:', e);
    }
}

function renderDealerProductGrid() {
    const container = document.getElementById('dealer-products-container');
    if (!container) return;

    let setsHTML = '';
    if (loadedDealerProductSets && loadedDealerProductSets.length > 0) {
        setsHTML = loadedDealerProductSets.map(s => {
            let setTotal = 0;
            (s.items || []).forEach(item => {
                const itemPrice = parseFloat(item.dealer_price) > 0 ? parseFloat(item.dealer_price) : parseFloat(item.selling_price || 0);
                setTotal += itemPrice * (item.quantity || 1);
            });
            const itemsListStr = (s.items || []).map(item => `${item.product_name || item.name} (x${item.quantity})`).join(', ');

            return `
                <div class="product-select-card" data-name="${s.name}" data-type="set" data-id="${s.set_id}" data-price="${setTotal}" onclick="toggleDealerProductSelection(this)" style="background:#FFFBF7; border: 1px solid #FED7AA;">
                    <div class="product-info">
                        <div style="font-size:0.65rem; font-weight:800; color:#FF6B00; text-transform:uppercase; margin-bottom:4px; display:inline-flex; align-items:center; gap:3px; background:#FFEDD5; padding:2px 6px; border-radius:4px;">
                            <i class="fa-solid fa-cubes"></i> FULL SET BUNDLE
                        </div>
                        <div class="product-name" style="font-weight:800; color:#0F172A;">${s.name}</div>
                        <div class="product-price" style="color:#FF6B00; font-weight:800;">₹${setTotal.toLocaleString('en-IN')}.00</div>
                        <div style="font-size:0.72rem; color:#64748B; margin-top:2px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${itemsListStr}">${itemsListStr}</div>
                    </div>
                    <div class="quantity-controls" onclick="event.stopPropagation();">
                        <button type="button" class="qty-btn" onclick="updateDealerProductQuantity(event, this, -1)">-</button>
                        <input type="number" min="1" value="1" class="qty-val" oninput="updateDealerProductQuantityInput(event, this)" onblur="handleDealerProductQuantityBlur(this)" onwheel="this.blur()" style="width:45px;text-align:center;font-weight:700;border:1px solid #cbd5e1;border-radius:4px;padding:2px 4px;font-size:0.85rem;outline:none;background:#ffffff;margin:0 2px;">
                        <button type="button" class="qty-btn" onclick="updateDealerProductQuantity(event, this, 1)">+</button>
                    </div>
                    <div class="check-indicator"><i class="fa-solid fa-circle-check"></i></div>
                </div>
            `;
        }).join('');
    }

    let productsHTML = '';
    if (availableProducts && availableProducts.length > 0) {
        productsHTML = availableProducts.map(p => {
            const price = parseFloat(p.dealer_price) > 0 ? parseFloat(p.dealer_price) : parseFloat(p.selling_price || 0);
            return `
                <div class="product-select-card" data-name="${p.name}" data-type="product" data-id="${p.product_id}" data-price="${price}" onclick="toggleDealerProductSelection(this)">
                    <div class="product-info">
                        <div class="product-name">${p.name}</div>
                        <div class="product-price">₹${price.toLocaleString('en-IN')}.00</div>
                    </div>
                    <div class="quantity-controls" onclick="event.stopPropagation();">
                        <button type="button" class="qty-btn" onclick="updateDealerProductQuantity(event, this, -1)">-</button>
                        <input type="number" min="1" value="1" class="qty-val" oninput="updateDealerProductQuantityInput(event, this)" onblur="handleDealerProductQuantityBlur(this)" onwheel="this.blur()" style="width:45px;text-align:center;font-weight:700;border:1px solid #cbd5e1;border-radius:4px;padding:2px 4px;font-size:0.85rem;outline:none;background:#ffffff;margin:0 2px;">
                        <button type="button" class="qty-btn" onclick="updateDealerProductQuantity(event, this, 1)">+</button>
                    </div>
                    <div class="check-indicator"><i class="fa-solid fa-circle-check"></i></div>
                </div>
            `;
        }).join('');
    }

    if (!setsHTML && !productsHTML) {
        container.innerHTML = `<div style="padding:2rem;text-align:center;color:#94a3b8;grid-column:1/-1;">No products found in inventory.</div>`;
    } else {
        container.innerHTML = setsHTML + productsHTML;
    }
}

function toggleDealerProductSelection(card) {
    if (!card) return;
    card.classList.toggle('selected');
    const qtyEl = card.querySelector('.qty-val');
    if (card.classList.contains('selected')) {
        const val = parseInt(qtyEl ? (qtyEl.value || qtyEl.textContent) : '1') || 1;
        if (val < 1) {
            if (qtyEl.tagName === 'INPUT') qtyEl.value = '1';
            else qtyEl.textContent = '1';
        }
    }
    recalcDealerOrderAmounts();
}

function updateDealerProductQuantity(event, btn, delta) {
    if (event) event.stopPropagation();
    const card = btn.closest('.product-select-card');
    if (!card) return;

    const qtyEl = card.querySelector('.qty-val');
    let currentQty = parseInt(qtyEl ? (qtyEl.value || qtyEl.textContent) : '1') || 1;
    let newQty = currentQty + delta;

    if (newQty <= 0) {
        card.classList.remove('selected');
        if (qtyEl) {
            if (qtyEl.tagName === 'INPUT') qtyEl.value = '1';
            else qtyEl.textContent = '1';
        }
    } else {
        if (qtyEl) {
            if (qtyEl.tagName === 'INPUT') qtyEl.value = newQty;
            else qtyEl.textContent = newQty;
        }
        if (!card.classList.contains('selected')) {
            card.classList.add('selected');
        }
    }
    recalcDealerOrderAmounts();
}

function updateDealerProductQuantityInput(event, inputEl) {
    if (event) event.stopPropagation();
    const card = inputEl.closest('.product-select-card');
    if (!card) return;

    if (!card.classList.contains('selected')) {
        card.classList.add('selected');
    }
    recalcDealerOrderAmounts();
}

function handleDealerProductQuantityBlur(inputEl) {
    const rawVal = (inputEl.value || '').trim();
    const val = parseInt(rawVal);
    if (isNaN(val) || val < 1) {
        inputEl.value = '1';
        recalcDealerOrderAmounts();
    }
}

function getDealerSelectedProducts() {
    const container = document.getElementById('dealer-products-container');
    if (!container) return [];

    const selectedCards = container.querySelectorAll('.product-select-card.selected');
    const finalItems = [];

    selectedCards.forEach(card => {
        const type = card.getAttribute('data-type') || 'product';
        const id = card.getAttribute('data-id');
        const qtyEl = card.querySelector('.qty-val');
        const qty = qtyEl ? (parseInt(qtyEl.value || qtyEl.textContent) || 1) : 1;

        if (type === 'set') {
            const set = (loadedDealerProductSets || []).find(s => s.set_id == id);
            if (set && set.items && set.items.length > 0) {
                set.items.forEach(item => {
                    const pid = item.product_id;
                    const price = parseFloat(item.dealer_price) > 0 ? parseFloat(item.dealer_price) : parseFloat(item.selling_price || 0);
                    const existing = finalItems.find(fi => fi.product_id === pid);
                    if (existing) {
                        existing.quantity += (item.quantity || 1) * qty;
                        existing.total = existing.quantity * existing.price;
                    } else {
                        finalItems.push({
                            product_id: pid,
                            name: item.product_name || item.name,
                            price: price,
                            quantity: (item.quantity || 1) * qty,
                            total: price * (item.quantity || 1) * qty
                        });
                    }
                });
            } else {
                const price = parseFloat(card.getAttribute('data-price')) || 0;
                finalItems.push({
                    product_id: null,
                    name: card.getAttribute('data-name'),
                    price: price,
                    quantity: qty,
                    total: price * qty
                });
            }
        } else {
            const pid = parseInt(id);
            const price = parseFloat(card.getAttribute('data-price')) || 0;
            const existing = finalItems.find(fi => fi.product_id === pid);
            if (existing) {
                existing.quantity += qty;
                existing.total = existing.quantity * existing.price;
            } else {
                finalItems.push({
                    product_id: pid,
                    name: card.getAttribute('data-name'),
                    price: price,
                    quantity: qty,
                    total: price * qty
                });
            }
        }
    });

    return finalItems;
}

let stage2OrderItems = [];

function syncStage2OrderItems() {
    const container = document.getElementById('dealer-products-container');
    if (!container) return;

    const selectedCards = container.querySelectorAll('.product-select-card.selected');
    const newItems = [];

    selectedCards.forEach(card => {
        const id = card.getAttribute('data-id');
        const name = card.getAttribute('data-name');
        const defaultPrice = parseFloat(card.getAttribute('data-price')) || 0;
        const qtyEl = card.querySelector('.qty-val');
        const qty = qtyEl ? (parseInt(qtyEl.value || qtyEl.textContent) || 1) : 1;

        // Preserve user edited unitPrice and discount if item is already in list
        const existing = stage2OrderItems.find(item => item.id == id && item.name === name);

        if (existing) {
            existing.quantity = qty;
            newItems.push(existing);
        } else {
            newItems.push({
                id: id,
                product_id: parseInt(id) || null,
                name: name,
                unitPrice: defaultPrice,
                discount: 0,
                quantity: qty
            });
        }
    });

    stage2OrderItems = newItems;
    renderStage2OrderItemsTable();
}

function renderStage2OrderItemsTable() {
    const tbody = document.getElementById('stage2OrderItemsTbody');
    const itemsCountEl = document.getElementById('stage2TotalItemsCount');
    const subTotalDisplayEl = document.getElementById('stage2SubTotalDisplay');

    if (!tbody) return;

    if (stage2OrderItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="padding:2.5rem;text-align:center;color:#94a3b8;">
                    <i class="fa-solid fa-basket-shopping" style="font-size:1.5rem;margin-bottom:0.5rem;display:block;"></i>
                    No products added yet. Click product cards above to add items.
                </td>
            </tr>
        `;
        if (itemsCountEl) itemsCountEl.textContent = '0';
        if (subTotalDisplayEl) subTotalDisplayEl.textContent = '₹0.00';
        recalcStage3Amounts();
        return;
    }

    let totalItems = 0;
    let subTotalSum = 0;

    tbody.innerHTML = stage2OrderItems.map((item, idx) => {
        const itemSubTotal = item.unitPrice * item.quantity;
        const itemDiscountTotal = item.discount * item.quantity;
        const itemFinalTotal = Math.max(0, itemSubTotal - itemDiscountTotal);

        totalItems += item.quantity;
        subTotalSum += itemSubTotal;

        return `
            <tr style="border-bottom:1px solid #f1f5f9;transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding:0.75rem 0.5rem;text-align:center;font-weight:700;color:#64748b;">${idx + 1}</td>
                <td style="padding:0.75rem 0.75rem;">
                    <div style="font-weight:700;color:#0f172a;">${item.name}</div>
                    ${item.quantity > 1 ? `<span style="font-size:0.75rem;color:#f59e0b;font-weight:700;">Qty: ${item.quantity}</span>` : ''}
                </td>
                <td style="padding:0.75rem 0.75rem;">
                    <input type="number" id="stage2UnitPrice_${idx}" min="0" step="1" value="${item.unitPrice}" oninput="updateStage2ItemUnitPrice(${idx}, this.value)" onwheel="this.blur()" style="width:105px;padding:0.4rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.875rem;font-weight:700;color:#0f172a;outline:none;background:#ffffff;">
                </td>
                <td style="padding:0.75rem 0.75rem;">
                    <input type="number" id="stage2Discount_${idx}" min="0" step="1" value="${item.discount}" oninput="updateStage2ItemDiscount(${idx}, this.value)" onwheel="this.blur()" style="width:95px;padding:0.4rem 0.5rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.875rem;font-weight:600;color:#0f172a;outline:none;background:#ffffff;">
                </td>
                <td style="padding:0.75rem 0.75rem;">
                    <span id="stage2RowTotal_${idx}" style="font-weight:800;color:#16a34a;font-size:0.95rem;">₹${itemFinalTotal.toLocaleString('en-IN')}.00</span>
                </td>
                <td style="padding:0.75rem 0.5rem;text-align:center;">
                    <button type="button" onclick="removeStage2OrderItem(${idx})" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px 8px;font-size:0.95rem;" title="Remove Item">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (itemsCountEl) itemsCountEl.textContent = totalItems;
    if (subTotalDisplayEl) subTotalDisplayEl.textContent = `₹${subTotalSum.toLocaleString('en-IN')}.00`;

    recalcStage3Amounts();
}

function updateStage2ItemUnitPrice(idx, val) {
    if (stage2OrderItems[idx]) {
        stage2OrderItems[idx].unitPrice = parseFloat(val) || 0;
        
        // Update row total without re-rendering tbody (preserves focus & cursor)
        const item = stage2OrderItems[idx];
        const itemSubTotal = item.unitPrice * item.quantity;
        const itemDiscountTotal = item.discount * item.quantity;
        const itemFinalTotal = Math.max(0, itemSubTotal - itemDiscountTotal);
        const rowTotalEl = document.getElementById(`stage2RowTotal_${idx}`);
        if (rowTotalEl) {
            rowTotalEl.textContent = `₹${itemFinalTotal.toLocaleString('en-IN')}.00`;
        }

        // Update footer totals
        let totalItems = 0;
        let subTotalSum = 0;
        stage2OrderItems.forEach(it => {
            totalItems += it.quantity;
            subTotalSum += (it.unitPrice * it.quantity);
        });
        const itemsCountEl = document.getElementById('stage2TotalItemsCount');
        const subTotalDisplayEl = document.getElementById('stage2SubTotalDisplay');
        if (itemsCountEl) itemsCountEl.textContent = totalItems;
        if (subTotalDisplayEl) subTotalDisplayEl.textContent = `₹${subTotalSum.toLocaleString('en-IN')}.00`;

        recalcStage3Amounts();
    }
}

function updateStage2ItemDiscount(idx, val) {
    if (stage2OrderItems[idx]) {
        stage2OrderItems[idx].discount = parseFloat(val) || 0;
        
        // Update row total without re-rendering tbody (preserves focus & cursor)
        const item = stage2OrderItems[idx];
        const itemSubTotal = item.unitPrice * item.quantity;
        const itemDiscountTotal = item.discount * item.quantity;
        const itemFinalTotal = Math.max(0, itemSubTotal - itemDiscountTotal);
        const rowTotalEl = document.getElementById(`stage2RowTotal_${idx}`);
        if (rowTotalEl) {
            rowTotalEl.textContent = `₹${itemFinalTotal.toLocaleString('en-IN')}.00`;
        }

        // Update footer totals
        let totalItems = 0;
        let subTotalSum = 0;
        stage2OrderItems.forEach(it => {
            totalItems += it.quantity;
            subTotalSum += (it.unitPrice * it.quantity);
        });
        const itemsCountEl = document.getElementById('stage2TotalItemsCount');
        const subTotalDisplayEl = document.getElementById('stage2SubTotalDisplay');
        if (itemsCountEl) itemsCountEl.textContent = totalItems;
        if (subTotalDisplayEl) subTotalDisplayEl.textContent = `₹${subTotalSum.toLocaleString('en-IN')}.00`;

        recalcStage3Amounts();
    }
}

function updateStage2ItemTax(idx, val) {
    if (stage2OrderItems[idx]) {
        stage2OrderItems[idx].tax = parseFloat(val) || 0;
        recalcStage3Amounts();
    }
}

function removeStage2OrderItem(idx) {
    const itemToRemove = stage2OrderItems[idx];
    if (itemToRemove) {
        const container = document.getElementById('dealer-products-container');
        if (container) {
            const card = container.querySelector(`.product-select-card[data-id="${itemToRemove.id}"][data-name="${itemToRemove.name}"]`);
            if (card) {
                card.classList.remove('selected');
                const qtySpan = card.querySelector('.qty-val');
                if (qtySpan) qtySpan.textContent = '1';
            }
        }
        stage2OrderItems.splice(idx, 1);
        renderStage2OrderItemsTable();
    }
}

function clearAllStage2OrderItems() {
    stage2OrderItems = [];
    const container = document.getElementById('dealer-products-container');
    if (container) {
        const selectedCards = container.querySelectorAll('.product-select-card.selected');
        selectedCards.forEach(c => {
            c.classList.remove('selected');
            const qtySpan = c.querySelector('.qty-val');
            if (qtySpan) qtySpan.textContent = '1';
        });
    }
    renderStage2OrderItemsTable();
}

function recalcStage3Amounts() {
    let subTotal = 0;
    let totalDiscount = 0;

    stage2OrderItems.forEach(item => {
        const uPrice = parseFloat(item.unitPrice) || 0;
        const qty = parseInt(item.quantity) || 1;
        const disc = parseFloat(item.discount) || 0;

        subTotal += (uPrice * qty);
        totalDiscount += (disc * qty);
    });

    const totalAmount = Math.max(0, subTotal - totalDiscount);

    const advanceInput = document.getElementById('dealer-order-advance');
    const advanceVal = parseFloat(advanceInput ? advanceInput.value : 0) || 0;

    const finalAmount = totalAmount;
    const dueAmount = Math.max(0, finalAmount - advanceVal);

    // Update Stage 3 DOM elements
    const subTotalEl = document.getElementById('stage3SubTotal');
    const totalDiscountEl = document.getElementById('stage3TotalDiscount');
    const totalAmountEl = document.getElementById('stage3TotalAmount');
    const finalAmountEl = document.getElementById('stage3FinalAmount');
    const dueAmountEl = document.getElementById('stage3DueAmount');

    if (subTotalEl) subTotalEl.textContent = `₹${subTotal.toLocaleString('en-IN')}.00`;
    if (totalDiscountEl) totalDiscountEl.textContent = `₹${totalDiscount.toLocaleString('en-IN')}.00`;
    if (totalAmountEl) totalAmountEl.textContent = `₹${totalAmount.toLocaleString('en-IN')}.00`;
    if (finalAmountEl) finalAmountEl.textContent = `₹${finalAmount.toLocaleString('en-IN')}.00`;
    if (dueAmountEl) {
        dueAmountEl.textContent = `₹${dueAmount.toLocaleString('en-IN')}.00`;
        dueAmountEl.style.color = dueAmount > 0 ? '#16a34a' : '#0f172a';
    }

    // Keep hidden inputs in sync
    const totalInput = document.getElementById('dealer-order-total');
    const discountInput = document.getElementById('dealer-order-discount');
    const finalInput = document.getElementById('dealer-order-final');
    const dueInput = document.getElementById('dealer-order-due');

    if (totalInput) totalInput.value = subTotal;
    if (discountInput) discountInput.value = totalDiscount;
    if (finalInput) finalInput.value = finalAmount;
    if (dueInput) dueInput.value = dueAmount;

    // Toggle Payment Method Visibility based on Advance Amount > 0
    const pmWrapper = document.getElementById('dealer-payment-method-wrapper');
    const pmSelect = document.getElementById('dealer-order-payment-method');
    if (pmWrapper) {
        if (advanceVal > 0) {
            pmWrapper.style.display = 'block';
        } else {
            pmWrapper.style.display = 'none';
            if (pmSelect) pmSelect.value = '';
        }
    }
}

function recalcDealerOrderAmounts() {
    syncStage2OrderItems();
}

function updateDealerFinalAndDue() {
    recalcStage3Amounts();
}

function toggleDealerOtherDelivery(val) {
    const wrapper = document.getElementById('dealer-delivery-other-wrapper');
    if (wrapper) {
        const v = (val || '').toLowerCase();
        wrapper.style.display = (v === 'others' || v === 'other') ? 'block' : 'none';
    }
}

function openOrderPageForDealer(dealerId, updateUrl = true) {
    const d = allDealers.find(item => item.dealer_id == dealerId);
    if (!d) return;

    document.getElementById('dealers-list-view').style.display = 'none';
    document.getElementById('add-dealer-view').style.display = 'none';
    const orderView = document.getElementById('order-dealer-view');
    if (orderView) orderView.style.display = 'block';

    if (updateUrl) updateViewUrl('order', { id: d.dealer_id });

    document.getElementById('order_page_dealer_id').value = d.dealer_id;
    document.getElementById('orderPageFirmName').textContent = d.firm_name || d.dealer_name || 'Dealer Firm Name';
    document.getElementById('orderPageOwnerName').textContent = d.owner_name || d.contact_person || 'Owner';
    document.getElementById('orderPagePhone').textContent = d.phone_number || d.phone || '—';
    
    let fullAddr = d.address || `${d.town_village || ''}, ${d.city || ''}, ${d.state || 'Karnataka'}`;
    document.getElementById('orderPageAddress').textContent = fullAddr.replace(/\n/g, ', ');

    // Reset Form Fields
    const dateInput = document.getElementById('dealer-order-payment-date');
    if (dateInput) dateInput.value = '';

    const notesInput = document.getElementById('dealer-order-notes');
    if (notesInput) notesInput.value = '';

    const advInput = document.getElementById('dealer-order-advance');
    if (advInput) advInput.value = 0;

    const deliverySelect = document.getElementById('dealer-delivery-type');
    if (deliverySelect) deliverySelect.value = '';
    toggleDealerOtherDelivery('');

    const paymentSelect = document.getElementById('dealer-order-payment-method');
    if (paymentSelect) paymentSelect.value = '';

    // Clear previous order items
    clearAllStage2OrderItems();

    fetchAvailableProductsAndSets();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleConfirmDealerOrderSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!stage2OrderItems || stage2OrderItems.length === 0) {
        if (window.showAlert) {
            window.showAlert('Selection Required', 'Please click at least one product card to add to the order.', 'warning');
        } else {
            alert('Please select at least one product card to add to the order.');
        }
        return;
    }

    const deliveryTypeSelect = document.getElementById('dealer-delivery-type');
    let deliveryType = deliveryTypeSelect ? deliveryTypeSelect.value : '';
    if (!deliveryType) {
        if (window.showAlert) {
            window.showAlert('Delivery Type Required', 'Please select a Delivery Type for this order.', 'warning');
        } else {
            alert('Please select a Delivery Type for this order.');
        }
        return;
    }

    const vDel = (deliveryType || '').toLowerCase();
    if (vDel === 'others' || vDel === 'other') {
        const otherInput = document.getElementById('dealer-delivery-other');
        const otherVal = otherInput ? otherInput.value.trim() : '';
        if (!otherVal) {
            if (window.showAlert) {
                window.showAlert('Delivery Details Required', 'Please specify delivery details for "OTHERS".', 'warning');
            } else {
                alert('Please specify delivery details for "OTHERS".');
            }
            return;
        }
        deliveryType = `OTHERS: ${otherVal}`;
    }

    const advanceVal = parseFloat(document.getElementById('dealer-order-advance')?.value) || 0;
    const paymentMethodSelect = document.getElementById('dealer-order-payment-method');
    let paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : '';

    if (advanceVal > 0) {
        if (!paymentMethod) {
            if (window.showAlert) {
                window.showAlert('Payment Method Required', 'Please select a Payment Method for the advance payment.', 'warning');
            } else {
                alert('Please select a Payment Method for the advance payment.');
            }
            return;
        }
    } else {
        paymentMethod = '';
    }

    const paymentDateInput = document.getElementById('dealer-order-payment-date');
    const paymentDate = paymentDateInput ? paymentDateInput.value : '';
    if (!paymentDate) {
        if (window.showAlert) {
            window.showAlert('Purchase Date Required', 'Please select a Purchase Date for this order.', 'warning');
        } else {
            alert('Please select a Purchase Date for this order.');
        }
        return;
    }

    const dealerId = document.getElementById('order_page_dealer_id').value;
    
    let subTotal = 0;
    let totalDiscount = 0;

    stage2OrderItems.forEach(item => {
        const uPrice = parseFloat(item.unitPrice) || 0;
        const qty = parseInt(item.quantity) || 1;
        const disc = parseFloat(item.discount) || 0;

        subTotal += (uPrice * qty);
        totalDiscount += (disc * qty);
    });

    const totalVal = Math.max(0, subTotal - totalDiscount);
    const dueVal = Math.max(0, totalVal - advanceVal);

    const notes = document.getElementById('dealer-order-notes')?.value.trim() || '';

    const submitBtn = document.getElementById('dealer-submit-order-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Order...`;
    }

    const orderPayload = {
        dealer_id: dealerId,
        items: stage2OrderItems.map(item => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            price: item.unitPrice,
            discount: item.discount,
            total_price: Math.max(0, (item.unitPrice - item.discount) * item.quantity)
        })),
        total_amount: totalVal,
        advance_amount: advanceVal,
        balance_amount: dueVal,
        payment_type: advanceVal >= totalVal ? 'full' : advanceVal > 0 ? 'partial' : 'no_advance',
        payment_method: paymentMethod,
        payment_date: paymentDate,
        order_date: paymentDate,
        purchased_date: paymentDate,
        delivery_type: deliveryType,
        discount: totalDiscount,
        notes: notes ? `${notes} (Delivery: ${deliveryType})` : `Delivery: ${deliveryType}`
    };

    try {
        let res = await fetch(`${API_BASE}/${dealerId}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify(orderPayload)
        });

        if (res.status === 404) {
            res = await fetch(`${API_BASE}/${dealerId}/order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token()}`
                },
                body: JSON.stringify(orderPayload)
            });
        }

        if (res.ok) {
            const data = await res.json();
            await fetchDealers();
            if (currentProfileDealer && String(currentProfileDealer.dealer_id) === String(dealerId)) {
                const updatedDealer = allDealers.find(item => String(item.dealer_id) === String(dealerId));
                if (updatedDealer) {
                    openDealerDetailsPageView(updatedDealer);
                } else {
                    openDealersListView();
                }
            } else {
                openDealersListView();
            }
            if (window.showAlert) {
                window.showAlert('Order Confirmed', `Order #${data.order_id || 'SGB'} for ₹${totalVal.toLocaleString('en-IN')} confirmed successfully!`, 'success');
            } else {
                alert(`Order of ₹${totalVal.toLocaleString('en-IN')} confirmed successfully!`);
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            alert('Failed to place order: ' + (errData.message || 'Server error'));
        }
    } catch (err) {
        console.error('Error confirming dealer order:', err);
        alert('Server connection error while confirming order.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `Save & Convert Order <i class="fa-solid fa-check"></i>`;
        }
    }
}

// Global Window Bindings for Inline HTML Event Handlers
window.fetchDealers = fetchDealers;
window.renderDealersTable = renderDealersTable;
window.openDealersListView = openDealersListView;
window.openAddDealerView = openAddDealerView;
window.openEditDealerView = openEditDealerView;
window.openOrderPageForDealer = openOrderPageForDealer;
const safeBindWindow = (bindings) => {
    Object.keys(bindings).forEach(key => {
        try {
            if (typeof bindings[key] !== 'undefined') window[key] = bindings[key];
        } catch (e) {}
    });
};

safeBindWindow({
    openCreateOrderModalForDealer: typeof openOrderPageForDealer !== 'undefined' ? openOrderPageForDealer : undefined,
    editDealerById: typeof editDealerById !== 'undefined' ? editDealerById : undefined,
    viewDealerById: typeof viewDealerById !== 'undefined' ? viewDealerById : undefined,
    updateStage2ItemUnitPrice: typeof updateStage2ItemUnitPrice !== 'undefined' ? updateStage2ItemUnitPrice : undefined,
    updateStage2ItemDiscount: typeof updateStage2ItemDiscount !== 'undefined' ? updateStage2ItemDiscount : undefined,
    updateStage2ItemTax: typeof updateStage2ItemTax !== 'undefined' ? updateStage2ItemTax : undefined,
    removeStage2OrderItem: typeof removeStage2OrderItem !== 'undefined' ? removeStage2OrderItem : undefined,
    clearAllStage2OrderItems: typeof clearAllStage2OrderItems !== 'undefined' ? clearAllStage2OrderItems : undefined,
    recalcStage3Amounts: typeof recalcStage3Amounts !== 'undefined' ? recalcStage3Amounts : undefined,
    viewDealerDetails: typeof viewDealerDetails !== 'undefined' ? viewDealerDetails : undefined,
    openDealerDetailsPageView: typeof openDealerDetailsPageView !== 'undefined' ? openDealerDetailsPageView : undefined,
    switchDpTab: typeof switchDpTab !== 'undefined' ? switchDpTab : undefined,
    closeDealerDetailsModal: typeof closeDealerDetailsModal !== 'undefined' ? closeDealerDetailsModal : undefined,
    handleDealerSubmit: typeof handleDealerSubmit !== 'undefined' ? handleDealerSubmit : undefined,
    deleteDealer: typeof deleteDealer !== 'undefined' ? deleteDealer : undefined,
    toggleFilterOptions: typeof toggleFilterOptions !== 'undefined' ? toggleFilterOptions : undefined,
    exportDealersData: typeof exportDealersData !== 'undefined' ? exportDealersData : undefined,
    handleQuantityChange: typeof handleQuantityChange !== 'undefined' ? handleQuantityChange : undefined,
    updateQuantityInput: typeof updateQuantityInput !== 'undefined' ? updateQuantityInput : undefined,
    removeOrderItem: typeof removeOrderItem !== 'undefined' ? removeOrderItem : undefined,
    calculateBalanceAmount: typeof calculateBalanceAmount !== 'undefined' ? calculateBalanceAmount : undefined,
    handlePaymentTypeChange: typeof handlePaymentTypeChange !== 'undefined' ? handlePaymentTypeChange : undefined,
    handleConfirmDealerOrderSubmit: typeof handleConfirmDealerOrderSubmit !== 'undefined' ? handleConfirmDealerOrderSubmit : undefined,
    openDealerVisitModal: typeof openDealerVisitModal !== 'undefined' ? openDealerVisitModal : undefined,
    closeDealerVisitModal: typeof closeDealerVisitModal !== 'undefined' ? closeDealerVisitModal : undefined,
    addCustomVisitQuestion: typeof addCustomVisitQuestion !== 'undefined' ? addCustomVisitQuestion : undefined,
    removeCustomVisitQuestion: typeof removeCustomVisitQuestion !== 'undefined' ? removeCustomVisitQuestion : undefined,
    saveDealerVisitForm: typeof saveDealerVisitForm !== 'undefined' ? saveDealerVisitForm : undefined,
    viewVisitDetailsModal: typeof viewVisitDetailsModal !== 'undefined' ? viewVisitDetailsModal : undefined,
    deleteVisitRecord: typeof deleteVisitRecord !== 'undefined' ? deleteVisitRecord : undefined,
    openAddQuestionModal: typeof openAddQuestionModal !== 'undefined' ? openAddQuestionModal : undefined,
    closeAddQuestionModal: typeof closeAddQuestionModal !== 'undefined' ? closeAddQuestionModal : undefined,
    handleAnswerTypeChange: typeof handleAnswerTypeChange !== 'undefined' ? handleAnswerTypeChange : undefined,
    handleAddQuestionSubmit: typeof handleAddQuestionSubmit !== 'undefined' ? handleAddQuestionSubmit : undefined,
    toggleVisitQnAExpand: typeof toggleVisitQnAExpand !== 'undefined' ? toggleVisitQnAExpand : undefined,
    toggleDealerProductSelection: typeof toggleDealerProductSelection !== 'undefined' ? toggleDealerProductSelection : undefined,
    updateDealerProductQuantity: typeof updateDealerProductQuantity !== 'undefined' ? updateDealerProductQuantity : undefined,
    recalcDealerOrderAmounts: typeof recalcDealerOrderAmounts !== 'undefined' ? recalcDealerOrderAmounts : undefined,
    updateDealerFinalAndDue: typeof updateDealerFinalAndDue !== 'undefined' ? updateDealerFinalAndDue : undefined,
    setStatusFilter: typeof setStatusFilter !== 'undefined' ? setStatusFilter : undefined,
    handleStatusFilterChange: typeof handleStatusFilterChange !== 'undefined' ? handleStatusFilterChange : undefined,
    setDaysFilter: typeof setDaysFilter !== 'undefined' ? setDaysFilter : undefined,
    handleDaysFilterChange: typeof handleDaysFilterChange !== 'undefined' ? handleDaysFilterChange : undefined,
    setSortFilter: typeof setSortFilter !== 'undefined' ? setSortFilter : undefined,
    handleSortFilterChange: typeof handleSortFilterChange !== 'undefined' ? handleSortFilterChange : undefined
});

// ==========================================
// BULK IMPORT DEALERS LOGIC (EXCEL / CSV)
// ==========================================

function openImportDealersModal(e) {
    if (e && e.preventDefault) e.preventDefault();
    const modal = document.getElementById('importDealersModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    } else {
        console.error('importDealersModal element not found');
    }
    try {
        clearImportFileSelection();
    } catch (err) {}
}
window.openImportDealersModal = openImportDealersModal;

function closeImportDealersModal() {
    const modal = document.getElementById('importDealersModal');
    if (modal) modal.style.display = 'none';
    clearImportFileSelection();
}

function downloadDealerImportTemplate() {
    const headers = [
        "FIRM / SHOP NAME",
        "DEALER NAME",
        "CONTACT",
        "GST NO.",
        "TOWN / VILLAGE",
        "CITY",
        "TALUK",
        "DISTRICT",
        "STATE",
        "PIN CODE",
        "NEAREST VRL LOCATION",
        "VRL CODE",
        "CURRENT STATUS"
    ];

    const sampleRow1 = [
        "Greenfield Agro Super Store",
        "Ramesh Kumar",
        "9342399999",
        "27AAHFG9999K1Z9",
        "Nanjangud",
        "Mysuru",
        "Nanjangud",
        "Mysuru",
        "Karnataka",
        "571301",
        "Mysore VRL Branch",
        "VRL-MYS-01",
        "Active"
    ];

    const sampleRow2 = [
        "Sree Lakshmi Agri Store",
        "Suresh Gowda",
        "9876543210",
        "29ABCDE1234F1Z5",
        "Tumkur Town",
        "Tumkur",
        "Tumkur",
        "Tumkur",
        "Karnataka",
        "572101",
        "Tumkur VRL Hub",
        "VRL-TUM-04",
        "Inactive"
    ];

    const sanitize = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
    const csvContent = '\uFEFF' + [
        headers.map(sanitize).join(','),
        sampleRow1.map(sanitize).join(','),
        sampleRow2.map(sanitize).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'dealer_import_sample_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function clearImportFileSelection() {
    pendingImportDealersList = [];
    const fileInput = document.getElementById('dealerImportFileInput');
    if (fileInput) fileInput.value = '';

    const prompt = document.getElementById('importFilePrompt');
    if (prompt) prompt.innerHTML = 'Click or Drag & Drop Excel / CSV file here';

    const previewContainer = document.getElementById('importPreviewContainer');
    if (previewContainer) previewContainer.style.display = 'none';

    const btnSubmit = document.getElementById('btnSubmitBulkImport');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.5';
        btnSubmit.innerHTML = '<i class="fa-solid fa-file-import"></i> Import Dealers Now';
    }
}

function handleImportFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const prompt = document.getElementById('importFilePrompt');
    if (prompt) prompt.innerHTML = `<i class="fa-solid fa-file-excel" style="color:#10B981;margin-right:6px;"></i> Selected: <strong>${file.name}</strong>`;

    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = function (e) {
        try {
            let data = [];
            if (isExcel && window.XLSX) {
                const buffer = e.target.result;
                const workbook = window.XLSX.read(buffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                data = window.XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            } else {
                const text = e.target.result;
                data = parseCSVToObjects(text);
            }

            if (!Array.isArray(data) || data.length === 0) {
                if (window.showAlert) {
                    window.showAlert("File Parsing Error", "No dealer records found in the selected file.", "warning");
                }
                clearImportFileSelection();
                return;
            }

            pendingImportDealersList = data;
            renderImportPreview(data);
        } catch (err) {
            console.error("Error parsing import file:", err);
            if (window.showAlert) {
                window.showAlert("Parsing Error", "Failed to parse file: " + err.message, "error");
            }
            clearImportFileSelection();
        }
    };

    if (isExcel) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

function parseCSVToObjects(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    const parseLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const headers = parseLine(lines[0]);
    const objects = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        if (values.length === 0 || (values.length === 1 && !values[0])) continue;
        const obj = {};
        headers.forEach((h, idx) => {
            const cleanKey = h.replace(/^[\uFEFF"'\s]+|["'\s]+$/g, '');
            let val = values[idx] !== undefined ? values[idx] : '';
            val = val.replace(/^["']|["']$/g, '').trim();
            obj[cleanKey] = val;
        });
        objects.push(obj);
    }
    return objects;
}

function extractPhoneNumbersFromObject(item) {
    if (!item || typeof item !== 'object') return [];
    const rawValues = [];
    const keys = Object.keys(item);
    for (const k of keys) {
        const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normK.includes('contact') || normK.includes('phone') || normK.includes('mobile') || normK.includes('cell')) {
            const val = item[k];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                rawValues.push(String(val).trim());
            }
        }
    }
    const phones = [];
    rawValues.forEach(raw => {
        const cleanedRaw = raw.replace(/\+91/g, ' ').replace(/\b91(?=\d{10}\b)/g, ' ');
        const parts = cleanedRaw.split(/[,;\/|\\&+\n\r\t]|\band\b|\bor\b/i);
        parts.forEach(part => {
            let digits = part.replace(/\D/g, '');
            if (!digits) return;
            if (digits.length === 11 && digits.startsWith('0')) digits = digits.substring(1);
            else if (digits.length === 12 && digits.startsWith('91')) digits = digits.substring(2);

            if (digits.length === 10) {
                if (!phones.includes(digits)) phones.push(digits);
            } else if (digits.length > 10) {
                const matches = digits.match(/[6-9]\d{9}/g);
                if (matches) {
                    matches.forEach(m => { if (!phones.includes(m)) phones.push(m); });
                } else {
                    const last10 = digits.slice(-10);
                    if (last10.length === 10 && !phones.includes(last10)) phones.push(last10);
                }
            } else if (digits.length >= 7) {
                if (!phones.includes(digits)) phones.push(digits);
            }
        });
    });
    return phones;
}

function renderImportPreview(rows) {
    const previewContainer = document.getElementById('importPreviewContainer');
    const tbody = document.getElementById('importPreviewTableBody');
    const btnSubmit = document.getElementById('btnSubmitBulkImport');

    const totalEl = document.getElementById('importSummaryTotal');
    const newEl = document.getElementById('importSummaryNew');
    const oldEl = document.getElementById('importSummaryOld');

    if (!tbody || !previewContainer) return;

    previewContainer.style.display = 'block';

    const normalizeStr = (str) => str ? String(str).toLowerCase().replace(/[^a-z0-9]/g, '') : '';

    let newCount = 0;
    let oldCount = 0;

    tbody.innerHTML = rows.map((r, idx) => {
        const firmName = r.firm_name || r.dealer_name || r['FIRM / SHOP NAME'] || r['FIRM NAME'] || r['Firm Name'] || r['Shop Name'] || '—';
        const dealerName = r.owner_name || r.contact_person || r['DEALER NAME'] || r['Dealer Name'] || '—';
        const extracted = extractPhoneNumbersFromObject(r);
        const phone = extracted.length > 0 ? extracted.join(' / ') : (r.phone_number || r.phone || r.contact || r['CONTACT'] || r['Phone'] || '—');
        const city = r.city || r['CITY'] || r.address || r['ADDRESS'] || r['City'] || '—';
        const gstNo = r.gst_no || r['GST NO.'] || r['GST NO'] || r['GST No'] || r['GSTIN'] || '';

        const rowFirmNorm = normalizeStr(firmName !== '—' ? firmName : '');
        const rowGstNorm = normalizeStr(gstNo);

        let isDuplicate = false;
        let matchReason = '';

        for (const d of allDealers) {
            const existingFirmNorm = normalizeStr(d.dealer_name);
            const existingGstNorm = normalizeStr(d.gst_no);
            const existingPhones = extractPhoneNumbersFromObject({ phone: d.phone, contact: d.contact_person });

            // 1. Phone match check
            if (extracted.length > 0 && existingPhones.length > 0) {
                const matchedPhone = extracted.find(p => existingPhones.includes(p));
                if (matchedPhone) {
                    isDuplicate = true;
                    matchReason = `Phone ${matchedPhone} matches "${d.dealer_name}"`;
                    break;
                }
            }

            // 2. Firm Name match check
            if (rowFirmNorm && existingFirmNorm && (rowFirmNorm === existingFirmNorm)) {
                isDuplicate = true;
                matchReason = `Firm Name matches "${d.dealer_name}"`;
                break;
            }

            // 3. GST match check
            if (rowGstNorm && existingGstNorm && rowGstNorm === existingGstNorm) {
                isDuplicate = true;
                matchReason = `GST No. matches "${d.dealer_name}"`;
                break;
            }
        }

        if (isDuplicate) {
            oldCount++;
        } else {
            newCount++;
        }

        const statusBadge = isDuplicate
            ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#FFEDD5;color:#C2410C;border:1px solid #FED7AA;padding:0.25rem 0.5rem;border-radius:6px;font-size:0.7rem;font-weight:700;"><i class="fa-solid fa-user-check"></i> EXISTING (OLD)</span>`
            : `<span style="display:inline-flex;align-items:center;gap:4px;background:#DCFCE7;color:#15803D;border:1px solid #BBF7D0;padding:0.25rem 0.5rem;border-radius:6px;font-size:0.7rem;font-weight:700;"><i class="fa-solid fa-user-plus"></i> NEW</span>`;

        const matchText = isDuplicate
            ? `<span style="color:#C2410C;font-weight:600;font-size:0.7rem;" title="${matchReason}">${matchReason}</span>`
            : `<span style="color:#16A34A;font-weight:600;font-size:0.7rem;">Ready to Import</span>`;

        const rowBg = isDuplicate ? 'background:#FFFBF5;' : '';

        return `
            <tr style="border-bottom:1px solid #f1f5f9;${rowBg}">
                <td style="padding:0.45rem 0.75rem;color:#64748b;">${idx + 1}</td>
                <td style="padding:0.45rem 0.75rem;">${statusBadge}</td>
                <td style="padding:0.45rem 0.75rem;font-weight:700;color:#0f172a;">${firmName}</td>
                <td style="padding:0.45rem 0.75rem;color:#334155;">${dealerName}</td>
                <td style="padding:0.45rem 0.75rem;color:#334155;">${phone}</td>
                <td style="padding:0.45rem 0.75rem;color:#475569;">${city}</td>
                <td style="padding:0.45rem 0.75rem;">${matchText}</td>
            </tr>
        `;
    }).join('');

    if (totalEl) totalEl.innerHTML = `Total: <strong>${rows.length}</strong>`;
    if (newEl) newEl.innerHTML = `<i class="fa-solid fa-user-plus"></i> New Dealers: <strong>${newCount}</strong>`;
    if (oldEl) oldEl.innerHTML = `<i class="fa-solid fa-user-check"></i> Existing (Old): <strong>${oldCount}</strong>`;

    const dupOptionsEl = document.getElementById('duplicateHandlingOptions');
    if (dupOptionsEl) {
        dupOptionsEl.style.display = oldCount > 0 ? 'flex' : 'none';
    }

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = '1';
        btnSubmit.innerHTML = '<i class="fa-solid fa-file-import"></i> Import Dealers Now';
    }
}

async function executeDealerBulkImport() {
    if (!pendingImportDealersList || pendingImportDealersList.length === 0) {
        if (window.showAlert) {
            window.showAlert("Import Warning", "No dealer data to import.", "warning");
        }
        return;
    }

    const dupActionEl = document.querySelector('input[name="duplicateAction"]:checked');
    const duplicateAction = dupActionEl ? dupActionEl.value : 'skip';

    const btnSubmit = document.getElementById('btnSubmitBulkImport');

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
    }

    try {
        const res = await fetch(`${API_BASE}/bulk-import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token()}`
            },
            body: JSON.stringify({
                dealers: pendingImportDealersList,
                duplicateAction: duplicateAction
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            if (window.showAlert) {
                window.showAlert("Import Success", data.message || `Successfully processed dealers!`, "success");
            } else {
                alert(data.message || "Import completed successfully!");
            }
            closeImportDealersModal();
            fetchDealers();
        } else {
            throw new Error(data.message || "Failed to import dealers.");
        }
    } catch (err) {
        console.error("Bulk import failed:", err);
        if (window.showAlert) {
            window.showAlert("Import Error", err.message || "Bulk import failed. Please check your network and file structure.", "error");
        } else {
            alert(err.message || "Import failed");
        }
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.style.opacity = '1';
            btnSubmit.innerHTML = '<i class="fa-solid fa-file-import"></i> Import Dealers Now';
        }
    }
}

// ============================================================
// BULK IMPORT 1-YEAR ORDERS LOGIC
// ============================================================
let pendingImportOrdersList = [];

function getFlexibleValue(obj, candidates) {
    if (!obj || typeof obj !== 'object') return '';
    const keys = Object.keys(obj);
    for (const cand of candidates) {
        const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const k of keys) {
            const keyNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (keyNorm === candNorm && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
                return obj[k];
            }
        }
    }
    return '';
}

function parseFlexibleNumber(val, defaultVal = 0) {
    if (val === undefined || val === null || val === '') return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    const str = String(val).trim();
    if (!str) return defaultVal;
    const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return defaultVal;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultVal : parsed;
}


function normalizeOrderStatus(val) {
    if (!val) return 'ordered';
    const str = String(val).trim().toLowerCase().replace(/[\s\-]+/g, '_');
    if (['ordered', 'draft', 'in_review', 'billed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(str)) {
        return str;
    }
    if (['ordered', 'order', 'order_placed', 'booking', 'booked', 'placed', 'new_order'].includes(str)) {
        return 'ordered';
    }
    if (['completed', 'complete', 'done', 'success', 'closed', 'fulfilled', 'received', 'successful'].includes(str)) {
        return 'delivered';
    }
    if (['in_review', 'review', 'pending_approval', 'under_review', 'inreview', 'reviewing'].includes(str)) {
        return 'in_review';
    }
    if (['dispatched', 'dispatch', 'in_transit', 'transit', 'out_for_delivery', 'shipping'].includes(str)) {
        return 'shipped';
    }
    if (['approved', 'billing_done', 'invoice_generated', 'invoiced', 'billing'].includes(str)) {
        return 'billed';
    }
    if (['packing', 'packed_and_ready', 'ready_for_shipment'].includes(str)) {
        return 'packed';
    }
    if (['canceled', 'rejected', 'void', 'cancel'].includes(str)) {
        return 'cancelled';
    }
    if (['new', 'pending', 'created', 'open'].includes(str)) {
        return 'draft';
    }
    return 'ordered';
}

function getOrderStatusBadgeHtml(statusRaw) {
    const norm = normalizeOrderStatus(statusRaw);
    const badgeStyles = {
        ordered: 'background:#ECFDF5;color:#059669;border:1px solid #A7F3D0;',
        delivered: 'background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;',
        billed: 'background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE;',
        in_review: 'background:#FEF3C7;color:#D97706;border:1px solid #FDE68A;',
        shipped: 'background:#F3E8FF;color:#7E22CE;border:1px solid #E9D5FF;',
        packed: 'background:#FFF7ED;color:#C2410C;border:1px solid #FFEDD5;',
        draft: 'background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;',
        cancelled: 'background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;'
    };
    const label = norm.replace(/_/g, ' ').toUpperCase();
    const style = badgeStyles[norm] || badgeStyles.ordered;
    return `<span style="font-size:0.7rem;font-weight:700;padding:3px 8px;border-radius:6px;${style}">${label}</span>`;
}

function openImportOrdersModal(e) {
    if (e) e.stopPropagation();
    const modal = document.getElementById('importOrdersModal');
    if (modal) {
        modal.style.display = 'flex';
        clearOrderImportFileSelection();
    }
}

function closeImportOrdersModal() {
    const modal = document.getElementById('importOrdersModal');
    if (modal) {
        modal.style.display = 'none';
        clearOrderImportFileSelection();
    }
}

function downloadOrderImportTemplate() {
    const templateData = [
        {
            'Dealer ID': 'DLR-001',
            'Firm Name': 'SLN Store',
            'Dealer Name': 'Ramesh',
            'Phone': '9876500111',
            'GST No': 'GST001',
            'Town': 'Tumkur',
            'City': 'Tumkur',
            'State': 'Karnataka',
            'Pincode': '572101',
            'Product': 'Brush Cutter',
            'Quantity': 10,
            'Unit Price': 12000,
            'Total': 120000,
            'Advance': 50000,
            'Due': 70000,
            'Delivery Type': 'COD',
            'Payment Method': 'Bank',
            'Order Date': '01-08-2026',
            'Shipped Date': '05-08-2026',
            'Status': 'Shipped',
            'Notes': '-'
        },
        {
            'Dealer ID': 'DLR-001',
            'Firm Name': 'SLN Store',
            'Dealer Name': 'Ramesh',
            'Phone': '9876500111',
            'GST No': 'GST001',
            'Town': 'Tumkur',
            'City': 'Tumkur',
            'State': 'Karnataka',
            'Pincode': '572101',
            'Product': 'Wheel Barrow',
            'Quantity': 5,
            'Unit Price': 5100,
            'Total': 25500,
            'Advance': 10000,
            'Due': 15500,
            'Delivery Type': 'COD',
            'Payment Method': 'Bank',
            'Order Date': '10-08-2026',
            'Shipped Date': '-',
            'Status': 'Ordered',
            'Notes': '-'
        },
        {
            'Dealer ID': 'DLR-002',
            'Firm Name': 'farm Agro',
            'Dealer Name': 'Mahesh',
            'Phone': '9342300222',
            'GST No': 'GST002',
            'Town': 'Nanjangud',
            'City': 'Mysuru',
            'State': 'Karnataka',
            'Pincode': '571301',
            'Product': 'Potash',
            'Quantity': 15,
            'Unit Price': 1250,
            'Total': 18750,
            'Advance': 18750,
            'Due': 0,
            'Delivery Type': 'Office',
            'Payment Method': 'UPI',
            'Order Date': '05-08-2026',
            'Shipped Date': '07-08-2026',
            'Status': 'Delivered',
            'Notes': '-'
        }
    ];

    if (window.XLSX) {
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dealers & Orders");
        XLSX.writeFile(wb, "SGB_CRM_Dealers_And_Orders_Template.xlsx");
    } else {
        alert("Excel generator library not loaded.");
    }
}

function clearOrderImportFileSelection() {
    pendingImportOrdersList = [];
    const input = document.getElementById('orderImportFileInput');
    if (input) input.value = '';
    const prompt = document.getElementById('orderImportFilePrompt');
    if (prompt) prompt.textContent = 'Drop Excel file here or Click to Browse';

    const previewContainer = document.getElementById('orderImportPreviewContainer');
    if (previewContainer) previewContainer.style.display = 'none';

    const dryRunSummaryView = document.getElementById('dryRunSummaryView');
    if (dryRunSummaryView) dryRunSummaryView.style.display = 'none';

    const progressBarContainer = document.getElementById('importProgressBarContainer');
    if (progressBarContainer) progressBarContainer.style.display = 'none';

    const btnSubmit = document.getElementById('btnSubmitOrdersBulkImport');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.5';
    }
}

function handleOrderImportFileSelect(e) {
    const file = e.target.files ? e.target.files[0] : null;
    if (!file) return;

    const prompt = document.getElementById('orderImportFilePrompt');
    if (prompt) prompt.textContent = `Selected File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith('.csv')) {
        reader.onload = function(evt) {
            try {
                const text = evt.target.result;
                pendingImportOrdersList = parseCSVToObjects(text);
                renderOrderImportPreview(pendingImportOrdersList);
            } catch (err) {
                alert("Error reading CSV file: " + err.message);
            }
        };
        reader.readAsText(file);
    } else {
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                pendingImportOrdersList = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
                renderOrderImportPreview(pendingImportOrdersList);
            } catch (err) {
                alert("Error reading Excel file: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function renderOrderImportPreview(rows) {
    const previewContainer = document.getElementById('orderImportPreviewContainer');
    const tbody = document.getElementById('orderImportPreviewTableBody');
    const badge = document.getElementById('orderImportRecordCountBadge');
    const btnSubmit = document.getElementById('btnSubmitOrdersBulkImport');

    if (!tbody || !previewContainer) return;

    badge.textContent = `Parsed ${rows.length} Record${rows.length === 1 ? '' : 's'} Ready to Process`;
    previewContainer.style.display = 'block';

    const previewRows = rows;
    tbody.innerHTML = previewRows.map((r, idx) => {
        const firmName = getFlexibleValue(r, ['Firm Name', 'firm_name', 'dealer_name', 'FIRM / SHOP NAME', 'Firm', 'Shop Name', 'Shop', 'Store Name', 'Store', 'Customer Name', 'Customer', 'Party Name', 'Party', 'Business Name', 'Account Name', 'DEALER NAME', 'FIRM NAME', 'Dealer', 'Name', 'Shop/Firm Name']) || '—';
        const phone = getFlexibleValue(r, ['Phone', 'phone', 'phone_number', 'Dealer Phone', 'PHONE', 'Mobile', 'Mobile No', 'Mobile Number', 'Phone No', 'Phone Number', 'Contact No', 'Contact Number', 'Cell', 'Whatsapp']) || '—';
        const gst = getFlexibleValue(r, ['GST No', 'gst_no', 'gst_number', 'GST NO.', 'GST NO', 'GSTIN', 'GST', 'Gst Number', 'Gst No']);
        const dealerIdCode = getFlexibleValue(r, ['Dealer ID', 'dealer_id', 'Dealer Code', 'vrl_code', 'VRL CODE', 'VRL Code', 'DLR ID', 'Dealer No', 'Code', 'ID', 'Dealer Code / ID']);
        const orderDate = getFlexibleValue(r, ['Order Date', 'order_date', 'created_at', 'DATE', 'Date', 'Invoice Date', 'Purchase Date', 'Order Created']) || 'Today';
        const quantity = Math.max(1, Math.round(parseFlexibleNumber(getFlexibleValue(r, ['Quantity', 'quantity', 'Qty', 'QTY', 'Units', 'Count']), 1)));
        const unitPrice = parseFlexibleNumber(getFlexibleValue(r, ['Unit Price', 'unit_price', 'price', 'Price', 'Rate', 'MRP', 'Cost']), 0);
        let total = parseFlexibleNumber(getFlexibleValue(r, ['Total', 'Total Amount', 'total_amount', 'Grand Total', 'Amount', 'Net Amount', 'Value', 'Bill Amount', 'Invoice Amount']), 0);
        if (total === 0 && unitPrice > 0) {
            total = unitPrice * quantity;
        }
        const statusRaw = getFlexibleValue(r, ['Status', 'Order Status', 'order_status', 'ORDER STATUS', 'Delivery Status', 'Current Status']);
        const statusBadge = getOrderStatusBadgeHtml(statusRaw);

        return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:0.4rem 0.75rem;color:#64748b;">${idx + 1}</td>
                <td style="padding:0.4rem 0.75rem;font-weight:700;color:#0f172a;">${firmName} ${dealerIdCode ? `<br><small style="color:#64748b;font-weight:600;">[${dealerIdCode}]</small>` : ''}</td>
                <td style="padding:0.4rem 0.75rem;color:#334155;">${phone} ${gst ? `<br><small style="color:#64748b;">${gst}</small>` : ''}</td>
                <td style="padding:0.4rem 0.75rem;color:#334155;">${orderDate}</td>
                <td style="padding:0.4rem 0.75rem;font-weight:700;color:#10b981;">₹${total.toLocaleString('en-IN')}</td>
                <td style="padding:0.4rem 0.75rem;">${statusBadge}</td>
            </tr>
        `;
    }).join('');

    if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = '1';
    }
}

function detectMissingDealersInImport(rows, dealersList) {
    const missingMap = new Map();

    const vrlSet = new Set();
    const phoneSet = new Set();
    const gstSet = new Set();
    const nameSet = new Set();

    (dealersList || []).forEach(d => {
        if (d.vrl_code) vrlSet.add(String(d.vrl_code).trim().toUpperCase());
        if (d.dealer_code) vrlSet.add(String(d.dealer_code).trim().toUpperCase());
        if (d.phone) {
            const dPhones = extractPhoneNumbersFromObject({ phone: d.phone });
            dPhones.forEach(p => phoneSet.add(p));
            phoneSet.add(String(d.phone).replace(/[^0-9]/g, '').slice(-10));
        }
        if (d.phone_number) {
            const dPhones = extractPhoneNumbersFromObject({ phone: d.phone_number });
            dPhones.forEach(p => phoneSet.add(p));
            phoneSet.add(String(d.phone_number).replace(/[^0-9]/g, '').slice(-10));
        }
        if (d.gst_no) gstSet.add(String(d.gst_no).trim().toUpperCase());
        if (d.gst_number) gstSet.add(String(d.gst_number).trim().toUpperCase());
        if (d.firm_name) nameSet.add(String(d.firm_name).trim().toLowerCase());
        if (d.dealer_name) nameSet.add(String(d.dealer_name).trim().toLowerCase());
    });

    (rows || []).forEach(r => {
        const firmName = getFlexibleValue(r, ['Firm Name', 'firm_name', 'dealer_name', 'FIRM / SHOP NAME', 'Firm', 'Shop Name', 'Shop', 'Store Name', 'Store', 'Customer Name', 'Customer', 'Party Name', 'Party', 'Business Name', 'Account Name', 'DEALER NAME', 'FIRM NAME', 'Dealer', 'Name', 'Shop/Firm Name']);
        const dealerName = getFlexibleValue(r, ['Dealer Name', 'Contact Person', 'contact_person', 'owner_name', 'Owner Name', 'Owner', 'CONTACT', 'CONTACT PERSON', 'Person', 'Contact', 'Dealer Owner']);
        const extractedPhones = extractPhoneNumbersFromObject(r);
        const rawPhone = getFlexibleValue(r, ['Phone', 'phone', 'phone_number', 'Dealer Phone', 'PHONE', 'Mobile', 'Mobile No', 'Mobile Number', 'Phone No', 'Phone Number', 'Contact No', 'Contact Number', 'Cell', 'Whatsapp']);
        const phoneDisplay = extractedPhones.length > 0 ? extractedPhones.join(' / ') : (rawPhone ? String(rawPhone).trim() : '');
        const gst = getFlexibleValue(r, ['GST No', 'gst_no', 'gst_number', 'GST NO.', 'GST NO', 'GSTIN', 'GST', 'Gst Number', 'Gst No']);
        const dealerIdCode = getFlexibleValue(r, ['Dealer ID', 'dealer_id', 'Dealer Code', 'vrl_code', 'VRL CODE', 'VRL Code', 'DLR ID', 'Dealer No', 'Code', 'ID', 'Dealer Code / ID']);

        if (!firmName && extractedPhones.length === 0 && !rawPhone && !gst && !dealerIdCode) return;

        let matched = false;
        if (dealerIdCode && vrlSet.has(String(dealerIdCode).trim().toUpperCase())) matched = true;
        else if (extractedPhones.some(p => phoneSet.has(p))) matched = true;
        else if (gst && gstSet.has(String(gst).trim().toUpperCase())) matched = true;
        else if (firmName && nameSet.has(String(firmName).trim().toLowerCase())) matched = true;

        if (!matched) {
            const key = extractedPhones.length > 0 ? `phone:${extractedPhones[0]}` : (dealerIdCode ? `code:${String(dealerIdCode).trim().toLowerCase()}` : `name:${String(firmName || dealerName).trim().toLowerCase()}`);
            if (!missingMap.has(key)) {
                missingMap.set(key, {
                    key,
                    firmName: firmName || dealerName || 'Unregistered Dealer Store',
                    dealerName: dealerName || '—',
                    phone: phoneDisplay || 'No phone',
                    gst: gst || '—',
                    code: dealerIdCode || ''
                });
            }
        }
    });

    return Array.from(missingMap.values());
}

let currentMissingDealersList = [];

function openMissingDealersConfirmModal(missingList) {
    const modal = document.getElementById('missingDealersConfirmModal');
    const scrollList = document.getElementById('missingDealersScrollList');
    if (!modal || !scrollList) return;

    currentMissingDealersList = missingList || [];

    let html = `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;background:#F1F5F9;border:1px solid #CBD5E1;border-radius:8px;margin-bottom:8px;font-size:0.8rem;">
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-weight:700;color:#0F172A;user-select:none;margin:0;">
                <input type="checkbox" id="chkSelectAllMissingDealers" checked onchange="toggleAllMissingDealersSelection(this)" style="width:16px;height:16px;accent-color:#10B981;cursor:pointer;">
                <span>Select / Deselect All</span>
            </label>
            <span id="missingDealersSelectedBadge" style="font-size:0.75rem;font-weight:700;color:#059669;background:#ECFDF5;padding:2px 8px;border-radius:12px;border:1px solid #A7F3D0;">
                ${missingList.length} of ${missingList.length} Selected
            </span>
        </div>
    `;

    html += missingList.map((m, idx) => `
        <div style="display:flex;align-items:center;gap:0.75rem;padding:0.55rem 0.75rem;background:#ffffff;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:6px;font-size:0.8rem;">
            <input type="checkbox" class="chk-missing-dealer-item" value="${m.key}" checked onchange="updateMissingDealersSelectionCount()" style="width:16px;height:16px;accent-color:#10B981;cursor:pointer;flex-shrink:0;">
            <div style="flex:1;display:flex;align-items:center;justify-content:space-between;min-width:0;">
                <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    <strong style="color:#0F172A;">${idx + 1}. ${m.firmName}</strong>
                    ${m.dealerName && m.dealerName !== '—' ? `<span style="color:#64748B;font-size:0.75rem;"> (${m.dealerName})</span>` : ''}
                    ${m.code ? ` <span style="font-family:monospace;background:#FEF3C7;color:#D97706;padding:1px 5px;border-radius:4px;font-size:0.7rem;">[${m.code}]</span>` : ''}
                </div>
                <div style="color:#475569;font-weight:600;font-size:0.75rem;flex-shrink:0;margin-left:8px;">
                    <i class="fa-solid fa-phone" style="color:#94A3B8;margin-right:4px;"></i>${m.phone}
                </div>
            </div>
        </div>
    `).join('');

    scrollList.innerHTML = html;
    modal.style.display = 'flex';
    updateMissingDealersSelectionCount();
}

function toggleAllMissingDealersSelection(masterChk) {
    const checkboxes = document.querySelectorAll('.chk-missing-dealer-item');
    checkboxes.forEach(chk => {
        chk.checked = masterChk.checked;
    });
    updateMissingDealersSelectionCount();
}

function updateMissingDealersSelectionCount() {
    const checkboxes = document.querySelectorAll('.chk-missing-dealer-item');
    const checked = document.querySelectorAll('.chk-missing-dealer-item:checked');
    const masterChk = document.getElementById('chkSelectAllMissingDealers');
    const badge = document.getElementById('missingDealersSelectedBadge');
    const lblBtn = document.getElementById('lblConfirmCreateMissingDealers');

    if (masterChk) {
        masterChk.checked = checked.length === checkboxes.length && checkboxes.length > 0;
        masterChk.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
    }

    if (badge) {
        badge.textContent = `${checked.length} of ${checkboxes.length} Selected`;
    }

    if (lblBtn) {
        if (checked.length === checkboxes.length) {
            lblBtn.textContent = 'Yes, Create All Dealers & Import Orders';
        } else if (checked.length === 0) {
            lblBtn.textContent = 'Skip Missing Dealers (Import Matched Only)';
        } else {
            lblBtn.textContent = `Yes, Create ${checked.length} Selected Dealer${checked.length === 1 ? '' : 's'} & Import Orders`;
        }
    }
}

function closeMissingDealersConfirmModal() {
    const modal = document.getElementById('missingDealersConfirmModal');
    if (modal) modal.style.display = 'none';
}

function confirmAutoCreateDealersAndImport(shouldAutoCreate) {
    if (!shouldAutoCreate) {
        closeMissingDealersConfirmModal();
        const chkAuto = document.getElementById('chkAutoCreateDealers');
        if (chkAuto) chkAuto.checked = false;
        executeOrdersBulkImport(false, []);
        return;
    }

    const checkedEls = document.querySelectorAll('.chk-missing-dealer-item:checked');
    const selectedKeys = Array.from(checkedEls).map(el => el.value);

    closeMissingDealersConfirmModal();
    const chkAuto = document.getElementById('chkAutoCreateDealers');
    if (chkAuto) chkAuto.checked = selectedKeys.length > 0;

    executeOrdersBulkImport(selectedKeys.length > 0, selectedKeys);
}

async function executeOrdersBulkImport(confirmedAutoCreate, selectedMissingDealers = []) {
    if (!pendingImportOrdersList || pendingImportOrdersList.length === 0) {
        alert("No data to import.");
        return;
    }

    // Pre-check for missing dealers if not confirmed yet
    if (confirmedAutoCreate === undefined) {
        const missingDealers = detectMissingDealersInImport(pendingImportOrdersList, allDealers);
        if (missingDealers.length > 0) {
            openMissingDealersConfirmModal(missingDealers);
            return;
        }
    }

    const autoCreate = (confirmedAutoCreate !== undefined) ? confirmedAutoCreate : (document.getElementById('chkAutoCreateDealers') ? document.getElementById('chkAutoCreateDealers').checked : true);
    const dryRun = document.getElementById('chkDryRunOrders') ? document.getElementById('chkDryRunOrders').checked : false;

    const btnSubmit = document.getElementById('btnSubmitOrdersBulkImport');
    const originalText = btnSubmit ? btnSubmit.innerHTML : 'Import Records Now';

    const progressBarContainer = document.getElementById('importProgressBarContainer');
    const progressBarFill = document.getElementById('importProgressBarFill');
    const progressStatus = document.getElementById('importProgressStatus');
    const progressPct = document.getElementById('importProgressPct');
    const dryRunSummaryView = document.getElementById('dryRunSummaryView');

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    }

    try {
        const totalRows = pendingImportOrdersList.length;
        const chunkSize = 1000;
        const totalChunks = Math.ceil(totalRows / chunkSize);

        if (progressBarContainer) progressBarContainer.style.display = 'block';

        let accumulatedSummary = {
            totalRows,
            dealersFound: 0,
            newDealersToCreate: 0,
            ordersToCreate: 0,
            validRows: 0,
            duplicateOrders: 0,
            errorRows: 0,
            totalRevenue: 0
        };

        for (let c = 0; c < totalChunks; c++) {
            const chunk = pendingImportOrdersList.slice(c * chunkSize, (c + 1) * chunkSize);
            const currentPct = Math.round(((c + 1) / totalChunks) * 100);

            if (progressStatus) progressStatus.textContent = `Processing batch ${c + 1} of ${totalChunks} (${chunk.length} rows)...`;
            if (progressPct) progressPct.textContent = `${currentPct}%`;
            if (progressBarFill) progressBarFill.style.width = `${currentPct}%`;

            let ordersApi = `${window.API_URL}/orders/bulk-import`;
            let res = await fetch(ordersApi, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token()}`
                },
                body: JSON.stringify({
                    orders: chunk,
                    dryRun,
                    autoCreateDealers: autoCreate,
                    selectedMissingDealers: selectedMissingDealers || []
                })
            });

            if (res.status === 404) {
                ordersApi = `${window.API_URL}/dealers/orders/bulk-import`;
                res = await fetch(ordersApi, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token()}`
                    },
                    body: JSON.stringify({
                        orders: chunk,
                        dryRun,
                        autoCreateDealers: autoCreate,
                        selectedMissingDealers: selectedMissingDealers || []
                    })
                });
            }

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.message || "Failed during batch import.");
            }

            const s = data.summary || {};
            accumulatedSummary.dealersFound += (s.dealersFound || 0);
            accumulatedSummary.newDealersToCreate += (s.newDealersToCreate || s.autoCreatedDealers || 0);
            accumulatedSummary.ordersToCreate += (s.ordersToCreate || s.ordersImported || 0);
            accumulatedSummary.validRows += (s.validRows || s.ordersImported || 0);
            accumulatedSummary.duplicateOrders += (s.duplicateOrders || 0);
            accumulatedSummary.errorRows += (s.errorRows || s.unmatchedDealers || 0);
            accumulatedSummary.totalRevenue += (s.totalRevenue || 0);
        }

        // Fill Summary Metric Cards
        const elemTotal = document.getElementById('statTotalRows');
        const elemFound = document.getElementById('statDealersFound');
        const elemNew = document.getElementById('statNewDealers');
        const elemOrders = document.getElementById('statOrdersToCreate');
        const elemErrors = document.getElementById('statErrors');

        if (elemTotal) elemTotal.textContent = accumulatedSummary.totalRows.toLocaleString();
        if (elemFound) elemFound.textContent = accumulatedSummary.dealersFound.toLocaleString();
        if (elemNew) elemNew.textContent = accumulatedSummary.newDealersToCreate.toLocaleString();
        if (elemOrders) elemOrders.textContent = accumulatedSummary.ordersToCreate.toLocaleString();
        if (elemErrors) elemErrors.textContent = (accumulatedSummary.errorRows + accumulatedSummary.duplicateOrders).toLocaleString();

        const badgeElem = document.getElementById('dryRunStatusBadge');
        if (badgeElem) {
            badgeElem.textContent = dryRun ? "PREVIEW MODE" : "IMPORT SUCCESSFUL";
            badgeElem.style.background = dryRun ? "#FEF3C7" : "#DCFCE7";
            badgeElem.style.color = dryRun ? "#D97706" : "#15803D";
        }

        if (dryRunSummaryView) dryRunSummaryView.style.display = 'block';

        const msg = dryRun
            ? `[DRY-RUN ANALYSIS PREVIEW]\nTotal Rows: ${accumulatedSummary.totalRows}\nDealers Found: ${accumulatedSummary.dealersFound}\nNew Dealers to Create: ${accumulatedSummary.newDealersToCreate}\nOrders to Create: ${accumulatedSummary.ordersToCreate}\nErrors/Unmatched: ${accumulatedSummary.errorRows}\nTotal Value: ₹${accumulatedSummary.totalRevenue.toLocaleString('en-IN')}`
            : `Successfully imported ${accumulatedSummary.ordersToCreate} orders and created ${accumulatedSummary.newDealersToCreate} new dealers!\nTotal Value: ₹${accumulatedSummary.totalRevenue.toLocaleString('en-IN')}`;

        if (window.showAlert) {
            window.showAlert(dryRun ? "Dry Run Complete" : "Import Success", msg.replace(/\n/g, '<br>'), "success");
        } else {
            alert(msg);
        }

        if (!dryRun) {
            closeImportOrdersModal();
            fetchDealers();
        }

    } catch (err) {
        console.error("Bulk import failed:", err);
        if (window.showAlert) {
            window.showAlert("Import Error", err.message || "Bulk import failed.", "error");
        } else {
            alert(err.message || "Import failed");
        }
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        }
    }
}

window.openImportDealersModal = openImportDealersModal;
window.closeImportDealersModal = closeImportDealersModal;
window.downloadDealerImportTemplate = downloadDealerImportTemplate;
window.handleImportFileSelect = handleImportFileSelect;
window.clearImportFileSelection = clearImportFileSelection;
window.executeDealerBulkImport = executeDealerBulkImport;

window.openImportOrdersModal = openImportOrdersModal;
window.closeImportOrdersModal = closeImportOrdersModal;
window.downloadOrderImportTemplate = downloadOrderImportTemplate;
window.handleOrderImportFileSelect = handleOrderImportFileSelect;
window.clearOrderImportFileSelection = clearOrderImportFileSelection;
window.executeOrdersBulkImport = executeOrdersBulkImport;
window.toggleSelectAllDealers = toggleSelectAllDealers;
window.handleDealerSelectChange = handleDealerSelectChange;
window.deleteSelectedDealers = deleteSelectedDealers;
window.closeMissingDealersConfirmModal = closeMissingDealersConfirmModal;
window.confirmAutoCreateDealersAndImport = confirmAutoCreateDealersAndImport;
window.toggleAllMissingDealersSelection = toggleAllMissingDealersSelection;
window.updateMissingDealersSelectionCount = updateMissingDealersSelectionCount;
window.filterDealers = filterDealers;
window.setSortFilter = setSortFilter;
window.handleSortFilterChange = handleSortFilterChange;
window.setDaysFilter = setDaysFilter;
window.handleDaysFilterChange = handleDaysFilterChange;




