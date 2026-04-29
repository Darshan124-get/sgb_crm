// ============================================================
// components.js — Shared UI: Sidebar Loader, Search, Auth
// Loaded on every protected page. Must come AFTER config.js.
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const sidebarContainer = document.getElementById('sidebar-container');

    // ── Sidebar Injection ──
    if (sidebarContainer) {
        const user = window.getCurrentUser();           // ← uses JWT decode as fallback
        const role = (user.role || '').toLowerCase();

        const sidebarMap = {
            admin: 'sidebar-admin.html',
            sales: 'sidebar-sales.html',
            billing: 'sidebar-billing.html',
            packing: 'sidebar-packing.html',
            shipping: 'sidebar-shipping.html'
        };

        const sidebarFile = sidebarMap[role] || 'sidebar-sales.html'; // Default to sales if unknown

        try {
            // ROOT_PATH is either '' or '../../' etc.
            const response = await fetch(`${window.ROOT_PATH}components/${sidebarFile}`);
            if (response.ok) {
                sidebarContainer.innerHTML = await response.text();
                initSidebar(sidebarContainer.querySelectorAll('a'));
            } else {
                console.error(`Sidebar file not found: ${sidebarFile}`);
            }
        } catch (err) {
            console.error('Failed to load sidebar:', err);
        }
    }

    // ── Lead Nav (Lead management pages only) ──
    const leadNavPlaceholder = document.getElementById('lead-nav-placeholder');
    if (leadNavPlaceholder) {
        await loadComponent(leadNavPlaceholder, `${window.ROOT_PATH}components/lead-nav.html`, initLeadNav);
    }

    // ── Global Search ──
    initGlobalSearch();

    // ── Update Profile Name ──
    const user = window.getCurrentUser();
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl && user.name) {
        profileNameEl.textContent = user.name;
    }
});

