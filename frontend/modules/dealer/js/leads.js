// ============================================================
// leads.js — Dealer Leads Info Module Logic
// ============================================================

const API_LEADS_BASE = `${window.API_URL}/leads`;
const token = () => localStorage.getItem('token') || '';

let allLeads = [];
let filteredLeads = [];
let selectedLeadIds = new Set();
let currentPage = 1;
let pageSize = 10;
let isManageAllowed = true;

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

function formatLeadDate(dateInput) {
    if (!dateInput) return 'N/A';
    try {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return String(dateInput);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return String(dateInput);
    }
}
window.formatLeadDate = formatLeadDate;

document.addEventListener('DOMContentLoaded', () => {
    if (window.requireAuth && !window.requireAuth(['admin', 'super-admin', 'dealer', 'dealer_manager', 'dealer_executive', 'dealer_viewer'], 'dealer_dealers')) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const profileElem = document.getElementById('profileName');
    if (profileElem) profileElem.textContent = user.name || user.email || 'admin';

    const role = (user.role || '').toLowerCase();
    isManageAllowed = (role === 'admin' || role === 'super-admin' || role === 'sales' || role.includes('dealer') || user.is_manager);
    if (role.includes('viewer')) {
        isManageAllowed = false;
    }

    setTimeout(() => {
        const navLeads = document.getElementById('nav-dealer-leads');
        if (navLeads) {
            document.querySelectorAll('.sidebar .nav-link').forEach(l => l.classList.remove('active'));
            navLeads.classList.add('active');
        }
    }, 250);

    fetchDealerLeads();
});

