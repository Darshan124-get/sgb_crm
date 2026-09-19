// visits.js — Dealer Visit Info & Survey Management Script

let allDealers = [];
let allVisits = [];
let filteredVisits = [];
let customQuestionsList = [];
let dealerPurchasedProductsMap = new Map();
let selectedVisitIds = new Set();

document.addEventListener('DOMContentLoaded', async () => {
    if (window.requireAuth && !window.requireAuth(['admin', 'super-admin', 'dealer', 'dealer_manager', 'dealer_executive', 'dealer_viewer'], 'sales_dealers')) return;
    // Set default date in New Visit form
    const dateInput = document.getElementById('nvVisitedDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : {};
    const staffInput = document.getElementById('nvVisitedBy');
    if (staffInput && currentUser.name) {
        staffInput.value = currentUser.name;
    }

    await loadVisitData();
});

// Load Dealers, Orders & Compile Visit Records
async function loadVisitData() {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('visitsTableBody');

    try {
        const response = await fetch(`${window.API_URL || 'http://localhost:5000/api'}/dealers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch dealers list');
        const data = await response.json();
        allDealers = Array.isArray(data) ? data : (data.dealers || []);

        await loadDealerOrdersAndPurchasedProducts();

        populateDealerDropdowns(allDealers);
        compileVisitRecords(allDealers);
        populateStaffDropdown(allVisits);
        updateKPIs(allVisits);
        applyVisitFilters();

    } catch (err) {
        console.error('Error loading visit records:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:2.5rem;text-align:center;color:#ef4444;font-weight:600;">
                <i class="fa-solid fa-triangle-exclamation" style="margin-right:0.5rem;"></i> Failed to load visit records. ${err.message}
            </td></tr>`;
        }
    }
}

// Fetch Dealer Orders to Aggregate Purchased Products & Quantities
async function loadDealerOrdersAndPurchasedProducts() {
    dealerPurchasedProductsMap.clear();
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${window.API_URL || 'http://localhost:5000/api'}/dealers/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const orders = await response.json();
            if (Array.isArray(orders)) {
                orders.forEach(o => {
                    if (!o.dealer_id || !o.items_summary) return;

                    const dId = String(o.dealer_id);
                    if (!dealerPurchasedProductsMap.has(dId)) {
                        dealerPurchasedProductsMap.set(dId, new Map());
                    }

                    const prodMap = dealerPurchasedProductsMap.get(dId);

                    // Format: "Brush Cutter x 20||Trolley x 10"
                    const items = o.items_summary.split('||');
                    items.forEach(itemStr => {
                        const parts = itemStr.split(' x ');
                        if (parts.length === 2) {
                            const pName = parts[0].trim();
                            const qty = parseInt(parts[1].trim()) || 0;
                            prodMap.set(pName, (prodMap.get(pName) || 0) + qty);
                        } else {
                            const pName = itemStr.trim();
                            if (pName) prodMap.set(pName, (prodMap.get(pName) || 0) + 1);
                        }
                    });
                });
            }
        }
    } catch (e) {
        console.error('Error fetching dealer orders for stock check:', e);
    }
}

// Populate dealer options in filters and form
function populateDealerDropdowns(dealers) {
    const filterSelect = document.getElementById('dealerSelectFilter');
    const formSelect = document.getElementById('nvDealerSelect');

    if (filterSelect) {
        let optionsHtml = '<option value="all">All Dealers</option>';
        dealers.forEach(d => {
            const loc = [d.town_village || d.city, d.district].filter(Boolean).join(', ');
            optionsHtml += `<option value="${d.dealer_id}">${d.dealer_name} ${loc ? `(${loc})` : ''}</option>`;
        });
        filterSelect.innerHTML = optionsHtml;
    }

    if (formSelect) {
        let optionsHtml = '<option value="">-- Select an Existing Dealer or Fill New Details Below --</option>';
        dealers.forEach(d => {
            const hasOrders = dealerPurchasedProductsMap.has(String(d.dealer_id));
            optionsHtml += `<option value="${d.dealer_id}">${d.dealer_name} ${hasOrders ? '(Has Purchased Products)' : ''}</option>`;
        });
        formSelect.innerHTML = optionsHtml;
    }
}

// Auto-fill Dealer Info & Display Question 11 ONLY for Dealers with Prior Purchases
function autoFillDealerInfo(dealerId) {
    const stockContainer = document.getElementById('sectionCurrentStockContainer');
    const stockTbody = document.getElementById('visitCurrentStockTbody');
    const outcomeSection = document.getElementById('visitOutcomeSectionContainer');

    if (!dealerId) {
        // New dealer creation mode -> SHOW Visit Status / Dealer Conversion cards
        if (outcomeSection) outcomeSection.style.display = 'block';
        selectVisitOutcome('converted');

        if (stockContainer) stockContainer.style.display = 'none';
        if (stockTbody) stockTbody.innerHTML = '';

        const firmInput = document.getElementById('nvFirmName');
        const nameInput = document.getElementById('nvDealerName');
        const contactInput = document.getElementById('nvContact');
        const locInput = document.getElementById('nvLocation');

        if (firmInput) firmInput.value = '';
        if (nameInput) nameInput.value = '';
        if (contactInput) contactInput.value = '';
        if (locInput) locInput.value = '';
        return;
    }

    // Existing dealer selected -> HIDE Visit Status / Dealer Conversion section (only for new dealers)
    if (outcomeSection) outcomeSection.style.display = 'none';
    selectVisitOutcome('converted');

    const dealer = allDealers.find(d => String(d.dealer_id) === String(dealerId));
    if (dealer) {
        const firmInput = document.getElementById('nvFirmName');
        const nameInput = document.getElementById('nvDealerName');
        const contactInput = document.getElementById('nvContact');
        const locInput = document.getElementById('nvLocation');

        if (firmInput) firmInput.value = dealer.dealer_name || '';
        if (nameInput) nameInput.value = dealer.contact_person || dealer.dealer_name || '';
        if (contactInput) contactInput.value = dealer.phone || '';
        if (locInput) locInput.value = [dealer.town_village || dealer.city, dealer.district].filter(Boolean).join(', ') || dealer.address || '';
    }

    // Check if dealer has prior purchased products
    const dIdStr = String(dealerId);
    if (dealerPurchasedProductsMap.has(dIdStr)) {
        const prodMap = dealerPurchasedProductsMap.get(dIdStr);
        const prodList = Array.from(prodMap.entries()).map(([pName, qty]) => ({ product: pName, purchased: qty }));

        if (prodList.length > 0) {
            // Dealer has ordered before -> SHOW Question 11 & List Purchased Products & Quantities
            if (stockContainer) stockContainer.style.display = 'block';
            if (stockTbody) {
                stockTbody.innerHTML = prodList.map(p => `
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:0.6rem 0.85rem;font-weight:700;color:#0f172a;">${p.product}</td>
                        <td style="padding:0.6rem 0.85rem;text-align:center;color:#64748b;font-weight:700;">${p.purchased}</td>
                        <td style="padding:0.6rem 0.85rem;text-align:center;">
                            <input type="number" min="0" max="${p.purchased}" placeholder="Qty" data-prod="${p.product}" data-purchased="${p.purchased}" class="visit-stock-input" style="width:85px;padding:0.35rem;border:1px solid #cbd5e1;border-radius:6px;text-align:center;font-weight:700;outline:none;">
                        </td>
                    </tr>
                `).join('');
            }
            return;
        }
    }

    // No prior purchases -> HIDE Question 11 completely
    if (stockContainer) stockContainer.style.display = 'none';
    if (stockTbody) stockTbody.innerHTML = '';
}

