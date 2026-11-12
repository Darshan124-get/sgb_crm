/**
 * job_cards.js
 * Customer Support Job Cards List & Navigation Controller
 * Routes Create / Edit / Resume / View / Print into the structured 10-section Job Card workspace.
 */

let currentPage = 1;
let totalPages = 1;
let currentStatus = 'all';
let searchQuery = '';
let currentJobType = '';
let currentPriority = '';
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get('status');
    const initialPhone = urlParams.get('phone');
    const initialOrderId = urlParams.get('order_id');
    const initialCaseId = urlParams.get('case_id');
    const initialAction = urlParams.get('action');

    // Redirect creation links (from customer_details or orders_delivered) directly to full structured page
    if (initialAction === 'create' || initialPhone || initialOrderId || initialCaseId) {
        const nextParams = new URLSearchParams({ mode: 'create' });
        if (initialPhone) nextParams.set('phone', initialPhone);
        if (initialOrderId) nextParams.set('order_id', initialOrderId);
        if (initialCaseId) nextParams.set('case_id', initialCaseId);
        window.location.replace(`job_card_details.html?${nextParams.toString()}`);
        return;
    }

    if (initialStatus) {
        currentStatus = initialStatus.toLowerCase();
        highlightActiveTab(currentStatus);
    }

    try {
        const flash = sessionStorage.getItem('jc_flash_toast');
        if (flash) {
            sessionStorage.removeItem('jc_flash_toast');
            if (window.showToast) window.showToast(flash, 'success');
        }
    } catch (e) {}

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                searchQuery = e.target.value.trim();
                loadJobCards(1);
            }, 350);
        });
    }

    await loadJobCards(1);
});

/**
 * Fetch and display Job Cards list
 */
async function loadJobCards(page = 1) {
    currentPage = page;
    const tbody = document.getElementById('jobCardsTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 3rem; color: #64748b;">
                <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: var(--support-primary);"></i>
                Loading Job Cards...
            </td>
        </tr>
    `;

    try {
        const queryParams = new URLSearchParams({
            page: currentPage,
            limit: 15,
            status: currentStatus,
            search: searchQuery,
            job_type: currentJobType,
            priority: currentPriority
        });

        const res = await window.supportFetch(`/job-cards?${queryParams.toString()}`);
        if (!res || !res.success) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 3rem; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                        Failed to load job cards: ${escapeHtml(res ? res.message : 'Unknown error')}
                    </td>
                </tr>
            `;
            return;
        }

        if (res.statusCounts) {
            const setBadge = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val || 0;
            };
            setBadge('badgeAll', res.statusCounts.all);
            setBadge('badgeDraft', res.statusCounts.draft);
            setBadge('badgeOpen', res.statusCounts.open);
            setBadge('badgeInProgress', res.statusCounts['in progress']);
            setBadge('badgeOnHold', res.statusCounts['on hold']);
            setBadge('badgeCompleted', res.statusCounts.completed);
            setBadge('badgeCancelled', res.statusCounts.cancelled);
        }

        const jobs = res.data || [];
        if (jobs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 3.5rem 1rem; color: #64748b;">
                        <div style="max-width: 380px; margin: 0 auto;">
                            <i class="fas fa-clipboard-check" style="font-size: 2.2rem; color: #cbd5e1; margin-bottom: 0.75rem; display: block;"></i>
                            <h4 style="font-weight: 700; color: #334155; margin-bottom: 0.35rem;">No Job Cards Found</h4>
                            <p style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 1rem;">
                                ${searchQuery ? `No jobs match "${escapeHtml(searchQuery)}".` : 'No Job Cards match the current filter criteria.'}
                            </p>
                            <a href="job_card_details.html?mode=create" class="btn btn-primary btn-sm">
                                <i class="fas fa-plus-circle"></i> Create Job Card
                            </a>
                        </div>
                    </td>
                </tr>
            `;
            updatePagination(res.pagination || { total: 0, page: 1, totalPages: 1 });
            return;
        }

        tbody.innerHTML = jobs.map(job => renderJobCardRow(job)).join('');
        updatePagination(res.pagination || { total: jobs.length, page: 1, totalPages: 1 });

    } catch (err) {
        console.error('Error loading job cards:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 3rem; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
                    Error connecting to server. Please try refreshing.
                </td>
            </tr>
        `;
    }
}

/**
 * Render single table row
 */