// ── Fetch Leads Data ──
async function fetchDealerLeads() {
    const tbody = document.getElementById('dealerLeadsTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="padding:3rem;text-align:center;color:#94a3b8;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x" style="margin-bottom:0.5rem;display:block;color:#FF6B00;"></i>
                    Loading dealer leads...
                </td>
            </tr>`;
    }

    try {
        // Fetch leads designated for dealer panel (WhatsApp transfer & CRM Order Conversion Wizard)
        let response = await fetch(`${API_LEADS_BASE}?limit=all&module=dealer`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });

        if (!response.ok) {
            response = await fetch(`${API_LEADS_BASE}?module=dealer`, {
                headers: { 'Authorization': `Bearer ${token()}` }
            });
        }

        if (response.ok) {
            const data = await response.json();
            const fetched = Array.isArray(data) ? data : (data.leads || data.data || []);

            allLeads = fetched.map(item => normalizeLead(item));

            // Sort newest updated/created first
            allLeads.sort((a, b) => {
                const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
                const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
                if (dateB !== dateA) return dateB - dateA;
                return (b.raw_id || 0) - (a.raw_id || 0);
            });
        } else {
            allLeads = [];
        }
    } catch (err) {
        console.warn('Backend API leads fetch error:', err);
        allLeads = [];
    }

    applyLeadFilters();
}

function normalizeLead(item) {
    const custName = item.customer_name || item.name || item.contact_person || '';
    const firmName = item.firm_name || item.business_name || item.firm || custName || 'Dealer Lead';
    const idVal = item.lead_id || item.id;
    const formattedLeadId = (typeof idVal === 'string' && idVal.startsWith('LEAD-')) ? idVal : `LEAD-${idVal || '001'}`;

    const rawStatus = String(item.status || 'NEW').toUpperCase().trim();
    let normStatus = 'NEW';
    if (['CONVERTED', 'DEALER_CONVERTED', 'DEALER'].includes(rawStatus)) {
        normStatus = 'CONVERTED';
    } else if (['FOLLOWUP', 'CONTACTED', 'INTERESTED', 'DEALER_LEAD', 'CALLBACK'].includes(rawStatus)) {
        normStatus = 'FOLLOWUP';
    } else if (rawStatus === 'NEW') {
        normStatus = 'NEW';
    } else {
        normStatus = 'FOLLOWUP';
    }

    return {
        id: item.lead_id || item.id,
        raw_id: item.lead_id || item.id,
        lead_id: formattedLeadId,
        firm_name: firmName,
        customer_name: custName || 'N/A',
        phone_number: item.phone_number || item.phone || '',
        email: item.email || '',
        city: item.city || item.address || 'N/A',
        state: item.state || 'Karnataka',
        district: item.district || '',
        taluk: item.taluk || '',
        pincode: item.pincode || item.pin_code || '',
        gst_no: item.gst_no || item.gst_number || '',
        nearest_vrl: item.nearest_vrl || item.vrl_branch || '',
        source: (item.source || 'DIRECT').toUpperCase(),
        status: normStatus,
        notes: item.notes || item.remarks || '',
        created_at: item.created_at || new Date().toISOString()
    };
}

// ── Update KPI Summary Cards ──
function updateKPIs() {
    const total = allLeads.length;
    const newLeads = allLeads.filter(l => l.status === 'NEW').length;
    const followupLeads = allLeads.filter(l => l.status === 'FOLLOWUP').length;
    const converted = allLeads.filter(l => l.status === 'CONVERTED').length;

    if (document.getElementById('kpiTotalLeads')) document.getElementById('kpiTotalLeads').textContent = total;
    if (document.getElementById('kpiNewLeads')) document.getElementById('kpiNewLeads').textContent = newLeads;
    if (document.getElementById('kpiFollowupLeads')) document.getElementById('kpiFollowupLeads').textContent = followupLeads;
    if (document.getElementById('kpiConvertedLeads')) document.getElementById('kpiConvertedLeads').textContent = converted;
}

// ── Search & Filter Logic ──
function applyLeadFilters() {
    const searchVal = (document.getElementById('leadSearchInput')?.value || '').toLowerCase().trim();
    const statusVal = document.getElementById('leadStatusFilter')?.value || 'ALL';
    const sourceVal = document.getElementById('leadSourceFilter')?.value || 'ALL';

    filteredLeads = allLeads.filter(l => {
        const matchesSearch = !searchVal ||
            l.lead_id.toLowerCase().includes(searchVal) ||
            l.firm_name.toLowerCase().includes(searchVal) ||
            l.customer_name.toLowerCase().includes(searchVal) ||
            l.phone_number.toLowerCase().includes(searchVal) ||
            l.city.toLowerCase().includes(searchVal);

        const matchesStatus = statusVal === 'ALL' || l.status === statusVal;
        const matchesSource = sourceVal === 'ALL' || l.source === sourceVal;

        return matchesSearch && matchesStatus && matchesSource;
    });

    updateKPIs();
    currentPage = 1;
    renderLeadsTable();
}

function syncLeadSearch(type) {
    const topVal = document.getElementById('topNavLeadSearch')?.value || '';
    const mainVal = document.getElementById('leadSearchInput')?.value || '';

    if (type === 'top') {
        const mainInput = document.getElementById('leadSearchInput');
        if (mainInput) mainInput.value = topVal;
    } else {
        const topInput = document.getElementById('topNavLeadSearch');
        if (topInput) topInput.value = mainVal;
    }
    applyLeadFilters();
}

function filterDealerLeads() {
    applyLeadFilters();
}

function resetLeadFilters() {
    if (document.getElementById('leadSearchInput')) document.getElementById('leadSearchInput').value = '';
    if (document.getElementById('topNavLeadSearch')) document.getElementById('topNavLeadSearch').value = '';
    if (document.getElementById('leadStatusFilter')) document.getElementById('leadStatusFilter').value = 'ALL';
    if (document.getElementById('leadSourceFilter')) document.getElementById('leadSourceFilter').value = 'ALL';
    applyLeadFilters();
}

// ── Render Leads Table ──
function renderLeadsTable() {
    const tbody = document.getElementById('dealerLeadsTableBody');
    if (!tbody) return;

    if (filteredLeads.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="padding:3rem;text-align:center;color:#94a3b8;">
                    <i class="fa-solid fa-folder-open fa-2x" style="margin-bottom:0.5rem;display:block;"></i>
                    No dealer leads found matching your criteria.
                </td>
            </tr>`;
        updatePaginationInfo(0);
        return;
    }

    // Ensure valid page range
    const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filteredLeads.slice(startIndex, startIndex + pageSize);

    let html = '';
    paginated.forEach(lead => {
        const isChecked = selectedLeadIds.has(lead.lead_id);
        const dateStr = lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

        // Status Badge Style (3 Allowed Statuses: NEW, FOLLOWUP, CONVERTED)
        let badgeClass = 'new';
        let statusLabel = 'NEW';
        if (lead.status === 'CONVERTED') {
            badgeClass = 'converted';
            statusLabel = 'CONVERTED';
        } else if (lead.status === 'FOLLOWUP') {
            badgeClass = 'followup';
            statusLabel = 'FOLLOW UP';
        } else {
            badgeClass = 'new';
            statusLabel = 'NEW';
        }

        html += `
            <tr style="transition:background 0.15s ease;${isChecked ? 'background:#F0F9FF;' : ''}" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${isChecked ? '#F0F9FF' : 'transparent'}'">
                <td style="padding:1rem 0.75rem;text-align:center;" onclick="event.stopPropagation();">
                    <input type="checkbox" onchange="toggleSelectLead('${lead.lead_id}', this.checked)" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;accent-color:#FF6B00;">
                </td>
                <td style="padding:1rem 1.25rem;font-weight:700;color:#FF6B00;font-size:0.825rem;cursor:pointer;text-decoration:underline;" onclick="openLeadDetailsModal('${lead.lead_id}')" title="Click to view full lead details">${lead.lead_id}</td>
                <td style="padding:1rem 1.25rem;cursor:pointer;" onclick="openLeadDetailsModal('${lead.lead_id}')" title="Click to view full lead details">
                    <div style="font-weight:700;color:#0F172A;font-size:0.875rem;" onmouseover="this.style.color='#FF6B00'" onmouseout="this.style.color='#0F172A'">${escapeHtml(lead.firm_name)}</div>
                    <div style="font-size:0.775rem;color:#64748B;"><i class="fa-solid fa-user-tie" style="margin-right:4px;"></i>${escapeHtml(lead.customer_name)}</div>
                </td>
                <td style="padding:1rem 1.25rem;">
                    <div style="font-weight:700;color:#059669;font-size:0.825rem;"><i class="fa-solid fa-phone" style="margin-right:4px;"></i>${escapeHtml(lead.phone_number)}</div>
                    ${lead.email ? `<div style="font-size:0.75rem;color:#64748B;"><i class="fa-solid fa-envelope" style="margin-right:4px;"></i>${escapeHtml(lead.email)}</div>` : ''}
                </td>
                <td style="padding:1rem 1.25rem;font-weight:600;color:#334155;font-size:0.825rem;">
                    <div>${escapeHtml(lead.city)}</div>
                    <div style="font-size:0.75rem;color:#64748B;">${escapeHtml(lead.state)}</div>
                </td>
                <td style="padding:1rem 1.25rem;">
                    <span style="font-size:0.75rem;font-weight:700;color:#475569;background:#F1F5F9;padding:0.2rem 0.55rem;border-radius:6px;border:1px solid #E2E8F0;">${lead.source}</span>
                </td>
                <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748B;font-weight:600;">${dateStr}</td>
                <td style="padding:1rem 1.25rem;text-align:center;">
                    <span class="lead-badge ${badgeClass}">${statusLabel}</span>
                </td>
                <td style="padding:1rem 1.25rem;text-align:center;" onclick="event.stopPropagation();">
                    <div style="display:flex;align-items:center;justify-content:center;gap:0.4rem;">
                        ${lead.status !== 'CONVERTED' ? `
                            <button onclick="event.stopPropagation(); convertToDealer('${lead.lead_id}')" style="background:#ECFDF5;color:#059669;border:1px solid #A7F3D0;padding:0.35rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer;" title="Convert to Dealer">
                                <i class="fa-solid fa-user-plus"></i> Convert
                            </button>
                        ` : `
                            <button disabled style="background:#F1F5F9;color:#94A3B8;border:1px solid #E2E8F0;padding:0.35rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:not-allowed;" title="Already Converted to Dealer">
                                <i class="fa-solid fa-check"></i> Converted
                            </button>
                        `}
                        <button onclick="event.stopPropagation(); deleteLead('${lead.lead_id}')" style="background:#FEE2E2;color:#DC2626;border:1px solid #FCA5A5;padding:0.35rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer;" title="Delete Lead">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });

    tbody.innerHTML = html;
    updatePaginationInfo(filteredLeads.length);
}

// ── Pagination Controls ──
function updatePaginationInfo(totalCount) {
    const summary = document.getElementById('leadsPaginationSummary');
    const buttonsContainer = document.getElementById('leadsPaginationButtons');
    const pageSizeSelect = document.getElementById('leadsPageSize');

    if (pageSizeSelect && String(pageSizeSelect.value) !== String(pageSize)) {
        pageSizeSelect.value = String(pageSize);
    }

    if (!summary || !buttonsContainer) return;

    if (totalCount === 0) {
        summary.textContent = 'Showing 0 entries';
        buttonsContainer.innerHTML = '';
        return;
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalCount);
    summary.textContent = `Showing ${start} to ${end} of ${totalCount} entries`;

    const totalPages = Math.ceil(totalCount / pageSize);
    let btnHtml = `
        <button onclick="changeLeadsPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="padding:0.3rem 0.6rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;">
            <i class="fa-solid fa-chevron-left"></i>
        </button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            btnHtml += `
                <button onclick="changeLeadsPage(${i})" style="padding:0.3rem 0.65rem;border:1px solid ${i === currentPage ? '#FF6B00' : '#cbd5e1'};border-radius:6px;background:${i === currentPage ? '#FF6B00' : '#fff'};color:${i === currentPage ? '#fff' : '#334155'};font-weight:700;cursor:pointer;">
                    ${i}
                </button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            btnHtml += `<span style="padding:0.3rem 0.4rem;color:#94a3b8;">...</span>`;
        }
    }

    btnHtml += `
        <button onclick="changeLeadsPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} style="padding:0.3rem 0.6rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;">
            <i class="fa-solid fa-chevron-right"></i>
        </button>`;

    buttonsContainer.innerHTML = btnHtml;
}

function changeLeadsPage(page) {
    const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderLeadsTable();
}

function changeLeadsPageSize(newSize) {
    pageSize = parseInt(newSize, 10) || 10;
    currentPage = 1;
    renderLeadsTable();
}

// ── Checkbox Batch Actions ──
function toggleSelectLead(leadId, isChecked) {
    if (isChecked) {
        selectedLeadIds.add(leadId);
    } else {
        selectedLeadIds.delete(leadId);
    }
    updateSelectedBadge();
}

function toggleSelectAllLeads(masterCheckbox) {
    const isChecked = masterCheckbox.checked;
    const startIndex = (currentPage - 1) * pageSize;
    const paginated = filteredLeads.slice(startIndex, startIndex + pageSize);

    paginated.forEach(lead => {
        if (isChecked) {
            selectedLeadIds.add(lead.lead_id);
        } else {
            selectedLeadIds.delete(lead.lead_id);
        }
    });
    updateSelectedBadge();
    renderLeadsTable();
}

function updateSelectedBadge() {
    const badge = document.getElementById('selectedLeadsBadge');
    const countSpan = document.getElementById('selectedLeadsCount');
    if (!badge || !countSpan) return;

    if (selectedLeadIds.size > 0) {
        badge.style.display = 'inline-flex';
        countSpan.textContent = selectedLeadIds.size;
    } else {
        badge.style.display = 'none';
    }
}

// ── Add / Edit Modal ──
function openAddLeadModal() {
    document.getElementById('leadModalTitle').textContent = 'Add New Dealer Lead';
    document.getElementById('leadModalId').value = '';
    document.getElementById('leadModalFirm').value = '';
    document.getElementById('leadModalName').value = '';
    document.getElementById('leadModalPhone').value = '';
    document.getElementById('leadModalEmail').value = '';
    document.getElementById('leadModalCity').value = '';
    document.getElementById('leadModalState').value = 'Karnataka';
    document.getElementById('leadModalStatus').value = 'NEW';
    document.getElementById('leadModalSource').value = 'WEBSITE';
    document.getElementById('leadModalNotes').value = '';
    document.getElementById('leadModal').style.display = 'flex';
}

function openEditLeadModal(leadId) {
    const lead = allLeads.find(l => l.lead_id === leadId || String(l.id) === String(leadId));
    if (!lead) return;

    document.getElementById('leadModalTitle').textContent = `Edit Lead (${lead.lead_id})`;
    document.getElementById('leadModalId').value = lead.lead_id;
    document.getElementById('leadModalFirm').value = lead.firm_name;
    document.getElementById('leadModalName').value = lead.customer_name;
    document.getElementById('leadModalPhone').value = lead.phone_number;
    document.getElementById('leadModalEmail').value = lead.email;
    document.getElementById('leadModalCity').value = lead.city;
    document.getElementById('leadModalState').value = lead.state;
    document.getElementById('leadModalStatus').value = lead.status;
    document.getElementById('leadModalSource').value = lead.source;
    document.getElementById('leadModalNotes').value = lead.notes;
    document.getElementById('leadModal').style.display = 'flex';
}

function closeLeadModal() {
    document.getElementById('leadModal').style.display = 'none';
}

async function saveLeadForm(e) {
    e.preventDefault();
    const id = document.getElementById('leadModalId').value;
    const firm = document.getElementById('leadModalFirm').value.trim();
    const name = document.getElementById('leadModalName').value.trim();
    const phone = document.getElementById('leadModalPhone').value.trim();
    const email = document.getElementById('leadModalEmail').value.trim();
    const city = document.getElementById('leadModalCity').value.trim();
    const state = document.getElementById('leadModalState').value.trim();
    const status = document.getElementById('leadModalStatus').value;
    const source = document.getElementById('leadModalSource').value;
    const notes = document.getElementById('leadModalNotes').value.trim();

    try {
        if (id) {
            // Edit existing lead
            const existingLead = allLeads.find(l => l.lead_id === id || String(l.id) === String(id));
            const realId = existingLead ? (existingLead.raw_id || existingLead.id) : id;

            await fetch(`${API_LEADS_BASE}/${realId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customer_name: name,
                    firm_name: firm,
                    phone_number: phone,
                    email: email,
                    city: city,
                    state: state,
                    status: status,
                    source: source,
                    notes: notes
                })
            });

            if (existingLead) {
                existingLead.firm_name = firm;
                existingLead.customer_name = name;
                existingLead.phone_number = phone;
                existingLead.email = email;
                existingLead.city = city;
                existingLead.state = state;
                existingLead.status = status;
                existingLead.source = source;
                existingLead.notes = notes;
            }
        } else {
            // Add new lead
            const res = await fetch(`${API_LEADS_BASE}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customer_name: name,
                    firm_name: firm,
                    phone_number: phone,
                    email: email,
                    city: city,
                    state: state,
                    status: status,
                    source: source,
                    notes: notes
                })
            });

            if (res.ok) {
                const resData = await res.json();
                const newLeadObj = resData.lead || resData.data || resData;
                const normalized = normalizeLead({
                    ...newLeadObj,
                    customer_name: name,
                    firm_name: firm,
                    phone_number: phone,
                    email: email,
                    city: city,
                    state: state,
                    status: status,
                    source: source,
                    notes: notes
                });
                allLeads.unshift(normalized);
            } else {
                // Fallback local add
                const newLead = {
                    id: Date.now(),
                    raw_id: Date.now(),
                    lead_id: `LEAD-${Math.floor(1000 + Math.random() * 9000)}`,
                    firm_name: firm,
                    customer_name: name,
                    phone_number: phone,
                    email: email,
                    city: city || 'N/A',
                    state: state || 'Karnataka',
                    source: source,
                    status: status,
                    notes: notes,
                    created_at: new Date().toISOString()
                };
                allLeads.unshift(newLead);
            }
        }
    } catch (err) {
        console.warn('Backend API save lead warning:', err);
    }

    closeLeadModal();
    applyLeadFilters();
    if (window.showAlert) window.showAlert('Success', id ? `Lead "${firm || name}" updated successfully!` : 'New dealer lead added successfully!', 'success');
}

// ── Convert Lead to Dealer ──
async function convertToDealer(leadId) {
    const lead = allLeads.find(l => l.lead_id === leadId || String(l.id) === String(leadId) || String(l.raw_id) === String(leadId));
    if (lead && lead.status === 'CONVERTED') {
        if (window.showAlert) {
            window.showAlert('Already Converted', `Lead "${lead.firm_name}" (${lead.lead_id}) has already been converted to a dealer!`, 'info');
        } else {
            alert(`Lead "${lead.firm_name}" (${lead.lead_id}) has already been converted to a dealer!`);
        }
        return;
    }
    openLeadConversionWizard(leadId);
}

// ── Delete Lead ──
async function deleteLead(leadId) {
    const lead = allLeads.find(l => l.lead_id === leadId || String(l.id) === String(leadId));
    if (!lead) return;

    if (!confirm(`Are you sure you want to delete lead ${lead.lead_id} (${lead.firm_name})?`)) return;

    try {
        const realId = lead.raw_id || lead.id || leadId;
        await fetch(`${API_LEADS_BASE}/${realId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token()}`
            }
        });
    } catch (err) {
        console.warn('Backend API delete lead warning:', err);
    }

    allLeads = allLeads.filter(l => l.lead_id !== lead.lead_id && String(l.id) !== String(lead.id));
    selectedLeadIds.delete(lead.lead_id);
    applyLeadFilters();
    if (window.showAlert) window.showAlert('Deleted', `Lead "${lead.firm_name}" removed successfully.`, 'info');
}

// ── Export CSV ──
function exportLeadsCSV() {
    if (filteredLeads.length === 0) {
        alert('No leads data available to export.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Lead ID,Firm Name,Customer Name,Phone,Email,City,State,Source,Status,Created Date\n";

    filteredLeads.forEach(l => {
        const row = [
            `"${l.lead_id}"`,
            `"${l.firm_name.replace(/"/g, '""')}"`,
            `"${l.customer_name.replace(/"/g, '""')}"`,
            `"${l.phone_number}"`,
            `"${l.email}"`,
            `"${l.city}"`,
            `"${l.state}"`,
            `"${l.source}"`,
            `"${l.status}"`,
            `"${l.created_at}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dealer_leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================
// DEALER LEAD CONVERSION WIZARD LOGIC
// ============================================================

let currentWizLead = null;
let currentWizStep = 1;
let selectedWizCallStatus = '';
let currentWizStep2Mode = 'COLLECT'; // 'COLLECT' or 'PLACE'
let wizProductsList = [];
let wizSelectedProducts = {}; // productId -> { id, name, price, qty }

// Open Wizard
function openLeadConversionWizard(leadId) {
    const cleanId = String(leadId || '').replace(/^LEAD-/i, '').trim();
    const lead = allLeads.find(l => l.lead_id === leadId || String(l.id) === String(leadId) || String(l.raw_id) === cleanId || String(l.lead_id).includes(cleanId));
    if (!lead) return;

    currentWizLead = lead;
    currentWizStep = 1;
    selectedWizCallStatus = '';
    currentWizStep2Mode = 'COLLECT';
    wizSelectedProducts = {};

    // Update Header
    const badge = document.getElementById('wizLeadBadge');
    const subtitle = document.getElementById('wizLeadSubtitle');
    if (badge) badge.textContent = lead.lead_id;
    if (subtitle) subtitle.textContent = `${lead.firm_name} (${lead.customer_name} - ${lead.phone_number})`;

    // Reset Step 1 Call Status Cards
    document.querySelectorAll('.wiz-call-card').forEach(card => {
        card.style.borderColor = '#E2E8F0';
        card.style.background = '#ffffff';
    });
    const nextBtn = document.getElementById('btnWizStep1Next');
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.6';
        nextBtn.style.cursor = 'not-allowed';
    }

    // Prefill Step 2 Collect Info Form
    if (document.getElementById('wizCollectShopName')) document.getElementById('wizCollectShopName').value = lead.firm_name || '';
    if (document.getElementById('wizCollectDealerName')) document.getElementById('wizCollectDealerName').value = lead.customer_name || '';
    if (document.getElementById('wizCollectContactNo')) document.getElementById('wizCollectContactNo').value = lead.phone_number || '';
    if (document.getElementById('wizCollectTaluk')) document.getElementById('wizCollectTaluk').value = lead.taluk || '';
    if (document.getElementById('wizCollectDistrict')) document.getElementById('wizCollectDistrict').value = lead.city || lead.district || '';
    if (document.getElementById('wizCollectState')) document.getElementById('wizCollectState').value = lead.state || 'Karnataka';
    if (document.getElementById('wizCollectPincode')) document.getElementById('wizCollectPincode').value = lead.pincode || '';
    if (document.getElementById('wizCollectNotes')) document.getElementById('wizCollectNotes').value = lead.notes || '';

    // Follow-up Date default (3 days from today)
    const fuDate = new Date();
    fuDate.setDate(fuDate.getDate() + 3);
    if (document.getElementById('wizCollectFollowUpDate')) document.getElementById('wizCollectFollowUpDate').value = fuDate.toISOString().slice(0, 10);

    // Prefill Step 2 Place Order Form
    if (document.getElementById('wizOrderShopName')) document.getElementById('wizOrderShopName').value = lead.firm_name || '';
    if (document.getElementById('wizOrderDealerName')) document.getElementById('wizOrderDealerName').value = lead.customer_name || '';
    if (document.getElementById('wizOrderContactNo')) document.getElementById('wizOrderContactNo').value = lead.phone_number || '';
    if (document.getElementById('wizOrderAddress')) document.getElementById('wizOrderAddress').value = lead.city || lead.address || '';
    if (document.getElementById('wizOrderTaluk')) document.getElementById('wizOrderTaluk').value = lead.taluk || '';
    if (document.getElementById('wizOrderDistrict')) document.getElementById('wizOrderDistrict').value = lead.city || lead.district || '';
    if (document.getElementById('wizOrderState')) document.getElementById('wizOrderState').value = lead.state || 'Karnataka';
    if (document.getElementById('wizOrderPincode')) document.getElementById('wizOrderPincode').value = lead.pincode || '';
    if (document.getElementById('wizOrderGstNo')) document.getElementById('wizOrderGstNo').value = lead.gst_no || '';
    if (document.getElementById('wizOrderNearestVrl')) document.getElementById('wizOrderNearestVrl').value = lead.nearest_vrl || '';

    // Prefill Step 2 Not Received Form
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (document.getElementById('wizNotReceivedFollowUpDate')) document.getElementById('wizNotReceivedFollowUpDate').value = tomorrow.toISOString().slice(0, 10);
    if (document.getElementById('wizNotReceivedNotes')) document.getElementById('wizNotReceivedNotes').value = lead.notes || '';

    // Prefill Step 3 Order Form
    if (document.getElementById('wizPaymentDate')) document.getElementById('wizPaymentDate').value = new Date().toISOString().slice(0, 10);
    if (document.getElementById('wizAdvanceAmount')) document.getElementById('wizAdvanceAmount').value = '0';
    if (document.getElementById('wizOrderNotes')) document.getElementById('wizOrderNotes').value = '';

    // Go to Step 1
    goToWizStep(1);

    // Fetch Products in background
    fetchWizProducts();

    // Show Modal
    const modal = document.getElementById('wizardModal');
    if (modal) modal.style.display = 'flex';
}

function closeWizardModal() {
    const modal = document.getElementById('wizardModal');
    if (modal) modal.style.display = 'none';
}

// Step 1: Select Call Status
function selectWizCallStatus(status) {
    selectedWizCallStatus = status;

    document.querySelectorAll('.wiz-call-card').forEach(card => {
        card.style.borderColor = '#E2E8F0';
        card.style.background = '#ffffff';
    });

    const cardId = `wizCallCard_${status.replace(/\s+/g, '_')}`;
    const activeCard = document.getElementById(cardId);
    if (activeCard) {
        activeCard.style.borderColor = '#FF6B00';
        activeCard.style.background = '#FFF7ED';
    }

    const nextBtn = document.getElementById('btnWizStep1Next');
    if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    }
}

// Step Navigation
function goToWizStep(step) {
    if (step === 2 && !selectedWizCallStatus) {
        if (window.showAlert) window.showAlert('Required', 'Please select a call status first.', 'warning');
        return;
    }

    if (step === 3) {
        if (selectedWizCallStatus !== 'Received' || currentWizStep2Mode !== 'PLACE') {
            if (window.showAlert) window.showAlert('Invalid Step', 'Products order is only available when Place Order is selected.', 'warning');
            return;
        }

        // Validate Place Order step 2 required fields
        const shop = (document.getElementById('wizOrderShopName')?.value || '').trim();
        const dealer = (document.getElementById('wizOrderDealerName')?.value || '').trim();
        const phone = (document.getElementById('wizOrderContactNo')?.value || '').trim();
        const address = (document.getElementById('wizOrderAddress')?.value || '').trim();

        if (!shop || !dealer || !phone || !address) {
            if (window.showAlert) window.showAlert('Missing Information', 'Please fill in Shop Name, Dealer Name, Contact Number, and Address before proceeding to order products.', 'warning');
            else alert('Please fill in Shop Name, Dealer Name, Contact Number, and Address before proceeding.');
            return;
        }

        renderWizProductsGrid();
        recalcWizOrderTotals();
    }

    currentWizStep = step;

    // Toggle Steps display
    if (document.getElementById('wizStep1')) document.getElementById('wizStep1').style.display = step === 1 ? 'block' : 'none';
    if (document.getElementById('wizStep2')) document.getElementById('wizStep2').style.display = step === 2 ? 'block' : 'none';
    if (document.getElementById('wizStep3')) document.getElementById('wizStep3').style.display = step === 3 ? 'block' : 'none';

    // Step 2 Logic based on Call Status
    if (step === 2) {
        if (selectedWizCallStatus === 'Received') {
            if (document.getElementById('wizStep2ReceivedGroup')) document.getElementById('wizStep2ReceivedGroup').style.display = 'block';
            if (document.getElementById('wizStep2NotReceivedGroup')) document.getElementById('wizStep2NotReceivedGroup').style.display = 'none';
            setWizStep2Mode(currentWizStep2Mode);
        } else {
            if (document.getElementById('wizStep2ReceivedGroup')) document.getElementById('wizStep2ReceivedGroup').style.display = 'none';
            if (document.getElementById('wizStep2NotReceivedGroup')) document.getElementById('wizStep2NotReceivedGroup').style.display = 'block';
            const label = document.getElementById('wizNonReceivedStatusLabel');
            if (label) label.textContent = selectedWizCallStatus;
        }
    }

    // Update Progress Stepper UI
    updateWizStepperUI(step);
}

function updateWizStepperUI(step) {
    const ind1 = document.getElementById('wizStepIndicator1');
    const ind2 = document.getElementById('wizStepIndicator2');
    const ind3 = document.getElementById('wizStepIndicator3');
    const line1 = document.getElementById('wizStepLine1');
    const line2 = document.getElementById('wizStepLine2');

    // Reset styles
    [ind1, ind2, ind3].forEach(ind => {
        if (ind) {
            ind.style.color = '#94A3B8';
            ind.style.fontWeight = '600';
            const badge = ind.querySelector('span');
            if (badge) {
                badge.style.background = '#E2E8F0';
                badge.style.color = '#64748B';
            }
        }
    });

    if (line1) line1.style.background = step > 1 ? '#059669' : '#CBD5E1';
    if (line2) line2.style.background = step > 2 ? '#059669' : '#CBD5E1';

    // Highlight step 1
    if (step >= 1 && ind1) {
        ind1.style.color = step === 1 ? '#FF6B00' : '#059669';
        ind1.style.fontWeight = '700';
        const badge1 = ind1.querySelector('span');
        if (badge1) {
            badge1.style.background = step === 1 ? '#FF6B00' : '#059669';
            badge1.style.color = '#ffffff';
        }
    }

    // Highlight step 2
    if (step >= 2 && ind2) {
        ind2.style.color = step === 2 ? '#FF6B00' : '#059669';
        ind2.style.fontWeight = '700';
        const badge2 = ind2.querySelector('span');
        if (badge2) {
            badge2.style.background = step === 2 ? '#FF6B00' : '#059669';
            badge2.style.color = '#ffffff';
        }
    }

    // Highlight step 3
    if (step === 3 && ind3) {
        ind3.style.color = '#FF6B00';
        ind3.style.fontWeight = '700';
        const badge3 = ind3.querySelector('span');
        if (badge3) {
            badge3.style.background = '#FF6B00';
            badge3.style.color = '#ffffff';
        }
    }
}

// Step 2 Mode Toggle ('COLLECT' vs 'PLACE')
function setWizStep2Mode(mode) {
    currentWizStep2Mode = mode;

    const btnCollect = document.getElementById('btnWizChoiceCollect');
    const btnPlace = document.getElementById('btnWizChoicePlace');
    const formCollect = document.getElementById('wizCollectInfoForm');
    const formPlace = document.getElementById('wizPlaceOrderForm');

    if (mode === 'COLLECT') {
        if (btnCollect) {
            btnCollect.style.borderColor = '#FF6B00';
            btnCollect.style.background = '#FFF7ED';
            btnCollect.style.color = '#C2410C';
        }
        if (btnPlace) {
            btnPlace.style.borderColor = '#CBD5E1';
            btnPlace.style.background = '#F8FAFC';
            btnPlace.style.color = '#475569';
        }
        if (formCollect) formCollect.style.display = 'block';
        if (formPlace) formPlace.style.display = 'none';
    } else {
        if (btnPlace) {
            btnPlace.style.borderColor = '#059669';
            btnPlace.style.background = '#ECFDF5';
            btnPlace.style.color = '#047857';
        }
        if (btnCollect) {
            btnCollect.style.borderColor = '#CBD5E1';
            btnCollect.style.background = '#F8FAFC';
            btnCollect.style.color = '#475569';
        }
        if (formCollect) formCollect.style.display = 'none';
        if (formPlace) formPlace.style.display = 'block';
    }
}

// Step 3 Product Management
async function fetchWizProducts() {
    try {
        const res = await fetch(`${window.API_URL}/products`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (res.ok) {
            wizProductsList = await res.json();
        } else {
            wizProductsList = [];
        }
    } catch (e) {
        console.warn('Error fetching wizard products:', e);
        wizProductsList = [];
    }
}

function renderWizProductsGrid() {
    const grid = document.getElementById('wizProductsGrid');
    if (!grid) return;

    const query = (document.getElementById('wizProductSearch')?.value || '').toLowerCase().trim();

    const filtered = wizProductsList.filter(p => !query || (p.name || '').toLowerCase().includes(query) || (p.sku || '').toLowerCase().includes(query));

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:#94a3b8;">No products found in catalog.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const pId = p.product_id || p.id;
        const price = parseFloat(p.dealer_price) > 0 ? parseFloat(p.dealer_price) : parseFloat(p.selling_price || 0);
        const isSelected = !!wizSelectedProducts[pId];
        const qty = isSelected ? wizSelectedProducts[pId].qty : 1;

        return `
            <div style="background:#ffffff;border:2px solid ${isSelected ? '#FF6B00' : '#E2E8F0'};border-radius:10px;padding:0.75rem;cursor:pointer;transition:all 0.15s ease;" onclick="toggleWizProduct('${pId}', '${escapeHtml(p.name)}', ${price})">
                <div style="font-weight:700;font-size:0.825rem;color:#0F172A;margin-bottom:0.25rem;">${escapeHtml(p.name)}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-size:0.85rem;font-weight:800;color:#FF6B00;">₹${price.toLocaleString('en-IN')}.00</span>
                    <div style="display:flex;align-items:center;gap:4px;" onclick="event.stopPropagation();">
                        <button type="button" onclick="updateWizQty('${pId}', -1, '${escapeHtml(p.name)}', ${price})" style="width:24px;height:24px;border:1px solid #CBD5E1;border-radius:4px;background:#fff;font-weight:700;cursor:pointer;">-</button>
                        <span style="font-weight:800;font-size:0.8rem;width:24px;text-align:center;">${qty}</span>
                        <button type="button" onclick="updateWizQty('${pId}', 1, '${escapeHtml(p.name)}', ${price})" style="width:24px;height:24px;border:1px solid #CBD5E1;border-radius:4px;background:#fff;font-weight:700;cursor:pointer;">+</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function filterWizProducts() {
    renderWizProductsGrid();
}

