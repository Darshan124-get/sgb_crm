// ============================================================
// components.js — Shared UI: Sidebar Loader, Search, Auth
// Loaded on every protected page. Must come AFTER config.js.
// ============================================================

window.copyToClipboard = function (text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        window.showAlert("Copied", "Phone number copied to clipboard!", "success");
    }).catch(err => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            window.showAlert("Copied", "Phone number copied to clipboard!", "success");
        } catch (copyErr) {
            console.error('Fallback copy failed:', copyErr);
        }
        document.body.removeChild(textArea);
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    const user = window.getCurrentUser();
    const role = (user.role || '').toLowerCase();

    const sidebarContainer = document.getElementById('sidebar-container');

    // ── Sidebar Injection & PBAC Dynamic Rendering ──
    if (sidebarContainer) {
        let userPermissions = [];
        try {
            userPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || []);
        } catch (e) {
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

    // ── Update Profile Name, Role & Avatar ──
    const profileNameEl = document.getElementById('profileName') || document.querySelector('.profile-name');
    if (profileNameEl && user.name) {
        profileNameEl.textContent = user.name;
    }
    const profileRoleEl = document.getElementById('profileRole') || document.querySelector('.profile-role');
    if (profileRoleEl && user.role) {
        profileRoleEl.textContent = user.role.replace(/_/g, ' ').toUpperCase();
    }
    const avatarEl = document.querySelector('.profile-section .avatar');
    if (avatarEl && user.name) {
        avatarEl.innerHTML = `<span style="font-weight:700;font-size:0.9rem;">${user.name.charAt(0).toUpperCase()}</span>`;
    }

    // ── Bind Profile Section Navigation to profile.html ──
    const profileSections = document.querySelectorAll('.profile-section');
    profileSections.forEach(section => {
        section.style.cursor = 'pointer';
        section.title = 'View My Profile';
        section.addEventListener('click', (e) => {
            // Ignore click if clicking notification icons
            if (e.target.closest('.notif-bell') || e.target.closest('.notif-envelope')) {
                return;
            }
            window.location.href = `${window.ROOT_PATH}modules/admin/profile.html`;
        });
    });

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

    // ── Dropdown Menu Toggling ──
    const sidebarElement = document.querySelector('.sidebar');
    if (sidebarElement) {
        const dropdownToggles = sidebarElement.querySelectorAll('.dropdown-toggle');
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const navItem = toggle.closest('.nav-item.dropdown');
                if (navItem) {
                    // Close other dropdowns if any
                    sidebarElement.querySelectorAll('.nav-item.dropdown').forEach(item => {
                        if (item !== navItem) {
                            item.classList.remove('open');
                        }
                    });
                    navItem.classList.toggle('open');
                }
            });
        });

        // Automatically open dropdown if a child link is active
        const activeSubLink = sidebarElement.querySelector('.nav-sub-bar a.active');
        if (activeSubLink) {
            const parentNavItem = activeSubLink.closest('.nav-item.dropdown');
            if (parentNavItem) {
                parentNavItem.classList.add('open');
            }
        }
    }

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
async function updateLeadStats(searchQuery = '') {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
        let url = `${API_URL}/leads/stats`;
        if (searchQuery) {
            url += `?search=${encodeURIComponent(searchQuery)}`;
        }
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) { window.doLogout(); return null; }
        if (response.ok) {
            const stats = await response.json();
            const badgeMap = {
                'badge-open': stats.open,
                'badge-today': stats.today,
                'badge-hot': stats.hot,
                'badge-followup': stats.followup,
                'badge-lost': stats.lost,
                'badge-all': stats.all,
                'badge-new': stats.new
            };
            Object.entries(badgeMap).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) {
                    const count = val !== undefined ? val : 0;
                    el.textContent = count;
                    el.style.display = 'inline-flex';
                    if (searchQuery) {
                        el.style.background = count > 0 ? '#10b981' : '#e2e8f0';
                        el.style.color = count > 0 ? '#ffffff' : '#64748b';
                    } else {
                        el.style.background = '';
                        el.style.color = '';
                    }
                }
            });
            return stats;
        }
    } catch (err) { console.error('Error fetching stats:', err); }
    return null;
}

let leadSearchDebounceTimer = null;
function setupLeadSearchInput() {
    const searchInput = document.getElementById('leadSearch');
    if (!searchInput) return;

    if (!document.getElementById('leadSearchStyles')) {
        const style = document.createElement('style');
        style.id = 'leadSearchStyles';
        style.innerHTML = `
            .search-bar {
                position: relative !important;
                display: flex !important;
                align-items: center !important;
            }
            .search-bar input {
                padding-right: 2.2rem !important;
            }
            .search-bar .clear-search-btn {
                position: absolute;
                right: 0.75rem;
                cursor: pointer;
                color: #94a3b8;
                font-size: 0.9rem;
                padding: 2px;
                border-radius: 50%;
                transition: all 0.2s ease;
                display: none;
                z-index: 10;
            }
            .search-bar .clear-search-btn:hover {
                color: #ef4444;
                background: #fee2e2;
            }
        `;
        document.head.appendChild(style);
    }

    const searchBar = searchInput.closest('.search-bar');
    if (searchBar) {
        let clearBtn = searchBar.querySelector('.clear-search-btn');
        if (!clearBtn) {
            clearBtn = document.createElement('i');
            clearBtn.className = 'fa-solid fa-circle-xmark clear-search-btn';
            clearBtn.id = 'leadSearchClear';
            clearBtn.title = 'Clear search';
            searchBar.appendChild(clearBtn);
        }

        clearBtn.style.display = searchInput.value.trim().length > 0 ? 'inline-block' : 'none';

        clearBtn.onclick = (e) => {
            e.stopPropagation();
            searchInput.value = '';
            clearBtn.style.display = 'none';
            searchInput.focus();
            triggerLeadSearch('');
        };
    }

    if (!searchInput.dataset.listenerSet) {
        searchInput.dataset.listenerSet = 'true';

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            const searchBar = searchInput.closest('.search-bar');
            const clearBtn = searchBar ? searchBar.querySelector('.clear-search-btn') : null;

            if (clearBtn) {
                clearBtn.style.display = query.length > 0 ? 'inline-block' : 'none';
            }

            clearTimeout(leadSearchDebounceTimer);
            leadSearchDebounceTimer = setTimeout(() => {
                triggerLeadSearch(query);
            }, 250);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(leadSearchDebounceTimer);
                triggerLeadSearch(searchInput.value.trim());
            }
        });
    }
}