// ─── Component Loader ────────────────────────────────────────
async function loadComponent(placeholder, url, callback) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Component not found: ${url}`);
        const html = await response.text();
        placeholder.innerHTML = html;
        if (callback) callback();
    } catch (err) {
        console.error(`Failed to load component from ${url}:`, err);
    }
}

// ─── Sidebar Logic ───────────────────────────────────────────
function initSidebar(links) {
    const currentPath = window.location.pathname;

    links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('http') || href.startsWith('javascript:')) return;

        // Prepend ROOT_PATH to links that are not absolute
        if (!href.startsWith('/') && !href.includes('://')) {
            link.href = `${window.ROOT_PATH}${href}`;
        }

        // Highlight active link
        // Use full URL comparison for reliability
        try {
            const linkUrl = new URL(link.href);
            if (currentPath === linkUrl.pathname) {
                link.classList.add('active');
                const navItem = link.closest('.nav-item');
                if (navItem) navItem.classList.add('active');
            }
        } catch (e) {
            if (currentPath.includes(href)) {
                link.classList.add('active');
            }
        }
    });

    // Logout binding
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.removeEventListener('click', window._logoutHandler);
        window._logoutHandler = e => {
            e.preventDefault();
            window.doLogout();
        };
        logoutBtn.addEventListener('click', window._logoutHandler);
    }
}

// ─── Global API URL ──────────────────────────────────────────
const API_URL = window.API_URL || 'http://localhost:5000/api';

// ─── Lead Stats Badge Updater ─────────────────────────────────
async function updateLeadStats() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/leads/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
        if (response.ok) {
            const stats = await response.json();
            const badgeMap = {
                'badge-followup': stats.followup,
                'badge-converted': stats.converted,
                'badge-lost': stats.lost,
                'badge-scheduled': stats.scheduled,
                'badge-manual': stats.manual
            };
            Object.entries(badgeMap).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = val || '0';
                    el.style.display = val > 0 ? 'inline-flex' : 'none';
                }
            });
        }
    } catch (err) { console.error('Error fetching stats:', err); }
}

// ─── Lead Navigation ──────────────────────────────────────────
function initLeadNav() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contentArea = document.getElementById('lead-content-area');
    if (!contentArea) return;

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const filter = tab.getAttribute('data-filter');
            if (filter === 'manual') {
                await loadComponent(contentArea, `${window.ROOT_PATH}components/manual-lead-form.html`, initManualLeadForm);
            } else {
                const filterConfig = {
                    all: {},
                    today: { is_today: 'true' },
                    unassigned: { is_unassigned: 'true' },
                    followup: { status: 'followup,interested,callback' },
                    converted: { status: 'converted' },
                    lost: { status: 'lost,not_interested' }
                };
                await loadComponent(contentArea, `${window.ROOT_PATH}components/lead-list.html`, () => initLeadList(filterConfig[filter] || {}));
            }
        });
    });

    updateLeadStats();
    const todayTab = document.querySelector('.nav-tab[data-filter="today"]') || document.querySelector('.nav-tab[data-filter="all"]');
    if (todayTab) todayTab.click();
}

// ─── Lead List Renderer ───────────────────────────────────────
async function initLeadList(filters = {}) {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;
    
    // ─── Filter Setup ───
    const searchInput = document.getElementById('leadSearch');
    if (searchInput && !searchInput.dataset.listenerSet) {
        searchInput.dataset.listenerSet = 'true';
        searchInput.oninput = window.debounce(() => {
            if (searchInput.value.trim().length > 0) {
                const allTab = document.querySelector('.nav-tab[data-filter="all"]');
                if (allTab && !allTab.classList.contains('active')) {
                    allTab.click();
                    return;
                }
            }
            initLeadList(window.currentBaseFilters);
        }, 500);
    }

    const statusF = document.getElementById('leadStatusFilter');
    const scoreF  = document.getElementById('leadScoreFilter');
    const dateF   = document.getElementById('leadDateFilter');
    const btnAll  = document.getElementById('btnFilterAll');

    if (statusF && !statusF.dataset.listenerSet) {
        statusF.dataset.listenerSet = 'true';
        statusF.onchange = () => initLeadList(window.currentBaseFilters);
    }
    if (scoreF && !scoreF.dataset.listenerSet) {
        scoreF.dataset.listenerSet = 'true';
        scoreF.onchange = () => initLeadList(window.currentBaseFilters);
    }
    if (dateF && !dateF.dataset.listenerSet) {
        dateF.dataset.listenerSet = 'true';
        dateF.onchange = () => initLeadList(window.currentBaseFilters);
    }
    if (btnAll && !btnAll.dataset.listenerSet) {
        btnAll.dataset.listenerSet = 'true';
        btnAll.onclick = () => {
            if (statusF) statusF.value = 'all';
            if (scoreF)  scoreF.value = 'all';
            if (dateF)   dateF.value = '';
            initLeadList(window.currentBaseFilters);
        };
    }

    tbody.innerHTML = '<tr><td colspan="10" class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading leads...</td></tr>';

    window.currentBaseFilters = filters; // Original context (e.g. {assigned_to: NULL})
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    
    // Start with base filters
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });

    // Overlay with dynamic UI filters
    if (statusF && statusF.value !== 'all') params.set('status', statusF.value);
    if (scoreF && scoreF.value !== 'all') params.set('score', scoreF.value);
    if (dateF && dateF.value) params.set('date', dateF.value);
    if (searchInput && searchInput.value) params.set('search', searchInput.value);

    try {
        const response = await fetch(`${API_URL}/leads?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('API Error');
        const leads = await response.json();

        if (!leads || leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No leads available.</td></tr>';
            return;
        }

        tbody.innerHTML = leads.map(lead => {
            const statusClass = lead.status === 'assigned' ? 'badge-assigned' : (lead.status === 'new' ? 'badge-unassigned' : 'badge-state');
            const scoreClass = `badge-score-${(lead.score || 'COLD').toLowerCase()}`;
            const date = new Date(lead.created_at).toLocaleDateString();
            const nameInitial = lead.customer_name ? lead.customer_name.charAt(0).toUpperCase() : '?';

            return `
            <tr onclick="viewLeadDetails(${lead.lead_id})" style="cursor:pointer;">
                <td><input type="checkbox" class="lead-checkbox" data-id="${lead.lead_id}" onclick="event.stopPropagation(); toggleLeadSelection(this)"></td>
                <td><div class="name-cell"><div class="name-initial">${nameInitial}</div>${lead.customer_name || 'Unknown'}</div></td>
                <td><span class="${statusClass}">${lead.status}</span></td>
                <td><span class="badge-score ${scoreClass}">${lead.score || 'COLD'}</span></td>
                <td>${lead.state || '-'}</td>
                <td><span class="language-tag">${lead.language || 'EN'}</span></td>
                <td>${lead.phone_number || '-'}</td>
                <td><div class="msg-trunk" title="${lead.first_message || ''}">${lead.first_message || '-'}</div></td>
                <td>${date}</td>
                <td>${lead.assigned_to_name || 'Unassigned'}</td>
            </tr>`;
        }).join('');

        // Bind Select All
        const selectAll = document.getElementById('selectAllLeads');
        if (selectAll) {
            selectAll.checked = false;
            selectAll.onclick = (e) => selectAllLeadsToggle(e.target);
        }
        updateBulkActionsBar();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Failed to load leads.</td></tr>';
    }
}