function toggleWizProduct(pId, name, price) {
    if (wizSelectedProducts[pId]) {
        delete wizSelectedProducts[pId];
    } else {
        wizSelectedProducts[pId] = { id: pId, name: name, price: price, qty: 1 };
    }
    renderWizProductsGrid();
    recalcWizOrderTotals();
}

function updateWizQty(pId, delta, name, price) {
    if (!wizSelectedProducts[pId]) {
        if (delta > 0) {
            wizSelectedProducts[pId] = { id: pId, name: name, price: price, qty: 1 };
        }
    } else {
        wizSelectedProducts[pId].qty += delta;
        if (wizSelectedProducts[pId].qty <= 0) {
            delete wizSelectedProducts[pId];
        }
    }
    renderWizProductsGrid();
    recalcWizOrderTotals();
}

function updateWizPrice(pId, newPrice) {
    const val = parseFloat(newPrice);
    const validPrice = (!isNaN(val) && val >= 0) ? val : 0;
    if (wizSelectedProducts[pId]) {
        wizSelectedProducts[pId].price = validPrice;

        // Update line total display for this item
        const lineTotalElem = document.getElementById(`wizLineTotal_${pId}`);
        const lineTotal = validPrice * wizSelectedProducts[pId].qty;
        if (lineTotalElem) {
            lineTotalElem.textContent = `₹${lineTotal.toLocaleString('en-IN')}.00`;
        }

        // Recalculate subtotal & balance displays without re-rendering inputs to preserve focus
        updateWizSummaryTotalsOnly();
    }
}

