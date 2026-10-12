/**
 * contacted_followup.js
 * Logic for 30-Day Follow-ups & In-Progress / Callbacks tab management
 */

let activeTab = 'followups';

document.addEventListener('DOMContentLoaded', () => {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'due') {
        document.getElementById('followupStatusFilter').value = 'DUE';
    } else if (urlParams.get('tab') === 'overdue') {
        document.getElementById('followupStatusFilter').value = 'OVERDUE';
    } else if (urlParams.get('tab') === 'inprogress') {
        switchTab('inprogress');
    }

    loadFollowups();
    loadInProgress();

    // Tab buttons
    document.getElementById('tabBtnFollowups').addEventListener('click', () => switchTab('followups'));
    document.getElementById('tabBtnInProgress').addEventListener('click', () => switchTab('inprogress'));

    // Follow-ups filter & search
    document.getElementById('followupStatusFilter').addEventListener('change', loadFollowups);
    document.getElementById('btnRefreshFollowups').addEventListener('click', loadFollowups);
    let fuSearchTimer = null;
    document.getElementById('searchFollowupsInput').addEventListener('input', () => {
        clearTimeout(fuSearchTimer);
        fuSearchTimer = setTimeout(loadFollowups, 350);
    });

    // In-Progress filter & search
    document.getElementById('inProgressStatusFilter').addEventListener('change', loadInProgress);
    document.getElementById('btnRefreshInProgress').addEventListener('click', loadInProgress);
    let ipSearchTimer = null;
    document.getElementById('searchInProgressInput').addEventListener('input', () => {
        clearTimeout(ipSearchTimer);
        ipSearchTimer = setTimeout(loadInProgress, 350);
    });
});

function switchTab(tab) {
    activeTab = tab;
    const btnFu = document.getElementById('tabBtnFollowups');
    const btnIp = document.getElementById('tabBtnInProgress');
    const secFu = document.getElementById('sectionFollowups');
    const secIp = document.getElementById('sectionInProgress');

    if (tab === 'followups') {
        btnFu.className = 'btn btn-primary';
        btnIp.className = 'btn btn-outline';
        secFu.style.display = 'block';
        secIp.style.display = 'none';
        loadFollowups();
    } else {
        btnFu.className = 'btn btn-outline';
        btnIp.className = 'btn btn-primary';
        secFu.style.display = 'none';
        secIp.style.display = 'block';
        loadInProgress();
    }
}

