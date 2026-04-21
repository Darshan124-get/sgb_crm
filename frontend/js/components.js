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
    tbody.innerHTML = '<tr><td colspan="9" class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading leads...</td></tr>';

    window.currentFilters = { ...filters };
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });

    try {
        const response = await fetch(`${API_URL}/leads?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('API Error');
        const leads = await response.json();

        if (!leads || leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No leads available.</td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Failed to load leads.</td></tr>';
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
        alert('Failed to load staff list. Please try again.');
    }
};

window.autoAssignSelected = async function () {
    if (window.currentSelectedLeadIds.length === 0) return alert('No leads selected.');

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
            alert(`Auto-assignment complete: ${result.count} leads assigned.`);
        } else {
            const err = await response.json();
            alert(`Auto-assign failed: ${err.message}`);
        }
    } catch (err) {
        alert('Network error during auto-assignment.');
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
            alert('Leads assigned successfully!');
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
            const fields = {
                leadDetailName: lead.customer_name,
                leadDetailPhone: lead.phone_number,
                leadDetailVillage: lead.city,
                leadDetailState: lead.state,
                leadDetailLanguage: lead.language,
                leadDetailAssigned: lead.assigned_to_name || 'Unassigned',
                topCustomerNameDisplay: lead.customer_name,
                leadDetailSaleStatus: lead.status || 'New'
            };
            Object.entries(fields).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val || '-';
            });

            // Set initials again if avatar is present
            const avatar = document.getElementById('assigneeAvatar');
            if (avatar) {
                const nameStr = lead.assigned_to_name || '?';
                avatar.textContent = nameStr.charAt(0).toUpperCase();
            }
        }
    } catch (err) { console.error('Lead detail error:', err); }
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
        alert('Failed to load staff list.');
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
            alert('Lead assigned successfully!');
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
        document.body.appendChild(modal);
    }
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modalFooter').style.display = hideFooter ? 'none' : 'flex';
    modal.classList.add('active');
};

window.hideModal = function () {
    const modal = document.getElementById('globalModal');
    if (modal) modal.classList.remove('active');
};

window.openAddLeadModal = async function () {
    try {
        const res = await fetch(`${window.ROOT_PATH}components/manual-lead-form.html`);
        const text = await res.text();
        window.showModal({ title: 'Create New Lead', content: text, hideFooter: true });
        if (typeof initManualLeadForm === 'function') initManualLeadForm();
    } catch (err) { console.error('Add lead modal error:', err); }
};

function initGlobalSearch() {
    document.querySelectorAll('.search-bar input').forEach(input => {
        input.addEventListener('focus', () => console.log('Search focus...'));
    });
}
