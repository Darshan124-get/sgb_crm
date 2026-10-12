/**
 * dashboard.js
 * Customer Support Dashboard logic
 */

let currentPage = 1;
const limit = 15;
let currentSearch = '';
let currentStatus = '';

document.addEventListener('DOMContentLoaded', () => {
    loadMetrics();
    loadCases();

    // Event Listeners
    document.getElementById('btnRefresh').addEventListener('click', () => {
        loadMetrics();
        loadCases();
    });

    document.getElementById('btnSyncDelivered').addEventListener('click', handleSyncDelivered);

    document.getElementById('statusFilter').addEventListener('change', (e) => {
        currentStatus = e.target.value;
        currentPage = 1;
        loadCases();
    });

    let searchTimeout = null;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            loadCases();
        }, 350);
    });

    document.getElementById('btnPrevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadCases();
        }
    });

    document.getElementById('btnNextPage').addEventListener('click', () => {
        currentPage++;
        loadCases();
    });

    document.getElementById('btnNotifToggle').addEventListener('click', openNotificationsModal);
});

async function loadMetrics() {
    try {
        const data = await window.supportFetch('/dashboard-metrics');
        if (data && data.success && data.metrics) {
            const m = data.metrics;
            document.getElementById('kpiNewDelivered').textContent = m.new_delivered || 0;
            document.getElementById('kpiPendingInstallation').textContent = m.pending_installation || 0;
            document.getElementById('kpiContactedFollowup').textContent = m.contacted_followup || 0;
            document.getElementById('kpiFollowupsDue').textContent = m.followups_due || 0;
            document.getElementById('kpiFollowupsOverdue').textContent = m.followups_overdue || 0;
            document.getElementById('kpiCompletedCases').textContent = m.completed_cases || 0;
        }
    } catch (err) {
        console.error('Failed to load metrics:', err);
    }
}

async function loadCases() {
    const tbody = document.getElementById('casesTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 2.5rem; color: #64748b;">
                <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                Fetching customer support records...
            </td>
        </tr>
    `;

    try {
        let endpoint = `/cases?page=${currentPage}&limit=${limit}`;
        if (currentStatus) endpoint += `&status=${encodeURIComponent(currentStatus)}`;
        if (currentSearch) endpoint += `&search=${encodeURIComponent(currentSearch)}`;

        const data = await window.supportFetch(endpoint);
        if (!data || !data.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 2rem;">Error fetching queue cases.</td></tr>`;
            return;
        }

        const cases = data.cases || [];
        const pagination = data.pagination || { total: 0, totalPages: 1 };

        document.getElementById('queueCountBadge').textContent = `${pagination.total} case${pagination.total === 1 ? '' : 's'}`;
        document.getElementById('pageInfo').textContent = `Showing ${cases.length} of ${pagination.total} cases (Page ${currentPage} of ${pagination.totalPages || 1})`;
        document.getElementById('btnPrevPage').disabled = (currentPage <= 1);
        document.getElementById('btnNextPage').disabled = (currentPage >= pagination.totalPages);

        if (cases.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 3rem;">
                        <div style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 0.75rem;"><i class="fas fa-box-open"></i></div>
                        <h4 style="font-size: 1rem; font-weight: 700; color: #334155;">No support cases found</h4>
                        <p style="font-size: 0.85rem; color: #94a3b8; max-width: 400px; margin: 0.25rem auto;">
                            Delivered B2C orders automatically generate support cases here. Click "Sync Delivered Orders" above to check for newly delivered orders.
                        </p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = cases.map(c => `
            <tr>
                <td>
                    <div style="font-weight: 700; color: #0f172a;">${escapeHtml(c.customer_name)}</div>
                    <span style="font-size: 0.75rem; color: #94a3b8;">Case #${escapeHtml(c.case_number)}</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <a href="tel:${escapeHtml(c.customer_phone)}" style="color: #0284c7; font-weight: 600; text-decoration: none;" onclick="window.callCustomer('${c.customer_phone}', '${escapeHtml(c.customer_name)}', ${c.case_id}); return false;">
                            ${escapeHtml(c.customer_phone || '-')}
                        </a>
                        <button onclick="window.copyToClipboard('${c.customer_phone}')" title="Copy Phone" style="border:none;background:none;color:#94a3b8;cursor:pointer;">
                            <i class="far fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem;" title="${escapeHtml(c.product_summary || '')}">
                        ${escapeHtml(c.product_summary || 'Standard Product')}
                    </div>
                </td>
                <td>
                    <span style="font-weight: 600; color: #475569;">${c.order_id ? '#' + c.order_id : (escapeHtml(c.manual_order_number || 'Manual'))}</span>
                </td>
                <td>
                    <span style="color: #64748b; font-size: 0.85rem;">${window.formatDate(c.delivery_date || c.created_at)}</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <i class="fas fa-user-circle" style="color: #94a3b8;"></i>
                        <span style="font-size: 0.85rem; font-weight: 500;">${escapeHtml(c.assigned_name || 'Unassigned')}</span>
                    </div>
                </td>
                <td>
                    ${window.renderStatusBadge(c.status)}
                </td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 0.4rem; justify-content: flex-end;">
                        <button class="btn btn-call btn-sm" onclick="window.callCustomer('${c.customer_phone}', '${escapeHtml(c.customer_name)}', ${c.case_id})" title="Call Customer">
                            <i class="fas fa-phone"></i> Call
                        </button>
                        <a href="customer_details.html?case_id=${c.case_id}" class="btn btn-outline btn-sm" title="View Details">
                            <i class="fas fa-eye"></i> Details
                        </a>
                        <button class="btn btn-outline btn-sm" onclick="openCallHistory(${c.case_id})" title="View Call History">
                            <i class="fas fa-history"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('Error loading cases:', err);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading queue.</td></tr>`;
    }
}

async function handleSyncDelivered() {
    const btn = document.getElementById('btnSyncDelivered');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Scanning...`;

    try {
        const data = await window.supportFetch('/sync-delivered', { method: 'POST' });
        if (data && data.success) {
            window.showToast(data.message, 'success');
            loadMetrics();
            loadCases();
        } else {
            window.showToast(data.message || 'Sync failed', 'error');
        }
    } catch (e) {
        window.showToast('Failed to sync delivered orders', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-rotate"></i> Sync Delivered Orders`;
    }
}