function renderJobCardRow(job) {
    const statusSlug = (job.status || 'open').toLowerCase().replace(/\s+/g, '-');
    const prioritySlug = (job.priority || 'medium').toLowerCase();

    let jobTypeIcon = 'fa-wrench';
    if (job.job_type === 'Installation') jobTypeIcon = 'fa-tools';
    else if (job.job_type === 'Inspection') jobTypeIcon = 'fa-search';
    else if (job.job_type === 'Replacement Assessment') jobTypeIcon = 'fa-exchange-alt';

    const customerPhoneClean = (job.customer_phone || '').replace(/[^0-9]/g, '');
    const formattedDate = window.formatDate(job.job_card_date || job.created_at);
    const formattedPromised = job.due_date ? window.formatDate(job.due_date) : '—';
    const machineName = job.machine_make_model || job.product_summary || '';
    const complaintText = job.specific_complaint || job.issue_description || 'No complaint entered yet';
    const grandTotal = parseFloat(job.grand_total || 0);

    let actionLabel = 'Manage';
    let actionIcon = 'fa-folder-open';
    let actionBtnClass = 'btn-primary';
    if (job.status === 'Draft') {
        actionLabel = 'Resume / Manage';
        actionIcon = 'fa-play-circle';
    } else if (job.status === 'Completed' || job.status === 'Cancelled') {
        actionLabel = 'View / Print';
        actionIcon = 'fa-eye';
        actionBtnClass = 'btn-outline';
    }

    return `
        <tr class="job-row">
            <td>
                <div style="font-weight: 800; color: #0284c7; display: flex; align-items: center; gap: 0.35rem;">
                    <a href="job_card_details.html?id=${job.job_card_id}" style="color: #0284c7; text-decoration: none;" title="Open Job Card">
                        ${escapeHtml(job.job_card_number)}
                    </a>
                </div>
                <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.15rem;">
                    <i class="far fa-calendar-alt"></i> ${formattedDate}
                </div>
                <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.1rem;">
                    <i class="fas ${jobTypeIcon}"></i> ${escapeHtml(job.job_type)}
                </div>
            </td>
            <td>
                <div style="font-weight: 700; color: #1e293b;">${escapeHtml(job.customer_name || 'Draft Customer')}</div>
                <div style="font-size: 0.78rem; color: #475569; display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem;">
                    <span><i class="fas fa-phone-alt" style="font-size: 0.7rem; color: #0284c7;"></i> ${escapeHtml(job.customer_phone || '—')}</span>
                    ${customerPhoneClean ? `
                        <button type="button" class="btn-call-mini" onclick="window.callCustomer('${customerPhoneClean}', '${escapeQuotes(job.customer_name)}')" title="Call Customer">
                            <i class="fas fa-phone"></i>
                        </button>
                    ` : ''}
                </div>
                ${job.customer_address ? `
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.15rem; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(job.customer_address)}">
                        <i class="fas fa-map-marker-alt" style="font-size: 0.68rem; color: #94a3b8;"></i> ${escapeHtml(job.customer_address)}
                    </div>
                ` : ''}
            </td>
            <td style="max-width: 190px;">
                <div style="font-weight: 600; color: #1e293b; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(machineName || 'N/A')}">
                    ${machineName ? escapeHtml(machineName) : '<span style="color:#94a3b8;font-style:italic;">Not specified</span>'}
                </div>
                ${job.serial_vin_number ? `
                    <div style="font-size: 0.72rem; color: #475569; font-family: monospace; margin-top: 0.15rem;">
                        S/N: ${escapeHtml(job.serial_vin_number)}
                    </div>
                ` : ''}
                ${job.hours_run ? `
                    <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.1rem;">
                        Hrs Run: ${escapeHtml(job.hours_run)}
                    </div>
                ` : ''}
            </td>
            <td style="max-width: 230px;">
                ${job.specific_complaint ? `
                    <div style="font-size: 0.75rem; font-weight: 700; color: #0f172a; margin-bottom: 0.15rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(job.specific_complaint)}">
                        ${escapeHtml(job.specific_complaint)}
                    </div>
                ` : ''}
                <div style="font-size: 0.76rem; color: #64748b; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(complaintText)}">
                    ${escapeHtml(job.issue_description || (job.specific_complaint ? '' : 'No complaint entered yet'))}
                </div>
            </td>
            <td>
                <div style="font-weight: 800; color: #0f172a; font-size: 0.85rem;">
                    ₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.15rem;">
                    ${parseFloat(job.shipping_charge || 0) > 0 ? `Incl. ₹${parseFloat(job.shipping_charge).toFixed(2)} shipping` : 'Billing in Billing Panel'}
                </div>
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-start;">
                    <span class="status-pill status-${statusSlug}">${escapeHtml(job.status)}</span>
                    <span class="priority-badge priority-${prioritySlug}">
                        <span class="priority-dot"></span> ${escapeHtml(job.priority)}
                    </span>
                </div>
            </td>
            <td>
                <div style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                    ${job.assigned_to_name ? `<i class="fas fa-user-circle" style="color: #64748b; font-size: 0.78rem;"></i> ${escapeHtml(job.assigned_to_name)}` : '<span style="color:#94a3b8;font-style:italic;">Unassigned</span>'}
                </div>
            </td>
            <td>
                <div style="font-size: 0.8rem; color: ${isPastDue(job.due_date, job.status) ? '#ef4444; font-weight:700;' : '#475569;'}">
                    ${formattedPromised}
                    ${isPastDue(job.due_date, job.status) ? '<span style="font-size: 0.68rem; display: block; color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Overdue</span>' : ''}
                </div>
            </td>
            <td style="text-align: right;">
                <div style="display: inline-flex; gap: 0.35rem; justify-content: flex-end;">
                    <a href="job_card_details.html?id=${job.job_card_id}" class="btn ${actionBtnClass} btn-sm" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;" title="${actionLabel}">
                        <i class="fas ${actionIcon}"></i> ${actionLabel}
                    </a>
                </div>
            </td>
        </tr>
    `;
}