async function triggerLeadSearch(query) {
    const stats = await updateLeadStats(query);

    const activeTab = document.querySelector('.nav-tab.active');
    const activeFilter = activeTab ? activeTab.getAttribute('data-filter') : 'all';

    if (query && stats) {
        const activeCount = stats[activeFilter] || 0;
        if (activeCount === 0 && stats.all > 0) {
            let targetFilter = 'all';
            const filterOrder = ['all', 'open', 'today', 'hot', 'followup', 'new', 'lost'];
            for (const f of filterOrder) {
                if (stats[f] > 0) {
                    targetFilter = f;
                    break;
                }
            }
            const targetTab = document.querySelector(`.nav-tab[data-filter="${targetFilter}"]`);
            if (targetTab && targetTab !== activeTab) {
                targetTab.click();
                return;
            }
        }
    }

    if (typeof window.initLeadList === 'function' && window.currentBaseFilters) {
        window.initLeadList(window.currentBaseFilters);
    }
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
                    all: {},
                    new: { status: 'new' }
                };
                await loadComponent(contentArea, `${window.ROOT_PATH}components/lead-list.html`, () => initLeadList(filterConfig[filter] || {}));
            }
        });
    });

    setupLeadSearchInput();
    const searchInput = document.getElementById('leadSearch');
    const currentQuery = searchInput ? searchInput.value.trim() : '';
    updateLeadStats(currentQuery);

    const todayTab = document.querySelector('.nav-tab[data-filter="today"]') || document.querySelector('.nav-tab[data-filter="all"]');
    if (todayTab) todayTab.click();

    // Auto-open lead details if ?leadId= is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const deepLinkLeadId = urlParams.get('leadId');
    if (deepLinkLeadId) {
        setTimeout(() => viewLeadDetails(parseInt(deepLinkLeadId)), 600);
    }
}

window.goBackToLeadsList = async function () {
    const contentArea = document.getElementById('lead-content-area');
    if (contentArea) {
        await loadComponent(contentArea, `${window.ROOT_PATH}components/lead-list.html`, () => {
            initLeadList(window.currentBaseFilters || {});
        });
    }
};

