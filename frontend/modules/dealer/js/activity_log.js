// ============================================================
// activity_log.js — Dealer Activity Log & Audit Trail Controller
// Admin-only: Real-time tracking of dealer panel actions & specs
// ============================================================

(function () {
    // 1. Strict Role Guard: Only Administrators can view this page
    if (window.requireAuth && !window.requireAuth(['admin', 'super-admin'])) {
        return;
    }

    let currentPage = 1;
    let currentLimit = 50;
    let currentAction = 'ALL';
    let currentEntity = 'ALL';
    let currentSearch = '';
    let totalLogsCount = 0;
    let totalPagesCount = 1;
    let isFetching = false;
    let searchDebounceTimer = null;
    let liveSyncInterval = null;

    document.addEventListener('DOMContentLoaded', () => {
        initAuditLogPage();
    });

    function initAuditLogPage() {
        const searchInput = document.getElementById('logSearchInput');
        const filterAction = document.getElementById('filterAction');
        const filterEntity = document.getElementById('filterEntity');
        const filterRows = document.getElementById('filterRows');
        const btnRefresh = document.getElementById('btnRefreshTrail');
        const btnPrevPage = document.getElementById('btnPrevPage');
        const btnNextPage = document.getElementById('btnNextPage');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    currentSearch = e.target.value.trim();
                    currentPage = 1;
                    fetchAuditLogs(currentPage);
                }, 300);
            });
        }

        if (filterAction) {
            filterAction.addEventListener('change', (e) => {
                currentAction = e.target.value;
                currentPage = 1;
                fetchAuditLogs(currentPage);
            });
        }

        if (filterEntity) {
            filterEntity.addEventListener('change', (e) => {
                currentEntity = e.target.value;
                currentPage = 1;
                fetchAuditLogs(currentPage);
            });
        }

        if (filterRows) {
            filterRows.addEventListener('change', (e) => {
                currentLimit = parseInt(e.target.value, 10) || 50;
                currentPage = 1;
                fetchAuditLogs(currentPage);
            });
        }

        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                triggerManualRefresh();
            });
        }

        if (btnPrevPage) {
            btnPrevPage.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    fetchAuditLogs(currentPage);
                }
            });
        }

        if (btnNextPage) {
            btnNextPage.addEventListener('click', () => {
                if (currentPage < totalPagesCount) {
                    currentPage++;
                    fetchAuditLogs(currentPage);
                }
            });
        }

        // Initial Load
        fetchAuditLogs(1);

        // Start Live Sync Polling every 10 seconds
        startLiveSync();
    }

    function triggerManualRefresh() {
        const refreshIcon = document.getElementById('refreshIcon');
        if (refreshIcon) refreshIcon.classList.add('fa-spin');
        fetchAuditLogs(currentPage, false).finally(() => {
            if (refreshIcon) {
                setTimeout(() => refreshIcon.classList.remove('fa-spin'), 600);
            }
        });
    }

    function startLiveSync() {
        if (liveSyncInterval) clearInterval(liveSyncInterval);
        liveSyncInterval = setInterval(() => {
            // Only auto-poll if tab is active and not currently fetching
            if (!document.hidden && !isFetching) {
                fetchAuditLogs(currentPage, true);
            }
        }, 10000);

        window.addEventListener('beforeunload', () => {
            if (liveSyncInterval) clearInterval(liveSyncInterval);
        });
    }

    async function fetchAuditLogs(page = 1, isSilent = false) {
        if (isFetching) return;
        isFetching = true;

        const tableBody = document.getElementById('auditTableBody');
        const token = localStorage.getItem('token');
        const baseUrl = window.API_URL || 'http://localhost:5000/api';

        if (!isSilent && tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="state-row">
                        <i class="fa-solid fa-circle-notch fa-spin"></i>
                        Loading dealer activity log & audit trail...
                    </td>
                </tr>
            `;
        }

        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(currentLimit),
                action: currentAction,
                entity: currentEntity,
                search: currentSearch
            });

            const res = await fetch(`${baseUrl}/dealers/activity-logs?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.status === 401 || res.status === 403) {
                if (tableBody) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="5" class="state-row" style="color: #ef4444;">
                                <i class="fa-solid fa-lock" style="color: #ef4444;"></i>
                                Access Denied: Dealer Activity Log is restricted to Administrators only.
                            </td>
                        </tr>
                    `;
                }
                return;
            }

            if (!res.ok) {
                throw new Error(`Server returned HTTP ${res.status}`);
            }

            const data = await res.json();
            const logs = Array.isArray(data.logs) ? data.logs : [];
            totalLogsCount = parseInt(data.total, 10) || 0;
            const operatorsCount = parseInt(data.operators, 10) || 0;
            totalPagesCount = parseInt(data.totalPages, 10) || 1;
            currentPage = parseInt(data.page, 10) || 1;

            // Update Header & Badge Stats
            const totalBadge = document.getElementById('totalLogsBadge');
            const operatorsBadge = document.getElementById('operatorsCountBadge');
            const showingBadge = document.getElementById('showingCountBadge');

            if (totalBadge) totalBadge.textContent = totalLogsCount.toLocaleString('en-IN');
            if (operatorsBadge) operatorsBadge.textContent = operatorsCount.toLocaleString('en-IN');
            if (showingBadge) {
                const showingCount = logs.length;
                showingBadge.textContent = `Showing ${showingCount} of ${totalLogsCount.toLocaleString('en-IN')}`;
            }

            renderLogsTable(logs);
            renderPagination();

        } catch (err) {
            console.error('Error fetching dealer activity logs:', err);
            if (!isSilent && tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="state-row" style="color: #ef4444;">
                            <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i>
                            Failed to load audit logs: ${escapeHtml(err.message)}
                        </td>
                    </tr>
                `;
            }
        } finally {
            isFetching = false;
        }
    }

    function renderLogsTable(logs) {
        const tableBody = document.getElementById('auditTableBody');
        if (!tableBody) return;

        if (!logs || logs.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="state-row">
                        <i class="fa-regular fa-folder-open"></i>
                        No dealer activity records found matching selected filters.
                    </td>
                </tr>
            `;
            return;
        }

        const rowsHtml = logs.map(log => {
            const action = (log.action || 'UPDATE').toUpperCase();
            const actionClass = getActionBadgeClass(action);
            const entityType = (log.entity_type || 'DEALER').toUpperCase();
            const entityIdStr = log.entity_id ? ` #${escapeHtml(String(log.entity_id))}` : '';
            const entityLabel = `${escapeHtml(entityType)}${entityIdStr}`;

            const detailsText = escapeHtml(log.details || 'Performed action');
            const eventId = log.log_id || '-';

            const userName = escapeHtml(log.user_name || 'System Operator');
            const userRole = escapeHtml(log.user_role ? ` (${log.user_role})` : '');
            const ipAddress = escapeHtml(log.ip_address || '127.0.0.1');

            const deviceSummary = escapeHtml(log.device_summary || 'Unknown Device');
            const userAgent = escapeHtml(log.user_agent || 'Browser Client');

            const { timeStr, dateStr } = formatLogTimestamp(log.created_at);

            return `
                <tr>
                    <td>
                        <div class="action-entity-cell">
                            <span class="badge-action ${actionClass}">${escapeHtml(action)}</span>
                            <span class="badge-entity">${entityLabel}</span>
                        </div>
                    </td>
                    <td>
                        <div class="desc-title">${detailsText}</div>
                        <div class="desc-sub">Event ID: #${eventId}</div>
                    </td>
                    <td>
                        <div class="user-line">
                            <i class="fa-regular fa-user"></i>
                            <span>${userName}</span>
                        </div>
                        <div class="ip-line">
                            <i class="fa-solid fa-globe"></i>
                            <span>${ipAddress}</span>
                        </div>
                    </td>
                    <td>
                        <div class="device-line">
                            <i class="fa-solid fa-display"></i>
                            <span>${deviceSummary}</span>
                        </div>
                        <span class="ua-line" title="${userAgent}">${userAgent}</span>
                    </td>
                    <td>
                        <div class="time-line">
                            <i class="fa-regular fa-clock"></i>
                            <span>${timeStr}</span>
                        </div>
                        <div class="date-line">${dateStr}</div>
                    </td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = rowsHtml;
    }

    function getActionBadgeClass(action) {
        switch (action) {
            case 'CREATE':
                return 'badge-action-create';
            case 'UPDATE':
                return 'badge-action-update';
            case 'DELETE':
                return 'badge-action-delete';
            case 'PAYMENT':
                return 'badge-action-payment';
            case 'STATUS':
                return 'badge-action-status';
            case 'IMPORT':
                return 'badge-action-import';
            case 'EXPORT':
                return 'badge-action-export';
            case 'LOGIN':
                return 'badge-action-login';
            default:
                return 'badge-action-update';
        }
    }

    function formatLogTimestamp(dateInput) {
        if (!dateInput) return { timeStr: '--:--:-- --', dateStr: '---' };
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return { timeStr: '--:--:-- --', dateStr: '---' };

        // Time formatted as hh:mm:ss a (e.g., 05:47:36 pm)
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 becomes 12
        const formattedHours = String(hours).padStart(2, '0');
        const timeStr = `${formattedHours}:${minutes}:${seconds} ${ampm}`;

        // Date formatted as DD MMM YYYY (e.g., 12 Nov 2026)
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const dateStr = `${day} ${month} ${year}`;

        return { timeStr, dateStr };
    }

    function renderPagination() {
        const paginationWrap = document.getElementById('auditPagination');
        const paginationInfo = document.getElementById('paginationInfo');
        const btnPrevPage = document.getElementById('btnPrevPage');
        const btnNextPage = document.getElementById('btnNextPage');
        const pageNumbersContainer = document.getElementById('pageNumbersContainer');

        if (!paginationWrap) return;

        if (totalLogsCount <= currentLimit) {
            paginationWrap.style.display = totalLogsCount > 0 ? 'flex' : 'none';
        } else {
            paginationWrap.style.display = 'flex';
        }

        if (paginationInfo) {
            paginationInfo.textContent = `Page ${currentPage} of ${totalPagesCount || 1}`;
        }

        if (btnPrevPage) {
            btnPrevPage.disabled = currentPage <= 1;
        }

        if (btnNextPage) {
            btnNextPage.disabled = currentPage >= totalPagesCount;
        }

        if (pageNumbersContainer) {
            pageNumbersContainer.innerHTML = '';
            const maxButtons = 5;
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPagesCount, startPage + maxButtons - 1);

            if (endPage - startPage < maxButtons - 1) {
                startPage = Math.max(1, endPage - maxButtons + 1);
            }

            for (let p = startPage; p <= endPage; p++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `btn-page ${p === currentPage ? 'active' : ''}`;
                pageBtn.textContent = String(p);
                pageBtn.addEventListener('click', () => {
                    if (p !== currentPage) {
                        currentPage = p;
                        fetchAuditLogs(currentPage);
                    }
                });
                pageNumbersContainer.appendChild(pageBtn);
            }
        }
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
})();