function updateWizSummaryTotalsOnly() {
    const items = Object.values(wizSelectedProducts);
    let subTotal = 0;
    items.forEach(item => {
        subTotal += (item.price * item.qty);
    });

    const totalDisp = document.getElementById('wizTotalAmountDisplay');
    const advanceInput = document.getElementById('wizAdvanceAmount');
    const balDisp = document.getElementById('wizBalanceAmountDisplay');

    const advanceVal = parseFloat(advanceInput?.value || 0) || 0;
    const balanceVal = Math.max(0, subTotal - advanceVal);

    if (totalDisp) totalDisp.textContent = `₹${subTotal.toLocaleString('en-IN')}.00`;
    if (balDisp) balDisp.textContent = `₹${balanceVal.toLocaleString('en-IN')}.00`;
}

function recalcWizOrderTotals() {
    const listContainer = document.getElementById('wizSelectedItemsList');
    const countBadge = document.getElementById('wizItemCountBadge');
    const items = Object.values(wizSelectedProducts);

    let subTotal = 0;
    if (items.length === 0) {
        if (listContainer) listContainer.innerHTML = `<div style="color:#94a3b8;font-style:italic;">No products selected yet. Select products from grid above.</div>`;
        if (countBadge) countBadge.textContent = '0 Items Selected';
    } else {
        let html = '<table style="width:100%;border-collapse:collapse;">';
        items.forEach(item => {
            const lineTotal = item.price * item.qty;
            subTotal += lineTotal;
            html += `
                <tr style="border-bottom:1px solid #FED7AA;align-items:center;">
                    <td style="padding:6px 0;font-weight:700;color:#0F172A;vertical-align:middle;width:40%;">
                        ${escapeHtml(item.name)}
                    </td>
                    <td style="padding:6px 8px;vertical-align:middle;text-align:center;">
                        <div style="display:inline-flex;align-items:center;gap:3px;background:#FFFFFF;border:1px solid #CBD5E1;border-radius:6px;padding:3px 6px;box-shadow:0 1px 2px rgba(0,0,0,0.03);" title="Edit Unit Price (₹ / unit)">
                            <span style="font-size:0.75rem;color:#64748B;font-weight:700;">₹</span>
                            <input type="number" step="any" min="0" value="${item.price}" oninput="updateWizPrice('${item.id}', this.value)" style="width:80px;border:none;outline:none;font-weight:700;font-size:0.8rem;color:#0F172A;background:transparent;" placeholder="Unit Price">
                            <span style="font-size:0.7rem;color:#94A3B8;font-weight:600;">/ unit</span>
                        </div>
                    </td>
                    <td style="padding:6px 8px;text-align:center;font-weight:700;color:#475569;vertical-align:middle;font-size:0.825rem;">
                        x${item.qty}
                    </td>
                    <td style="padding:6px 0;text-align:right;font-weight:800;color:#FF6B00;vertical-align:middle;font-size:0.85rem;" id="wizLineTotal_${item.id}">
                        ₹${lineTotal.toLocaleString('en-IN')}.00
                    </td>
                </tr>`;
        });
        html += '</table>';
        if (listContainer) listContainer.innerHTML = html;
        if (countBadge) countBadge.textContent = `${items.length} Items Selected`;
    }

    updateWizSummaryTotalsOnly();
}