async function loadFollowups() {
    const tbody = document.getElementById('followupsTableBody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Loading follow-ups...</td></tr>`;

    const status = document.getElementById('followupStatusFilter').value;
    const search = document.getElementById('searchFollowupsInput').value.trim();

    try {
        let endpoint = `/followups?limit=50`;
        if (status) endpoint += `&status=${encodeURIComponent(status)}`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;

        const data = await window.supportFetch(endpoint);
        if (!data || !data.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:2rem;">Failed to load follow-ups.</td></tr>`;
            return;
        }

        const list = data.followups || [];
        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center;padding:3rem;">
                        <i class="fas fa-calendar-check" style="font-size:2rem;color:#cbd5e1;margin-bottom:0.5rem;display:block;"></i>
                        <h4 style="color:#334155;font-weight:700;">No follow-ups in this view</h4>
                        <p style="font-size:0.85rem;color:#94a3b8;">When customer support cases are completed, 30-day product check follow-ups appear here automatically.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map(f => `
            <tr>
                <td>
                    <div style="font-weight:700;color:#0f172a;">${escapeHtml(f.customer_name)}</div>
                    <span style="font-size:0.75rem;color:#64748b;">Case #${escapeHtml(f.case_number)}</span>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span style="font-weight:600;color:#334155;">${escapeHtml(f.customer_phone || '-')}</span>
                        <button onclick="window.copyToClipboard('${f.customer_phone}')" title="Copy Phone" style="border:none;background:none;color:#94a3b8;cursor:pointer;">
                            <i class="far fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.85rem;" title="${escapeHtml(f.product_summary || '')}">
                        ${escapeHtml(f.product_summary || 'Agricultural Equipment')}
                    </div>
                </td>
                <td>
                    <span style="font-weight:700;color:#475569;">#${f.order_id}</span>
                </td>
                <td>
                    <span style="font-weight:600;color:${f.status === 'OVERDUE' ? '#ef4444' : (f.status === 'DUE' ? '#d97706' : '#475569')};">
                        ${window.formatDate(f.scheduled_date)}
                    </span>
                </td>
                <td>
                    <span style="font-size:0.85rem;color:#334155;">${escapeHtml(f.assigned_name || 'Unassigned')}</span>
                </td>
                <td>
                    ${window.renderStatusBadge(f.status)}
                </td>
                <td style="text-align:right;">
                    <div style="display:inline-flex;gap:0.4rem;justify-content:flex-end;">
                        <button class="btn btn-call btn-sm" onclick="window.callCustomer('${f.customer_phone}', '${escapeHtml(f.customer_name)}')">
                            <i class="fas fa-phone"></i> Call
                        </button>
                        <a href="followup_details.html?followup_id=${f.followup_id}" class="btn btn-primary btn-sm" title="Record Feedback / Issue">
                            <i class="fas fa-clipboard-check"></i> Record Call
                        </a>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:2rem;">Error loading follow-ups.</td></tr>`;
    }
}

async function loadInProgress() {
    const tbody = document.getElementById('inProgressTableBody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Loading in-progress cases...</td></tr>`;

    const status = document.getElementById('inProgressStatusFilter').value;
    const search = document.getElementById('searchInProgressInput').value.trim();

    try {
        let endpoint = `/cases?status=${encodeURIComponent(status)}&limit=50`;
        if (search) endpoint += `&search=${encodeURIComponent(search)}`;

        const data = await window.supportFetch(endpoint);
        if (!data || !data.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:2rem;">Failed to load in-progress cases.</td></tr>`;
            return;
        }

        const cases = data.cases || [];
        if (cases.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center;padding:3rem;">
                        <i class="fas fa-check-circle" style="font-size:2rem;color:#cbd5e1;margin-bottom:0.5rem;display:block;"></i>
                        <h4 style="color:#334155;font-weight:700;">No cases in progress</h4>
                        <p style="font-size:0.85rem;color:#94a3b8;">All cases have either completed initial support or are newly delivered.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = cases.map(c => `
            <tr>
                <td>
                    <div style="font-weight:700;color:#0f172a;">${escapeHtml(c.customer_name)}</div>
                    <span style="font-size:0.75rem;color:#0284c7;font-weight:600;">Case #${escapeHtml(c.case_number)}</span>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span style="font-weight:600;color:#334155;">${escapeHtml(c.customer_phone || '-')}</span>
                        <button onclick="window.copyToClipboard('${c.customer_phone}')" title="Copy Phone" style="border:none;background:none;color:#94a3b8;cursor:pointer;">
                            <i class="far fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.85rem;" title="${escapeHtml(c.product_summary || '')}">
                        ${escapeHtml(c.product_summary || 'Standard Equipment')}
                    </div>
                </td>
                <td>
                    <span style="font-weight:700;color:#475569;">#${c.order_id}</span>
                </td>
                <td>
                    <span style="color:#64748b;font-size:0.85rem;">${window.formatDate(c.delivery_date || c.created_at)}</span>
                </td>
                <td>
                    <span style="font-size:0.85rem;color:#334155;">${escapeHtml(c.assigned_name || 'Unassigned')}</span>
                </td>
                <td>
                    ${window.renderStatusBadge(c.status)}
                </td>
                <td style="text-align:right;">
                    <div style="display:inline-flex;gap:0.4rem;justify-content:flex-end;">
                        <button class="btn btn-call btn-sm" onclick="window.callCustomer('${c.customer_phone}', '${escapeHtml(c.customer_name)}', ${c.case_id})">
                            <i class="fas fa-phone"></i> Call
                        </button>
                        <a href="call_completion.html?case_id=${c.case_id}" class="btn btn-primary btn-sm" title="Continue Guidance / Complete">
                            <i class="fas fa-check"></i> Complete Support
                        </a>
                        <a href="customer_details.html?case_id=${c.case_id}" class="btn btn-outline btn-sm" title="View Full Profile">
                            <i class="fas fa-eye"></i>
                        </a>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:2rem;">Error loading cases.</td></tr>`;
    }
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