window.initLeadList = initLeadList;
async function initLeadList(filters = {}, page = 1) {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;

    // Inject pagination CSS if not present
    if (!document.getElementById('leadsPaginationStyles')) {
        const style = document.createElement('style');
        style.id = 'leadsPaginationStyles';
        style.innerHTML = `
            .leads-pagination-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem 1.5rem;
                background: white;
                border-top: 1px solid #f1f5f9;
                font-family: 'Inter', sans-serif;
                font-size: 0.875rem;
                color: #64748b;
            }
            .leads-pagination-info {
                font-weight: 500;
            }
            .leads-pagination-pages {
                display: flex;
                align-items: center;
                gap: 0.25rem;
            }
            .leads-pagination-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 2rem;
                height: 2rem;
                padding: 0 0.5rem;
                border: 1px solid #e2e8f0;
                background: white;
                color: #475569;
                border-radius: 0.375rem;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.85rem;
                transition: all 0.2s;
            }
            .leads-pagination-btn:hover:not(:disabled) {
                background: #f8fafc;
                border-color: #cbd5e1;
                color: #1e293b;
            }
            .leads-pagination-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .leads-pagination-btn.active {
                background: #10b981;
                border-color: #10b981;
                color: white;
            }
            .leads-pagination-limit {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .leads-pagination-select {
                padding: 0.35rem 1.75rem 0.35rem 0.75rem;
                font-size: 0.85rem;
                font-weight: 600;
                color: #475569;
                background: white;
                border: 1px solid #cbd5e1;
                border-radius: 0.375rem;
                cursor: pointer;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                background-position: right 0.5rem center;
                background-repeat: no-repeat;
                background-size: 1.25rem auto;
                appearance: none;
            }
            .leads-pagination-select:focus {
                outline: none;
                border-color: #10b981;
            }
        `;
        document.head.appendChild(style);
    }

    // ─── Filter Setup ───
    setupLeadSearchInput();
    const searchInput = document.getElementById('leadSearch');
    const statusF = document.getElementById('leadStatusFilter');
    const scoreF = document.getElementById('leadScoreFilter');
    const priorityF = document.getElementById('leadPriorityFilter');
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
    if (priorityF && !priorityF.dataset.listenerSet) {
        priorityF.dataset.listenerSet = 'true';
        priorityF.onchange = () => initLeadList(window.currentBaseFilters);
    }
    if (staffF && !staffF.dataset.listenerSet) {
        staffF.dataset.listenerSet = 'true';
        staffF.onchange = () => initLeadList(window.currentBaseFilters);

        // Fetch staff list and populate options
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/users/sales`, {
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

    const campaignF = document.getElementById('leadCampaignFilter');
    if (campaignF && !campaignF.dataset.listenerSet) {
        campaignF.dataset.listenerSet = 'true';
        campaignF.onchange = () => initLeadList(window.currentBaseFilters);

        // Fetch campaign list and populate options
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/campaigns`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const campaigns = await response.json();
                    const val = campaignF.value;
                    campaignF.innerHTML = '<option value="all">All Campaigns</option>';
                    campaigns.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c.id;
                        opt.textContent = `${c.campaign_id} - ${c.tag_line.substring(0, 30)}${c.tag_line.length > 30 ? '...' : ''}`;
                        campaignF.appendChild(opt);
                    });
                    campaignF.value = val;
                }
            } catch (err) {
                console.error('Failed to load campaigns list for filter:', err);
            }
        })();
    }

    if (dateF && !dateF.dataset.listenerSet) {
        dateF.dataset.listenerSet = 'true';
        if (typeof flatpickr !== 'undefined') {
            flatpickr(dateF, {
                mode: "range",
                dateFormat: "Y-m-d",
                onClose: function (selectedDates, dateStr, instance) {
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
            if (priorityF) priorityF.value = 'all';
            if (staffF) staffF.value = 'all';
            if (campaignF) campaignF.value = 'all';
            if (dateF) {
                dateF.value = '';
                if (dateF._flatpickr) {
                    dateF._flatpickr.clear();
                }
            }
            if (searchInput) {
                searchInput.value = '';
                const searchBar = searchInput.closest('.search-bar');
                const clearBtn = searchBar ? searchBar.querySelector('.clear-search-btn') : null;
                if (clearBtn) clearBtn.style.display = 'none';
                updateLeadStats('');
            }
            initLeadList(window.currentBaseFilters);
        };
    }

    tbody.innerHTML = '<tr><td colspan="11" class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading leads...</td></tr>';

    window.currentBaseFilters = filters; // Original context (e.g. {assigned_to: NULL})
    window.currentLeadsPage = page;
    window.currentLeadsLimit = parseInt(localStorage.getItem('leadsPageSize')) || 100;

    const token = localStorage.getItem('token');
    const params = new URLSearchParams();

    // Start with base filters
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v); });

    // Overlay with dynamic UI filters
    if (statusF && statusF.value !== 'all') params.set('status', statusF.value);
    if (scoreF && scoreF.value !== 'all') params.set('score', scoreF.value);
    if (priorityF && priorityF.value !== 'all') params.set('priority', priorityF.value);
    if (campaignF && campaignF.value !== 'all') params.set('campaign_id', campaignF.value);

    if (staffF && staffF.value !== 'all') {
        if (staffF.value === 'unassigned') {
            params.set('is_unassigned', 'true');
        } else {
            params.set('assigned_to', staffF.value);
        }
    }

    if (dateF && dateF.value) params.set('date', dateF.value);
    if (searchInput && searchInput.value) params.set('search', searchInput.value);

    // Apply pagination params
    params.set('page', window.currentLeadsPage);
    params.set('limit', window.currentLeadsLimit);

    try {
        const response = await fetch(`${API_URL}/leads?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();

        const leads = data.leads || [];
        window.currentLeadsList = leads; // For export

        if (!leads || leads.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No leads available.</td></tr>';
            // Clear pagination controls if empty
            const pagContainer = document.getElementById('leadsPagination');
            if (pagContainer) pagContainer.style.display = 'none';
            return;
        }

        const currentUser = window.getCurrentUser ? window.getCurrentUser() : {};
        const currentUserRole = (currentUser.role || '').toLowerCase();
        const isTelecomPanelUser = currentUserRole.includes('telecaller');

        tbody.innerHTML = leads.map(lead => {
            const statusClass = lead.status === 'assigned' ? 'badge-assigned' : (lead.status === 'new' ? 'badge-unassigned' : 'badge-state');
            const _dateObj = new Date(lead.created_at);
            const date = _dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const time = _dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const nameInitial = lead.customer_name ? lead.customer_name.charAt(0).toUpperCase() : '?';
            const isChecked = window.currentSelectedLeadIds && window.currentSelectedLeadIds.includes(lead.lead_id) ? 'checked' : '';

            const callTag = lead.call_count >= 3 ? '<span class="call-tag tag-3">3rd Call</span>' :
                (lead.call_count === 2 ? '<span class="call-tag tag-2">2nd Call</span>' :
                    (lead.call_count === 1 ? '<span class="call-tag tag-1">1st Call</span>' : ''));

            let dateHtml = '';
            if (lead.next_followup_date) {
                const fuDate = new Date(lead.next_followup_date);
                const d = fuDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                const t = fuDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                const diffHrs = (fuDate - new Date()) / (1000 * 60 * 60);
                let colorClass = '#10b981';
                let icon = '📅';
                if (diffHrs < 0) { colorClass = '#ef4444'; icon = '⚠'; }
                else if (diffHrs < 24) { colorClass = '#f59e0b'; icon = '🔴'; }

                dateHtml = `<div style="font-size:0.75rem;font-weight:700;color:${colorClass};text-transform:uppercase;margin-bottom:2px;">${icon} Follow-up</div>
                            <div style="font-size:0.85rem;font-weight:600;color:#1e293b;white-space:nowrap;">${d}</div>
                            <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">${t}</div>`;
            } else {
                dateHtml = `<div style="font-size:0.75rem;font-weight:600;color:#94a3b8;text-transform:uppercase;margin-bottom:2px;">Added</div>
                            <div style="font-size:0.85rem;font-weight:600;color:#1e293b;white-space:nowrap;">${date}</div>
                            <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">${time}</div>`;
            }

            // 1. CRM Score Badge
            const scoreUpper = (lead.score || 'COLD').toUpperCase();
            let scoreBadgeHtml = '';
            if (scoreUpper === 'HOT') {
                scoreBadgeHtml = `<span class="badge-score" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-weight:700; padding:3px 8px; border-radius:999px;">HOT</span>`;
            } else if (scoreUpper === 'WARM' || scoreUpper === 'MILD') {
                scoreBadgeHtml = `<span class="badge-score" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:700; padding:3px 8px; border-radius:999px;">MILD</span>`;
            } else {
                scoreBadgeHtml = `<span class="badge-score" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; font-weight:700; padding:3px 8px; border-radius:999px;">COLD</span>`;
            }

            // 2. Chatbot Priority Badge & Progress Pill
            let priorityBadgeHtml = '-';
            if (lead.bot_answered !== undefined && lead.bot_answered > 0) {
                const bAns = lead.bot_answered;
                const bTot = lead.bot_total || 5;
                if (bAns >= 4) {
                    priorityBadgeHtml = `<div style="display:flex; flex-direction:column; align-items:center;"><span class="badge-score" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; font-weight:700; padding:3px 8px; border-radius:999px;">HIGH</span><div style="font-size:0.68rem; font-weight:700; color:#10b981; margin-top:3px; display:inline-flex; align-items:center; gap:3px;" title="${bAns} of ${bTot} Chatbot questions answered"><i class="fas fa-robot" style="font-size:0.65rem;"></i> ${bAns}/${bTot}</div></div>`;
                } else if (bAns >= 2) {
                    priorityBadgeHtml = `<div style="display:flex; flex-direction:column; align-items:center;"><span class="badge-score" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:700; padding:3px 8px; border-radius:999px;">MEDIUM</span><div style="font-size:0.68rem; font-weight:700; color:#d97706; margin-top:3px; display:inline-flex; align-items:center; gap:3px;" title="${bAns} of ${bTot} Chatbot questions answered"><i class="fas fa-robot" style="font-size:0.65rem;"></i> ${bAns}/${bTot}</div></div>`;
                } else {
                    priorityBadgeHtml = `<div style="display:flex; flex-direction:column; align-items:center;"><span class="badge-score" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; font-weight:700; padding:3px 8px; border-radius:999px;">LOW</span><div style="font-size:0.68rem; font-weight:700; color:#64748b; margin-top:3px; display:inline-flex; align-items:center; gap:3px;" title="${bAns} of ${bTot} Chatbot questions answered"><i class="fas fa-robot" style="font-size:0.65rem;"></i> ${bAns}/${bTot}</div></div>`;
                }
            } else {
                priorityBadgeHtml = `<span style="color:#94a3b8; font-size:0.8rem;">-</span>`;
            }

            return `
            <tr id="lead-row-${lead.lead_id}" onclick="viewLeadDetails(${lead.lead_id})" style="cursor:pointer;">
                <td onclick="event.stopPropagation()"><input type="checkbox" class="lead-checkbox" data-id="${lead.lead_id}" ${isChecked} onclick="event.stopPropagation(); toggleLeadSelection(this)"></td>
                <td>
                    <div class="name-cell">
                        <div class="name-initial">${nameInitial}</div>
                        <div>
                            <div style="font-weight: 600; color: #1e293b;">${lead.customer_name || 'Unknown'} ${callTag}</div>
                            ${lead.campaign_id_code ? (() => {
                    const fullCode = lead.campaign_id_code;
                    const shortCode = fullCode.length > 15 ? fullCode.substring(0, 12) + '...' : fullCode;
                    return `<span class="campaign-tag" title="${fullCode}" style="display: inline-block; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; font-size: 0.7rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-top: 4px; text-transform: uppercase; cursor: help;">📣 ${shortCode}</span>`;
                })() : ''}
                        </div>
                    </div>
                </td>
                <td><span class="${statusClass}">${lead.status}</span></td>
                <td>${scoreBadgeHtml}</td>
                <td>${priorityBadgeHtml}</td>
                <td>${lead.state || '-'}</td>
                <td><span class="language-tag">${lead.language || 'EN'}</span></td>
                <td onclick="event.stopPropagation()">
                    ${isTelecomPanelUser ? `
                        <a href="javascript:void(0)" onclick="window.copyToClipboard('${lead.phone_number || ''}')" style="color:#25d366;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px;" title="Click to Copy Number">
                            <i class="fab fa-whatsapp" style="font-size:1rem;"></i>${lead.phone_number || '-'}
                        </a>
                    ` : `
                        <a href="${window.ROOT_PATH}modules/whatsapp/whatsapp.html?phone=${lead.phone_number || ''}" target="_self" style="color:#25d366;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px;" title="Open WhatsApp Chat">
                            <i class="fab fa-whatsapp" style="font-size:1rem;"></i>${lead.phone_number || '-'}
                        </a>
                    `}
                </td>
                <td><div class="msg-trunk" title="${lead.first_message || ''}">${lead.first_message || '-'}</div></td>
                <td>${dateHtml}</td>
                <td>${lead.assigned_to_name || 'Unassigned'}</td>
            </tr>`;
        }).join('');

        // Render Pagination Controls below the table
        renderPaginationControls({
            totalLeads: data.totalLeads || 0,
            totalPages: data.totalPages || 1,
            currentPage: data.currentPage || 1,
            limit: data.limit || 100
        });

        // Bind Select All
        const selectAll = document.getElementById('selectAllLeads');
        if (selectAll) {
            const allChecked = leads.length > 0 && leads.every(lead => window.currentSelectedLeadIds && window.currentSelectedLeadIds.includes(lead.lead_id));
            selectAll.checked = allChecked;
            selectAll.onclick = (e) => selectAllLeadsToggle(e.target);
        }
        updateBulkActionsBar();

        // Restore scroll position by focusing/scrolling the clicked lead row into view
        if (window._lastClickedLeadId !== undefined) {
            const targetRow = document.getElementById(`lead-row-${window._lastClickedLeadId}`);
            delete window._lastClickedLeadId;
            if (targetRow) {
                setTimeout(() => {
                    targetRow.scrollIntoView({ block: 'center', behavior: 'instant' });
                    // Add a temporary highlight class so they can see which one they clicked!
                    targetRow.style.backgroundColor = '#ecfdf5'; // light emerald green
                    setTimeout(() => {
                        targetRow.style.transition = 'background-color 1s ease';
                        targetRow.style.backgroundColor = '';
                    }, 1500);
                }, 80);
            } else if (window._savedScrollY !== undefined) {
                const targetScroll = window._savedScrollY;
                delete window._savedScrollY;
                setTimeout(() => {
                    const scrollContainer = document.querySelector('.main-content');
                    if (scrollContainer) {
                        scrollContainer.scrollTop = targetScroll;
                    } else {
                        window.scrollTo({ top: targetScroll, behavior: 'instant' });
                    }
                }, 80);
            }
        }
    } catch (err) {
        console.error('[fetchAndRenderLeads Error]', err);
        tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Failed to load leads.</td></tr>';
    }
}

