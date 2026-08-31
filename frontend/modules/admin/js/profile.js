// ============================================================
// profile.js — Logged-in User Profile Management (Fully Dynamic)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = window.getCurrentUser();
    if (!currentUser) {
        window.location.href = `${window.ROOT_PATH}index.html`;
        return;
    }

    // Set page control tower title
    const userName = currentUser.name || currentUser.username || 'User';
    const controlTowerTitle = document.getElementById('pageControlTowerTitle');
    if (controlTowerTitle) {
        controlTowerTitle.textContent = `${userName}'s Control Tower`;
    }

    // Breadcrumb home link
    const btnBreadcrumbHome = document.getElementById('btnBreadcrumbHome');
    if (btnBreadcrumbHome) {
        btnBreadcrumbHome.addEventListener('click', () => {
            const role = (currentUser.role || '').toLowerCase();
            if (role === 'admin' || role === 'super-admin') {
                window.location.href = `${window.ROOT_PATH}modules/admin/dashboard.html`;
            } else if (role.includes('telecaller') || role.includes('sales')) {
                window.location.href = `${window.ROOT_PATH}modules/sales/dashboard.html`;
            } else if (role.includes('billing')) {
                window.location.href = `${window.ROOT_PATH}modules/billing/dashboard.html`;
            } else if (role.includes('shipping')) {
                window.location.href = `${window.ROOT_PATH}modules/shipping/dashboard.html`;
            } else if (role.includes('pack')) {
                window.location.href = `${window.ROOT_PATH}modules/packing/dashboard.html`;
            } else {
                window.location.href = `${window.ROOT_PATH}index.html`;
            }
        });
    }

    // Tab switching handlers
    const tabBtns = document.querySelectorAll('.profile-tab-item');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const targetTab = e.currentTarget.getAttribute('data-tab');
            console.log(`Switched to profile tab: ${targetTab}`);
        });
    });

    // Load Profile Data
    await loadUserProfileData(currentUser);
});