// Select Visit Outcome Radio Card
function selectVisitOutcome(outcome) {
    const cardConverted = document.getElementById('cardStatusConverted');
    const cardProspect = document.getElementById('cardStatusProspect');

    if (outcome === 'converted') {
        if (cardConverted) {
            cardConverted.className = 'status-radio-card selected-converted';
            const radio = cardConverted.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        }
        if (cardProspect) cardProspect.className = 'status-radio-card';
    } else {
        if (cardProspect) {
            cardProspect.className = 'status-radio-card selected-prospect';
            const radio = cardProspect.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        }
        if (cardConverted) cardConverted.className = 'status-radio-card';
    }
}

// Compile all visit records (from official dealers & local prospect logs)
function compileVisitRecords(dealers) {
    allVisits = [];
    let deletedVisitIds = [];
    try {
        deletedVisitIds = JSON.parse(localStorage.getItem('sgb_deleted_visit_ids')) || [];
    } catch (e) {
        deletedVisitIds = [];
    }
    const deletedSet = new Set(deletedVisitIds.map(String));

    // 1. Process Official Dealers Visits
    dealers.forEach(d => {
        const visitsKey = 'sgb_dealer_visits_' + d.dealer_id;
        let localVisits = [];

        try {
            localVisits = JSON.parse(localStorage.getItem(visitsKey)) || [];
        } catch (e) {
            localVisits = [];
        }

        const initVisitId = 'VISIT-INIT-' + d.dealer_id;
        const hasExplicitKey = localStorage.getItem(visitsKey) !== null;

        // If no localStorage visits recorded yet but dealer has initial visited_date AND initVisitId is NOT deleted
        if (localVisits.length === 0 && !hasExplicitKey && d.visited_date && !deletedSet.has(initVisitId)) {
            localVisits.push({
                id: initVisitId,
                dealer_id: d.dealer_id,
                visited_date: d.visited_date,
                visited_by: d.visited_by || 'Staff',
                status: d.status || 'Active',
                is_initial: true,
                is_converted: true
            });
        }

        localVisits.forEach((v, idx) => {
            const vId = String(v.id || ('VISIT-L-' + d.dealer_id + '-' + idx));
            if (!deletedSet.has(vId)) {
                allVisits.push({
                    ...v,
                    id: v.id || vId,
                    dealer_name: d.dealer_name || 'Unknown Dealer',
                    contact_person: d.contact_person || '',
                    phone: d.phone || '',
                    town_village: d.town_village || d.city || '',
                    district: d.district || '',
                    state: d.state || '',
                    is_converted: true
                });
            }
        });
    });

    // 2. Load Prospect Visits (Visit Only — NOT added to Dealers List DB)
    try {
        const prospectVisits = JSON.parse(localStorage.getItem('sgb_prospect_visits')) || [];
        prospectVisits.forEach(pv => {
            const pvId = String(pv.id || '');
            if (pvId && !deletedSet.has(pvId)) {
                allVisits.push({
                    ...pv,
                    is_converted: false
                });
            }
        });
    } catch (err) {
        console.error('Error reading prospect visits:', err);
    }

    // Sort by visited date descending
    allVisits.sort((a, b) => new Date(b.visited_date || 0) - new Date(a.visited_date || 0));
}

// Populate unique staff list
function populateStaffDropdown(visits) {
    const staffSelect = document.getElementById('staffSelectFilter');
    if (!staffSelect) return;

    const staffSet = new Set();
    visits.forEach(v => {
        if (v.visited_by && v.visited_by.trim()) {
            staffSet.add(v.visited_by.trim());
        }
    });

    let optionsHtml = '<option value="all">All Staff</option>';
    staffSet.forEach(staff => {
        optionsHtml += `<option value="${staff}">${staff}</option>`;
    });
    staffSelect.innerHTML = optionsHtml;
}

// Update Overview KPI Cards
function updateKPIs(visits) {
    const kpiTotalVisits = document.getElementById('kpiTotalVisits');
    const kpiDealersVisited = document.getElementById('kpiDealersVisited');
    const kpiVisitsThisMonth = document.getElementById('kpiVisitsThisMonth');
    const kpiDetailedForms = document.getElementById('kpiDetailedForms');

    const totalCount = visits.length;
    const convertedDealersCount = visits.filter(v => v.is_converted).length;

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let recentCount = 0;
    let detailedCount = 0;

    visits.forEach(v => {
        if (v.formData) detailedCount++;
        if (v.visited_date && v.visited_date.includes(currentMonthStr)) recentCount++;
    });

    if (kpiTotalVisits) kpiTotalVisits.textContent = totalCount;
    if (kpiDealersVisited) kpiDealersVisited.textContent = convertedDealersCount;
    if (kpiVisitsThisMonth) kpiVisitsThisMonth.textContent = recentCount;
    if (kpiDetailedForms) kpiDetailedForms.textContent = detailedCount;
}

