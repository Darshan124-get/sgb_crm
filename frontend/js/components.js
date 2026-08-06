// ============================================================
// components.js — Shared UI: Sidebar Loader, Search, Auth
// Loaded on every protected page. Must come AFTER config.js.
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const user = window.getCurrentUser();
    const role = (user.role || '').toLowerCase();
    
    const sidebarContainer = document.getElementById('sidebar-container');

    // ── Sidebar Injection & PBAC Dynamic Rendering ──
    if (sidebarContainer) {
        let userPermissions = [];
        try {
            userPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || []);
        } catch(e) {
            userPermissions = [];
        }

        // Admins override
        if (role === 'admin' || role === 'super-admin') {
            userPermissions.push('ALL');
        }
        
        try {
            let sidebarFileName = 'sidebar-dynamic.html';
            const isDealerMode = localStorage.getItem('dealerMode') === 'true';
            
            // Admins and Super Admins always get the admin sidebar or dealer sidebar
            if (role === 'admin' || role === 'super-admin') {
                sidebarFileName = isDealerMode ? 'sidebar-dealer.html' : 'sidebar-admin.html';
            } else if (role === 'whatsapp_management_executive') {
                sidebarFileName = 'sidebar-whatsapp_management_executive.html';
            } else if (role === 'billing_manager' || (role === 'manager' && userPermissions.includes('billing_billing'))) {
                sidebarFileName = 'sidebar-billing_manager.html';
            } else if (role === 'shipping_manager' || (role === 'manager' && userPermissions.includes('shipping_dashboard'))) {
                sidebarFileName = 'sidebar-shipping_manager.html';
            }
            // If user has zero specific permissions, load their role's original default sidebar.
            else if (userPermissions.length === 0 && role) {
                const normalizedRole = role.trim().replace(/\s+/g, '_');
                sidebarFileName = `sidebar-${normalizedRole}.html`;
            }

            let response = await fetch(`${window.ROOT_PATH}components/${sidebarFileName}`);
            
            // Fallback to dynamic sidebar if the role-specific file doesn't exist
            if (!response.ok && sidebarFileName !== 'sidebar-dynamic.html') {
                sidebarFileName = 'sidebar-dynamic.html';
                response = await fetch(`${window.ROOT_PATH}components/${sidebarFileName}`);
            }

            if (response.ok) {
                sidebarContainer.innerHTML = await response.text();
                
                // 🔐 Filter Sidebar by Permissions 🔐
                const navItems = sidebarContainer.querySelectorAll('.nav-item');
                navItems.forEach(item => {
                    const reqPerm = item.getAttribute('data-perm');
                    if (reqPerm && !userPermissions.includes('ALL') && !userPermissions.includes(reqPerm)) {
                        item.remove(); // Remove unauthorized module link
                    }
                });

                // ── Cleanup Empty Group Titles ──
                const groups = sidebarContainer.querySelectorAll('.nav-group-title');
                groups.forEach(group => {
                    let nextSibling = group.nextElementSibling;
                    let hasItems = false;
                    while (nextSibling && !nextSibling.classList.contains('nav-group-title')) {
                        if (nextSibling.classList.contains('nav-item')) {
                            hasItems = true;
                            break;
                        }
                        nextSibling = nextSibling.nextElementSibling;
                    }
                    if (!hasItems) group.remove();
                });

                initSidebar(sidebarContainer.querySelectorAll('a'));
                
                // ── Update Sidebar Role Label ──
                if (role === 'super-admin') {
                    const sidebarLabel = document.getElementById('sidebar-role-label');
                    if (sidebarLabel) sidebarLabel.textContent = 'SUPER ADMIN PORTAL';
                } else if (role === 'manager' && userPermissions.includes('sales_dashboard')) {
                    const sidebarLabel = document.getElementById('sidebar-role-label');
                    if (sidebarLabel) sidebarLabel.textContent = 'SALES MANAGER PANEL';
                    const dashboardLabel = document.querySelector('#nav-dashboard-sales .nav-label');
                    if (dashboardLabel) dashboardLabel.textContent = 'Sales Manager Dashboard';
                } else if (role.includes('telecaller')) {
                    const sidebarLabel = document.getElementById('sidebar-role-label');
                    if (sidebarLabel) sidebarLabel.textContent = 'TELECOM PANEL';
                    const dashboardLabel = document.querySelector('#nav-dashboard-sales .nav-label');
                    if (dashboardLabel) dashboardLabel.textContent = 'Telecom Dashboard';
                } else if (role.includes('whatsapp')) {
                    const sidebarLabel = document.getElementById('sidebar-role-label');
                    if (sidebarLabel) sidebarLabel.textContent = 'WHATSAPP PANEL';
                    const dashboardLabel = document.querySelector('#nav-dashboard-sales .nav-label');
                    if (dashboardLabel) dashboardLabel.textContent = 'WhatsApp Dashboard';
                } else if (role === 'viewer') {
                    const sidebarLabel = document.getElementById('sidebar-role-label');
                    if (sidebarLabel) sidebarLabel.textContent = 'VIEWER PANEL';
                    const dashboardLabel = document.querySelector('#nav-dashboard-sales .nav-label');
                    if (dashboardLabel) dashboardLabel.textContent = 'Viewer Dashboard';
                }

                // Initialize B2B Dealer Mode Toggle
                const dealerModeToggle = document.getElementById('dealerModeToggle');
                if (dealerModeToggle) {
                    const isDealerMode = localStorage.getItem('dealerMode') === 'true';
                    dealerModeToggle.checked = isDealerMode;
                    dealerModeToggle.addEventListener('change', (e) => {
                        localStorage.setItem('dealerMode', e.target.checked ? 'true' : 'false');
                        window.location.reload();
                    });
                }
            } else {
                console.error(`Sidebar file not found: sidebar-dynamic.html`);
            }
        } catch (err) {
            console.error('Failed to load dynamic sidebar:', err);
        }
    }

    // ── Lead Nav (Lead management pages only) ──
    const leadNavPlaceholder = document.getElementById('lead-nav-placeholder');
    if (leadNavPlaceholder) {
        await loadComponent(leadNavPlaceholder, `${window.ROOT_PATH}components/lead-nav.html`, initLeadNav);
    }

    // ── Global Search ──
    initGlobalSearch();

    // ── Super Admin Read-Only UI Adjustments ──
    if (role === 'super-admin') {
        const path = window.location.pathname;
        const isAccessControlPage = path.includes('users.html') || path.includes('departments.html') || path.includes('roles.html');
        
        const bannerText = isAccessControlPage 
            ? 'SUPER ADMIN MODE: You have full modification access on this User Management page.' 
            : 'MONITORING MODE: You have full read-only access to the system. Modifications are disabled.';
            
        const banner = document.createElement('div');
        banner.innerHTML = `<div style="background: ${isAccessControlPage ? '#dcfce7' : '#fef3c7'}; border-bottom: 1px solid ${isAccessControlPage ? '#bbf7d0' : '#fde68a'}; color: ${isAccessControlPage ? '#166534' : '#92400e'}; text-align: center; padding: 0.5rem; font-weight: 700; font-size: 0.85rem; position: sticky; top: 0; z-index: 10000; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <i class="fa-solid ${isAccessControlPage ? 'fa-users-gear' : 'fa-eye'}" style="margin-right: 5px;"></i> ${bannerText}
        </div>`;
        document.body.prepend(banner);

        if (!isAccessControlPage) {
            const style = document.createElement('style');
            style.innerHTML = `
                /* Attempt to hide obvious creation/deletion action buttons */
                .btn-primary, .btn-danger, .btn-success, .btn-add-lead, [onclick*="delete"], [onclick*="save"], [onclick*="create"], [onclick*="add"], [onclick*="mark"], [onclick*="convert"], [onclick*="ship"], [onclick*="verify"], [onclick*="approve"], [onclick*="reject"] {
                    opacity: 0.5;
                    pointer-events: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ── Viewer Read-Only UI Adjustments ──
    if (role === 'viewer') {
        const bannerText = 'VIEWER MODE: You have read-only access to the system. Modifications are disabled.';
        const banner = document.createElement('div');
        banner.innerHTML = `<div style="background: #fef3c7; border-bottom: 1px solid #fde68a; color: #92400e; text-align: center; padding: 0.5rem; font-weight: 700; font-size: 0.85rem; position: sticky; top: 0; z-index: 10000; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <i class="fa-solid fa-eye" style="margin-right: 5px;"></i> ${bannerText}
        </div>`;
        document.body.prepend(banner);

        const style = document.createElement('style');
        style.innerHTML = `
            /* Hide obvious creation/deletion action buttons */
            .btn-primary, .btn-danger, .btn-success, .btn-add-lead, #bulkActionsBar, [onclick*="delete"], [onclick*="save"], [onclick*="create"], [onclick*="add"], [onclick*="openAddLeadModal"], [onclick*="mark"], [onclick*="convert"], [onclick*="ship"], [onclick*="verify"], [onclick*="approve"], [onclick*="reject"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ── Inject Hamburger Menu Button for Mobile ──
    const topbar = document.querySelector('.topbar');
    if (topbar && !topbar.querySelector('.hamburger')) {
        const hamburger = document.createElement('div');
        hamburger.className = 'hamburger';
        hamburger.onclick = () => {
            if (typeof window.toggleMobileSidebar === 'function') {
                window.toggleMobileSidebar();
            }
        };
        hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
        topbar.prepend(hamburger);
    }

    // ── Update Profile Name ──
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl && user.name) {
        let displayName = user.name;
        if (role === 'super-admin' && displayName.toLowerCase() === 'admin') {
            displayName = 'Super Admin';
        }
        profileNameEl.textContent = displayName;
    }

    // ── Inject Notification Bell dynamically ──
    const profileSection = document.querySelector('.profile-section');
    if (profileSection && !profileSection.querySelector('.notif-bell')) {
        const bellDiv = document.createElement('div');
        bellDiv.className = 'notif-bell';
        bellDiv.style.cssText = `
            margin-right: 1.25rem;
            position: relative;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        bellDiv.innerHTML = `
            <i class="far fa-bell" style="font-size: 1.2rem; color: #6b7280; transition: color 0.2s;"></i>
            <span id="notifBadge" style="position: absolute; top: -6px; right: -6px; background: #ef4444; color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 8px; display: none; align-items: center; justify-content: center; font-weight: 700; border: 1.5px solid white;">0</span>
        `;
        
        // Hover styling
        const bellIcon = bellDiv.querySelector('i');
        bellDiv.onmouseenter = () => bellIcon.style.color = '#1e293b';
        bellDiv.onmouseleave = () => bellIcon.style.color = '#6b7280';

        profileSection.prepend(bellDiv);
    }

    // ── Initialize FCM for Authenticated Users ──
    if (user && user.id) {
        import('./fcm.js')
            .then(module => {
                module.initFCM();
            })
            .catch(err => console.error('Failed to load FCM module:', err));
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

        // ── Smart Path Resolution ──
        // Resolve the link relative to the frontend root (ROOT_PATH)
        try {
            // Create a base URL pointing to the frontend root
            const rootUrl = new URL(window.ROOT_PATH, window.location.href).href;
            // Resolve the href against that root
            const resolvedUrl = new URL(href, rootUrl).href;
            link.href = resolvedUrl;
        } catch (e) {
            console.error('Path resolution failed for:', href, e);
            // Fallback to simple concatenation if URL API fails
            if (!href.startsWith('/') && !href.startsWith('.') && !href.includes('://')) {
                link.href = `${window.ROOT_PATH}${href}`;
            }
        }

        // Highlight active link
        // Use full URL comparison for reliability
        try {
            const linkUrl = new URL(link.href);
            if (currentPath === linkUrl.pathname) {
                // Hash-aware matching
                const currentHash = window.location.hash || '#dashboard';
                const linkHash = linkUrl.hash || '#dashboard';
                if (linkUrl.hash && currentHash !== linkHash) {
                    return;
                }
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

    // ── Mobile Sidebar Logic ──
    const sidebar = document.querySelector('.sidebar');
    let overlay = document.getElementById('sidebar-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    window.toggleMobileSidebar = () => {
        if (!sidebar) return;
        sidebar.classList.toggle('mobile-active');
        overlay.classList.toggle('active');
    };

    overlay.onclick = window.toggleMobileSidebar;

    // Close on link click
    links.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-active');
                overlay.classList.remove('active');
            }
        });
    });
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
        if (response.status === 401 || response.status === 403) { window.doLogout(); return; }
        if (response.ok) {
            const stats = await response.json();
            const badgeMap = {
                'badge-open': stats.open,
                'badge-today': stats.today,
                'badge-hot': stats.hot,
                'badge-followup': stats.followup,
                'badge-lost': stats.lost,
                'badge-all': stats.all
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
                    open: { is_open: 'true' },
                    today: { is_today: 'true' },
                    hot: { score: 'hot', status: 'interested' },
                    followup: { status: 'followup' },
                    lost: { status: 'lost,not_interested' },
                    all: {}
                };
                await loadComponent(contentArea, `${window.ROOT_PATH}components/lead-list.html`, () => initLeadList(filterConfig[filter] || {}));
            }
        });
    });

    updateLeadStats();
    const todayTab = document.querySelector('.nav-tab[data-filter="today"]') || document.querySelector('.nav-tab[data-filter="all"]');
    if (todayTab) todayTab.click();

    // Auto-open lead details if ?leadId= is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const deepLinkLeadId = urlParams.get('leadId');
    if (deepLinkLeadId) {
        setTimeout(() => viewLeadDetails(parseInt(deepLinkLeadId)), 600);
    }
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
    const scoreF = document.getElementById('leadScoreFilter');
    const staffF = document.getElementById('leadStaffFilter');
    const dateF = document.getElementById('leadDateFilter');
    const btnAll = document.getElementById('btnFilterAll');

    if (statusF && !statusF.dataset.listenerSet) {
        statusF.dataset.listenerSet = 'true';
        statusF.onchange = () => initLeadList(window.currentBaseFilters);
    }
    if (scoreF && !scoreF.dataset.listenerSet) {
        scoreF.dataset.listenerSet = 'true';
        scoreF.onchange = () => initLeadList(window.currentBaseFilters);
    }
    if (staffF && !staffF.dataset.listenerSet) {
        staffF.dataset.listenerSet = 'true';
        staffF.onchange = () => initLeadList(window.currentBaseFilters);

        // Fetch staff list and populate options
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/users`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const allUsers = await response.json();
                    const users = allUsers.filter(u => u.role_name && (u.role_name.includes('executive') || u.role_name === 'sales' || u.role_name === 'viewer' || u.role_name === 'manager'));
                    
                    const val = staffF.value;
                    staffF.innerHTML = '<option value="all">All Staff</option><option value="unassigned">Unassigned</option>';
                    users.forEach(u => {
                        const opt = document.createElement('option');
                        opt.value = u.user_id;
                        opt.textContent = `${u.name} - ${u.language || 'General'}`;
                        staffF.appendChild(opt);
                    });
                    staffF.value = val;
                }
            } catch (err) {
                console.error('Failed to load staff list for filter:', err);
            }
        })();
    }
    if (dateF && !dateF.dataset.listenerSet) {
        dateF.dataset.listenerSet = 'true';
        if (typeof flatpickr !== 'undefined') {
            flatpickr(dateF, {
                mode: "range",
                dateFormat: "Y-m-d",
                onClose: function(selectedDates, dateStr, instance) {
                    initLeadList(window.currentBaseFilters);
                }
            });
        } else {
            dateF.onchange = () => initLeadList(window.currentBaseFilters);
        }
    }
    if (btnAll && !btnAll.dataset.listenerSet) {
        btnAll.dataset.listenerSet = 'true';
        btnAll.onclick = () => {
            if (statusF) statusF.value = 'all';
            if (scoreF) scoreF.value = 'all';
            if (staffF) staffF.value = 'all';
            if (dateF) {
                dateF.value = '';
                if (dateF._flatpickr) {
                    dateF._flatpickr.clear();
                }
            }
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
    
    if (staffF && staffF.value !== 'all') {
        if (staffF.value === 'unassigned') {
            params.set('is_unassigned', 'true');
        } else {
            params.set('assigned_to', staffF.value);
        }
    }

    if (dateF && dateF.value) params.set('date', dateF.value);
    if (searchInput && searchInput.value) params.set('search', searchInput.value);

    try {
        const response = await fetch(`${API_URL}/leads?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('API Error');
        const leads = await response.json();
        window.currentLeadsList = leads; // For export

        if (!leads || leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No leads available.</td></tr>';
            return;
        }

        tbody.innerHTML = leads.map(lead => {
            const statusClass = lead.status === 'assigned' ? 'badge-assigned' : (lead.status === 'new' ? 'badge-unassigned' : 'badge-state');
            const scoreClass = `badge-score-${(lead.score || 'COLD').toLowerCase()}`;
            const _dateObj = new Date(lead.created_at);
            const date = _dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const time = _dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const nameInitial = lead.customer_name ? lead.customer_name.charAt(0).toUpperCase() : '?';

            const callTag = lead.call_count >= 3 ? '<span class="call-tag tag-3">3rd Call</span>' :
                (lead.call_count === 2 ? '<span class="call-tag tag-2">2nd Call</span>' :
                    (lead.call_count === 1 ? '<span class="call-tag tag-1">1st Call</span>' : ''));

            let dateHtml = '';
            if (lead.next_followup_date) {
                const fuDate = new Date(lead.next_followup_date);
                const d = fuDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                const t = fuDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                
                // Smart color based on due date
                const diffHrs = (fuDate - new Date()) / (1000 * 60 * 60);
                let colorClass = '#10b981'; // Green (future)
                let icon = '📅';
                if (diffHrs < 0) { colorClass = '#ef4444'; icon = '⚠'; } // Red (overdue)
                else if (diffHrs < 24) { colorClass = '#f59e0b'; icon = '🔴'; } // Orange (due soon)

                dateHtml = `<div style="font-size:0.75rem;font-weight:700;color:${colorClass};text-transform:uppercase;margin-bottom:2px;">${icon} Follow-up</div>
                            <div style="font-size:0.85rem;font-weight:600;color:#1e293b;white-space:nowrap;">${d}</div>
                            <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">${t}</div>`;
            } else {
                dateHtml = `<div style="font-size:0.75rem;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:2px;">Added</div>
                            <div style="font-size:0.85rem;font-weight:600;color:#1e293b;white-space:nowrap;">${date}</div>
                            <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">${time}</div>`;
            }

            return `
            <tr onclick="viewLeadDetails(${lead.lead_id})" style="cursor:pointer;">
                <td onclick="event.stopPropagation()"><input type="checkbox" class="lead-checkbox" data-id="${lead.lead_id}" onclick="event.stopPropagation(); toggleLeadSelection(this)"></td>
                <td><div class="name-cell"><div class="name-initial">${nameInitial}</div>${lead.customer_name || 'Unknown'} ${callTag}</div></td>
                <td><span class="${statusClass}">${lead.status}</span></td>
                <td><span class="badge-score ${scoreClass}">${(lead.score || 'COLD').toUpperCase() === 'WARM' ? 'MILD' : (lead.score || 'COLD').toUpperCase()}</span></td>
                <td>${lead.state || '-'}</td>
                <td><span class="language-tag">${lead.language || 'EN'}</span></td>
                <td onclick="event.stopPropagation()"><a href="${window.ROOT_PATH}modules/whatsapp/whatsapp.html?phone=${lead.phone_number || ''}" target="_self" style="color:#25d366;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px;" title="Open WhatsApp Chat"><i class="fab fa-whatsapp" style="font-size:1rem;"></i>${lead.phone_number || '-'}</a></td>
                <td><div class="msg-trunk" title="${lead.first_message || ''}">${lead.first_message || '-'}</div></td>
                <td>${dateHtml}</td>
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
        // Fetch staff to choose from
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const allUsers = await response.json();
        const users = allUsers.filter(u => u.role_name && (u.role_name.includes('executive') || u.role_name === 'sales' || u.role_name === 'viewer' || u.role_name === 'manager'));

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
            window.currentLeadData = lead; // Store globally for decision engine

            // ── Primary Field Mapping ──
            const fields = {
                leadDetailName: lead.customer_name,
                leadDetailPhone: lead.phone_number,
                leadDetailVillage: lead.city,
                leadDetailState: lead.state,
                leadDetailDistrict: lead.district || '-',
                leadDetailPincode: lead.pincode || '-',
                leadDetailLanguage: lead.language || 'EN',
                leadDetailLanguageInfo: lead.language || 'English',
                leadDetailAssigned: lead.assigned_to_name || 'Unassigned',
                leadDetailAssignedId: lead.assigned_to || '',
                topCustomerNameDisplay: lead.first_message || lead.customer_name || 'No Message',
                leadDetailSaleStatus: lead.status || 'New',
                leadDetailStatusSelect: lead.status || 'new',
                leadDetailStatusSelect: lead.status || 'new',
                leadDetailScoreSelect: lead.score || 'cold',
                leadDetailCrop: lead.current_crop || '-',
                leadDetailAcreage: lead.acreage || '-',
                leadDetailFeedback: lead.feedback || '-',
                leadDetailAttempt: lead.call_count || '0',

                // Edit Inputs mapping
                editName: lead.customer_name,
                phone_number: lead.phone_number,
                editPhone: lead.phone_number,
                editVillage: lead.city,
                editState: lead.state,
                editDistrict: lead.district,
                editPincode: lead.pincode,
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

            // Style and set Campaign Tag
            const tagEl = document.getElementById('leadCampaignTag');
            if (tagEl) {
                if (lead.campaign_name) {
                    tagEl.textContent = lead.campaign_name;
                    tagEl.style.background = '#e0f2fe';
                    tagEl.style.color = '#0369a1';
                    tagEl.style.border = '1px solid #bae6fd';
                } else {
                    tagEl.textContent = 'Direct Lead';
                    tagEl.style.background = '#f1f5f9';
                    tagEl.style.color = '#475569';
                    tagEl.style.border = '1px solid #e2e8f0';
                }
            }

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
            if (lead.next_followup_date || lead.next_followup) {
                const followupDate = lead.next_followup_date || (lead.next_followup ? lead.next_followup.followup_date : null);
                const dateObj = new Date(followupDate);
                if (fDate) fDate.textContent = dateObj.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                if (fAction) fAction.textContent = (lead.next_followup && lead.next_followup.remarks) ? lead.next_followup.remarks : "Scheduled call";
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
            // ── WhatsApp Button ──
            const waBtn = document.getElementById('whatsappBtn');
            if (waBtn && lead.phone_number) {
                // Link to our internal WhatsApp module with deep linking
                waBtn.href = `${window.ROOT_PATH}modules/whatsapp/whatsapp.html?phone=${lead.phone_number}`;
                waBtn.target = '_self'; // Open in same window/tab
                waBtn.onclick = null; // Remove any old handlers
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
        payload.district = document.getElementById('editDistrict').value;
        payload.pincode = document.getElementById('editPincode').value;
        payload.language = document.getElementById('editLanguage').value;
        
        const cropEl = document.getElementById('editCrop');
        if(cropEl) payload.current_crop = cropEl.value;
        
        const acreEl = document.getElementById('editAcreage');
        if(acreEl) payload.acreage = acreEl.value ? parseFloat(acreEl.value) : null;
    } else if (sectionId === 'requirementSection') {
        // Interests might need a specialized endpoint or array formatting
        payload.interests_raw = document.getElementById('editInterest') ? document.getElementById('editInterest').value : '';
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
                <input type="text" id="rescheduleDate" class="form-control-premium flatpickr-input" style="width: 100%;" placeholder="Select Date & Time">
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
    
    setTimeout(() => {
        if (typeof flatpickr !== 'undefined') {
            const defaultDate = new Date();
            defaultDate.setMinutes(defaultDate.getMinutes() + 30);
            flatpickr("#rescheduleDate", {
                enableTime: true,
                dateFormat: "Y-m-d\\TH:i",
                altInput: true,
                altFormat: "d M Y h:i K",
                minDate: "today",
                defaultDate: defaultDate
            });
        }
    }, 50);
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
        const response = await fetch(`${API_URL}/leads/${leadId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ next_followup_date: date, status: 'followup' })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to update schedule');
        }

        window.hideModal();
        populateLeadDetails(leadId);
        window.showAlert("Scheduled", "Callback successfully scheduled.", "success");
        if (typeof window.initLeadList === 'function') {
            window.initLeadList(window.currentFilters || window.currentBaseFilters || {});
        } else if (typeof initLeadList === 'function') {
            initLeadList(window.currentFilters || window.currentBaseFilters || {});
        }
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
        const response = await fetch(`${API_URL}/users/sales`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const allUsers = await response.json();
        const users = allUsers.filter(u => u.role_name && (u.role_name.includes('executive') || u.role_name === 'sales' || u.role_name === 'viewer' || u.role_name === 'manager'));

        const content = `
            <div style="padding: 1rem;">
                <p style="margin-bottom: 1rem; color: #64748b;">Assign this lead to a staff member:</p>
                <select id="singleStaffSelect" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <option value="">Select Staff Member...</option>
                    ${users.map(u => {
            const langMap = { EN: 'English', HI: 'Hindi', KA: 'Kannada', KN: 'Kannada', TN: 'Tamil', TA: 'Tamil', TE: 'Telugu', ML: 'Malayalam', MR: 'Marathi' };
            const langs = u.language ? u.language.split(',').map(l => langMap[l.trim()] || l.trim()).join(', ') : 'General';
            return `<option value="${u.user_id}">${u.name} (${langs})</option>`;
        }).join('')}
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
            <div class="modal-content premium-card">
                <div class="modal-header" style="background: var(--primary-color, #2563eb); color: white; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <h3 id="modalTitle" style="margin: 0; font-size: 1.125rem;"></h3>
                    <button onclick="window.hideModal()" style="background: none; border: none; color: white; cursor: pointer;"><i class="fas fa-times"></i></button>
                </div>
                <div id="modalBody" class="modal-body"></div>
                <div id="modalFooter" class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 0.75rem;">
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
    document.body.classList.add('modal-open');
};

window.hideModal = function () {
    const modal = document.getElementById('globalModal');
    if (modal) modal.classList.remove('active');
    document.body.classList.remove('modal-open');
};

window.openAddLeadModal = async function () {
    try {
        const res = await fetch(`${window.ROOT_PATH}components/quick-lead-form.html`);
        const text = await res.text();
        window.showModal({ title: 'Quick Lead Entry', content: text, hideFooter: true });
    } catch (err) { console.error('Add lead modal error:', err); }
};

window.submitQuickLead = async function () {
    const phone = document.getElementById('q-phone').value.trim();
    const name = document.getElementById('q-name').value.trim();
    const village = document.getElementById('q-village').value.trim();
    const district = document.getElementById('q-district').value.trim();
    const pincode = document.getElementById('q-pincode').value.trim();
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
                district: district,
                pincode: pincode,
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
            // Check for specific duplicate flag from backend
            if (result.duplicate && result.lead_id) {
                window.showAlert("Duplicate Lead", result.message, "warning");
                // Option: Redirect to the existing lead's detail page if desired
                // window.location.href = `lead-details.html?id=${result.lead_id}`;
            } else {
                window.showAlert("Creation Failed", result.message || "Failed to create lead", "error");
            }
        }
    } catch (err) {
        console.error('Submit lead error:', err);
        window.showAlert("Connection Error", "Failed to connect to server", "error");
    } finally {
        submitBtn.innerHTML = originalHtml;
        submitBtn.disabled = false;
    }
};

// ─── Export Leads to Excel (CSV) ──────────────────────────────
window.exportLeadsToExcel = function() {
    if (!window.currentLeadsList || window.currentLeadsList.length === 0) {
        if(window.showAlert) {
            window.showAlert("Export Failed", "No leads available to export.", "info");
        } else {
            alert("No leads available to export.");
        }
        return;
    }

    // Determine which leads to export
    let leadsToExport = window.currentLeadsList;
    if (window.currentSelectedLeadIds && window.currentSelectedLeadIds.length > 0) {
        leadsToExport = window.currentLeadsList.filter(lead => window.currentSelectedLeadIds.includes(lead.lead_id));
    }

    // Define CSV headers
    const headers = [
        "Lead ID", "Customer Name", "Phone Number", "Status", "Score", 
        "State", "District", "City/Village", "Pincode", "Language", 
        "Crop", "Acreage", "First Message", "Next Follow-up", "Assigned Staff", "Created At"
    ];

    // Build CSV content
    let csvContent = headers.join(",") + "\n";

    leadsToExport.forEach(lead => {
        const row = [
            lead.lead_id || '',
            `"${(lead.customer_name || '').replace(/"/g, '""')}"`,
            `"${lead.phone_number || ''}"`,
            `"${lead.status || ''}"`,
            `"${lead.score || ''}"`,
            `"${(lead.state || '').replace(/"/g, '""')}"`,
            `"${(lead.district || '').replace(/"/g, '""')}"`,
            `"${(lead.city || '').replace(/"/g, '""')}"`,
            `"${lead.pincode || ''}"`,
            `"${lead.language || ''}"`,
            `"${(lead.current_crop || '').replace(/"/g, '""')}"`,
            `"${lead.acreage || ''}"`,
            `"${(lead.first_message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            `"${lead.next_followup_date ? new Date(lead.next_followup_date).toLocaleString() : ''}"`,
            `"${(lead.assigned_to_name || 'Unassigned').replace(/"/g, '""')}"`,
            `"${lead.created_at ? new Date(lead.created_at).toLocaleString() : ''}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Get active tab name for filename
    let tabName = "Leads";
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) {
        const filter = activeTab.getAttribute('data-filter');
        const nameMap = {
            open: 'Open_Leads',
            today: 'Todays_Leads',
            hot: 'Hot_Leads',
            followup: 'FollowUps_Mild',
            lost: 'Lost_Leads',
            all: 'All_Leads'
        };
        tabName = nameMap[filter] || 'Leads';
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${tabName}_${dateStr}.csv`;

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function initGlobalSearch() {
    document.querySelectorAll('.search-bar input').forEach(input => {
        input.addEventListener('focus', () => console.log('Search focus...'));
    });
}