// ─── Pagination Rendering and Handlers ───────────────────────
window.renderPaginationControls = function ({ totalLeads, totalPages, currentPage, limit }) {
    let pagContainer = document.getElementById('leadsPagination');
    if (!pagContainer) {
        pagContainer = document.createElement('div');
        pagContainer.id = 'leadsPagination';
        pagContainer.className = 'leads-pagination-bar';
        const wrapper = document.querySelector('.lead-table-scroll-wrapper');
        if (wrapper) {
            wrapper.parentNode.insertBefore(pagContainer, wrapper.nextSibling);
        }
    }

    if (totalLeads === 0) {
        pagContainer.innerHTML = '';
        pagContainer.style.display = 'none';
        return;
    }
    pagContainer.style.display = 'flex';

    // Calculate showing range
    const startRange = (currentPage - 1) * limit + 1;
    const endRange = Math.min(currentPage * limit, totalLeads);

    // Build page buttons
    let pageButtonsHtml = '';

    // Prev button
    pageButtonsHtml += `
        <button class="leads-pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changeLeadsPage(${currentPage - 1})">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    // Smart visible pages range
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        pageButtonsHtml += `
            <button class="leads-pagination-btn" onclick="changeLeadsPage(1)">1</button>
        `;
        if (startPage > 2) {
            pageButtonsHtml += `<span style="padding: 0 0.25rem;">...</span>`;
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        pageButtonsHtml += `
            <button class="leads-pagination-btn ${p === currentPage ? 'active' : ''}" onclick="changeLeadsPage(${p})">${p}</button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageButtonsHtml += `<span style="padding: 0 0.25rem;">...</span>`;
        }
        pageButtonsHtml += `
            <button class="leads-pagination-btn" onclick="changeLeadsPage(${totalPages})">${totalPages}</button>
        `;
    }

    // Next button
    pageButtonsHtml += `
        <button class="leads-pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changeLeadsPage(${currentPage + 1})">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    // Build limit selector
    const limitOptions = [10, 20, 30, 100, 200, 500];
    let limitSelectHtml = `
        <div class="leads-pagination-limit">
            <span>Rows per page:</span>
            <select class="leads-pagination-select" onchange="changeLeadsLimit(this.value)">
    `;
    limitOptions.forEach(opt => {
        limitSelectHtml += `<option value="${opt}" ${opt === limit ? 'selected' : ''}>${opt}</option>`;
    });
    limitSelectHtml += `
            </select>
        </div>
    `;

    pagContainer.innerHTML = `
        <div class="leads-pagination-info">
            Showing <strong style="color: #1e293b;">${startRange}-${endRange}</strong> of <strong style="color: #1e293b;">${totalLeads}</strong> leads
        </div>
        <div class="leads-pagination-pages">
            ${pageButtonsHtml}
        </div>
        ${limitSelectHtml}
    `;
};

window.changeLeadsPage = function (page) {
    initLeadList(window.currentBaseFilters, page);
};

window.changeLeadsLimit = function (limit) {
    localStorage.setItem('leadsPageSize', limit);
    initLeadList(window.currentBaseFilters, 1);
};

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
    const canManageBulk = ['admin', 'super-admin', 'sales', 'manager'].includes((user.role || '').toLowerCase());

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
    if (!window.currentSelectedLeadIds || window.currentSelectedLeadIds.length === 0) {
        return window.showAlert("No Selection", "Please select at least one lead.", "info");
    }

    const selectedLeads = (window.currentLeadsList || []).filter(l => window.currentSelectedLeadIds.includes(l.lead_id));
    const alreadyAssigned = selectedLeads.filter(l => l.assigned_to && l.assigned_to_name && l.assigned_to_name.toLowerCase() !== 'unassigned');

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/users/sales`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const allUsers = await response.json();
        const users = allUsers.filter(u => u.role_name && (u.role_name.includes('executive') || u.role_name === 'sales' || u.role_name === 'viewer' || u.role_name === 'manager'));

        let warningHtml = '';
        if (alreadyAssigned.length > 0) {
            const listItems = alreadyAssigned.map(l => 
                `<li style="margin-bottom: 4px;">• <strong>${l.customer_name || 'Lead'}</strong> (${l.phone_number || '-'}) is already assigned to <strong>${l.assigned_to_name}</strong></li>`
            ).join('');
            
            warningHtml = `
                <div style="margin-bottom: 1.25rem; padding: 0.85rem 1rem; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; font-size: 0.85rem; color: #9a3412;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.875rem; margin-bottom: 0.4rem; color: #c2410c;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 1rem;"></i> Warning: ${alreadyAssigned.length} selected lead(s) are already assigned!
                    </div>
                    <ul style="list-style: none; margin: 0; padding: 0; line-height: 1.4;">
                        ${listItems}
                    </ul>
                    <div style="margin-top: 0.5rem; font-size: 0.8rem; font-weight: 600; color: #c2410c;">
                        Check before re-assigning to avoid duplicate assignments.
                    </div>
                </div>
            `;
        }

        const content = `
            <div style="padding: 1.25rem; background: #fff;">
                <div style="margin-bottom: 1.25rem; padding: 0.85rem 1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fas fa-users-gear" style="color: #16a34a; font-size: 1.2rem;"></i>
                    <p style="margin: 0; color: #166534; font-weight: 600;">Assigning ${window.currentSelectedLeadIds.length} selected lead(s)</p>
                </div>

                ${warningHtml}

                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: #475569; font-weight: 700; font-size: 0.85rem;">SELECT TEAM MEMBER</label>
                    <select id="bulkStaffSelect" class="form-control-premium" style="width: 100%; border: 1px solid #cbd5e1; padding: 0.6rem; border-radius: 8px;">
                        <option value="">Choose a staff member...</option>
                        ${users.map(u => `<option value="${u.user_id}">${u.name} — ${u.language || 'General'}</option>`).join('')}
                    </select>
                </div>

                <div style="display: flex; gap: 0.75rem;">
                    <button onclick="performBulkAssign()" class="btn" style="flex: 2; height: 44px; background: #059669; color: white; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 700; border-radius: 8px;">
                        <i class="fas fa-check-circle"></i> Confirm Assignment
                    </button>
                    <button onclick="window.hideModal()" class="btn btn-outline" style="flex: 1; height: 44px; font-weight: 600; border-radius: 8px;">Cancel</button>
                </div>
            </div>
        `;
        window.showModal({ title: 'Manual Multi-Assignment', content, hideFooter: true });
    } catch (err) {
        window.showAlert("Error", "Failed to load staff list. Please try again.", "error");
    }
};

