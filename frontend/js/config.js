// ============================================================
// config.js — Global Configuration for SGB Agro CRM Frontend
// ============================================================

// ─── Backend URL ─────────────────────────────────────────────
const BACKEND_PORT = 5000;
const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
// window.BASE_URL = isLocal ? `http://127.0.0.1:${BACKEND_PORT}` : 'https://paleturquoise-elk-361855.hostingersite.com';
// Set this to true if you want to use the local backend (localhost:5000)
const USE_LOCAL_BACKEND = true;

window.BASE_URL = USE_LOCAL_BACKEND ? `http://127.0.0.1:${BACKEND_PORT}` : 'https://paleturquoise-elk-361855.hostingersite.com';
window.API_URL = `${window.BASE_URL}/api`;
window.FCM_VAPID_KEY = 'BCt9SBycqLOQToZjMnZ9sRedn1Etk7-HtrCeCnPxAQEmgqCnMA87QtqPflx6Wi1PAOU2to8Rd6F_AeY1OEhTRE4';

// ─── Root Path Computation ───────────────────────────────────
// Computes how many levels deep we are from the frontend root.
(function computeRootPath() {
    const path = window.location.pathname;
    const anchors = ['/modules/', '/js/', '/css/', '/components/'];
    let rootFound = false;

    for (const anchor of anchors) {
        const index = path.lastIndexOf(anchor);
        if (index !== -1) {
            const subPath = path.substring(index + 1);
            const segments = subPath.split('/').filter(Boolean);
            const depth = segments.length - 1;
            window.ROOT_PATH = '../'.repeat(Math.max(0, depth)) || './';
            rootFound = true;
            break;
        }
    }

    if (!rootFound) {
        window.ROOT_PATH = './';
    }
    console.log('Computed ROOT_PATH:', window.ROOT_PATH, 'for path:', path);
})();

window.ROLE_REDIRECTS = {
    admin: 'modules/admin/dashboard.html',
    'super-admin': 'modules/admin/dashboard.html',
    sales: 'modules/sales/dashboard.html',
    billing: 'modules/billing/billing.html',
    packing: 'modules/packing/dashboard.html',
    shipping: 'modules/shipping/dashboard.html',
    shipment: 'modules/shipping/dashboard.html',
    whatsapp_manager: 'modules/whatsapp/whatsapp.html'
};

window.getHomeUrl = function (user) {
    if (!user || !user.role) return 'index.html';
    const role = user.role.toLowerCase();

    if (role === 'admin' || role === 'super-admin') {
        return window.ROLE_REDIRECTS[role];
    }

    // Check if they have custom PBAC permissions
    let userPermissions = [];
    try {
        userPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || []);
    } catch (e) { }

    // Route based on department permissions injected by auth controller
    if (userPermissions.includes('sales_dashboard')) return 'modules/sales/dashboard.html';
    if (userPermissions.includes('packing_dashboard')) return 'modules/packing/dashboard.html';
    if (userPermissions.includes('shipping_dashboard')) return 'modules/shipping/dashboard.html';
    if (userPermissions.includes('billing_billing')) return 'modules/billing/billing.html';

    // If they have PBAC permissions but don't match the above, or are a manager, route them to the unified dashboard as fallback
    if ((userPermissions.length > 0 || user.is_manager) && role !== 'admin' && role !== 'super-admin') {
        return 'modules/admin/dashboard.html';
    }

    // Otherwise, route them to their native role dashboard (fallback for legacy tokens)
    return window.ROLE_REDIRECTS[role] || 'index.html';
};

// ─── Get Current User ────────────────────────────────────────
window.getCurrentUser = function () {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch (e) { }

    if (!user || !user.role) {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const b64 = token.split('.')[1]
                    .replace(/-/g, '+')
                    .replace(/_/g, '/')
                    .padEnd(Math.ceil(token.split('.')[1].length / 4) * 4, '=');
                const payload = JSON.parse(atob(b64));
                user = {
                    id: payload.id,
                    name: payload.name,
                    role: payload.role,
                    department_id: payload.department_id,
                    is_manager: payload.is_manager,
                    permissions: payload.permissions
                };
                localStorage.setItem('user', JSON.stringify(user));
            } catch (e) { console.warn('JWT error:', e); }
        }
    }
    return user || {};
};

// ─── Auth Guard ──────────────────────────────────────────────
window.requireAuth = function (allowedRoles = []) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = `${window.ROOT_PATH}index.html`;
        return false;
    }

    const user = window.getCurrentUser();
    const role = (user.role || '').toLowerCase();

    // Automatically allow super-admin wherever admin is allowed
    if (role === 'super-admin' && allowedRoles.includes('admin') && !allowedRoles.includes('super-admin')) {
        allowedRoles.push('super-admin');
    }

    // PBAC Bypass: If the user has custom permissions or is a manager, allow them into unified folders 
    // Security is handled by the backend APIs and sidebar filtering.
    let userPermissions = [];
    try { userPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || []); } catch (e) { }
    if (userPermissions.length > 0 || user.is_manager) {
        return true;
    }

    // Standard folder-based role restriction
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        const home = window.getHomeUrl(user);

        // Loop Breaker
        const targetPath = new URL(home, window.location.origin + window.location.pathname).pathname;
        if (window.location.pathname.includes(targetPath)) {
            console.error("Infinite redirect detected. Staying on current page or redirecting to safe state.");
            return false;
        }

        window.location.href = `${window.ROOT_PATH}${home}`;
        return false;
    }
    return true;
};

// ─── Logout ──────────────────────────────────────────────────
window.doLogout = function () {
    const token = localStorage.getItem('token');
    const fcmToken = localStorage.getItem('fcm_token');
    
    if (token && fcmToken) {
        // Fire and forget FCM token cleanup on server so it doesn't block logout redirect
        fetch(`${window.API_URL}/users/fcm-token?token=${encodeURIComponent(fcmToken)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(e => console.warn('FCM token cleanup failed:', e));
    }

    localStorage.clear();
    window.location.href = `${window.ROOT_PATH}index.html`;
};

// ─── Global Notification Helper ─────────────────────────────
window.showAlert = function (title, message, type = 'info') {
    let overlay = document.querySelector('.alert-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'alert-overlay';
        document.body.appendChild(overlay);
    }

    const toast = document.createElement('div');
    toast.className = `alert-toast alert-${type}`;

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-circle-exclamation',
        info: 'fa-circle-info'
    };
    const iconClass = iconMap[type] || 'fa-circle-info';

    toast.innerHTML = `
        <div class="alert-icon">
            <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="alert-content">
            <div class="alert-title">${title}</div>
            <div class="alert-message">${message}</div>
        </div>
        <button class="alert-close">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    // Close button logic
    toast.querySelector('.alert-close').addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    });

    overlay.appendChild(toast);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
};

// ─── Order ID Formatter ──────────────────────────────────────
window.formatOrderId = function (id, dateStr) {
    if (!id) return 'N/A';
    const d = dateStr ? new Date(dateStr) : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `#SGB-${year}-${month}-${day}-${id}`;
};

window.debounce = function (func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

window.togglePasswordVisibility = function (inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};
