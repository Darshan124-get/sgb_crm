document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth check
    if (!window.requireAuth(['admin', 'super-admin'])) return;

    // Load current user profile name
    const currentUser = window.getCurrentUser();
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl && currentUser.name) {
        profileNameEl.textContent = currentUser.name;
    }

    await loadChatbotAnalytics();
});

async function loadChatbotAnalytics() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/reports/dashboard-stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            renderKeywordTable(data.topProducts || []);
            renderBarChart(data.operations?.trends?.received || []);
            
            // Update KPI elements if present
            const kpiTotal = document.getElementById('kpiTotalConversations');
            if (kpiTotal) kpiTotal.textContent = (data.whatsapp?.received || 0).toLocaleString('en-IN');
            
            const kpiRead = document.getElementById('kpiReadRate');
            if (kpiRead) kpiRead.textContent = `${data.whatsapp?.readRate || 0}%`;

            const kpiUnread = document.getElementById('kpiUnread');
            if (kpiUnread) kpiUnread.textContent = (data.whatsapp?.unread || 0).toLocaleString('en-IN');
        } else {
            renderKeywordTable([]);
            renderBarChart([]);
        }
    } catch (err) {
        console.error('Error loading chatbot analytics:', err);
        renderKeywordTable([]);
        renderBarChart([]);
    }
}

function renderKeywordTable(items) {
    const tbody = document.getElementById('keywordTableBody');
    if (!tbody) return;

    if (!items || items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:2rem;">No trigger keywords or product interactions recorded in database.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr>
            <td style="font-weight:700; color:#1e293b;"><code>"${item.name}"</code></td>
            <td>${(item.total_qty || 0).toLocaleString('en-IN')} matches</td>
            <td style="font-weight:600; color:#10b981;">100%</td>
            <td><span style="font-size:0.8rem; font-weight:600; color:#4b5563;">Catalog Flow</span></td>
            <td>
                <span class="status-indicator success" style="padding:0.15rem 0.45rem; font-size:0.65rem;">
                    <span class="pulse-dot" style="width:4px; height:4px;"></span> Active
                </span>
            </td>
        </tr>
    `).join('');
}

function renderBarChart(trends) {
    const barContainer = document.getElementById('barContainer');
    if (!barContainer) return;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const countsMap = {};
    days.forEach(d => countsMap[d] = 0);

    if (Array.isArray(trends) && trends.length > 0) {
        trends.forEach(t => {
            if (t.date) {
                const dayName = new Date(t.date).toLocaleDateString('en-US', { weekday: 'short' });
                if (countsMap[dayName] !== undefined) {
                    countsMap[dayName] += (t.count || 0);
                }
            }
        });
    }

    const maxCount = Math.max(1, ...Object.values(countsMap));

    barContainer.innerHTML = days.map(day => {
        const count = countsMap[day] || 0;
        const percent = Math.round((count / maxCount) * 100);
        return `
            <div class="chart-bar" style="height: ${Math.max(5, percent)}%; background: rgba(16, 185, 129, ${0.4 + (percent / 160)});" title="${day}: ${count} starts">
                <span class="chart-bar-label">${day}</span>
            </div>
        `;
    }).join('');
}

