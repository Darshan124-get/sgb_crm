/* ============================================================
   analytics.js — Chatbot Analytics Dashboard Interactive Engine
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth check
    if (!window.requireAuth(['admin', 'super-admin'])) return;

    // Load current user profile name
    const currentUser = window.getCurrentUser();
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl && currentUser.name) {
        profileNameEl.textContent = currentUser.name;
    }

    // Populate elements
    renderKeywordTable();
    renderBarChart();
});

// Mock Trigger Keywords Stats
const keywordStats = [
    { word: 'machinery', count: 1420, accuracy: '98%', action: 'Run Flow Builder', status: 'Active' },
    { word: 'tractor', count: 890, accuracy: '96%', action: 'Run Flow Builder', status: 'Active' },
    { word: 'price', count: 1220, accuracy: '91%', action: 'Product Catalog', status: 'Active' },
    { word: 'rotavator', count: 640, accuracy: '94%', action: 'Run Flow Builder', status: 'Active' },
    { word: 'warranty', count: 410, accuracy: '99%', action: 'Auto-FAQ Reply', status: 'Active' },
    { word: 'help', count: 350, accuracy: '100%', action: 'Transfer to Staff', status: 'Active' }
];

// Mock Weekly Traffic Data
const weeklyTraffic = [
    { day: 'Mon', count: 1200, percent: 55 },
    { day: 'Tue', count: 1450, percent: 66 },
    { day: 'Wed', count: 1890, percent: 86 },
    { day: 'Thu', count: 2100, percent: 100 },
    { day: 'Fri', count: 1750, percent: 80 },
    { day: 'Sat', count: 900, percent: 40 },
    { day: 'Sun', count: 700, percent: 32 }
];

function renderKeywordTable() {
    const tbody = document.getElementById('keywordTableBody');
    if (!tbody) return;

    tbody.innerHTML = keywordStats.map(stat => `
        <tr>
            <td style="font-weight:700; color:#1e293b;"><code>"${stat.word}"</code></td>
            <td>${stat.count.toLocaleString('en-IN')} matches</td>
            <td style="font-weight:600; color:#10b981;">${stat.accuracy}</td>
            <td><span style="font-size:0.8rem; font-weight:600; color:#4b5563;">${stat.action}</span></td>
            <td>
                <span class="status-indicator success" style="padding:0.15rem 0.45rem; font-size:0.65rem;">
                    <span class="pulse-dot" style="width:4px; height:4px;"></span> ${stat.status}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderBarChart() {
    const barContainer = document.getElementById('barContainer');
    if (!barContainer) return;

    barContainer.innerHTML = weeklyTraffic.map(item => `
        <div class="chart-bar" style="height: ${item.percent}%; background: rgba(16, 185, 129, ${0.4 + (item.percent / 160)});" title="${item.day}: ${item.count} starts">
            <span class="chart-bar-label">${item.day}</span>
        </div>
    `).join('');
}