window.autoAssignSelected = async function () {
    if (!window.currentSelectedLeadIds || window.currentSelectedLeadIds.length === 0) return window.showAlert("No Selection", "Please select at least one lead.", "info");

    const selectedLeads = (window.currentLeadsList || []).filter(l => window.currentSelectedLeadIds.includes(l.lead_id));
    const alreadyAssigned = selectedLeads.filter(l => l.assigned_to && l.assigned_to_name && l.assigned_to_name.toLowerCase() !== 'unassigned');

    let confirmMsg = `Are you sure you want to let the system auto-assign these ${window.currentSelectedLeadIds.length} lead(s) based on language?`;
    if (alreadyAssigned.length > 0) {
        const details = alreadyAssigned.map(l => `• ${l.customer_name || 'Lead'} (${l.phone_number || '-'}) is already assigned to ${l.assigned_to_name}`).join('\n');
        confirmMsg = `Notice: ${alreadyAssigned.length} selected lead(s) are ALREADY ASSIGNED:\n\n${details}\n\nDo you still want to re-assign them?`;
    }

    if (!confirm(confirmMsg)) return;

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
            if (typeof clearSelection === 'function') clearSelection();
            const currentSearch = document.getElementById('leadSearch')?.value.trim() || '';
            updateLeadStats(currentSearch);
            initLeadList(window.currentBaseFilters || {});
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

    const selectedLeads = (window.currentLeadsList || []).filter(l => (window.currentSelectedLeadIds || []).includes(l.lead_id));
    const alreadyAssigned = selectedLeads.filter(l => l.assigned_to && l.assigned_to_name && l.assigned_to_name.toLowerCase() !== 'unassigned');

    if (alreadyAssigned.length > 0) {
        const details = alreadyAssigned.map(l => `• ${l.customer_name || 'Lead'} (${l.phone_number || '-'}) is currently assigned to ${l.assigned_to_name}`).join('\n');
        if (!confirm(`Warning: ${alreadyAssigned.length} of the selected lead(s) are already assigned:\n\n${details}\n\nDo you still want to re-assign them?`)) {
            return;
        }
    }

    const token = localStorage.getItem('token');
    const btn = document.querySelector('#globalModal .btn');
    const originalText = btn ? btn.textContent : 'Assign';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Assigning...';
    }

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
            if (typeof clearSelection === 'function') clearSelection();
            window.hideModal();
            const currentSearch = document.getElementById('leadSearch')?.value.trim() || '';
            updateLeadStats(currentSearch);
            initLeadList(window.currentBaseFilters || {});
            window.showAlert("Success", "Leads assigned successfully!", "success");
        } else {
            const err = await response.json();
            alert(`Error: ${err.message}`);
        }
    } catch (err) {
        alert('Failed to connect to server.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
};

window.bulkUnassignLeads = async function () {
    if (!window.currentSelectedLeadIds || window.currentSelectedLeadIds.length === 0) {
        return window.showAlert("No Selection", "Please select at least one lead.", "info");
    }

    if (!confirm(`Are you sure you want to unassign the selected ${window.currentSelectedLeadIds.length} leads?`)) {
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/leads/bulk-unassign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                leadIds: window.currentSelectedLeadIds
            })
        });

        if (response.ok) {
            const result = await response.json();
            window.currentSelectedLeadIds = [];
            if (typeof clearSelection === 'function') clearSelection();
            const currentSearch = document.getElementById('leadSearch')?.value.trim() || '';
            updateLeadStats(currentSearch);
            initLeadList(window.currentBaseFilters || {});
            window.showAlert("Success", `Successfully unassigned ${result.count} leads.`, "success");
        } else {
            const err = await response.json();
            window.showAlert("Error", `Failed to unassign leads: ${err.message}`, "error");
        }
    } catch (err) {
        console.error('Bulk unassign error:', err);
        window.showAlert("Error", "Failed to connect to server.", "error");
    }
};



