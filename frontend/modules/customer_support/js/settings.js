/**
 * settings.js
 * Support Rules, Follow-Up Configuration & Staff Roster
 */

document.addEventListener('DOMContentLoaded', () => {
    loadSettingsData();

    document.getElementById('btnSyncDelivered').addEventListener('click', handleManualSync);
});

async function loadSettingsData() {
    try {
        const data = await window.supportFetch('/settings');
        if (!data || !data.success) {
            window.showToast('Failed to load settings', 'error');
            return;
        }

        renderStaffTable(data.staff || []);

    } catch (err) {
        console.error('Error in loadSettingsData:', err);
    }
}

function renderStaffTable(staffList) {
    const tbody = document.getElementById('staffTableBody');

    if (!staffList || staffList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #94a3b8; padding: 2.5rem;">
                    <i class="fas fa-users-slash" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    No customer support executives registered yet.<br>
                    <a href="../admin/users.html" style="color: var(--support-primary); font-weight: 600; text-decoration: underline;">
                        Create a user under Customer Support department in Admin &rarr;
                    </a>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = staffList.map(u => `
        <tr>
            <td>
                <div style="font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-user-circle" style="color: var(--support-primary); font-size: 1.1rem;"></i>
                    ${u.name}
                </div>
            </td>
            <td>
                <span class="badge" style="background: #f1f5f9; color: #334155;">
                    ${(u.role_name || 'Support Executive').replace(/_/g, ' ')}
                </span>
            </td>
            <td style="color: #475569; font-size: 0.85rem;">${u.email || '-'}</td>
            <td style="color: #0284c7; font-weight: 600; font-size: 0.85rem;">${u.phone || '-'}</td>
            <td>
                <span class="badge" style="background: ${u.status === 'inactive' ? '#fee2e2' : '#ecfdf5'}; color: ${u.status === 'inactive' ? '#b91c1c' : '#059669'};">
                    ${(u.status || 'Active').toUpperCase()}
                </span>
            </td>
            <td>
                <strong style="color: #0f172a;">${u.active_cases_count || 0}</strong> active
            </td>
        </tr>
    `).join('');
}

async function handleManualSync() {
    const btn = document.getElementById('btnSyncDelivered');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning Delivered Orders...';

    try {
        const res = await window.supportFetch('/sync-delivered', {
            method: 'POST'
        });

        if (res && res.success) {
            window.showToast(res.message, 'success');
            loadSettingsData();
        } else {
            window.showToast(res ? res.message : 'Sync scan failed', 'error');
        }
    } catch (err) {
        window.showToast('Network error during sync', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync"></i> Scan Delivered Orders Now';
    }
}