// ─── Lead Selection Logic ─────────────────────────────────────
window.currentSelectedLeadIds = [];

window.toggleLeadSelection = function (checkbox) {
    const id = parseInt(checkbox.getAttribute('data-id'));
    if (checkbox.checked) {
        if (!window.currentSelectedLeadIds.includes(id)) window.currentSelectedLeadIds.push(id);
    } else {
        window.currentSelectedLeadIds = window.currentSelectedLeadIds.filter(lid => lid !== id);
    }
    updateBulkActionsBar();
};

window.selectAllLeadsToggle = function (masterCheckbox) {
    const checkboxes = document.querySelectorAll('.lead-checkbox');
    window.currentSelectedLeadIds = [];
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
        if (cb.checked) {
            const id = parseInt(cb.getAttribute('data-id'));
            window.currentSelectedLeadIds.push(id);
        }
    });
    updateBulkActionsBar();
};

window.updateBulkActionsBar = function () {
    const bar = document.getElementById('bulkActionsBar');
    const countEl = document.getElementById('selectedCount');
    if (!bar) return;

    const user = window.getCurrentUser();
    const canManageBulk = ['admin', 'super-admin', 'sales'].includes((user.role || '').toLowerCase());

    if (window.currentSelectedLeadIds.length > 0 && canManageBulk) {
        bar.style.display = 'flex';
        if (countEl) countEl.textContent = `${window.currentSelectedLeadIds.length} Selected`;
    } else {
        bar.style.display = 'none';
        const selectAll = document.getElementById('selectAllLeads');
        if (selectAll) selectAll.checked = false;
    }
};

window.clearSelection = function () {
    window.currentSelectedLeadIds = [];
    document.querySelectorAll('.lead-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAllLeads');
    if (selectAll) selectAll.checked = false;
    updateBulkActionsBar();
};

// ─── Manual Bulk Assignment ──────────────────────────────────
window.openBulkAssignModal = async function () {
    const token = localStorage.getItem('token');
    try {
        // Fetch sales staff to choose from
        const response = await fetch(`${API_URL}/users?role=sales`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();

        const content = `
            <div style="padding: 1.5rem; background: #fff;">
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fas fa-users-gear" style="color: #16a34a; font-size: 1.25rem;"></i>
                    <p style="margin: 0; color: #166534; font-weight: 600;">Assigning ${window.currentSelectedLeadIds.length} leads</p>
                </div>

                <div class="form-group" style="margin-bottom: 2rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #475569; font-weight: 700; font-size: 0.875rem;">SELECT TEAM MEMBER</label>
                    <select id="bulkStaffSelect" class="form-control-premium" style="width: 100%; border: 1px solid #e2e8f0;">
                        <option value="">Choose a staff member...</option>
                        ${users.map(u => `<option value="${u.user_id}">${u.name} — ${u.language || 'General'}</option>`).join('')}
                    </select>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="performBulkAssign()" class="btn" style="flex: 2; height: 48px; background: #059669; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 700;">
                        <i class="fas fa-check-circle"></i> Confirm Assignment
                    </button>
                    <button onclick="window.hideModal()" class="btn btn-outline" style="flex: 1; height: 48px; font-weight: 600;">Cancel</button>
                </div>
            </div>
        `;
        window.showModal({ title: 'Manual Multi-Assignment', content, hideFooter: true });
    } catch (err) {
        window.showAlert("Error", "Failed to load staff list. Please try again.", "error");
    }
};

window.autoAssignSelected = async function () {
    if (window.currentSelectedLeadIds.length === 0) return window.showAlert("No Selection", "Please select at least one lead.", "info");

    if (!confirm(`Are you sure you want to let the system auto-assign these ${window.currentSelectedLeadIds.length} leads based on language?`)) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/leads/auto-assign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ leadIds: window.currentSelectedLeadIds })
        });

        if (response.ok) {
            const result = await response.json();
            window.currentSelectedLeadIds = [];
            initLeadList(window.currentFilters || {});
            updateLeadStats();
            window.showAlert("Success", `Auto-assignment complete: ${result.count} leads assigned.`, "success");
        } else {
            const err = await response.json();
            window.showAlert("Error", `Auto-assign failed: ${err.message}`, "error");
        }
    } catch (err) {
        window.showAlert("Network Error", "Network error during auto-assignment.", "error");
    }
};