function isPastDue(dueDateStr, status) {
    if (!dueDateStr) return false;
    if (status === 'Completed' || status === 'Cancelled' || status === 'Draft') return false;
    try {
        const due = new Date(dueDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return due < today;
    } catch (e) {
        return false;
    }
}

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updatePagination(pagination) {
    totalPages = pagination.totalPages || 1;
    currentPage = pagination.page || 1;
    const totalRecords = pagination.total || 0;

    const pageInfo = document.getElementById('pageInfo');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');

    if (pageInfo) {
        const start = totalRecords === 0 ? 0 : (currentPage - 1) * (pagination.limit || 15) + 1;
        const end = Math.min(currentPage * (pagination.limit || 15), totalRecords);
        pageInfo.textContent = `Showing ${start}–${end} of ${totalRecords} jobs (Page ${currentPage} of ${totalPages})`;
    }

    if (btnPrev) btnPrev.disabled = currentPage <= 1;
    if (btnNext) btnNext.disabled = currentPage >= totalPages;
}

window.changePage = function (delta) {
    const target = currentPage + delta;
    if (target >= 1 && target <= totalPages) {
        loadJobCards(target);
    }
};

window.filterByStatus = function (status) {
    currentStatus = status.toLowerCase();
    highlightActiveTab(currentStatus);
    loadJobCards(1);
};

function highlightActiveTab(status) {
    const tabs = document.querySelectorAll('#jobStatusTabs .job-tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('data-status') === status) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

window.applyFilters = function () {
    const typeSelect = document.getElementById('typeFilter');
    const prioritySelect = document.getElementById('priorityFilter');
    currentJobType = typeSelect ? typeSelect.value : '';
    currentPriority = prioritySelect ? prioritySelect.value : '';
    loadJobCards(1);
};

window.resetFilters = function () {
    const searchInput = document.getElementById('searchInput');
    const typeSelect = document.getElementById('typeFilter');
    const prioritySelect = document.getElementById('priorityFilter');

    if (searchInput) searchInput.value = '';
    if (typeSelect) typeSelect.value = '';
    if (prioritySelect) prioritySelect.value = '';

    searchQuery = '';
    currentJobType = '';
    currentPriority = '';
    currentStatus = 'all';
    highlightActiveTab('all');

    loadJobCards(1);
};

// Backwards-compatible redirect helper
window.openCreateJobModal = function (prefill = {}) {
    const nextParams = new URLSearchParams({ mode: 'create' });
    if (prefill.phone) nextParams.set('phone', prefill.phone);
    if (prefill.order_id) nextParams.set('order_id', prefill.order_id);
    if (prefill.case_id) nextParams.set('case_id', prefill.case_id);
    window.location.href = `job_card_details.html?${nextParams.toString()}`;
};
