document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    
    // Initialize Sidebar
    if (window.loadComponent) {
        window.loadComponent('sidebar-container', '../../components/sidebar-admin.html');
    }

    const user = window.getCurrentUser();
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'Administrator';

    const btnRefresh = document.getElementById('btnRefreshLogs');
    if (btnRefresh) {
        btnRefresh.onclick = fetchLogs;
    }

    fetchLogs();
});

async function fetchLogs() {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading system logs...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.API_URL}/logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch logs');

        const logs = await response.json();
        renderLogs(logs);
    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error-state" style="padding: 2rem; text-align: center; color: #ef4444;">
            <i class="fa-solid fa-triangle-exclamation"></i> Error loading logs: ${error.message}
        </td></tr>`;
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="padding: 2rem; text-align: center; color: #64748b;">No logs found.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td style="color: #64748b; font-size: 0.85rem;">${new Date(log.created_at).toLocaleString()}</td>
            <td><div style="font-weight: 600; color: #1e293b;">${log.user_name || 'System'}</div></td>
            <td><span class="badge-pill pill-${getModuleColor(log.module)}">${log.module}</span></td>
            <td style="font-weight: 500;">${log.action}</td>
            <td style="color: #475569; font-size: 0.85rem; max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.details || ''}">
                ${log.details || '-'}
            </td>
        </tr>
    `).join('');
}

function getModuleColor(module) {
    const colors = {
        'Leads': 'blue',
        'Inventory': 'orange',
        'Billing': 'green',
        'Auth': 'purple',
        'System': 'gray'
    };
    return colors[module] || 'gray';
}