window.performBulkAssign = async function () {
    const staffId = document.getElementById('bulkStaffSelect').value;
    if (!staffId) return alert('Please select a staff member.');

    const token = localStorage.getItem('token');
    const btn = document.querySelector('#globalModal .btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Assigning...';

    try {
        const response = await fetch(`${API_URL}/leads/bulk-assign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                leadIds: window.currentSelectedLeadIds,
                staffId: staffId
            })
        });

        if (response.ok) {
            window.currentSelectedLeadIds = [];
            window.hideModal();
            initLeadList(window.currentFilters || {});
            updateLeadStats();
            window.showAlert("Success", "Leads assigned successfully!", "success");
        } else {
            const err = await response.json();
            alert(`Error: ${err.message}`);
        }
    } catch (err) {
        alert('Failed to connect to server.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

// ─── Lead Detail View ─────────────────────────────────────────
async function viewLeadDetails(leadId) {
    if (window.currentViewingLeadId !== leadId) {
        window.timelineShowAll = false;
        window.historyShowAll = false;
    }
    window.currentViewingLeadId = leadId;
    const contentArea = document.getElementById('lead-content-area');
    if (contentArea) {
        await loadComponent(contentArea, `${window.ROOT_PATH}components/lead-details.html`, () => populateLeadDetails(leadId));
    }
}

async function populateLeadDetails(leadId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/leads/${leadId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
            const lead = await response.json();

            // ── Primary Field Mapping ──
            const fields = {
                leadDetailName: lead.customer_name,
                leadDetailPhone: lead.phone_number,
                leadDetailVillage: lead.city,
                leadDetailState: lead.state,
                leadDetailLanguage: lead.language || 'EN',
                leadDetailLanguageInfo: lead.language || 'English',
                leadDetailAssigned: lead.assigned_to_name || 'Unassigned',
                leadDetailAssignedId: lead.assigned_to || '',
                topCustomerNameDisplay: lead.customer_name,
                leadDetailSaleStatus: lead.status || 'New',
                leadDetailStatusSelect: lead.status || 'new',
                leadDetailScoreSelect: lead.score || 'cold',
                leadDetailCrop: lead.current_crop || '-',
                leadDetailAcreage: lead.acreage || '-',
                leadDetailFeedback: lead.feedback || '-',
                leadDetailAttempt: lead.call_attempts || '0',

                // Edit Inputs mapping
                editName: lead.customer_name,
                editPhone: lead.phone_number,
                editVillage: lead.city,
                editState: lead.state,
                editLanguage: lead.language || 'EN',
                editCrop: lead.current_crop,
                editAcreage: lead.acreage,
                editInterest: lead.interests ? lead.interests.map(i => i.product_name).join(', ') : '',
                editSaleStatus: lead.status,
                editFeedback: lead.feedback
            };

            Object.entries(fields).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) {
                    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.value = val || '';
                    else el.textContent = val || '-';
                }
            });

            // ── Order Visibility ──
            const orderFields = document.querySelectorAll('.order-only');
            const nonOrderFields = document.querySelectorAll('.non-order-fields');

            if (lead.order) {
                orderFields.forEach(el => el.style.display = 'block');
                nonOrderFields.forEach(el => el.style.display = 'none');

                const pEl = document.getElementById('leadDetailProducts');
                const aEl = document.getElementById('leadDetailAmount');
                const adEl = document.getElementById('leadDetailAdvance');
                const dEl = document.getElementById('leadDetailDue');

                if (pEl) pEl.textContent = lead.order.items_summary || 'Products Mapped';
                if (aEl) aEl.textContent = `₹${parseFloat(lead.order.total_amount).toLocaleString()}`;
                if (adEl) adEl.textContent = `₹${parseFloat(lead.order.advance_amount).toLocaleString()}`;
                if (dEl) dEl.textContent = `₹${parseFloat(lead.order.balance_amount).toLocaleString()}`;
            } else {
                orderFields.forEach(el => el.style.display = 'none');
                nonOrderFields.forEach(el => el.style.display = 'block');
            }

            // ── Interest Badges ──
            const interestContainer = document.getElementById('leadDetailInterest');
            if (interestContainer && lead.interests) {
                interestContainer.innerHTML = lead.interests.map(i => `<span class="badge-pill">${i.product_name}</span>`).join('') || '-';
            }

            // ── Follow-up Card ──
            const fDate = document.getElementById('leadDetailFollowupDate');
            const fAction = document.getElementById('leadDetailFollowupAction');
            if (lead.next_followup_date) {
                const dateObj = new Date(lead.next_followup_date);
                if (fDate) fDate.textContent = dateObj.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                if (fAction) fAction.textContent = "Scheduled call";
            } else {
                if (fDate) fDate.textContent = "No Schedule";
                if (fAction) fAction.textContent = "No pending action";
            }

            // ── Initials ──
            const avatar = document.getElementById('assigneeAvatar');
            if (avatar) {
                const nameStr = lead.assigned_to_name || '?';
                avatar.textContent = nameStr.charAt(0).toUpperCase();
            }

            // ── Purchase History ──
            const historyContainer = document.getElementById('purchaseHistoryContainer');
            if (historyContainer) {
                if (!window.historyShowAll) window.historyShowAll = false; // Initialize if not set

                if (lead.order_history && lead.order_history.length > 0) {
                    const originalHistoryCount = lead.order_history.length;
                    let displayHistory = lead.order_history;
                    const historyLimit = 3;

                    if (!window.historyShowAll && originalHistoryCount > historyLimit) {
                        displayHistory = lead.order_history.slice(0, historyLimit);
                    }

                    let historyHtml = displayHistory.map(order => `
                        <div class="history-item" style="padding: 1rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: start;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                    <span style="font-weight: 700; color: #1e293b;">${order.items_summary || 'Products'}</span>
                                    <span class="badge" style="background: ${order.order_status === 'delivered' ? '#dcfce7' : '#fef9c3'}; color: ${order.order_status === 'delivered' ? '#166534' : '#854d0e'}; font-size: 0.65rem;">${(order.order_status || 'Draft').toUpperCase()}</span>
                                </div>
                                <div style="font-size: 0.75rem; color: #64748b;">
                                     <i class="far fa-calendar-alt"></i> ${new Date(order.created_at).toLocaleDateString()} &bull; Order ID: ${window.formatOrderId(order.order_id, order.created_at)}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 800; color: #1e293b;">₹${parseFloat(order.total_amount).toLocaleString()}</div>
                                <div style="font-size: 0.7rem; color: #10b981;">Paid: ₹${parseFloat(order.advance_amount).toLocaleString()}</div>
                            </div>
                        </div>
                    `).join('');

                    if (originalHistoryCount > historyLimit) {
                        if (!window.historyShowAll) {
                            historyHtml += `
                                <div style="text-align: center; margin-top: 1rem;">
                                    <button onclick="viewFullHistory()" class="btn-text" style="color: var(--primary-color); font-weight: 700; font-size: 0.8125rem; background: none; border: none; cursor: pointer; width: 100%;">
                                        View All Orders (${originalHistoryCount})
                                    </button>
                                </div>
                            `;
                        } else {
                            historyHtml += `
                                <div style="text-align: center; margin-top: 1rem;">
                                    <button onclick="collapseHistory()" class="btn-text" style="color: #94a3b8; font-weight: 700; font-size: 0.8125rem; background: none; border: none; cursor: pointer; width: 100%;">
                                        Show Less
                                    </button>
                                </div>
                            `;
                        }
                    }
                    historyContainer.innerHTML = historyHtml;
                } else {
                    historyContainer.innerHTML = '<p class="text-muted text-center py-4">No previous orders found for this customer.</p>';
                }
            }

            // ── Load Timeline ──
            loadLeadTimeline(leadId);
        }
    } catch (err) { console.error('Lead detail error:', err); }
}

// ─── Lead Helpers ─────────────────────────────────────────────
function getScoreFromStatus(status) {
    const hotStatus = ['converted', 'interested'];
    const warmStatus = ['followup', 'callback', 'dealer'];
    const coldStatus = ['not_interested', 'lost', 'new'];

    if (hotStatus.includes(status)) return 'hot';
    if (warmStatus.includes(status)) return 'warm';
    if (coldStatus.includes(status)) return 'cold';
    return 'cold'; // Fallback
}

// ─── Lead Details Interaction ──────────────────────────────────
window.updateLeadFromHeader = async function () {
    const leadId = window.currentViewingLeadId;
    const token = localStorage.getItem('token');

    const status = document.getElementById('leadDetailStatusSelect').value;
    const scoreSelect = document.getElementById('leadDetailScoreSelect');

    // Auto-update score based on status
    const autoScore = getScoreFromStatus(status);
    scoreSelect.value = autoScore;

    const payload = {
        status: status,
        score: autoScore
    };

    try {
        const response = await fetch(`${API_URL}/leads/${leadId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            populateLeadDetails(leadId);
            window.showAlert("Updated", `Status set to ${payload.status}`, "success");
        }
    } catch (err) {
        console.error('Header update error:', err);
    }
};

window.toggleLeadEdit = function (sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const isEditing = section.classList.toggle('is-editing');
    section.querySelectorAll('.view-item').forEach(el => el.style.display = isEditing ? 'none' : '');
    section.querySelectorAll('.edit-item').forEach(el => el.style.display = isEditing ? 'block' : 'none');
};

window.saveLeadSection = async function (sectionId) {
    const leadId = window.currentViewingLeadId;
    const token = localStorage.getItem('token');
    const section = document.getElementById(sectionId);

    // Build payload based on section
    const payload = {};
    if (sectionId === 'farmerInfoSection') {
        payload.customer_name = document.getElementById('editName').value;
        payload.phone_number = document.getElementById('editPhone').value;
        payload.city = document.getElementById('editVillage').value;
        payload.state = document.getElementById('editState').value;
        payload.language = document.getElementById('editLanguage').value;
    } else if (sectionId === 'requirementSection') {
        payload.current_crop = document.getElementById('editCrop').value;
        payload.acreage = document.getElementById('editAcreage').value;
        // Interests might need a specialized endpoint or array formatting
        payload.interests_raw = document.getElementById('editInterest').value;
    } else if (sectionId === 'salesSection') {
        payload.status = document.getElementById('editSaleStatus').value;
        payload.feedback = document.getElementById('editFeedback').value;
    }

    try {
        const response = await fetch(`${API_URL}/leads/${leadId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            window.toggleLeadEdit(sectionId);
            populateLeadDetails(leadId);
            window.showAlert("Updated", "Lead information saved.", "success");
        } else {
            const err = await response.json();
            window.showAlert("Error", err.message || "Failed to update lead", "error");
        }
    } catch (err) {
        window.showAlert("Connection Error", "Check server connectivity", "error");
    }
};

window.rescheduleCallFromDetails = function () {
    const leadId = window.currentViewingLeadId;
    const content = `
        <div style="padding: 1rem;">
            <div class="form-group">
                <label>Next Call Date & Time</label>
                <input type="datetime-local" id="rescheduleDate" class="form-control-premium" style="width: 100%;">
            </div>
            <div class="form-group" style="margin-top: 1rem;">
                <label>Reason / Note</label>
                <textarea id="rescheduleNote" class="form-control-premium" placeholder="Reminder for next call..." style="width: 100%; height: 80px;"></textarea>
            </div>
            <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                <button onclick="performReschedule(${leadId})" class="btn" style="flex: 2; background: #ea580c; color: white;">Save Schedule</button>
                <button onclick="window.hideModal()" class="btn btn-outline" style="flex: 1;">Cancel</button>
            </div>
        </div>
    `;
    window.showModal({ title: 'Reschedule Follow-up', content, hideFooter: true });
};

window.performReschedule = async function (leadId) {
    const date = document.getElementById('rescheduleDate').value;
    const note = document.getElementById('rescheduleNote').value;
    if (!date) return alert('Please select a date.');

    const token = localStorage.getItem('token');
    try {
        // 1. Log the rescheduling as a note
        await fetch(`${API_URL}/leads/${leadId}/notes`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: `System: Call rescheduled for ${date}. Reason: ${note || 'None'}` })
        });

        // 2. Update the lead's next followup date and status
        await fetch(`${API_URL}/leads/${leadId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ next_followup_date: date, status: 'callback' })
        });

        window.hideModal();
        populateLeadDetails(leadId);
        window.showAlert("Scheduled", "Callback successfully scheduled.", "success");
    } catch (err) {
        window.showAlert("Error", "Failed to save schedule.", "error");
    }
};