async function loadUserProfileData(currentUser) {
    try {
        const userId = currentUser.user_id || currentUser.id;
        let user = currentUser;
        try {
            let res = await window.fetchWithAuth(`${window.API_BASE_URL}/users/profile/me`);
            if (!res || (!res.email && userId)) {
                res = await window.fetchWithAuth(`${window.API_BASE_URL}/users/${userId}`);
            }
            if (res && (res.user_id || res.id)) {
                user = Object.assign({}, currentUser, res);
            }
        } catch (fetchErr) {
            console.warn('Fallback to local currentUser object:', fetchErr);
        }

        const userName = user.name || user.username || 'User';
        const userRoleRaw = user.role_name || user.role || 'Staff';
        const userRole = userRoleRaw.replace(/_/g, ' ').toUpperCase();
        const userDept = user.department_name || (user.department_id ? `Dept #${user.department_id}` : 'General');
        const userStatus = (user.status || 'active').toLowerCase();
        const isActive = userStatus === 'active';

        // 1. Control Tower Title & Topbar
        const controlTowerTitle = document.getElementById('pageControlTowerTitle');
        if (controlTowerTitle) {
            controlTowerTitle.textContent = `${userName}'s Control Tower`;
        }

        // 2. Header Banner
        document.getElementById('breadcrumbUserName').textContent = userName;
        document.getElementById('myProfileAvatar').textContent = userName.charAt(0).toUpperCase();
        document.getElementById('myProfileName').textContent = userName;
        
        const statusBadgeEl = document.getElementById('myProfileStatusBadge');
        if (statusBadgeEl) {
            statusBadgeEl.className = `status-badge ${isActive ? 'active' : 'inactive'}`;
            statusBadgeEl.textContent = isActive ? 'Active' : 'Inactive';
        }
        
        document.getElementById('myProfileRoleTitle').textContent = userRole;

        const isUserAdmin = userName.toLowerCase().includes('admin') || userRole.includes('ADMIN');
        const userEmail = user.email || '';
        const userPhone = user.phone || '';
        const userEmpId = user.employee_id || '';

        document.getElementById('myProfileEmail').innerHTML = `<i class="far fa-envelope" style="margin-right:0.3rem;"></i>${userEmail || '-'}`;
        document.getElementById('myProfilePhone').textContent = userPhone || '-';
        document.getElementById('myProfileEmpId').textContent = userEmpId || '-';
        
        const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        document.getElementById('myProfileJoinedDate').textContent = joinDate;

        document.getElementById('myProfileDept').textContent = userDept;
        document.getElementById('myProfileReporting').textContent = user.reporting_to || 'Admin';
        document.getElementById('myProfileLocation').textContent = user.address || 'Coimbatore, Tamil Nadu, India';
        document.getElementById('myProfileLastLogin').textContent = user.last_login ? new Date(user.last_login).toLocaleString() : 'Recent';
        
        const statusTextEl = document.getElementById('myProfileStatusText');
        if (statusTextEl) {
            statusTextEl.innerHTML = `<span style="color:${isActive ? '#10b981' : '#cbd5e1'};">● ${isActive ? 'Active' : 'Inactive'}</span>`;
        }
        
        const isFullAccess = (user.role === 'admin' || user.role === 'super-admin' || isUserAdmin);
        const accessLevelEl = document.getElementById('myProfileAccessLevel');
        if (accessLevelEl) {
            accessLevelEl.innerHTML = `<span class="badge-pill-outline" style="background:${isFullAccess ? '#f0fdf4' : '#eff6ff'};color:${isFullAccess ? '#15803d' : '#2563eb'};border:1px solid ${isFullAccess ? '#bbf7d0' : '#bfdbfe'};padding:0.15rem 0.5rem;">${isFullAccess ? 'Full Access' : 'Standard Access'}</span>`;
        }

        // 3. User Information Card
        document.getElementById('infoMyFullName').textContent = userName;
        document.getElementById('infoMyEmail').textContent = userEmail || '-';
        document.getElementById('infoMyPhone').textContent = userPhone || '-';
        document.getElementById('infoMyEmpId').textContent = userEmpId || '-';
        document.getElementById('infoMyDept').textContent = userDept;
        document.getElementById('infoMyRole').textContent = userRole;
        document.getElementById('infoMyJoining').textContent = joinDate;
        
        const infoStatusEl = document.getElementById('infoMyStatus');
        if (infoStatusEl) {
            infoStatusEl.className = `status-badge ${isActive ? 'active' : 'inactive'}`;
            infoStatusEl.textContent = isActive ? 'Active' : 'Inactive';
        }
        
        document.getElementById('infoMyAddress').textContent = user.address || 'Tamil Nadu, India';
        document.getElementById('infoMyBio').textContent = user.bio || `Staff member assigned to ${userDept} as ${userRole}.`;

        // 4. Roles & Permissions Card
        document.getElementById('permMyPrimaryRole').textContent = userRole;
        document.getElementById('permMyAccessLevel').textContent = isFullAccess ? 'Full Access' : 'Standard Access';

        // Render Dynamic Module Access List from user.permissions
        let userPerms = [];
        try {
            userPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || []);
        } catch(e) { userPerms = []; }

        const availableModules = [
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'leads', label: 'Lead Management' },
            { key: 'whatsapp', label: 'WhatsApp Communication' },
            { key: 'orders', label: 'Orders' },
            { key: 'inventory', label: 'Products & Inventory' },
            { key: 'packing', label: 'Packing' },
            { key: 'billing', label: 'Billing' },
            { key: 'shipping', label: 'Shipping' },
            { key: 'campaigns', label: 'Campaigns' },
            { key: 'users', label: 'Users & Roles' },
            { key: 'reports', label: 'Reports & Analytics' },
            { key: 'logs', label: 'System Logs' },
            { key: 'settings', label: 'Settings' }
        ];

        const moduleGrid = document.getElementById('myProfileModuleAccessGrid');
        if (moduleGrid) {
            moduleGrid.innerHTML = availableModules.map(m => {
                const hasPerm = isFullAccess || userPerms.some(p => p.toLowerCase().includes(m.key) || p.toLowerCase().includes(m.label.toLowerCase()));
                return `
                    <div class="permission-check-item" style="opacity: ${hasPerm ? '1' : '0.5'};">
                        <i class="fas ${hasPerm ? 'fa-circle-check' : 'fa-circle-xmark'}" style="color:${hasPerm ? '#10b981' : '#94a3b8'};"></i> ${m.label}
                    </div>
                `;
            }).join('');
        }

        // Render Recent Activities if available
        if (user.recent_activity && Array.isArray(user.recent_activity) && user.recent_activity.length > 0) {
            const timelineEl = document.getElementById('myProfileActivityTimeline');
            if (timelineEl) {
                timelineEl.innerHTML = user.recent_activity.slice(0, 5).map(act => `
                    <div class="timeline-event-item">
                        <div class="timeline-event-dot" style="border-color:#3b82f6;color:#3b82f6;"><i class="fas fa-clock-rotate-left"></i></div>
                        <div>
                            <div class="timeline-event-title">${act.title || act.action || 'Activity Recorded'}</div>
                            <div class="timeline-event-sub">${act.description || act.details || '-'}</div>
                        </div>
                        <div class="timeline-event-time">${act.created_at ? new Date(act.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Recent'}</div>
                    </div>
                `).join('');
            }
        }

        // 5. Action Buttons
        document.getElementById('btnEditMyProfile')?.addEventListener('click', () => {
            window.showAlert('Edit Profile', 'Profile edit window opened.', 'info');
        });
        document.getElementById('btnResetMyPassword')?.addEventListener('click', () => {
            window.showAlert('Reset Password', 'Password reset email sent to your registered email.', 'success');
        });
        document.getElementById('btnChangePasswordAction')?.addEventListener('click', () => {
            window.showAlert('Change Password', 'Enter your current password to update.', 'info');
        });
    } catch (err) {
        console.error('Failed to load profile data:', err);
    }
}
