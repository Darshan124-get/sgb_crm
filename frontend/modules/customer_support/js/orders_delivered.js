/**
 * orders_delivered.js
 * Dedicated logic for Newly Delivered Orders Queue
 */

let currentPage = 1;
const limit = 20;
let currentSearch = '';
let currentStage = 'delivered';

document.addEventListener('DOMContentLoaded', () => {
    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('status') === 'pending') {
        currentStage = 'pending_contact';
        document.getElementById('stageFilter').value = 'pending_contact';
    }

    loadDeliveredOrders();

    document.getElementById('stageFilter').addEventListener('change', (e) => {
        currentStage = e.target.value;
        currentPage = 1;
        loadDeliveredOrders();
    });

    document.getElementById('btnRefresh').addEventListener('click', loadDeliveredOrders);

    let searchTimeout = null;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            loadDeliveredOrders();
        }, 350);
    });

    document.getElementById('btnPrevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadDeliveredOrders();
        }
    });

    document.getElementById('btnNextPage').addEventListener('click', () => {
        currentPage++;
        loadDeliveredOrders();
    });
});

async function loadDeliveredOrders() {
    const tbody = document.getElementById('deliveredTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 2.5rem; color: #64748b;">
                <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                Loading delivered orders...
            </td>
        </tr>
    `;

    try {
        let endpoint = `/cases?page=${currentPage}&limit=${limit}`;
        if (currentStage) endpoint += `&status=${encodeURIComponent(currentStage)}`;
        if (currentSearch) endpoint += `&search=${encodeURIComponent(currentSearch)}`;

        const data = await window.supportFetch(endpoint);
        if (!data || !data.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 2rem;">Error fetching delivered cases.</td></tr>`;
            return;
        }

        const cases = data.cases || [];
        const pagination = data.pagination || { total: 0, totalPages: 1 };

        document.getElementById('pageInfo').textContent = `Showing ${cases.length} of ${pagination.total} cases (Page ${currentPage} of ${pagination.totalPages || 1})`;
        document.getElementById('btnPrevPage').disabled = (currentPage <= 1);
        document.getElementById('btnNextPage').disabled = (currentPage >= pagination.totalPages);

        if (cases.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 3rem;">
                        <div style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.5rem;"><i class="fas fa-check-circle"></i></div>
                        <h4 style="font-size: 1rem; font-weight: 700; color: #334155;">No pending delivered orders</h4>
                        <p style="font-size: 0.85rem; color: #94a3b8;">All newly delivered B2C orders have been contacted or handled.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = cases.map(c => `
            <tr>
                <td>
                    <div style="font-weight: 700; color: #0f172a;">${escapeHtml(c.customer_name)}</div>
                    <span style="font-size: 0.75rem; color: #0284c7; font-weight: 600;">Case #${escapeHtml(c.case_number)}</span>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 600; color: #334155;">${escapeHtml(c.customer_phone || '-')}</span>
                        <button onclick="window.copyToClipboard('${c.customer_phone}')" title="Copy Phone" style="border:none;background:none;color:#94a3b8;cursor:pointer;">
                            <i class="far fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem;" title="${escapeHtml(c.product_summary || '')}">
                        ${escapeHtml(c.product_summary || 'Standard Equipment')}
                    </div>
                </td>
                <td>
                    <span style="font-weight: 700; color: #475569;">${c.order_id ? '#' + c.order_id : (escapeHtml(c.manual_order_number || 'Manual'))}</span>
                </td>
                <td>
                    <span style="color: #64748b; font-size: 0.85rem;">${window.formatDate(c.delivery_date || c.created_at)}</span>
                </td>
                <td>
                    <span style="font-size: 0.85rem; font-weight: 500; color: #334155;">${escapeHtml(c.assigned_name || 'Unassigned')}</span>
                </td>
                <td>
                    ${window.renderStatusBadge(c.status)}
                </td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 0.4rem; justify-content: flex-end;">
                        <button class="btn btn-call btn-sm" onclick="window.callCustomer('${c.customer_phone}', '${escapeHtml(c.customer_name)}', ${c.case_id})">
                            <i class="fas fa-phone"></i> Call
                        </button>
                        <a href="call_completion.html?case_id=${c.case_id}" class="btn btn-primary btn-sm" title="Log Call & Guide Installation">
                            <i class="fas fa-tools"></i> Guide Installation
                        </a>
                        <a href="customer_details.html?case_id=${c.case_id}" class="btn btn-outline btn-sm" title="Case Details">
                            <i class="fas fa-eye"></i>
                        </a>
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 2rem;">Failed to load cases.</td></tr>`;
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

window.loadCases = loadDeliveredOrders;
window.loadDeliveredOrders = loadDeliveredOrders;