window.viewFullTimeline = function () {
    window.timelineShowAll = true;
    if (window.currentViewingLeadId) loadLeadTimeline(window.currentViewingLeadId);
};

window.collapseTimeline = function () {
    window.timelineShowAll = false;
    if (window.currentViewingLeadId) loadLeadTimeline(window.currentViewingLeadId);
};

window.viewFullHistory = function () {
    window.historyShowAll = true;
    if (window.currentViewingLeadId) populateLeadDetails(window.currentViewingLeadId);
};

window.collapseHistory = function () {
    window.historyShowAll = false;
    if (window.currentViewingLeadId) populateLeadDetails(window.currentViewingLeadId);
};

async function loadLeadTimeline(leadId) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/leads/${leadId}/notes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const notes = await res.json();

        if (!notes || notes.length === 0) {
            container.innerHTML = '<p style="color: #94a3b8; font-size: 0.8125rem; text-align: center; padding: 2rem;">No interaction history found.</p>';
            return;
        }

        const originalCount = notes.length;
        let displayNotes = notes;
        const limit = 5;

        if (!window.timelineShowAll && originalCount > limit) {
            displayNotes = notes.slice(0, limit);
        }

        let html = displayNotes.map(note => {
            const date = new Date(note.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            let icon = 'fa-comment-dots';
            let color = '#64748b';

            if (note.note.includes('converted')) { icon = 'fa-shopping-cart'; color = '#10b981'; }
            else if (note.note.includes('assigned')) { icon = 'fa-user-check'; color = '#3b82f6'; }
            else if (note.note.includes('rescheduled')) { icon = 'fa-calendar-alt'; color = '#f59e0b'; }
            else if (note.note.includes('System:')) { icon = 'fa-robot'; color = '#94a3b8'; }

            return `
                <div class="timeline-item" style="display: flex; gap: 1rem; margin-bottom: 1.5rem; position: relative;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${color}20; color: ${color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 1;">
                        <i class="fas ${icon}" style="font-size: 0.875rem;"></i>
                    </div>
                    <div style="flex-grow: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                            <span style="font-weight: 700; font-size: 0.8125rem; color: #1e293b;">${note.user_name || 'System'}</span>
                            <span style="font-size: 0.75rem; color: #94a3b8;">${date}</span>
                        </div>
                        <p style="font-size: 0.875rem; color: #475569; line-height: 1.4; margin: 0;">${note.note}</p>
                    </div>
                </div>
            `;
        }).join('');

        // Add Toggle Button if needed
        if (originalCount > limit) {
            if (!window.timelineShowAll) {
                html += `
                    <div style="text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #e2e8f0;">
                        <button onclick="viewFullTimeline()" class="btn-text" style="color: var(--primary-color); font-weight: 700; font-size: 0.8125rem; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%; gap: 0.5rem;">
                            <i class="fas fa-ellipsis-h"></i> View Full History (${originalCount} interactions)
                        </button>
                    </div>
                `;
            } else {
                html += `
                    <div style="text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #e2e8f0;">
                        <button onclick="collapseTimeline()" class="btn-text" style="color: #94a3b8; font-weight: 700; font-size: 0.8125rem; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%; gap: 0.5rem;">
                            <i class="fas fa-chevron-up"></i> Show Less
                        </button>
                    </div>
                `;
            }
        }

        container.innerHTML = html;
    } catch (err) {
        console.error('Timeline error:', err);
    }
}


