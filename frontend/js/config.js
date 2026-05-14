// ============================================================
// config.js — Global Configuration for SGB Agro CRM Frontend
// ============================================================

// ─── Backend URL ─────────────────────────────────────────────
const BACKEND_PORT = 5000;
const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
// window.BASE_URL = isLocal ? `http://127.0.0.1:${BACKEND_PORT}` : 'https://paleturquoise-elk-361855.hostingersite.com';
// Set this to true if you want to use the local backend (localhost:5000)https://paleturquoise-elk-361855.hostingersite.com
const USE_LOCAL_BACKEND = false; 

window.BASE_URL = USE_LOCAL_BACKEND ? `http://127.0.0.1:${BACKEND_PORT}` : 'https://paleturquoise-elk-361855.hostingersite.com';
window.API_URL = `${window.BASE_URL}/api`;

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

// ─── Role-Based Redirect Targets ─────────────────────────────
window.ROLE_REDIRECTS = {
    admin:    'modules/admin/dashboard.html',
    sales:    'modules/sales/dashboard.html',
    billing:  'modules/billing/billing.html',
    packing:  'modules/packing/dashboard.html',
    shipping: 'modules/shipping/dashboard.html',
    shipment: 'modules/shipping/dashboard.html'
};

// ─── Get Current User ────────────────────────────────────────
window.getCurrentUser = function () {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch(e) {}

    if (!user || !user.role) {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const b64 = token.split('.')[1]
                    .replace(/-/g, '+')
                    .replace(/_/g, '/')
                    .padEnd(Math.ceil(token.split('.')[1].length / 4) * 4, '=');
                const payload = JSON.parse(atob(b64));
                user = { id: payload.id, name: payload.name, role: payload.role };
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

    const user  = window.getCurrentUser();
    const role  = (user.role || '').toLowerCase();

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        const home = window.ROLE_REDIRECTS[role] || 'index.html';
        window.location.href = `${window.ROOT_PATH}${home}`;
        return false;
    }
    return true;
};

// ─── Logout ──────────────────────────────────────────────────
window.doLogout = function () {
    localStorage.clear();
    window.location.href = `${window.ROOT_PATH}index.html`;
};

// ─── Global Notification Helper ─────────────────────────────
window.showAlert = function(title, message, type = 'info') {
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
window.formatOrderId = function(id, dateStr) {
    if (!id) return 'N/A';
    const d = dateStr ? new Date(dateStr) : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `#SGB-${year}-${month}-${day}-${id}`;
};

window.debounce = function(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};