// ── Submit Collect Info (or Non-Received Call) ──
async function submitWizCollectInfo() {
    if (!currentWizLead) return;

    let notes = '';
    let followUpDate = '';
    let updatedFirm = currentWizLead.firm_name;
    let updatedCust = currentWizLead.customer_name;
    let updatedPhone = currentWizLead.phone_number;
    let updatedCity = currentWizLead.city;
    let updatedState = currentWizLead.state;

    if (selectedWizCallStatus === 'Received') {
        const shop = (document.getElementById('wizCollectShopName')?.value || '').trim();
        const dealer = (document.getElementById('wizCollectDealerName')?.value || '').trim();
        const phone = (document.getElementById('wizCollectContactNo')?.value || '').trim();
        const taluk = (document.getElementById('wizCollectTaluk')?.value || '').trim();
        const district = (document.getElementById('wizCollectDistrict')?.value || '').trim();
        const state = (document.getElementById('wizCollectState')?.value || '').trim();
        const pincode = (document.getElementById('wizCollectPincode')?.value || '').trim();
        notes = (document.getElementById('wizCollectNotes')?.value || '').trim();
        followUpDate = document.getElementById('wizCollectFollowUpDate')?.value || '';

        if (!shop || !dealer || !phone) {
            if (window.showAlert) window.showAlert('Required', 'Please fill in Shop Name, Dealer Name, and Contact Number.', 'warning');
            else alert('Please fill in Shop Name, Dealer Name, and Contact Number.');
            return;
        }

        updatedFirm = shop;
        updatedCust = dealer;
        updatedPhone = phone;
        updatedCity = district || taluk || currentWizLead.city;
        updatedState = state || currentWizLead.state;

        currentWizLead.firm_name = shop;
        currentWizLead.customer_name = dealer;
        currentWizLead.phone_number = phone;
        currentWizLead.taluk = taluk;
        currentWizLead.district = district;
        currentWizLead.city = updatedCity;
        currentWizLead.state = updatedState;
        currentWizLead.pincode = pincode;
        currentWizLead.status = 'FOLLOWUP';
    } else {
        followUpDate = document.getElementById('wizNotReceivedFollowUpDate')?.value || '';
        notes = (document.getElementById('wizNotReceivedNotes')?.value || '').trim();
        currentWizLead.status = 'FOLLOWUP';
    }

    const fullNotes = notes ? `[Call Status: ${selectedWizCallStatus}] ${notes}` : `[Call Status: ${selectedWizCallStatus}]`;
    currentWizLead.notes = fullNotes;
    if (followUpDate) {
        currentWizLead.next_followup_date = followUpDate;
        currentWizLead.follow_up_date = followUpDate;
    }

    // Send update to Backend API
    try {
        const realId = currentWizLead.raw_id || currentWizLead.id;
        const res = await fetch(`${API_LEADS_BASE}/${realId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customer_name: updatedCust,
                firm_name: updatedFirm,
                phone_number: updatedPhone,
                city: updatedCity,
                state: updatedState,
                district: currentWizLead.district,
                pincode: currentWizLead.pincode,
                status: 'FOLLOWUP',
                next_followup_date: followUpDate || null,
                notes: fullNotes
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('API update lead info error:', res.status, errData);
            if (window.showAlert) window.showAlert('Error', errData.message || 'Failed to update lead info on server.', 'error');
            return;
        }

        // Add note to local lead object so details modal displays immediately
        if (!Array.isArray(currentWizLead.notes_history)) {
            currentWizLead.notes_history = [];
        }
        currentWizLead.notes_history.unshift({
            note: fullNotes,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.warn('API update lead info warning:', e);
    }

    closeWizardModal();
    applyLeadFilters();

    if (window.showAlert) {
        window.showAlert('Submitted!', `Dealer lead enquiry details updated successfully.`, 'success');
    } else {
        alert('Dealer lead enquiry details updated successfully.');
    }
}

// ── Submit Place Order and Convert to Dealer ──
async function submitWizPlaceOrderAndConvert() {
    if (!currentWizLead) return;

    const items = Object.values(wizSelectedProducts);
    if (items.length === 0) {
        if (window.showAlert) window.showAlert('No Products Selected', 'Please select at least 1 product to place an order.', 'warning');
        else alert('Please select at least 1 product to place an order.');
        return;
    }

    const shopName = (document.getElementById('wizOrderShopName')?.value || '').trim();
    const dealerName = (document.getElementById('wizOrderDealerName')?.value || '').trim();
    const phone = (document.getElementById('wizOrderContactNo')?.value || '').trim();
    const address = (document.getElementById('wizOrderAddress')?.value || '').trim();
    const taluk = (document.getElementById('wizOrderTaluk')?.value || '').trim();
    const district = (document.getElementById('wizOrderDistrict')?.value || '').trim();
    const state = (document.getElementById('wizOrderState')?.value || '').trim();
    const pincode = (document.getElementById('wizOrderPincode')?.value || '').trim();
    const gstNo = (document.getElementById('wizOrderGstNo')?.value || '').trim();
    const nearestVrl = (document.getElementById('wizOrderNearestVrl')?.value || '').trim();

    const deliveryType = document.getElementById('wizDeliveryType')?.value || 'VRL Logistics';
    const paymentMethod = document.getElementById('wizPaymentMethod')?.value || 'Bank Transfer';
    const paymentDate = document.getElementById('wizPaymentDate')?.value || new Date().toISOString().slice(0, 10);
    const advanceAmount = parseFloat(document.getElementById('wizAdvanceAmount')?.value || 0) || 0;
    const orderNotes = (document.getElementById('wizOrderNotes')?.value || '').trim();

    if (!shopName || !dealerName || !phone || !address) {
        if (window.showAlert) window.showAlert('Required Fields', 'Please fill in Shop Name, Dealer Name, Contact Number, and Address.', 'warning');
        else alert('Please fill in Shop Name, Dealer Name, Contact Number, and Address.');
        return;
    }

    let subTotal = 0;
    items.forEach(i => subTotal += (i.price * i.qty));
    const balanceAmount = Math.max(0, subTotal - advanceAmount);

    const submitBtn = document.getElementById('btnWizConvertSubmit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Converting & Placing Order...`;
    }

    try {
        // Step 1: Create Dealer in Backend DB
        let dealerId = null;
        try {
            const dealerRes = await fetch(`${window.API_URL}/dealers`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firm_name: shopName,
                    dealer_name: dealerName,
                    phone: phone,
                    email: currentWizLead.email || '',
                    address: address,
                    city: district || taluk || address,
                    taluk: taluk,
                    district: district,
                    state: state || 'Karnataka',
                    pincode: pincode,
                    gst_no: gstNo,
                    nearest_vrl: nearestVrl,
                    status: 'Active'
                })
            });

            if (dealerRes.ok) {
                const dData = await dealerRes.json();
                dealerId = dData.dealer_id || dData.id || dData.insertId;
            }
        } catch (e) {
            console.warn('Dealer API create warning:', e);
        }

        if (!dealerId) {
            dealerId = Date.now();
        }

        // Step 2: Create Order for Dealer in Backend DB
        const orderPayload = {
            dealer_id: dealerId,
            items: items.map(i => ({
                product_id: i.id,
                name: i.name,
                quantity: i.qty,
                price: i.price,
                discount: 0,
                total_price: i.price * i.qty
            })),
            total_amount: subTotal,
            advance_amount: advanceAmount,
            balance_amount: balanceAmount,
            payment_type: advanceAmount >= subTotal ? 'full' : advanceAmount > 0 ? 'partial' : 'no_advance',
            payment_method: paymentMethod,
            payment_date: paymentDate,
            order_date: paymentDate,
            delivery_type: deliveryType,
            notes: orderNotes ? `${orderNotes} (Converted from Lead ${currentWizLead.lead_id})` : `Converted from Lead ${currentWizLead.lead_id}`
        };

        try {
            await fetch(`${window.API_URL}/dealers/${dealerId}/orders`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderPayload)
            });
        } catch (e) {
            console.warn('Order API create warning:', e);
        }

        // Step 3: Update Lead Status to CONVERTED in Backend DB
        const realLeadId = currentWizLead.raw_id || currentWizLead.id;
        try {
            await fetch(`${API_LEADS_BASE}/${realLeadId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customer_name: dealerName,
                    firm_name: shopName,
                    phone_number: phone,
                    status: 'CONVERTED'
                })
            });
        } catch (e) {
            console.warn('Lead status update API warning:', e);
        }

        currentWizLead.status = 'CONVERTED';
        currentWizLead.firm_name = shopName;
        currentWizLead.customer_name = dealerName;
        currentWizLead.phone_number = phone;

        // Also sync item in allLeads list
        const matchLead = allLeads.find(l => String(l.raw_id) === String(realLeadId) || String(l.id) === String(realLeadId) || l.lead_id === currentWizLead.lead_id);
        if (matchLead) {
            matchLead.status = 'CONVERTED';
            matchLead.firm_name = shopName;
            matchLead.customer_name = dealerName;
            matchLead.phone_number = phone;
        }

        closeWizardModal();
        applyLeadFilters();

        if (window.showAlert) {
            window.showAlert('Converted Successfully!', `Lead "${shopName}" converted to Dealer and Order of ₹${subTotal.toLocaleString('en-IN')} added to Dealer Orders!`, 'success');
        } else {
            alert(`Lead "${shopName}" converted to Dealer and Order of ₹${subTotal.toLocaleString('en-IN')} added to Dealer Orders!`);
        }
    } catch (err) {
        console.error('Wizard convert & place order error:', err);
        currentWizLead.status = 'CONVERTED';
        closeWizardModal();
        applyLeadFilters();
        if (window.showAlert) window.showAlert('Converted!', `Lead converted to Dealer and Order created.`, 'success');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-user-check" style="margin-right:4px;"></i> Submit & Convert to Dealer`;
        }
    }
}