// ─── Single Assignment ─────────────────────────────────────────
window.changeAssigneeFromDetails = async function () {
    const leadId = window.currentViewingLeadId;
    if (!leadId) return alert('No lead selected.');

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/users?role=sales`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();

        const content = `
            <div style="padding: 1rem;">
                <p style="margin-bottom: 1rem; color: #64748b;">Assign this lead to a staff member:</p>
                <select id="singleStaffSelect" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <option value="">Select Staff Member...</option>
                    ${users.map(u => `<option value="${u.user_id}">${u.name} (${u.language || 'General'})</option>`).join('')}
                </select>
                <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                    <button onclick="performSingleAssign(${leadId})" class="btn" style="flex: 2; background: #059669; color: white;">Confirm Change</button>
                    <button onclick="window.hideModal()" class="btn btn-outline" style="flex: 1;">Cancel</button>
                </div>
            </div>
        `;
        window.showModal({ title: 'Change Assignee', content, hideFooter: true });
    } catch (err) {
        window.showAlert("Error", "Failed to load staff list.", "error");
    }
};

window.performSingleAssign = async function (leadId) {
    const staffId = document.getElementById('singleStaffSelect').value;
    if (!staffId) return alert('Please select a staff member.');

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/leads/${leadId}/assign`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ assigned_to: staffId })
        });

        if (response.ok) {
            window.hideModal();
            populateLeadDetails(leadId); // Refresh details
            updateLeadStats();
            window.showAlert("Success", "Lead assigned successfully!", "success");
        } else {
            const err = await response.json();
            alert(`Error: ${err.message}`);
        }
    } catch (err) {
        alert('Failed to connect to server.');
    }
};