// ─── Lead Detail View ─────────────────────────────────────────
async function viewLeadDetails(leadId) {
    // Save scroll position of the .main-content scrollable container and last clicked lead ID before loading details
    const scrollContainer = document.querySelector('.main-content');
    window._savedScrollY = scrollContainer ? scrollContainer.scrollTop : (window.scrollY || window.pageYOffset);
    window._lastClickedLeadId = leadId;

    if (window.currentViewingLeadId !== leadId) {
        window.timelineShowAll = false;
        window.historyShowAll = false;
    }
    window.currentViewingLeadId = leadId;
    const contentArea = document.getElementById('lead-content-area');
    if (contentArea) {
        await loadComponent(contentArea, `${window.ROOT_PATH}components/lead-details.html`, async () => {
            await populateLeadDetails(leadId);
            const container = document.querySelector('.main-content');
            if (container) {
                container.scrollTop = 0;
            } else {
                window.scrollTo({ top: 0, behavior: 'instant' });
            }
        });
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
                topCustomerNameDisplay: lead.first_message || lead.customer_name || (lead.phone_number ? `Lead (${lead.phone_number})` : 'Lead Details'),
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
                    tagEl.textContent = lead.source || 'Direct Lead';
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
            await loadLeadTimeline(leadId);

            // ── Render Chatbot Summary Card ──
            renderChatbotSummaryCard(lead.chatbot_summary);

            // ── Hide Change Assignee for Telecaller Role ──
            const user = window.getCurrentUser();
            const role = (user.role || '').toLowerCase();
            const changeAssigneeBtn = document.getElementById('changeAssigneeBtn');
            if (changeAssigneeBtn) {
                if (role.includes('telecaller')) {
                    changeAssigneeBtn.style.display = 'none';
                } else {
                    changeAssigneeBtn.style.display = '';
                }
            }
        }
    } catch (err) { console.error('Lead detail error:', err); }
}