// Sync Main and Top Header Search Inputs
function syncVisitSearch(source) {
    const mainInput = document.getElementById('visitSearchInput');
    const topInput = document.getElementById('topNavVisitSearch');

    if (source === 'top' && mainInput && topInput) {
        mainInput.value = topInput.value;
    } else if (source === 'main' && mainInput && topInput) {
        topInput.value = mainInput.value;
    }
    applyVisitFilters();
}

// Filter and Render Visit Records Table
function applyVisitFilters() {
    const searchVal = (document.getElementById('visitSearchInput')?.value || '').toLowerCase().trim();
    const dealerVal = document.getElementById('dealerSelectFilter')?.value || 'all';
    const staffVal = document.getElementById('staffSelectFilter')?.value || 'all';
    const surveyVal = document.getElementById('surveyTypeFilter')?.value || 'all';

    filteredVisits = allVisits.filter(v => {
        // Dealer filter
        if (dealerVal !== 'all' && String(v.dealer_id) !== String(dealerVal)) return false;

        // Staff filter
        if (staffVal !== 'all' && (v.visited_by || '').trim() !== staffVal) return false;

        // Visit outcome filter
        if (surveyVal === 'converted' && !v.is_converted) return false;
        if (surveyVal === 'prospect' && v.is_converted) return false;

        // Search text matching
        if (searchVal) {
            const queryTarget = [
                v.dealer_name,
                v.contact_person,
                v.phone,
                v.town_village,
                v.district,
                v.visited_by,
                v.visited_date,
                v.formData?.req,
                v.formData?.crops,
                v.formData?.topProducts
            ].filter(Boolean).join(' ').toLowerCase();

            if (!queryTarget.includes(searchVal)) return false;
        }

        return true;
    });

    renderVisitsTable(filteredVisits);
}

// Reset all filter fields
function resetVisitFilters() {
    const searchMain = document.getElementById('visitSearchInput');
    const searchTop = document.getElementById('topNavVisitSearch');
    const dealerSelect = document.getElementById('dealerSelectFilter');
    const staffSelect = document.getElementById('staffSelectFilter');
    const surveySelect = document.getElementById('surveyTypeFilter');

    if (searchMain) searchMain.value = '';
    if (searchTop) searchTop.value = '';
    if (dealerSelect) dealerSelect.value = 'all';
    if (staffSelect) staffSelect.value = 'all';
    if (surveySelect) surveySelect.value = 'all';

    applyVisitFilters();
}

// Selection & Checkbox Handlers
function handleVisitSelectChange(chk, visitId) {
    if (chk.checked) {
        selectedVisitIds.add(String(visitId));
    } else {
        selectedVisitIds.delete(String(visitId));
    }
    updateSelectedVisitsUI();
}

function toggleSelectAllVisits(chk) {
    const visibleIds = (filteredVisits || []).map(v => String(v.id));
    if (chk.checked) {
        visibleIds.forEach(id => selectedVisitIds.add(id));
    } else {
        visibleIds.forEach(id => selectedVisitIds.delete(id));
    }
    updateSelectedVisitsUI();
    renderVisitsTable(filteredVisits);
}

function updateSelectedVisitsUI() {
    const badge = document.getElementById('selectedVisitsBadge');
    const countEl = document.getElementById('selectedVisitsCount');
    const btnDel = document.getElementById('btnDeleteSelectedVisits');
    const selectAllChk = document.getElementById('selectAllVisitsChk');

    const count = selectedVisitIds.size;
    if (badge) badge.style.display = count > 0 ? 'inline-flex' : 'none';
    if (countEl) countEl.textContent = count;
    if (btnDel) btnDel.style.display = count > 0 ? 'inline-flex' : 'none';

    if (selectAllChk) {
        const visibleIds = (filteredVisits || []).map(v => String(v.id));
        if (visibleIds.length > 0 && visibleIds.every(id => selectedVisitIds.has(id))) {
            selectAllChk.checked = true;
            selectAllChk.indeterminate = false;
        } else if (visibleIds.some(id => selectedVisitIds.has(id))) {
            selectAllChk.checked = false;
            selectAllChk.indeterminate = true;
        } else {
            selectAllChk.checked = false;
            selectAllChk.indeterminate = false;
        }
    }
}

// Storage Deletion Helper
function removeVisitFromStorage(visitId) {
    const idStr = String(visitId);

    // 1. Persist to sgb_deleted_visit_ids blacklist
    try {
        let deletedVisitIds = JSON.parse(localStorage.getItem('sgb_deleted_visit_ids')) || [];
        if (!deletedVisitIds.includes(idStr)) {
            deletedVisitIds.push(idStr);
            localStorage.setItem('sgb_deleted_visit_ids', JSON.stringify(deletedVisitIds));
        }
    } catch (e) {}

    // 2. Remove from prospect visits
    try {
        let prospectVisits = JSON.parse(localStorage.getItem('sgb_prospect_visits')) || [];
        const filtered = prospectVisits.filter(pv => String(pv.id) !== idStr);
        localStorage.setItem('sgb_prospect_visits', JSON.stringify(filtered));
    } catch (e) {}

    // 3. Remove from dealer visits keys
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sgb_dealer_visits_')) {
                let localVisits = JSON.parse(localStorage.getItem(key)) || [];
                const filtered = localVisits.filter(v => String(v.id) !== idStr);
                localStorage.setItem(key, JSON.stringify(filtered));
            }
        }
    } catch (e) {}
}

// Delete Single Visit Record
async function deleteSingleVisit(visitId) {
    const visit = allVisits.find(v => String(v.id) === String(visitId));
    const name = visit ? (visit.dealer_name || 'this record') : 'this record';
    if (!confirm(`Are you sure you want to delete the visit record for "${name}"?`)) return;

    removeVisitFromStorage(visitId);
    selectedVisitIds.delete(String(visitId));

    if (window.showAlert) {
        window.showAlert('Deleted', `Visit record for "${name}" deleted successfully.`, 'success');
    } else {
        alert(`Visit record for "${name}" deleted successfully.`);
    }

    await loadVisitData();
}

// Bulk Delete Selected Visit Records
async function deleteSelectedVisits() {
    const count = selectedVisitIds.size;
    if (count === 0) return;

    if (!confirm(`Are you sure you want to delete ${count} selected visit record(s)?`)) return;

    Array.from(selectedVisitIds).forEach(id => {
        removeVisitFromStorage(id);
    });

    selectedVisitIds.clear();

    if (window.showAlert) {
        window.showAlert('Deleted', `Successfully deleted ${count} selected visit record(s).`, 'success');
    } else {
        alert(`Successfully deleted ${count} selected visit record(s).`);
    }

    await loadVisitData();
}