window.transferLead = async function (leadId) {
    if (!leadId) return alert('No lead selected.');

    const content = `
        <div style="padding: 1rem;">
            <p style="margin-bottom: 1rem; color: #64748b;">Transfer this lead to a staff member proficient in:</p>
            <select id="transferLangSelect" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                <option value="KA">Kannada</option>
                <option value="TN">Tamil</option>
                <option value="TE">Telugu</option>
                <option value="ML">Malayalam</option>
                <option value="HI">Hindi</option>
                <option value="EN">English</option>
            </select>
            <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                <button id="confirmTransferBtn" class="btn" style="flex: 2; background: #2563eb; color: white;">Transfer Lead</button>
                <button onclick="window.hideModal()" class="btn btn-outline" style="flex: 1;">Cancel</button>
            </div>
        </div>
    `;

    window.showModal({ title: 'Language Transfer', content, hideFooter: true });

    document.getElementById('confirmTransferBtn').onclick = async () => {
        const lang = document.getElementById('transferLangSelect').value;
        const token = localStorage.getItem('token');
        const btn = document.getElementById('confirmTransferBtn');
        btn.disabled = true;
        btn.textContent = 'Transferring...';

        try {
            const response = await fetch(`${API_URL}/leads/${leadId}/transfer`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ target_language: lang })
            });

            const data = await response.json();
            if (response.ok) {
                window.hideModal();
                populateLeadDetails(leadId);
                updateLeadStats();
                alert(`Lead transferred successfully to ${data.target_user}!`);
            } else {
                alert(`Error: ${data.message}`);
            }
        } catch (err) {
            alert('Failed to connect to server.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Transfer Lead';
        }
    };
};