// Helper escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ── Explicit Window Bindings ──
window.fetchDealerLeads = fetchDealerLeads;
window.applyLeadFilters = applyLeadFilters;
window.filterDealerLeads = filterDealerLeads;
window.syncLeadSearch = syncLeadSearch;
window.resetLeadFilters = resetLeadFilters;
window.renderLeadsTable = renderLeadsTable;
window.updatePaginationInfo = updatePaginationInfo;
window.changeLeadsPage = changeLeadsPage;
window.changeLeadsPageSize = changeLeadsPageSize;
window.toggleSelectLead = toggleSelectLead;
window.toggleSelectAllLeads = toggleSelectAllLeads;
window.updateSelectedBadge = updateSelectedBadge;
window.openAddLeadModal = openAddLeadModal;
window.openEditLeadModal = openEditLeadModal;
window.closeLeadModal = closeLeadModal;
window.saveLeadForm = saveLeadForm;
window.convertToDealer = convertToDealer;
window.deleteLead = deleteLead;
window.exportLeadsCSV = exportLeadsCSV;
window.openLeadConversionWizard = openLeadConversionWizard;
window.closeWizardModal = closeWizardModal;
window.selectWizCallStatus = selectWizCallStatus;
window.goToWizStep = goToWizStep;
window.setWizStep2Mode = setWizStep2Mode;
window.fetchWizProducts = fetchWizProducts;
window.renderWizProductsGrid = renderWizProductsGrid;
window.filterWizProducts = filterWizProducts;
window.toggleWizProduct = toggleWizProduct;
window.updateWizQty = updateWizQty;
window.updateWizPrice = updateWizPrice;
window.updateWizSummaryTotalsOnly = updateWizSummaryTotalsOnly;
window.recalcWizOrderTotals = recalcWizOrderTotals;
window.submitWizCollectInfo = submitWizCollectInfo;
window.submitWizPlaceOrderAndConvert = submitWizPlaceOrderAndConvert;