async function openCallHistory(caseId) {
    const modal = document.getElementById('callHistoryModal');
    const body = document.getElementById('callHistoryBody');
    modal.classList.add('active');
    body.innerHTML = `<p style="text-align:center;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Loading call logs...</p>`;

    try {
        const data = await window.supportFetch(`/cases/${caseId}`);
        if (!data || !data.success) {
            body.innerHTML = `<p style="color:#ef4444;">Failed to load call history</p>`;
            return;
        }

        const calls = data.calls || [];
        if (calls.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fas fa-phone-slash" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.5rem; display: block;"></i>
                    No calls recorded yet for this case.
                    <div style="margin-top: 1rem;">
                        <a href="call_completion.html?case_id=${caseId}" class="btn btn-primary btn-sm">
                            <i class="fas fa-phone"></i> Log Call Outcome
                        </a>
                    </div>
                </div>
            `;
            return;
        }

        body.innerHTML = `
            <div class="timeline">
                ${calls.map(call => `
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div class="timeline-time">${window.formatDateTime(call.created_at)} • by ${escapeHtml(call.caller_name || 'Staff')}</div>
                            <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">
                                [${call.call_type}] Outcome: <span style="text-transform: capitalize; color: #0284c7;">${call.call_outcome.replace(/_/g, ' ')}</span>
                            </div>
                            ${call.installation_status ? `<div style="font-size: 0.85rem; color: #475569; margin-bottom: 0.25rem;">Installation Status: <strong>${call.installation_status.replace(/_/g, ' ')}</strong></div>` : ''}
                            ${call.guidance_provided ? `<div style="font-size: 0.85rem; color: #475569;">Guidance: ${escapeHtml(call.guidance_provided)}</div>` : ''}
                            ${call.remarks ? `<div style="font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; font-style: italic;">Remarks: ${escapeHtml(call.remarks)}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 1rem; text-align: right;">
                <a href="call_completion.html?case_id=${caseId}" class="btn btn-primary btn-sm">
                    <i class="fas fa-plus"></i> Record New Call
                </a>
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<p style="color:#ef4444;">Error fetching call logs</p>`;
    }
}

async function openNotificationsModal() {
    const modal = document.getElementById('notifModal');
    const body = document.getElementById('notifListBody');
    modal.classList.add('active');
    body.innerHTML = `<p style="text-align:center;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Loading notifications...</p>`;

    try {
        const data = await window.supportFetch('/notifications');
        if (!data || !data.success) {
            body.innerHTML = `<p style="color:#ef4444;">Failed to load notifications</p>`;
            return;
        }

        const notifs = data.notifications || [];
        if (notifs.length === 0) {
            body.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 2rem;">No notifications found.</p>`;
            return;
        }

        body.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${notifs.map(n => `
                    <div style="padding: 0.85rem; border-radius: 8px; border: 1px solid ${n.is_read ? '#e2e8f0' : '#bfdbfe'}; background: ${n.is_read ? '#f8fafc' : '#eff6ff'}; display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
                        <div>
                            <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem; margin-bottom: 0.2rem;">${escapeHtml(n.title || 'Support Notification')}</div>
                            <div style="font-size: 0.85rem; color: #475569; line-height: 1.4;">${escapeHtml(n.message || '')}</div>
                            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.35rem;">${window.formatDateTime(n.created_at)}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-end;">
                            ${n.link ? `<a href="${n.link}" class="btn btn-primary btn-sm" onclick="markReadAndOpen(${n.notification_id})">Open</a>` : ''}
                            ${!n.is_read ? `<button class="btn btn-outline btn-sm" onclick="markNotificationRead(${n.notification_id}, this)">Mark Read</button>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (e) {
        body.innerHTML = `<p style="color:#ef4444;">Error fetching notifications</p>`;
    }
}

async function markNotificationRead(id, btn) {
    try {
        await window.supportFetch(`/notifications/${id}/read`, { method: 'PATCH' });
        if (btn) btn.remove();
        window.initSupportNotifications();
    } catch (e) {
        console.error(e);
    }
}

async function markReadAndOpen(id) {
    try {
        await window.supportFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (e) {}
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.loadDashboardData = function () {
    loadMetrics();
    loadCases();
};