function handleAuthError() {
    localStorage.clear();
    window.location.href = `${window.ROOT_PATH}index.html?error=session_expired`;
}

// ─── Modal System ─────────────────────────────────────────────
window.showModal = function ({ title, content, hideFooter }) {
    let modal = document.getElementById('globalModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'globalModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    // Ensure internal structure exists using innerHTML only if needed
    let titleEl = modal.querySelector('#modalTitle');
    let bodyEl = modal.querySelector('#modalBody');
    let footerEl = modal.querySelector('#modalFooter');

    if (!titleEl || !bodyEl || !footerEl) {
        modal.innerHTML = `
            <div class="modal-content premium-card" style="width: 100%; max-width: 600px; padding: 0; overflow: hidden; border: none;">
                <div style="background: var(--primary-color, #2563eb); color: white; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <h3 id="modalTitle" style="margin: 0; font-size: 1.125rem;"></h3>
                    <button onclick="window.hideModal()" style="background: none; border: none; color: white; cursor: pointer;"><i class="fas fa-times"></i></button>
                </div>
                <div id="modalBody" style="padding: 1.5rem; overflow-y: auto; max-height: 80vh;"></div>
                <div id="modalFooter" style="padding: 1rem 1.5rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 0.75rem;">
                    <button onclick="window.hideModal()" class="btn btn-outline">Close</button>
                </div>
            </div>
        `;
        // Re-query after setting innerHTML
        titleEl = modal.querySelector('#modalTitle');
        bodyEl = modal.querySelector('#modalBody');
        footerEl = modal.querySelector('#modalFooter');
    }

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;
    if (footerEl) footerEl.style.display = hideFooter ? 'none' : 'flex';

    modal.classList.add('active');
};

window.hideModal = function () {
    const modal = document.getElementById('globalModal');
    if (modal) modal.classList.remove('active');
};

window.openAddLeadModal = async function () {
    try {
        const res = await fetch(`${window.ROOT_PATH}components/quick-lead-form.html`);
        const text = await res.text();
        window.showModal({ title: 'Quick Lead Entry', content: text, hideFooter: true });
    } catch (err) { console.error('Add lead modal error:', err); }
};

window.submitQuickLead = async function() {
    const phone = document.getElementById('q-phone').value.trim();
    const name = document.getElementById('q-name').value.trim();
    const village = document.getElementById('q-village').value.trim();
    const district = document.getElementById('q-district').value.trim();
    const submitBtn = document.getElementById('q-submit-btn');

    if (!phone || phone.length < 10) {
        return window.showAlert("Validation", "Please enter a valid 10-digit phone number", "error");
    }

    const originalHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    submitBtn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.API_URL}/leads`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone_number: phone,
                customer_name: name,
                city: village,
                address: district, // Map district to address field
                source: 'manual',
                language: 'EN' // Default
            })
        });

        const result = await response.json();

        if (response.ok) {
            window.hideModal();
            window.showAlert("Success", "Lead created successfully!", "success");
            // Refresh lead list if function exists
            if (typeof window.initLeadList === 'function') {
                window.initLeadList(window.currentBaseFilters || {});
            }
        } else {
            window.showAlert("Error", result.message || "Failed to create lead", "error");
        }
    } catch (err) {
        console.error('Submit lead error:', err);
        window.showAlert("Connection Error", "Failed to connect to server", "error");
    } finally {
        submitBtn.innerHTML = originalHtml;
        submitBtn.disabled = false;
    }
};

function initGlobalSearch() {
    document.querySelectorAll('.search-bar input').forEach(input => {
        input.addEventListener('focus', () => console.log('Search focus...'));
    });
}