// ─── Chatbot Summary Renderer ────────────────────────────────────
function renderChatbotSummaryCard(chatbotSummary) {
    const badgeEl = document.getElementById('chatbotPriorityBadge');
    const containerEl = document.getElementById('chatbotSummaryContainer');
    if (!containerEl) return;

    if (!chatbotSummary || !chatbotSummary.steps || chatbotSummary.steps.length === 0) {
        if (badgeEl) badgeEl.style.display = 'none';
        containerEl.innerHTML = `
            <div style="text-align: center; padding: 1.25rem 0.75rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                <i class="fab fa-whatsapp" style="font-size: 1.75rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
                <p style="font-size: 0.8125rem; color: #64748b; font-weight: 600; margin: 0;">No Chatbot Activity</p>
                <p style="font-size: 0.75rem; color: #94a3b8; margin: 0.25rem 0 0 0;">This customer hasn't completed any WhatsApp bot questions yet.</p>
            </div>
        `;
        return;
    }

    // Render Priority Badge
    if (badgeEl) {
        badgeEl.style.display = 'inline-flex';
        badgeEl.textContent = chatbotSummary.priority_label;
        badgeEl.style.padding = '0.2rem 0.6rem';
        badgeEl.style.borderRadius = '9999px';
        badgeEl.style.fontSize = '0.7rem';
        badgeEl.style.fontWeight = '700';
        badgeEl.style.fontFamily = "'Outfit', sans-serif";

        if (chatbotSummary.priority_level === 'qualified') {
            badgeEl.style.background = '#dcfce7';
            badgeEl.style.color = '#15803d';
            badgeEl.style.border = '1px solid #bbf7d0';
        } else if (chatbotSummary.priority_level === 'medium') {
            badgeEl.style.background = '#fef3c7';
            badgeEl.style.color = '#b45309';
            badgeEl.style.border = '1px solid #fde68a';
        } else {
            badgeEl.style.background = '#f1f5f9';
            badgeEl.style.color = '#64748b';
            badgeEl.style.border = '1px solid #e2e8f0';
        }
    }

    // Progress Bar
    const pct = chatbotSummary.completion_percentage || 0;
    const answered = chatbotSummary.answered_questions || 0;
    const total = chatbotSummary.total_questions || 5;

    let html = `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 0.85rem 1rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.75rem; font-weight: 700; color: #475569;">
                <span>STAGE PROGRESS</span>
                <span style="color: #0284c7;">${answered} / ${total} Questions (${pct}%)</span>
            </div>
            <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #0284c7, #10b981); border-radius: 999px; transition: width 0.4s ease;"></div>
            </div>
        </div>

        <div style="margin-bottom: 1rem;">
            <h4 style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 0.65rem;">Question Flow Stages</h4>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;

    chatbotSummary.steps.forEach(step => {
        const isDone = step.answered;
        const icon = isDone 
            ? `<div style="width: 22px; height: 22px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; flex-shrink: 0;"><i class="fas fa-check"></i></div>`
            : `<div style="width: 22px; height: 22px; border-radius: 50%; background: #e2e8f0; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; flex-shrink: 0;">${step.step_number}</div>`;

        const valDisplay = isDone 
            ? `<span style="font-weight: 700; color: #0f172a; font-size: 0.8125rem;">${step.answer_value}</span>`
            : `<span style="color: #94a3b8; font-size: 0.75rem; font-style: italic;">Pending response</span>`;

        html += `
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: ${isDone ? '#ffffff' : '#f8fafc'}; border: 1px solid ${isDone ? '#cbd5e1' : '#f1f5f9'}; border-radius: 0.5rem; transition: all 0.2s;">
                ${icon}
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-size: 0.7rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;">Step ${step.step_number}: ${step.title}</div>
                    <div style="margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${valDisplay}</div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    const isHumanNeeded = chatbotSummary.status === 'paused_for_human' || (window.currentLeadData && window.currentLeadData.status === 'human_needed');
    const phone = window.currentLeadData ? window.currentLeadData.phone_number : '';

    html += `
        <div style="background: ${isHumanNeeded ? '#fef2f2' : '#eff6ff'}; border: 1px solid ${isHumanNeeded ? '#fecaca' : '#dbeafe'}; border-radius: 0.75rem; padding: 0.85rem; font-size: 0.75rem; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="color: ${isHumanNeeded ? '#991b1b' : '#1e40af'}; font-weight: 700;">
                    <i class="fas ${isHumanNeeded ? 'fa-triangle-exclamation' : 'fa-info-circle'} mr-1"></i> 
                    Flow: ${chatbotSummary.flow_name || 'Enquiry Flow'}
                </span>
                <span class="badge" style="background: ${isHumanNeeded ? '#ef4444' : (chatbotSummary.status === 'completed' ? '#dcfce7' : '#fef9c3')}; color: ${isHumanNeeded ? '#ffffff' : (chatbotSummary.status === 'completed' ? '#166534' : '#854d0e')}; font-size: 0.65rem; text-transform: uppercase; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-weight: 700;">
                    ${isHumanNeeded ? '🚨 HUMAN NEEDED' : (chatbotSummary.status || 'active')}
                </span>
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button onclick="window.retriggerBotFlow('${phone}')" class="login-btn" style="flex: 1; padding: 0.45rem 0.5rem; font-size: 0.75rem; background: #3b82f6; border: none; color: white; border-radius: 0.375rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
                    <i class="fas fa-rotate-right"></i> Re-Trigger Bot
                </button>
                <button onclick="window.takeoverBotFlow('${phone}')" class="login-btn" style="flex: 1; padding: 0.45rem 0.5rem; font-size: 0.75rem; background: #f59e0b; border: none; color: white; border-radius: 0.375rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
                    <i class="fas fa-pause"></i> Pause & Takeover
                </button>
            </div>
        </div>
    `;

    containerEl.innerHTML = html;
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
        if (cropEl) payload.current_crop = cropEl.value;

        const acreEl = document.getElementById('editAcreage');
        if (acreEl) payload.acreage = acreEl.value ? parseFloat(acreEl.value) : null;
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

        let warningHtml = '';
        if (window.currentLeadData && window.currentLeadData.assigned_to_name && window.currentLeadData.assigned_to_name.toLowerCase() !== 'unassigned') {
            warningHtml = `
                <div style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; font-size: 0.825rem; color: #9a3412;">
                    <div style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; color: #c2410c; margin-bottom: 0.25rem;">
                        <i class="fas fa-exclamation-triangle"></i> Notice: Lead Already Assigned
                    </div>
                    This lead (<strong>${window.currentLeadData.customer_name || window.currentLeadData.phone_number || 'Lead'}</strong>) is currently assigned to <strong>${window.currentLeadData.assigned_to_name}</strong>. Re-assigning will transfer ownership.
                </div>
            `;
        }

        const content = `
            <div style="padding: 1rem;">
                ${warningHtml}
                <p style="margin-bottom: 0.75rem; color: #475569; font-weight: 600; font-size: 0.875rem;">Assign this lead to a staff member:</p>
                <select id="singleStaffSelect" style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <option value="">Select Staff Member...</option>
                    ${users.map(u => {
            const langMap = { EN: 'English', HI: 'Hindi', KA: 'Kannada', KN: 'Kannada', TN: 'Tamil', TA: 'Tamil', TE: 'Telugu', ML: 'Malayalam', MR: 'Marathi' };
            const langs = u.language ? u.language.split(',').map(l => langMap[l.trim()] || l.trim()).join(', ') : 'General';
            return `<option value="${u.user_id}">${u.name} (${langs})</option>`;
        }).join('')}
                </select>
                <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                    <button onclick="performSingleAssign(${leadId})" class="btn" style="flex: 2; background: #059669; color: white; font-weight: 700;">Confirm Change</button>
                    <button onclick="window.hideModal()" class="btn btn-outline" style="flex: 1; font-weight: 600;">Cancel</button>
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
        const url = `${window.ROOT_PATH}components/quick-lead-form.html`;
        const res = await fetch(url);
        if (!res.ok) {
            alert(`Error: Failed to fetch modal content from ${url} (status: ${res.status})`);
            return;
        }
        const text = await res.text();
        window.showModal({ title: 'Quick Lead Entry', content: text, hideFooter: true });
    } catch (err) {
        alert('Add lead modal error: ' + err.message);
        console.error('Add lead modal error:', err);
    }
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
window.exportLeadsToExcel = async function () {
    // Determine which leads to export
    let leadsToExport = [];

    if (window.currentSelectedLeadIds && window.currentSelectedLeadIds.length > 0) {
        // Export only checked leads
        leadsToExport = window.currentLeadsList.filter(lead => window.currentSelectedLeadIds.includes(lead.lead_id));
    } else {
        // Fetch all matching leads from backend (limit=all) with current filters
        const btn = document.getElementById('btnExportExcel');
        const originalHtml = btn ? btn.innerHTML : 'Export Excel';
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Exporting...';
            btn.disabled = true;
        }

        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams();

            // Reconstruct current filters
            if (window.currentBaseFilters) {
                Object.entries(window.currentBaseFilters).forEach(([k, v]) => { if (v) params.append(k, v); });
            }

            const statusF = document.getElementById('leadStatusFilter');
            const scoreF = document.getElementById('leadScoreFilter');
            const staffF = document.getElementById('leadStaffFilter');
            const dateF = document.getElementById('leadDateFilter');
            const searchInput = document.getElementById('leadSearch');

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

            // Request full list
            params.set('limit', 'all');

            const response = await fetch(`${API_URL}/leads?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('API Error');
            const result = await response.json();
            leadsToExport = result.leads || [];
        } catch (err) {
            console.error('Export fetch error:', err);
            window.showAlert("Export Failed", "Failed to retrieve matching leads from server", "error");
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
            return;
        }

        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }

    if (!leadsToExport || leadsToExport.length === 0) {
        if (window.showAlert) {
            window.showAlert("Export Failed", "No leads available to export.", "info");
        } else {
            alert("No leads available to export.");
        }
        return;
    }

    // Standardized export layout across ALL tabs (All Leads, Lost, Followups, MildHot, Today, Open, New, etc.)
    const headers = ["Phone Number", "Priority", "Product Name", "Campaign Tag / Code", "Assigned Staff", "Date and Time", "Farmer Name"];
    let csvContent = headers.join(",") + "\n";

    leadsToExport.forEach(lead => {
        const bAns = lead.bot_answered !== undefined ? lead.bot_answered : 0;
        const bTot = lead.bot_total || 5;
        let priorityStr = 'NONE';
        if (lead.bot_priority) {
            priorityStr = lead.bot_priority.toUpperCase();
        } else if (lead.score) {
            priorityStr = lead.score.toUpperCase();
        } else if (bAns >= 4) {
            priorityStr = 'HIGH';
        } else if (bAns >= 2) {
            priorityStr = 'MEDIUM';
        } else if (bAns >= 1) {
            priorityStr = 'LOW';
        }
        const priorityFull = priorityStr.includes('/') ? priorityStr : `${priorityStr} (${bAns}/${bTot})`;

        let prodName = lead.campaign_product_name || lead.product_name || lead.product_interest || '';
        if (!prodName && lead.bot_variables) {
            try {
                const vars = typeof lead.bot_variables === 'string' ? JSON.parse(lead.bot_variables) : lead.bot_variables;
                prodName = vars.product_interest || vars.product || vars.barrow_type || '';
            } catch(e) {}
        }
        if (!prodName) prodName = '-';

        const campaignCode = lead.campaign_id_code || lead.campaign_name || lead.campaign_tag || lead.first_message || lead.source || 'Direct';
        const farmerName = lead.customer_name || lead.farmer_name || '-';
        const assignedStaff = lead.assigned_to_name || lead.assigned_name || lead.staff_name || 'Unassigned';
        const dateTimeStr = lead.created_at ? new Date(lead.created_at).toLocaleString('en-IN') : '-';

        const row = [
            `"${lead.phone_number || ''}"`,
            `"${priorityFull}"`,
            `"${prodName.replace(/"/g, '""')}"`,
            `"${campaignCode.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            `"${assignedStaff.replace(/"/g, '""')}"`,
            `"${dateTimeStr}"`,
            `"${farmerName.replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Get active tab name for filename
    const activeTab = document.querySelector('.nav-tab.active');
    let tabName = "Leads";
    if (activeTab) {
        const filter = activeTab.getAttribute('data-filter');
        const nameMap = {
            open: 'Open_Leads',
            today: 'Todays_Leads',
            hot: 'Hot_Leads',
            followup: 'FollowUps_Mild',
            lost: 'Lost_Leads',
            all: 'All_Leads',
            new: 'New_Leads'
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

// Helper to manage dismissed human alert IDs in session storage
function getDismissedAlerts() {
    try {
        return JSON.parse(sessionStorage.getItem('dismissed_human_alerts') || '[]');
    } catch (e) {
        return [];
    }
}

function markAlertAsDismissed(identifier) {
    if (!identifier) return;
    const list = getDismissedAlerts();
    const str = String(identifier);
    if (!list.includes(str)) {
        list.push(str);
        sessionStorage.setItem('dismissed_human_alerts', JSON.stringify(list));
    }
}

window.retriggerBotFlow = async function(sessionIdOrPhone) {
    if (!sessionIdOrPhone) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${window.API_URL}/chatbot/sessions/retrigger`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId: sessionIdOrPhone, phone: sessionIdOrPhone })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to re-trigger flow');

        window.showAlert('Flow Re-Triggered', 'Chatbot flow resumed and prompt sent to customer on WhatsApp!', 'success');
        
        // Remove toast if active
        const toast = document.getElementById('telecaller-human-alert-toast');
        if (toast) toast.remove();

        // Refresh UI if functions exist
        if (typeof window.fetchPendingHumanAlerts === 'function') window.fetchPendingHumanAlerts();
        if (typeof window.loadLeads === 'function') window.loadLeads();
    } catch (err) {
        window.showAlert('Error', err.message, 'error');
    }
};

