/**
 * completed.js
 * Historical completed support cases logic
 */

let currentPage = 1;
const limit = 20;
let currentSearch = '';

document.addEventListener('DOMContentLoaded', () => {
    loadCompletedCases();

    document.getElementById('btnRefresh').addEventListener('click', loadCompletedCases);

    let searchTimer = null;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentSearch = e.target.value.trim();
            currentPage = 1;
            loadCompletedCases();
        }, 350);
    });

    document.getElementById('btnPrevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadCompletedCases();
        }
    });

    document.getElementById('btnNextPage').addEventListener('click', () => {
        currentPage++;
        loadCompletedCases();
    });
});

async function loadCompletedCases() {
    const tbody = document.getElementById('completedTableBody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: #64748b;"><i class="fas fa-spinner fa-spin"></i> Loading completed cases...</td></tr>`;

    try {
        let endpoint = `/cases?status=completed&page=${currentPage}&limit=${limit}`;
        if (currentSearch) endpoint += `&search=${encodeURIComponent(currentSearch)}`;

        const data = await window.supportFetch(endpoint);
        if (!data || !data.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 2rem;">Error fetching completed cases.</td></tr>`;
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
                        <i class="fas fa-clipboard-check" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 0.5rem; display: block;"></i>
                        <h4 style="color: #334155; font-weight: 700;">No completed cases yet</h4>
                        <p style="font-size: 0.85rem; color: #94a3b8;">When customer installation guidance is completed, cases will be archived here.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = cases.map(c => `
            <tr>
                <td>
                    <div style="font-weight: 700; color: #0f172a;">${escapeHtml(c.customer_name)}</div>
                    <span style="font-size: 0.75rem; color: #10b981; font-weight: 600;">Case #${escapeHtml(c.case_number)}</span>
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
                    <span style="font-weight: 700; color: #475569;">#${c.order_id}</span>
                </td>
                <td>
                    <span style="color: #64748b; font-size: 0.85rem;">${window.formatDateTime(c.completed_at || c.updated_at)}</span>
                </td>
                <td>
                    <span style="text-transform: capitalize; font-weight: 600; color: #0284c7; font-size: 0.85rem;">
                        ${(c.installation_status || 'Installed').replace(/_/g, ' ')}
                    </span>
                </td>
                <td>
                    <div>
                        ${c.followup_status ? window.renderStatusBadge(c.followup_status) : '<span style="color:#94a3b8;font-size:0.8rem;">None</span>'}
                        ${c.followup_date ? `<div style="font-size:0.75rem;color:#64748b;margin-top:2px;">Due: ${window.formatDate(c.followup_date)}</div>` : ''}
                    </div>
                </td>
                <td style="text-align: right;">
                    <a href="customer_details.html?case_id=${c.case_id}" class="btn btn-outline btn-sm">
                        <i class="fas fa-eye"></i> Full History
                    </a>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading completed cases.</td></tr>`;
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