// ── Lead Details Modal logic ──
// ── Lead Details Modal logic ──
function renderLeadDetailsBody(lead, numericId) {
    const body = document.getElementById('leadDetailsModalBody');
    if (!body) return;

    const leadCode = `LEAD-${numericId || lead.raw_id || lead.id || '000'}`;
    const custName = lead.customer_name || lead.name || 'N/A';
    const firmName = lead.firm_name || lead.business_name || custName || 'Dealer Lead';
    const phone = lead.phone_number || lead.phone || 'N/A';
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');

    const titleElem = document.getElementById('detailModalTitle');
    const subTitleElem = document.getElementById('detailModalSubTitle');
    if (titleElem) titleElem.textContent = `${firmName} (${leadCode})`;
    if (subTitleElem) subTitleElem.textContent = `Contact: ${custName} | ${phone}`;

    // Helper to check if a note string is a system assignment/update note
    const isSystemNote = (noteStr) => {
        if (!noteStr) return true;
        const text = String(noteStr).trim();
        if (text.startsWith('Lead details updated.')) return true;
        if (text.startsWith('Assigned to')) return true;
        if (text.startsWith('Lead assigned')) return true;
        if (text.startsWith('Lead transferred')) return true;
        if (text.startsWith('Lead created')) return true;
        if (text.startsWith('Scheduled via')) return true;
        if (text.includes('Transferred for Dealer Management')) return true;
        return false;
    };

    // Determine actual interaction note taken from lead
    let noteText = '';
    if (Array.isArray(lead.notes_history) && lead.notes_history.length > 0) {
        const userNotes = lead.notes_history.filter(n => n && n.note && !isSystemNote(n.note));
        if (userNotes.length > 0) {
            noteText = userNotes[0].note;
        }
    }
    if (!noteText || isSystemNote(noteText)) {
        if (lead.feedback && lead.feedback !== '-' && !isSystemNote(lead.feedback)) {
            noteText = lead.feedback;
        } else if (lead.notes && !isSystemNote(lead.notes)) {
            noteText = lead.notes;
        }
    }
    if (!noteText || isSystemNote(noteText)) {
        noteText = 'No notes or interaction remarks recorded yet.';
    }

    let html = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
            <!-- Top Summary Card -->
            <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:1.25rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex;align-items:center;gap:1rem;">
                    <div style="width:52px;height:52px;border-radius:12px;background:#FFF7ED;color:#FF6B00;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;border:1px solid #FFEDD5;">
                        ${escapeHtml(firmName.charAt(0).toUpperCase())}
                    </div>
                    <div>
                        <div style="font-size:1.15rem;font-weight:800;color:#0F172A;">${escapeHtml(firmName)}</div>
                        <div style="font-size:0.85rem;color:#64748B;display:flex;align-items:center;gap:0.75rem;margin-top:0.2rem;">
                            <span><i class="fa-solid fa-user" style="margin-right:4px;color:#94A3B8;"></i>${escapeHtml(custName)}</span>
                            <span><i class="fa-solid fa-phone" style="margin-right:4px;color:#059669;"></i>${escapeHtml(phone)}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
                    <span style="font-size:0.75rem;font-weight:800;padding:0.3rem 0.75rem;border-radius:9999px;background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE;">
                        STATUS: ${escapeHtml((lead.status || 'NEW').toUpperCase())}
                    </span>
                    <span style="font-size:0.75rem;font-weight:800;padding:0.3rem 0.75rem;border-radius:9999px;background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;">
                        SOURCE: ${escapeHtml((lead.source || 'WHATSAPP').toUpperCase())}
                    </span>
                    ${cleanPhone ? `
                        <a href="https://wa.me/${cleanPhone}" target="_blank" style="padding:0.4rem 0.85rem;background:#25D366;color:#ffffff;border-radius:8px;font-size:0.8rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
                            <i class="fa-brands fa-whatsapp"></i> WhatsApp
                        </a>
                        <a href="tel:${cleanPhone}" style="padding:0.4rem 0.85rem;background:#0284C7;color:#ffffff;border-radius:8px;font-size:0.8rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
                            <i class="fa-solid fa-phone"></i> Call
                        </a>
                    ` : ''}
                </div>
            </div>

            <!-- Details 2-Column Grid -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(380px, 1fr));gap:1.25rem;">
                
                <!-- Card 1: Contact & Business Details -->
                <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:0.9rem;font-weight:800;color:#0F172A;margin-bottom:1rem;display:flex;align-items:center;gap:8px;border-bottom:1px solid #F1F5F9;padding-bottom:0.6rem;">
                        <i class="fa-solid fa-building-user" style="color:#FF6B00;"></i> Business & Contact Details
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.85rem;font-size:0.825rem;">
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Firm / Shop Name</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(firmName)}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Contact Person</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(custName)}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Phone Number</span>
                            <span style="font-weight:700;color:#059669;">${escapeHtml(phone)}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Email Address</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.email || 'N/A')}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">GST Number</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.gst_no || lead.gst_number || 'Unregistered')}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Nearest VRL Branch</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.nearest_vrl || 'N/A')}</span>
                        </div>
                    </div>
                </div>

                <!-- Card 2: Location & Address -->
                <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:0.9rem;font-weight:800;color:#0F172A;margin-bottom:1rem;display:flex;align-items:center;gap:8px;border-bottom:1px solid #F1F5F9;padding-bottom:0.6rem;">
                        <i class="fa-solid fa-location-dot" style="color:#3B82F6;"></i> Location & Address
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.85rem;font-size:0.825rem;">
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">City / Village</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.city || 'N/A')}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Taluk</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.taluk || 'N/A')}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">District</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.district || 'N/A')}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">State</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.state || 'Karnataka')}</span>
                        </div>
                        <div style="grid-column: span 2;">
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Pincode</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.pincode || lead.pin_code || 'N/A')}</span>
                        </div>
                    </div>
                </div>

                <!-- Card 3: Assignment & System Metadata -->
                <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:0.9rem;font-weight:800;color:#0F172A;margin-bottom:1rem;display:flex;align-items:center;gap:8px;border-bottom:1px solid #F1F5F9;padding-bottom:0.6rem;">
                        <i class="fa-solid fa-user-gear" style="color:#8B5CF6;"></i> Assignment & Team Metadata
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.85rem;font-size:0.825rem;">
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Assigned Dealer Manager</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.assigned_to_name || lead.assigned_name || 'Unassigned')}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Language Preference</span>
                            <span style="font-weight:700;color:#0F172A;">${escapeHtml(lead.language || 'EN')}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Created Date</span>
                            <span style="font-weight:700;color:#0F172A;">${formatLeadDate(lead.created_at)}</span>
                        </div>
                        <div>
                            <span style="color:#64748B;display:block;font-size:0.75rem;font-weight:600;">Last Updated</span>
                            <span style="font-weight:700;color:#0F172A;">${formatLeadDate(lead.updated_at || lead.created_at)}</span>
                        </div>
                    </div>
                </div>

                <!-- Card 4: Recent Notes & Follow-up Date -->
                <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:0.9rem;font-weight:800;color:#0F172A;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border-bottom:1px solid #F1F5F9;padding-bottom:0.6rem;">
                        <span><i class="fa-solid fa-clipboard-list" style="color:#F59E0B;margin-right:6px;"></i> Follow-up Notes & Remarks</span>
                        ${(lead.next_followup_date || lead.follow_up_date) ? `
                            <span style="font-size:0.75rem;font-weight:700;background:#FFF7ED;color:#C2410C;padding:0.25rem 0.65rem;border-radius:6px;border:1px solid #FFEDD5;">
                                <i class="fa-solid fa-calendar-check" style="margin-right:4px;"></i> Follow-up: ${formatLeadDate(lead.next_followup_date || lead.follow_up_date)}
                            </span>
                        ` : ''}
                    </div>
                    <div style="font-size:0.825rem;color:#0F172A;background:#F8FAFC;padding:0.75rem 1rem;border-radius:8px;border:1px solid #E2E8F0;min-height:60px;line-height:1.5;font-weight:600;">
                        ${escapeHtml(noteText)}
                    </div>
                </div>
            </div>

            ${Array.isArray(lead.order_history) && lead.order_history.length > 0 ? `
                <!-- Card 5: Order History -->
                <div style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:0.9rem;font-weight:800;color:#0F172A;margin-bottom:1rem;display:flex;align-items:center;gap:8px;border-bottom:1px solid #F1F5F9;padding-bottom:0.6rem;">
                        <i class="fa-solid fa-boxes-packing" style="color:#10B981;"></i> Associated Orders History (${lead.order_history.length})
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;text-align:left;">
                            <thead>
                                <tr style="background:#F8FAFC;color:#64748B;font-weight:700;border-bottom:1px solid #E2E8F0;">
                                    <th style="padding:0.6rem 0.75rem;">ORDER ID</th>
                                    <th style="padding:0.6rem 0.75rem;">DATE</th>
                                    <th style="padding:0.6rem 0.75rem;">PRODUCTS</th>
                                    <th style="padding:0.6rem 0.75rem;">AMOUNT</th>
                                    <th style="padding:0.6rem 0.75rem;">STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lead.order_history.map(o => `
                                    <tr style="border-bottom:1px solid #F1F5F9;">
                                        <td style="padding:0.6rem 0.75rem;font-weight:700;color:#0F172A;">ORD-${o.order_id}</td>
                                        <td style="padding:0.6rem 0.75rem;color:#64748B;">${formatLeadDate(o.created_at)}</td>
                                        <td style="padding:0.6rem 0.75rem;font-weight:600;">${escapeHtml(o.items_summary || 'Order Items')}</td>
                                        <td style="padding:0.6rem 0.75rem;font-weight:700;color:#059669;">₹${Number(o.total_amount || 0).toLocaleString('en-IN')}</td>
                                        <td style="padding:0.6rem 0.75rem;">
                                            <span style="padding:0.15rem 0.5rem;border-radius:4px;font-size:0.725rem;font-weight:700;background:#ECFDF5;color:#059669;">
                                                ${escapeHtml((o.order_status || 'PENDING').toUpperCase())}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        </div>`;

    body.innerHTML = html;
}

async function openLeadDetailsModal(leadId) {
    const modal = document.getElementById('leadDetailsModal');
    if (!modal) return;

    const numericId = String(leadId || '').replace(/^LEAD-/i, '').trim();

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.setProperty('display', 'flex', 'important');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    // Local fallback search
    let lead = allLeads.find(l => String(l.raw_id) === String(numericId) || String(l.id) === String(numericId) || String(l.lead_id).includes(numericId)) || {};

    // Render immediately with local data
    renderLeadDetailsBody(lead, numericId);

    // Async fetch full updated lead details
    try {
        const response = await fetch(`${API_LEADS_BASE}/${numericId}`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        if (response.ok) {
            const apiData = await response.json();
            lead = { ...lead, ...apiData };
            renderLeadDetailsBody(lead, numericId);
        }
    } catch (err) {
        console.warn('Fetch lead by ID error:', err);
    }
}

function closeLeadDetailsModal() {
    const modal = document.getElementById('leadDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('hidden');
        modal.style.setProperty('display', 'none', 'important');
    }
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
}

window.openLeadDetailsModal = openLeadDetailsModal;
window.closeLeadDetailsModal = closeLeadDetailsModal;