window.takeoverBotFlow = async function(sessionIdOrPhone) {
    if (!sessionIdOrPhone) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${window.API_URL}/chatbot/sessions/takeover`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId: sessionIdOrPhone, phone: sessionIdOrPhone })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to take over flow');

        markAlertAsDismissed(sessionIdOrPhone);
        const toast = document.getElementById('telecaller-human-alert-toast');
        if (toast) toast.remove();

        window.showAlert('Bot Paused', 'Chatbot flow paused for manual telecaller takeover!', 'info');
    } catch (err) {
        window.showAlert('Error', err.message, 'error');
    }
};

window.openTelecallerChat = function(phone, sessionId) {
    if (!phone) return;
    markAlertAsDismissed(phone);
    if (sessionId) markAlertAsDismissed(sessionId);
    const toast = document.getElementById('telecaller-human-alert-toast');
    if (toast) toast.remove();
    window.location.href = `${window.ROOT_PATH}modules/whatsapp/whatsapp.html?phone=${encodeURIComponent(phone)}`;
};

window.dismissHumanAlertToast = function(identifier) {
    if (identifier) {
        markAlertAsDismissed(identifier);
    } else if (window._currentActiveAlertId) {
        markAlertAsDismissed(window._currentActiveAlertId);
    }
    const toast = document.getElementById('telecaller-human-alert-toast');
    if (toast) toast.remove();
};

let lastAlertCount = 0;
window.fetchPendingHumanAlerts = async function() {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Check Notification settings
    const notifEnabled = localStorage.getItem('notifications_enabled') !== 'false';
    const soundMuted = localStorage.getItem('notification_sound_muted') === 'true';

    if (!notifEnabled) {
        const toast = document.getElementById('telecaller-human-alert-toast');
        if (toast) toast.remove();
        return;
    }

    try {
        const res = await fetch(`${window.API_URL}/chatbot/sessions/human-needed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const alerts = await res.json();
        if (!Array.isArray(alerts) || alerts.length === 0) {
            const toast = document.getElementById('telecaller-human-alert-toast');
            if (toast) toast.remove();
            lastAlertCount = 0;
            return;
        }

        const dismissedList = getDismissedAlerts();
        const activeAlerts = alerts.filter(a => 
            !dismissedList.includes(String(a.session_id)) && 
            !dismissedList.includes(String(a.phone))
        );

        if (activeAlerts.length === 0) {
            const toast = document.getElementById('telecaller-human-alert-toast');
            if (toast) toast.remove();
            lastAlertCount = 0;
            return;
        }

        const firstAlert = activeAlerts[0];
        window._currentActiveAlertId = firstAlert.session_id || firstAlert.phone;

        // Play alert chime sound if new alert arrives AND sound is not muted
        if (activeAlerts.length > lastAlertCount && !soundMuted) {
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(() => {});
            } catch (e) {}
        }
        lastAlertCount = activeAlerts.length;

        let toast = document.getElementById('telecaller-human-alert-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'telecaller-human-alert-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: #0f172a;
                color: #ffffff;
                padding: 16px 20px;
                border-radius: 14px;
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.2);
                border-left: 5px solid #ef4444;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 380px;
                font-family: 'Inter', sans-serif;
                animation: fcmSlideIn 0.35s ease-out;
            `;
            document.body.appendChild(toast);
        }

        const custName = firstAlert.customer_name || 'WhatsApp Customer';
        const phone = firstAlert.phone || firstAlert.phone_number || '';
        const sessionId = firstAlert.session_id || phone;
        const msgSnippet = firstAlert.last_message ? `"${firstAlert.last_message.slice(0, 45)}..."` : 'Requested human agent takeover';

        toast.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:13.5px; color:#f87171; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:15px;"></i>
                    🚨 Human Assistance Needed (${activeAlerts.length})
                </span>
                <button onclick="window.dismissHumanAlertToast('${sessionId}')" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:14px;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div style="font-size:12.5px; color:#cbd5e1; line-height:1.4;">
                Customer <strong>${escapeHtml(custName)}</strong> (${escapeHtml(phone)})<br>
                <span style="font-size:11.5px; color:#94a3b8; font-style:italic;">${escapeHtml(msgSnippet)}</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:4px;">
                <button onclick="window.openTelecallerChat('${phone}', '${sessionId}')" style="background:#ef4444; color:#fff; border:none; padding:7px 12px; border-radius:7px; font-weight:700; font-size:12px; cursor:pointer; flex:1;">
                    <i class="fa-solid fa-headset"></i> Takeover Chat
                </button>
                <button onclick="window.retriggerBotFlow('${sessionId}')" style="background:#3b82f6; color:#fff; border:none; padding:7px 12px; border-radius:7px; font-weight:700; font-size:12px; cursor:pointer; flex:1;">
                    <i class="fa-solid fa-rotate-right"></i> Re-Trigger Flow
                </button>
            </div>
        `;
    } catch (err) {
        console.warn('[PENDING ALERTS POLL ERROR]', err);
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Start polling pending human handoff alerts every 12 seconds
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.fetchPendingHumanAlerts, 2000);
    setInterval(window.fetchPendingHumanAlerts, 12000);
});