// Edit Visit Record Modal Handlers
function openEditVisitModal(visitId) {
    const visit = allVisits.find(v => String(v.id) === String(visitId));
    if (!visit) {
        if (window.showAlert) window.showAlert('Error', 'Visit record not found.', 'error');
        return;
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('evVisitId', visit.id);
    setVal('evFirmName', visit.dealer_name || '');
    setVal('evDealerName', visit.contact_person || visit.dealer_name || '');
    setVal('evContact', visit.phone || '');
    setVal('evLocation', [visit.town_village, visit.district].filter(Boolean).join(', ') || visit.address || '');
    setVal('evVisitedDate', visit.visited_date || '');
    setVal('evVisitedBy', visit.visited_by || '');

    const fd = visit.formData || {};
    setVal('evVisitReq', fd.req || '');
    setVal('evVisitCrops', fd.crops || '');
    setVal('evVisitTopProducts', fd.topProducts || '');
    setVal('evVisitBrushCuttersQty', fd.brushCuttersQty || '');
    setVal('evVisitBrushCuttersBrands', fd.brushCuttersBrands || '');
    setVal('evVisitCompetitors', fd.competitors || '');
    setVal('evVisitBranches', fd.branches || '');
    setVal('evVisitStaffCount', fd.staffCount || '');
    setVal('evVisitBusinessYears', fd.businessYears || '');

    const modal = document.getElementById('editVisitModal');
    if (modal) modal.classList.add('active');
}

function closeEditVisitModal() {
    const modal = document.getElementById('editVisitModal');
    if (modal) modal.classList.remove('active');
}

async function handleEditVisitSubmit(e) {
    e.preventDefault();

    const visitId = document.getElementById('evVisitId').value;
    const visit = allVisits.find(v => String(v.id) === String(visitId));
    if (!visit) return;

    const firmName = document.getElementById('evFirmName').value.trim();
    const dealerName = document.getElementById('evDealerName').value.trim();
    const contact = document.getElementById('evContact').value.trim();
    const location = document.getElementById('evLocation').value.trim();
    const visitedDate = document.getElementById('evVisitedDate').value;
    const visitedBy = document.getElementById('evVisitedBy').value.trim();

    visit.dealer_name = firmName;
    visit.contact_person = dealerName;
    visit.phone = contact;
    visit.town_village = location;
    visit.visited_date = visitedDate;
    visit.visited_by = visitedBy;

    if (!visit.formData) visit.formData = {};
    visit.formData.req = document.getElementById('evVisitReq').value.trim();
    visit.formData.crops = document.getElementById('evVisitCrops').value.trim();
    visit.formData.topProducts = document.getElementById('evVisitTopProducts').value.trim();
    visit.formData.brushCuttersQty = document.getElementById('evVisitBrushCuttersQty').value.trim();
    visit.formData.brushCuttersBrands = document.getElementById('evVisitBrushCuttersBrands').value.trim();
    visit.formData.competitors = document.getElementById('evVisitCompetitors').value.trim();
    visit.formData.branches = document.getElementById('evVisitBranches').value.trim();
    visit.formData.staffCount = document.getElementById('evVisitStaffCount').value.trim();
    visit.formData.businessYears = document.getElementById('evVisitBusinessYears').value.trim();
    visit.updated_at = new Date().toISOString();

    const idStr = String(visitId);
    if (!visit.is_converted) {
        let prospectVisits = [];
        try { prospectVisits = JSON.parse(localStorage.getItem('sgb_prospect_visits')) || []; } catch (err) {}
        const idx = prospectVisits.findIndex(pv => String(pv.id) === idStr);
        if (idx !== -1) {
            prospectVisits[idx] = visit;
            localStorage.setItem('sgb_prospect_visits', JSON.stringify(prospectVisits));
        }
    } else if (visit.dealer_id) {
        const visitsKey = 'sgb_dealer_visits_' + visit.dealer_id;
        let localVisits = [];
        try { localVisits = JSON.parse(localStorage.getItem(visitsKey)) || []; } catch (err) {}
        const idx = localVisits.findIndex(v => String(v.id) === idStr);
        if (idx !== -1) {
            localVisits[idx] = visit;
            localStorage.setItem(visitsKey, JSON.stringify(localVisits));
        } else {
            localVisits.unshift(visit);
            localStorage.setItem(visitsKey, JSON.stringify(localVisits));
        }
    }

    if (window.showAlert) {
        window.showAlert('Success', `Visit record for "${firmName}" updated successfully.`, 'success');
    } else {
        alert(`Visit record for "${firmName}" updated successfully.`);
    }

    closeEditVisitModal();
    await loadVisitData();
}

// Render Visit Table Rows
function renderVisitsTable(visits) {
    const tbody = document.getElementById('visitsTableBody');
    const recordBadge = document.getElementById('visitRecordCountBadge');

    if (recordBadge) {
        recordBadge.textContent = `Showing ${visits.length} of ${allVisits.length} records`;
    }

    if (!tbody) return;

    if (visits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:3rem;text-align:center;color:#94a3b8;">
            <i class="fa-solid fa-folder-open" style="font-size:2rem;margin-bottom:0.5rem;display:block;"></i>
            No visit records found matching your filters.
        </td></tr>`;
        updateSelectedVisitsUI();
        return;
    }

    tbody.innerHTML = visits.map(v => {
        const isSelected = selectedVisitIds.has(String(v.id));
        const hasQnA = !!(v.formData);
        const dateFormatted = v.visited_date || 'N/A';
        const staffName = v.visited_by || 'Staff';
        const locationStr = [v.town_village, v.district].filter(Boolean).join(', ') || 'N/A';

        const outcomeBadge = v.is_converted
            ? `<span class="badge-converted"><i class="fa-solid fa-circle-check"></i> Converted Dealer</span>`
            : `<span class="badge-prospect"><i class="fa-solid fa-user-clock"></i> Prospect Only</span>`;

        return `
            <tr style="border-bottom:1px solid #f1f5f9;transition:background 0.15s;${isSelected ? 'background-color:#F0F9FF;' : ''}" onmouseover="if(!${isSelected}) this.style.background='#f8fafc'" onmouseout="if(!${isSelected}) this.style.background='transparent'">
                <td style="padding:1rem 0.75rem;text-align:center;">
                    <input type="checkbox" class="visit-chk" value="${v.id}" ${isSelected ? 'checked' : ''} onchange="handleVisitSelectChange(this, '${v.id}')" style="width:16px;height:16px;cursor:pointer;accent-color:#FF6B00;">
                </td>
                <td style="padding:1rem 1.25rem;">
                    <div style="font-weight:700;color:#0f172a;font-size:0.925rem;">${v.dealer_name}</div>
                    <div style="font-size:0.8rem;color:#64748b;margin-top:2px;">
                        ${v.contact_person ? `<i class="fa-regular fa-user" style="margin-right:4px;"></i>${v.contact_person} ` : ''}
                        ${v.phone ? `<span style="color:#94a3b8;margin:0 4px;">•</span><i class="fa-solid fa-phone" style="margin-right:4px;"></i>${v.phone}` : ''}
                    </div>
                </td>
                <td style="padding:1rem 1.25rem;color:#475569;font-weight:500;">
                    <i class="fa-solid fa-location-dot" style="color:#94a3b8;margin-right:4px;"></i>${locationStr}
                </td>
                <td style="padding:1rem 1.25rem;color:#1e293b;font-weight:600;white-space:nowrap;">
                    <i class="fa-regular fa-calendar" style="color:#f59e0b;margin-right:6px;"></i>${dateFormatted}
                </td>
                <td style="padding:1rem 1.25rem;color:#0f172a;font-weight:600;">
                    <span style="background:#f1f5f9;padding:4px 10px;border-radius:12px;font-size:0.8rem;color:#334155;">
                        <i class="fa-solid fa-user-tie" style="margin-right:4px;color:#64748b;"></i>${staffName}
                    </span>
                </td>
                <td style="padding:1rem 1.25rem;">
                    ${outcomeBadge}
                </td>
                <td style="padding:1rem 1.25rem;text-align:right;white-space:nowrap;">
                    <div style="display:inline-flex;align-items:center;gap:6px;">
                        <button class="action-btn-square" title="Edit Visit Log" onclick="openEditVisitModal('${v.id}')" style="color:#0284c7;background:#f0f9ff;border:1px solid #bae6fd;padding:0.45rem 0.65rem;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;transition:all 0.15s ease;" onmouseover="this.style.background='#e0f2fe';" onmouseout="this.style.background='#f0f9ff';">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button class="action-btn-square" title="Delete Visit Log" onclick="deleteSingleVisit('${v.id}')" style="color:#ef4444;background:#fef2f2;border:1px solid #fecaca;padding:0.45rem 0.65rem;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:600;transition:all 0.15s ease;" onmouseover="this.style.background='#fee2e2';" onmouseout="this.style.background='#fef2f2';">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                        ${hasQnA ? `
                            <button class="btn-amber" onclick="viewVisitDetail('${v.id}')" style="padding:0.45rem 0.85rem;font-size:0.8rem;">
                                <i class="fa-solid fa-eye"></i> View Q&A
                            </button>
                        ` : `
                            <button class="btn-outline-card" onclick="viewVisitDetail('${v.id}')" style="padding:0.45rem 0.85rem;font-size:0.8rem;">
                                <i class="fa-solid fa-circle-info"></i> Log Info
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateSelectedVisitsUI();
}

// Open Visit Detail Modal
function viewVisitDetail(visitId) {
    const visit = allVisits.find(v => String(v.id) === String(visitId));
    if (!visit) return;

    const modal = document.getElementById('visitDetailModal');
    const titleEl = document.getElementById('modalVisitDealerTitle');
    const subTitleEl = document.getElementById('modalVisitSubTitle');
    const bodyEl = document.getElementById('modalVisitDetailContent');

    if (titleEl) titleEl.textContent = `${visit.dealer_name} — Visit Form`;
    if (subTitleEl) subTitleEl.textContent = `Visited on ${visit.visited_date || 'N/A'} by ${visit.visited_by || 'Staff'}`;

    if (bodyEl) {
        if (!visit.formData) {
            bodyEl.innerHTML = `
                <div style="text-align:center;padding:2.5rem 1rem;">
                    <div style="width:60px;height:60px;border-radius:50%;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 1rem auto;">
                        <i class="fa-solid fa-clipboard-list"></i>
                    </div>
                    <h3 style="font-size:1.1rem;font-weight:800;color:#0f172a;margin-bottom:0.35rem;">Initial Visit Log</h3>
                    <p style="color:#64748b;font-size:0.875rem;max-width:450px;margin:0 auto 1.5rem auto;">
                        This visit log was registered on <strong>${visit.visited_date || 'N/A'}</strong> by <strong>${visit.visited_by || 'Staff'}</strong>.
                    </p>
                    ${!visit.is_converted ? `
                        <button class="btn-convert-dealer" onclick="convertProspectToDealer('${visit.id}')" style="margin-top:0.5rem;">
                            <i class="fa-solid fa-user-plus"></i> Convert to Dealer
                        </button>
                    ` : ''}
                </div>
            `;
        } else {
            const fd = visit.formData;

            const stockRowsHtml = (fd.stockData && fd.stockData.length) ? fd.stockData.map(st => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:0.5rem 0.75rem;font-weight:700;color:#0f172a;">${st.product}</td>
                    <td style="padding:0.5rem 0.75rem;text-align:center;color:#64748b;font-weight:700;">${st.purchased || '0'}</td>
                    <td style="padding:0.5rem 0.75rem;text-align:center;font-weight:700;color:#16a34a;">${st.currentStock || '0'}</td>
                </tr>
            `).join('') : '<tr><td colspan="3" style="padding:1rem;text-align:center;color:#94a3b8;">No stock check recorded.</td></tr>';

            const customQuestionsHtml = (fd.customQuestions && fd.customQuestions.length) ? fd.customQuestions.map((cq, idx) => `
                <div class="qna-box">
                    <div class="qna-label">${11 + idx}. ${cq.title}:</div>
                    <div class="qna-ans">${cq.answer || '—'}</div>
                </div>
            `).join('') : '';

            bodyEl.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:1.25rem;">
                    <!-- Metadata Header -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
                        <div>
                            <span style="font-size:0.75rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Firm & Contact</span>
                            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">${visit.dealer_name} (${visit.phone || 'N/A'})</div>
                        </div>
                        <div>
                            <span style="font-size:0.75rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Location</span>
                            <div style="font-weight:700;color:#0f172a;font-size:0.9rem;">${[visit.town_village, visit.district, visit.state].filter(Boolean).join(', ') || 'N/A'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.75rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Visited Date & By</span>
                            <div style="font-weight:700;color:#d97706;font-size:0.9rem;">${visit.visited_date || 'N/A'} by ${visit.visited_by || 'Staff'}</div>
                        </div>
                        <div>
                            <span style="font-size:0.75rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Dealer Status</span>
                            <div style="display:flex;align-items:center;gap:0.5rem;margin-top:2px;">
                                ${visit.is_converted 
                                    ? `<span class="badge-converted"><i class="fa-solid fa-circle-check"></i> Converted Dealer</span>` 
                                    : `<span class="badge-prospect"><i class="fa-solid fa-user-clock"></i> Prospect Only</span>
                                       <button class="btn-convert-dealer" onclick="convertProspectToDealer('${visit.id}')" title="Add this dealer to official Dealers List">
                                           <i class="fa-solid fa-user-plus"></i> Convert to Dealer
                                       </button>`}
                            </div>
                        </div>
                    </div>

                    <!-- Questionnaire Answers Grid -->
                    <h4 style="font-size:0.95rem;font-weight:800;color:#0f172a;margin:0.25rem 0 0 0;display:flex;align-items:center;gap:0.5rem;">
                        <i class="fa-solid fa-list-check" style="color:#f59e0b;"></i> Field Questionnaire Responses
                    </h4>

                    <div class="visit-qna-grid">
                        <div class="qna-box">
                            <div class="qna-label">1. Major Requirements from SGB Agro</div>
                            <div class="qna-ans">${fd.req || '—'}</div>
                        </div>
                        <div class="qna-box">
                            <div class="qna-label">2. Main Crops Grown & Focus Items</div>
                            <div class="qna-ans">${fd.crops || '—'}</div>
                        </div>
                        <div class="qna-box">
                            <div class="qna-label">3. Top Selling Products</div>
                            <div class="qna-ans">${fd.topProducts || '—'}</div>
                        </div>
                        <div class="qna-box">
                            <div class="qna-label">4. Monthly Brush Cutters Volume</div>
                            <div class="qna-ans">${fd.brushCuttersQty ? `${fd.brushCuttersQty} units / year` : '—'}</div>
                        </div>
                        <div class="qna-box">
                            <div class="qna-label">5. Brands Currently Stocked</div>
                            <div class="qna-ans">${fd.brushCuttersBrands || '—'}</div>
                        </div>
                        <div class="qna-box">
                            <div class="qna-label">6. Key Competitors & Market Dynamics</div>
                            <div class="qna-ans">${fd.competitors || '—'}</div>
                        </div>
                        <div class="qna-box">
                            <div class="qna-label">7. Branches / Sub-Dealers</div>
                            <div class="qna-ans">${fd.branches || '—'}</div>
                        </div>
                        <div class="qna-box">
                            <div class="qna-label">8. Counter Staff & Business Years</div>
                            <div class="qna-ans">
                                Staff: <strong>${fd.staffCount || '—'}</strong> | Business Age: <strong>${fd.businessYears ? `${fd.businessYears} years` : '—'}</strong> | Mode: <strong>${fd.salesType || 'B2B'}</strong>
                            </div>
                        </div>
                        ${customQuestionsHtml}
                    </div>

                    <!-- Stock Inventory Check Table (Only shown if dealer had prior purchases) -->
                    ${(fd.stockData && fd.stockData.length) ? `
                        <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-top:0.5rem;">
                            <div style="background:#f8fafc;padding:0.75rem 1rem;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:0.85rem;color:#334155;">
                                <i class="fa-solid fa-boxes-stacked" style="margin-right:6px;color:#f59e0b;"></i> Current Stock Check (Products Purchased From Us)
                            </div>
                            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                                <thead style="background:#f1f5f9;color:#475569;font-weight:700;">
                                    <tr>
                                        <th style="padding:0.5rem 0.75rem;text-align:left;">Product Model</th>
                                        <th style="padding:0.5rem 0.75rem;text-align:center;">Purchased Qty</th>
                                        <th style="padding:0.5rem 0.75rem;text-align:center;">Current Stock On Hand</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${stockRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    if (modal) modal.classList.add('active');
}

function closeVisitDetailModal() {
    const modal = document.getElementById('visitDetailModal');
    if (modal) modal.classList.remove('active');
}

// Open Record New Visit Modal
function openNewVisitModal(preselectDealerId = null) {
    const modal = document.getElementById('newVisitModal');
    const formSelect = document.getElementById('nvDealerSelect');

    if (formSelect) {
        if (preselectDealerId) {
            formSelect.value = preselectDealerId;
            autoFillDealerInfo(preselectDealerId);
        } else {
            formSelect.value = '';
            autoFillDealerInfo('');
        }
    }

    if (modal) modal.classList.add('active');
}

function closeNewVisitModal() {
    const modal = document.getElementById('newVisitModal');
    if (modal) modal.classList.remove('active');
}

// Dynamic Custom Questions Logic
function openAddQuestionModal() {
    const modal = document.getElementById('addQuestionModal');
    if (modal) modal.classList.add('active');
}

function closeAddQuestionModal() {
    const modal = document.getElementById('addQuestionModal');
    if (modal) modal.classList.remove('active');
}

function handleAddCustomQuestion() {
    const titleInput = document.getElementById('newQuestionTitleInput');
    const title = titleInput ? titleInput.value.trim() : '';

    if (!title) {
        if (window.showAlert) window.showAlert('Notice', 'Please enter a question prompt.', 'info');
        return;
    }

    const qId = 'cq_' + Date.now();
    customQuestionsList.push({ id: qId, title: title });

    renderCustomQuestions();
    closeAddQuestionModal();
    if (titleInput) titleInput.value = '';
}

function renderCustomQuestions() {
    const container = document.getElementById('customQuestionsContainer');
    if (!container) return;

    container.innerHTML = customQuestionsList.map((cq, idx) => `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:1rem;position:relative;">
            <button type="button" onclick="removeCustomQuestion('${cq.id}')" style="position:absolute;right:10px;top:10px;background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.9rem;">
                <i class="fa-solid fa-trash"></i>
            </button>
            <label style="display:block;font-weight:700;font-size:0.875rem;color:#0f172a;margin-bottom:0.4rem;">
                ${11 + idx}. ${cq.title} <span style="color:#ef4444;">*</span>
            </label>
            <textarea id="${cq.id}" rows="2" placeholder="Type your answer..." required style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:0.6rem 0.85rem;font-size:0.85rem;color:#1e293b;outline:none;resize:vertical;background:#f8fafc;font-family:inherit;"></textarea>
        </div>
    `).join('');
}

function removeCustomQuestion(qId) {
    customQuestionsList = customQuestionsList.filter(q => q.id !== qId);
    renderCustomQuestions();
}

// Handle New Visit Form Submission (Converts Dealer or Saves Visit Log)
async function handleNewVisitSubmit(e) {
    e.preventDefault();

    const firmName = document.getElementById('nvFirmName').value.trim();
    const dealerName = document.getElementById('nvDealerName').value.trim();
    const contact = document.getElementById('nvContact').value.trim();
    const location = document.getElementById('nvLocation').value.trim();
    const visitedDate = document.getElementById('nvVisitedDate').value;
    const visitedBy = document.getElementById('nvVisitedBy').value.trim();

    const outcomeRadio = document.querySelector('input[name="visitOutcome"]:checked');
    const outcome = outcomeRadio ? outcomeRadio.value : 'converted'; // 'converted' or 'prospect'

    const salesTypeRadio = document.querySelector('input[name="visitSalesType"]:checked');
    const salesType = salesTypeRadio ? salesTypeRadio.value : 'B2B – Business to Business';

    if (!firmName || !dealerName || !contact || !location || !visitedDate || !visitedBy) {
        if (window.showAlert) window.showAlert('Error', 'Please fill in all firm, dealer contact, and visit details.', 'error');
        return;
    }

    // Collect Stock inputs if Question 11 is visible
    const stockContainer = document.getElementById('sectionCurrentStockContainer');
    let stockData = [];
    if (stockContainer && stockContainer.style.display !== 'none') {
        const stockInputs = document.querySelectorAll('.visit-stock-input');
        stockData = Array.from(stockInputs).map(inp => ({
            product: inp.dataset.prod,
            purchased: inp.dataset.purchased,
            currentStock: inp.value || '0'
        }));
    }

    // Collect Custom Questions
    const customQAnswers = customQuestionsList.map(cq => {
        const el = document.getElementById(cq.id);
        return {
            title: cq.title,
            answer: el ? el.value.trim() : ''
        };
    });

    const formData = {
        req: document.getElementById('visitReq').value.trim(),
        crops: document.getElementById('visitCrops').value.trim(),
        topProducts: document.getElementById('visitTopProducts').value.trim(),
        brushCuttersQty: document.getElementById('visitBrushCuttersQty').value.trim(),
        brushCuttersBrands: document.getElementById('visitBrushCuttersBrands').value.trim(),
        competitors: document.getElementById('visitCompetitors').value.trim(),
        branches: document.getElementById('visitBranches').value.trim(),
        staffCount: document.getElementById('visitStaffCount').value.trim(),
        businessYears: document.getElementById('visitBusinessYears').value.trim(),
        salesType: salesType,
        stockData: stockData,
        customQuestions: customQAnswers
    };

    const newVisitId = 'VISIT-' + Date.now();
    const token = localStorage.getItem('token');
    const existingDealerId = document.getElementById('nvDealerSelect')?.value;

    try {
        if (existingDealerId) {
            // Existing dealer selected -> Record visit directly under existing dealer
            const visitRecord = {
                id: newVisitId,
                dealer_id: existingDealerId,
                dealer_name: firmName,
                contact_person: dealerName,
                phone: contact,
                town_village: location,
                visited_date: visitedDate,
                visited_by: visitedBy,
                formData: formData,
                is_converted: true,
                created_at: new Date().toISOString()
            };

            const visitsKey = 'sgb_dealer_visits_' + existingDealerId;
            let localVisits = [];
            try { localVisits = JSON.parse(localStorage.getItem(visitsKey)) || []; } catch (e) { localVisits = []; }
            localVisits.unshift(visitRecord);
            localStorage.setItem(visitsKey, JSON.stringify(localVisits));

            if (window.showAlert) {
                window.showAlert('Success', `Visit recorded for ${firmName}!`, 'success');
            }

        } else if (outcome === 'converted') {
            // 1. Dealer is OK to order -> ADD TO OFFICIAL DEALERS LIST DB
            const response = await fetch(`${window.API_URL || 'http://localhost:5000/api'}/dealers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    firm_name: firmName,
                    dealer_name: firmName,
                    contact_person: dealerName,
                    phone: contact,
                    town_village: location,
                    address: location,
                    visited_date: visitedDate,
                    visited_by: visitedBy,
                    status: 'Active'
                })
            });

            let newDealerId = null;
            if (response.ok) {
                const resData = await response.json();
                newDealerId = resData.dealer_id;
            }

            const targetDealerId = newDealerId || ('LOCAL-' + Date.now());

            const visitRecord = {
                id: newVisitId,
                dealer_id: targetDealerId,
                dealer_name: firmName,
                contact_person: dealerName,
                phone: contact,
                town_village: location,
                visited_date: visitedDate,
                visited_by: visitedBy,
                formData: formData,
                is_converted: true,
                created_at: new Date().toISOString()
            };

            const visitsKey = 'sgb_dealer_visits_' + targetDealerId;
            let localVisits = [];
            try { localVisits = JSON.parse(localStorage.getItem(visitsKey)) || []; } catch (e) { localVisits = []; }
            localVisits.unshift(visitRecord);
            localStorage.setItem(visitsKey, JSON.stringify(localVisits));

            if (window.showAlert) {
                window.showAlert('Success', `Visit recorded and ${firmName} added to official Dealers List!`, 'success');
            }

        } else {
            // 2. Just a Visit / Prospect -> DO NOT ADD TO DEALERS LIST DB
            const visitRecord = {
                id: newVisitId,
                dealer_id: 'PROSPECT-' + Date.now(),
                dealer_name: firmName,
                contact_person: dealerName,
                phone: contact,
                town_village: location,
                visited_date: visitedDate,
                visited_by: visitedBy,
                formData: formData,
                is_converted: false,
                created_at: new Date().toISOString()
            };

            let prospectVisits = [];
            try { prospectVisits = JSON.parse(localStorage.getItem('sgb_prospect_visits')) || []; } catch (e) { prospectVisits = []; }
            prospectVisits.unshift(visitRecord);
            localStorage.setItem('sgb_prospect_visits', JSON.stringify(prospectVisits));

            if (window.showAlert) {
                window.showAlert('Success', `Field visit log recorded as Prospect (Dealer not added to Dealers list).`, 'success');
            }
        }

        closeNewVisitModal();
        document.getElementById('newVisitForm').reset();
        customQuestionsList = [];
        renderCustomQuestions();
        await loadVisitData();

    } catch (err) {
        console.error('Error saving visit form:', err);
        if (window.showAlert) window.showAlert('Error', 'Failed to save visit record: ' + err.message, 'error');
    }
}

// Export Visits to CSV
function exportVisitsCSV() {
    if (!filteredVisits || filteredVisits.length === 0) {
        if (window.showAlert) window.showAlert('Notice', 'No visit records available to export.', 'info');
        return;
    }

    const headers = ['Visit ID', 'Firm / Dealer Name', 'Contact Person', 'Phone', 'Location', 'Visited Date', 'Visited By', 'Visit Outcome', 'Requirements', 'Top Products'];

    const rows = filteredVisits.map(v => {
        const hasQnA = !!(v.formData);
        const req = hasQnA ? (v.formData.req || '') : '';
        const topProd = hasQnA ? (v.formData.topProducts || '') : '';
        const loc = [v.town_village, v.district].filter(Boolean).join(', ');

        return [
            `"${v.id}"`,
            `"${(v.dealer_name || '').replace(/"/g, '""')}"`,
            `"${(v.contact_person || '').replace(/"/g, '""')}"`,
            `"${v.phone || ''}"`,
            `"${loc.replace(/"/g, '""')}"`,
            `"${v.visited_date || ''}"`,
            `"${(v.visited_by || '').replace(/"/g, '""')}"`,
            `"${v.is_converted ? 'Converted Dealer' : 'Prospect Only'}"`,
            `"${req.replace(/"/g, '""')}"`,
            `"${topProd.replace(/"/g, '""')}"`
        ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Dealer_Visits_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Convert a Prospect Visit into an Official Registered Dealer in DB
async function convertProspectToDealer(visitId) {
    const visit = allVisits.find(v => String(v.id) === String(visitId));
    if (!visit) {
        if (window.showAlert) window.showAlert('Error', 'Visit record not found.', 'error');
        return;
    }

    if (visit.is_converted) {
        if (window.showAlert) window.showAlert('Notice', 'This dealer is already added to the Dealers List.', 'info');
        return;
    }

    const confirmMsg = `Add "${visit.dealer_name}" to the official Dealers List?`;
    if (!confirm(confirmMsg)) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${window.API_URL || 'http://localhost:5000/api'}/dealers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                firm_name: visit.dealer_name,
                dealer_name: visit.dealer_name,
                contact_person: visit.contact_person || visit.dealer_name,
                phone: visit.phone || '',
                town_village: visit.town_village || '',
                address: [visit.town_village, visit.district, visit.state].filter(Boolean).join(', '),
                visited_date: visit.visited_date || new Date().toISOString().slice(0, 10),
                visited_by: visit.visited_by || 'Staff',
                status: 'Active'
            })
        });

        let newDealerId = null;
        if (response.ok) {
            const resData = await response.json();
            newDealerId = resData.dealer_id;
        }

        const targetDealerId = newDealerId || ('LOCAL-' + Date.now());

        // Remove from prospectVisits list in localStorage if present
        let prospectVisits = [];
        try { prospectVisits = JSON.parse(localStorage.getItem('sgb_prospect_visits')) || []; } catch (e) { prospectVisits = []; }
        prospectVisits = prospectVisits.filter(pv => String(pv.id) !== String(visitId));
        localStorage.setItem('sgb_prospect_visits', JSON.stringify(prospectVisits));

        // Save under official dealer visits key
        const visitRecord = {
            ...visit,
            dealer_id: targetDealerId,
            is_converted: true,
            updated_at: new Date().toISOString()
        };

        const visitsKey = 'sgb_dealer_visits_' + targetDealerId;
        let localVisits = [];
        try { localVisits = JSON.parse(localStorage.getItem(visitsKey)) || []; } catch (e) { localVisits = []; }
        localVisits.unshift(visitRecord);
        localStorage.setItem(visitsKey, JSON.stringify(localVisits));

        if (window.showAlert) {
            window.showAlert('Success', `"${visit.dealer_name}" successfully added to Dealers List!`, 'success');
        } else {
            alert(`"${visit.dealer_name}" successfully added to Dealers List!`);
        }

        closeVisitDetailModal();
        await loadVisitData();

    } catch (err) {
        console.error('Error converting prospect to dealer:', err);
        if (window.showAlert) window.showAlert('Error', 'Failed to convert dealer: ' + err.message, 'error');
    }
}

window.openNewVisitModal = openNewVisitModal;
window.closeNewVisitModal = closeNewVisitModal;
window.openAddQuestionModal = openAddQuestionModal;
window.closeAddQuestionModal = closeAddQuestionModal;
window.handleAddCustomQuestion = handleAddCustomQuestion;
window.removeCustomQuestion = removeCustomQuestion;
window.selectVisitOutcome = selectVisitOutcome;
window.autoFillDealerInfo = autoFillDealerInfo;
window.viewVisitDetail = viewVisitDetail;
window.closeVisitDetailModal = closeVisitDetailModal;
window.handleNewVisitSubmit = handleNewVisitSubmit;
window.exportVisitsCSV = exportVisitsCSV;
window.resetVisitFilters = resetVisitFilters;
window.applyVisitFilters = applyVisitFilters;
window.syncVisitSearch = syncVisitSearch;
window.handleVisitSelectChange = handleVisitSelectChange;
window.toggleSelectAllVisits = toggleSelectAllVisits;
window.deleteSelectedVisits = deleteSelectedVisits;
window.deleteSingleVisit = deleteSingleVisit;
window.openEditVisitModal = openEditVisitModal;
window.closeEditVisitModal = closeEditVisitModal;
window.handleEditVisitSubmit = handleEditVisitSubmit;
window.convertProspectToDealer = convertProspectToDealer;
