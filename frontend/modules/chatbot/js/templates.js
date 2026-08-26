/* ==========================================================================
   Chatbot Flow Templates & Management Page Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Guard & User Check
    if (window.requireAuth && typeof window.requireAuth === 'function') {
        window.requireAuth(['admin', 'super-admin', 'whatsapp_management_executive']);
    }

    const flowService = new FlowService();
    window.flowService = flowService;

    // State Management
    const state = {
        templates: [],
        flows: [],
        filteredFlows: [],
        activeTab: 'templates',
        searchQuery: '',
        statusFilter: 'ALL',
        categoryFilter: 'ALL',
        sortBy: 'recently_modified',
        currentPage: 1,
        pageSize: 10,
        selectedFlowId: null,
        confirmCallback: null
    };

    // DOM Elements
    const tabTemplatesBtn = document.getElementById('tab-templates-btn');
    const tabCreatedBtn = document.getElementById('tab-created-btn');
    const sectionTemplates = document.getElementById('section-flow-templates');
    const sectionCreated = document.getElementById('section-created-flows');
    const templatesGridContainer = document.getElementById('templates-grid-container');
    const createdFlowsTbody = document.getElementById('created-flows-tbody');
    const tableEmptyState = document.getElementById('table-empty-state');
    const flowsSearchInput = document.getElementById('flows-search-input');
    const filterStatus = document.getElementById('filter-status');
    const filterCategory = document.getElementById('filter-category');
    const sortSelect = document.getElementById('sort-select');
    const btnClearFilters = document.getElementById('btn-clear-filters');
    const paginationInfo = document.getElementById('pagination-info');
    const toastContainer = document.getElementById('toast-container');

    // Modals
    const modalHowItWorks = document.getElementById('modal-how-it-works');
    const modalCreateFromTemplate = document.getElementById('modal-create-from-template');
    const modalCreateFlow = document.getElementById('modal-create-flow');
    const modalDuplicateFlow = document.getElementById('modal-duplicate-flow');
    const modalImportFlow = document.getElementById('modal-import-flow');
    const modalTestFlow = document.getElementById('modal-test-flow');
    const modalConfirm = document.getElementById('modal-confirm');

    // Initialize Page
    init();

    async function init() {
        bindEvents();
        await loadTemplates();
        await loadFlows();
        syncTabWithURL();
    }

    // ── Tab Management & URL Sync ──
    function syncTabWithURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        if (tab === 'created') {
            switchTab('created');
        } else {
            switchTab('templates');
        }
    }

    function switchTab(tabName) {
        state.activeTab = tabName;
        if (tabTemplatesBtn) tabTemplatesBtn.classList.toggle('active', tabName === 'templates');
        if (tabCreatedBtn) tabCreatedBtn.classList.toggle('active', tabName === 'created');
        if (tabName === 'templates') {
            if (sectionTemplates) sectionTemplates.style.display = 'block';
            if (sectionCreated) sectionCreated.style.display = 'block';
        } else {
            if (sectionTemplates) sectionTemplates.style.display = 'block';
            if (sectionCreated) {
                sectionCreated.style.display = 'block';
                sectionCreated.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    // ── Load Templates ──
    async function loadTemplates() {
        try {
            state.templates = await flowService.getTemplates();
            renderTemplatesGrid();
        } catch (err) {
            console.error('Failed to load templates:', err);
            renderTemplatesGrid();
        }
    }

    function renderTemplatesGrid() {
        if (!templatesGridContainer) return;

        const colorClasses = ['purple', 'blue', 'green', 'orange', 'red'];

        templatesGridContainer.innerHTML = state.templates.map((tpl, index) => {
            const colorClass = colorClasses[index % colorClasses.length];
            const previewChips = tpl.previewNodes ? tpl.previewNodes.map((node, i) => `
                <span class="chip-item">${node}</span>
                ${i < tpl.previewNodes.length - 1 ? '<i class="fa-solid fa-chevron-right chip-arrow"></i>' : ''}
            `).join('') : '';

            return `
                <div class="template-card" data-template-id="${tpl.id}">
                    <div>
                        <div class="tpl-icon-box ${colorClass}">
                            <i class="fa-solid ${tpl.icon || 'fa-bolt'}"></i>
                        </div>
                        <h3 class="tpl-card-title">${tpl.name}</h3>
                        <p class="tpl-card-desc">${tpl.description}</p>
                        
                        <div class="mini-flow-chips">
                            ${previewChips}
                        </div>
                    </div>
                    <div class="tpl-card-bottom">
                        <span class="used-count-text">Used ${tpl.usageCount || 10} times</span>
                        <button class="btn-use-tpl btn-use-template" type="button" data-template-id="${tpl.id}" data-template-name="${tpl.name}" data-category="${tpl.category}">
                            Use Template
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ── Load Flows ──
    async function loadFlows() {
        try {
            state.flows = await flowService.getFlows();
            applyFiltersAndSort();
        } catch (err) {
            console.error('Failed to load flows:', err);
            applyFiltersAndSort();
        }
    }

    // ── Filters & Sorting ──
    function applyFiltersAndSort() {
        let result = [...state.flows];

        // Search
        if (state.searchQuery.trim() !== '') {
            const q = state.searchQuery.toLowerCase().trim();
            result = result.filter(f =>
                f.name.toLowerCase().includes(q) ||
                (f.description && f.description.toLowerCase().includes(q)) ||
                (f.category && f.category.toLowerCase().includes(q)) ||
                (f.createdBy && f.createdBy.toLowerCase().includes(q)) ||
                (f.triggerKeywords && f.triggerKeywords.some(k => k.toLowerCase().includes(q)))
            );
        }

        // Status
        if (state.statusFilter !== 'ALL') {
            result = result.filter(f => f.status.toUpperCase() === state.statusFilter.toUpperCase());
        }

        // Category
        if (state.categoryFilter !== 'ALL') {
            result = result.filter(f => f.category.toLowerCase() === state.categoryFilter.toLowerCase());
        }

        // Sorting
        result.sort((a, b) => {
            if (state.sortBy === 'recently_modified') return new Date(b.lastModified) - new Date(a.lastModified);
            if (state.sortBy === 'oldest_modified') return new Date(a.lastModified) - new Date(b.lastModified);
            if (state.sortBy === 'name_asc') return a.name.localeCompare(b.name);
            if (state.sortBy === 'name_desc') return b.name.localeCompare(a.name);
            if (state.sortBy === 'most_leads') return (b.metrics?.leads || 0) - (a.metrics?.leads || 0);
            if (state.sortBy === 'highest_completion') return (b.metrics?.completionRate || 0) - (a.metrics?.completionRate || 0);
            if (state.sortBy === 'highest_conversion') return (b.metrics?.conversionRate || 0) - (a.metrics?.conversionRate || 0);
            return 0;
        });

        state.filteredFlows = result;
        state.currentPage = 1;

        if (btnClearFilters) {
            btnClearFilters.style.display = (state.searchQuery || state.statusFilter !== 'ALL' || state.categoryFilter !== 'ALL') ? 'inline-flex' : 'none';
        }

        renderCreatedFlowsTable();
    }

    // ── Render Created Flows Table ──
    function renderCreatedFlowsTable() {
        if (!createdFlowsTbody) return;

        if (state.filteredFlows.length === 0) {
            createdFlowsTbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 24px; color: #94a3b8;">No chatbot flows found.</td></tr>';
            if (tableEmptyState) tableEmptyState.style.display = 'block';
            if (paginationInfo) paginationInfo.textContent = 'Showing 0 flows';
            return;
        }

        if (tableEmptyState) tableEmptyState.style.display = 'none';

        const total = state.filteredFlows.length;
        const startIndex = (state.currentPage - 1) * state.pageSize;
        const endIndex = Math.min(startIndex + state.pageSize, total);
        const pageFlows = state.filteredFlows.slice(startIndex, endIndex);

        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${total} flows`;
        }

        createdFlowsTbody.innerHTML = pageFlows.map(flow => {
            const statusLower = (flow.status || 'draft').toLowerCase();
            const statusSubtext = statusLower === 'active' ? 'Live' : (statusLower === 'draft' ? 'Draft' : 'Inactive');
            const keywordsLabel = flow.triggerType === 'Default'
                ? 'Trigger Type: Default Welcome Message'
                : `Keywords: ${flow.triggerKeywords && flow.triggerKeywords.length > 0 ? flow.triggerKeywords.join(', ') : 'none'}`;

            let catClass = 'gen';
            const catLower = (flow.category || '').toLowerCase();
            if (catLower.includes('agri')) catClass = 'agri';
            else if (catLower.includes('const')) catClass = 'const';
            else if (catLower.includes('gard')) catClass = 'gard';

            let iconClass = 'general';
            if (flow.name.toLowerCase().includes('trolley')) iconClass = 'trolley';
            else if (flow.name.toLowerCase().includes('dumper')) iconClass = 'dumper';
            else if (flow.name.toLowerCase().includes('tractor')) iconClass = 'tractor';
            else if (flow.name.toLowerCase().includes('cutter')) iconClass = 'cutter';
            else if (flow.name.toLowerCase().includes('sprayer')) iconClass = 'sprayer';

            let avatarBg = '#4338ca';
            if (flow.userInitials === 'RK') avatarBg = '#7c3aed';
            if (flow.userInitials === 'SK') avatarBg = '#0284c7';

            return `
                <tr data-flow-id="${flow.id}">
                    <td>
                        <div class="tbl-flow-name-cell">
                            <div class="tbl-flow-icon ${iconClass}"><i class="fa-solid fa-shapes"></i></div>
                            <div style="min-width: 0;">
                                <span class="tbl-flow-title btn-edit-flow" data-flow-id="${flow.id}" title="${flow.name}">${flow.name}</span>
                                <span class="tbl-flow-sub" title="${flow.description || 'Enquiry flow'}">${flow.description || 'Enquiry flow'}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="tbl-trigger-box">
                            <div class="tbl-wa-icon"><i class="fa-brands fa-whatsapp"></i></div>
                            <span class="tbl-trigger-text" title="${keywordsLabel}">${keywordsLabel}</span>
                        </div>
                    </td>
                    <td>
                        <span class="tbl-cat-badge ${catClass}">${flow.category}</span>
                    </td>
                    <td>
                        <div class="tbl-status-cell">
                            <span class="tbl-status-dot-label ${statusLower}">
                                <span class="status-dot-indicator"></span> ${statusLower.charAt(0).toUpperCase() + statusLower.slice(1)}
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="tbl-ver-cell">
                            <span class="tbl-ver-num">${(flow.currentVersion || '1.0').replace('v','')}</span>
                        </div>
                    </td>
                    <td>
                        <span style="font-size: 10.5px; color: #475569; white-space: nowrap;">${flow.lastModified}</span>
                    </td>
                    <td>
                        <div class="tbl-user-cell">
                            <div class="tbl-user-avatar" style="background: ${avatarBg};">${flow.userInitials || 'AD'}</div>
                            <span style="font-size: 10.5px; font-weight: 600; color: #334155; white-space: nowrap;">${flow.createdBy}</span>
                        </div>
                    </td>
                    <td>
                        <strong style="font-size: 11px; color: #0f172a;">${(flow.metrics?.leads || 0).toLocaleString()}</strong>
                    </td>
                    <td>
                        <div class="tbl-progress-cell">
                            <span class="tbl-progress-val">${flow.metrics?.completionRate || 0}%</span>
                            <div class="tbl-progress-bar-bg">
                                <div class="tbl-progress-bar-fill" style="width: ${flow.metrics?.completionRate || 0}%;"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="tbl-progress-cell">
                            <span class="tbl-progress-val">${flow.metrics?.conversionRate || 0}%</span>
                            <div class="tbl-progress-bar-bg">
                                <div class="tbl-progress-bar-fill" style="width: ${flow.metrics?.conversionRate || 0}%;"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="tbl-actions-flex">
                            <button class="tbl-act-btn btn-edit-flow" title="Edit Flow" data-flow-id="${flow.id}"><i class="fa-regular fa-pen-to-square"></i></button>
                            <button class="tbl-act-btn btn-view-analytics" title="View Analytics" data-flow-id="${flow.id}"><i class="fa-solid fa-chart-line"></i></button>
                            <button class="tbl-act-btn btn-duplicate-flow" title="Duplicate Flow" data-flow-id="${flow.id}"><i class="fa-regular fa-copy"></i></button>
                            <button class="tbl-act-btn btn-more-options" title="More Options" data-flow-id="${flow.id}"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ── Bind Event Listeners ──
    function bindEvents() {
        // Tab buttons
        if (tabTemplatesBtn) tabTemplatesBtn.addEventListener('click', () => switchTab('templates'));
        if (tabCreatedBtn) tabCreatedBtn.addEventListener('click', () => switchTab('created'));

        // View All link
        const viewAllLink = document.getElementById('view-all-link');
        if (viewAllLink) viewAllLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('templates');
        });

        // Top actions
        const btnHowItWorks = document.getElementById('btn-how-it-works');
        if (btnHowItWorks) btnHowItWorks.addEventListener('click', () => openModal(modalHowItWorks));

        const btnImportFlow = document.getElementById('btn-import-flow');
        if (btnImportFlow) btnImportFlow.addEventListener('click', () => openModal(modalImportFlow));

        const btnCreateFlow = document.getElementById('btn-create-flow');
        if (btnCreateFlow) btnCreateFlow.addEventListener('click', () => openModal(modalCreateFlow));

        // Close modal buttons
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-backdrop');
                if (modal) closeModal(modal);
            });
        });

        // Search & Filters
        if (flowsSearchInput) flowsSearchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            applyFiltersAndSort();
        });
        if (filterStatus) filterStatus.addEventListener('change', (e) => {
            state.statusFilter = e.target.value;
            applyFiltersAndSort();
        });
        if (filterCategory) filterCategory.addEventListener('change', (e) => {
            state.categoryFilter = e.target.value;
            applyFiltersAndSort();
        });
        if (sortSelect) sortSelect.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            applyFiltersAndSort();
        });
        if (btnClearFilters) btnClearFilters.addEventListener('click', () => {
            state.searchQuery = '';
            state.statusFilter = 'ALL';
            state.categoryFilter = 'ALL';
            if (flowsSearchInput) flowsSearchInput.value = '';
            if (filterStatus) filterStatus.value = 'ALL';
            if (filterCategory) filterCategory.value = 'ALL';
            applyFiltersAndSort();
        });

        // Dynamic click delegation for Use Template & Table Actions
        document.addEventListener('click', async (e) => {
            // Use Template button
            const useBtn = e.target.closest('.btn-use-template');
            if (useBtn) {
                const tplId = useBtn.dataset.templateId;
                const tplName = useBtn.dataset.templateName;
                const tplCat = useBtn.dataset.category;

                document.getElementById('tpl-modal-id').value = tplId;
                document.getElementById('tpl-flow-name').value = `${tplName} - Custom`;
                document.getElementById('tpl-flow-category').value = tplCat || 'Agriculture';
                openModal(modalCreateFromTemplate);
                return;
            }

            // 3-Dot More Options Dropdown Toggle
            const moreBtn = e.target.closest('.btn-more-options');
            if (moreBtn) {
                e.stopPropagation();
                const parent = moreBtn.parentElement;
                let currentDropdown = parent.querySelector('.row-dropdown-menu');

                // Close all existing open dropdowns and clear row z-index highlights
                document.querySelectorAll('.row-dropdown-menu.active').forEach(menu => {
                    if (menu !== currentDropdown) menu.classList.remove('active');
                });
                document.querySelectorAll('.created-flows-table tr.row-dropdown-open').forEach(r => {
                    r.classList.remove('row-dropdown-open');
                });
                
                if (currentDropdown && currentDropdown.classList.contains('active')) {
                    currentDropdown.classList.remove('active');
                } else {
                    if (currentDropdown) currentDropdown.remove();

                    const flowId = moreBtn.dataset.flowId;
                    const targetFlow = state.flows.find(f => f.id == flowId);
                    const currentStatus = (targetFlow ? targetFlow.status : 'draft').toLowerCase();

                    // Calculate space below to determine whether to open upward or downward
                    const rect = moreBtn.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const openUpwards = spaceBelow < 280; // 280px buffer for menu height

                    const tr = moreBtn.closest('tr');
                    if (tr) tr.classList.add('row-dropdown-open');

                    const menu = document.createElement('div');
                    menu.className = `row-dropdown-menu active ${openUpwards ? 'open-upwards' : ''}`;
                    menu.innerHTML = `
                        <div class="dropdown-header">STATUS CONTROL</div>
                        ${currentStatus !== 'active' ? `
                            <div class="row-dropdown-item btn-change-status" data-flow-id="${flowId}" data-status="active">
                                <i class="fa-solid fa-play" style="color: #16a34a;"></i> Activate (Set Live)
                            </div>
                        ` : ''}
                        ${currentStatus !== 'stopped' ? `
                            <div class="row-dropdown-item btn-change-status" data-flow-id="${flowId}" data-status="stopped">
                                <i class="fa-solid fa-pause" style="color: #ea580c;"></i> Pause Flow
                            </div>
                        ` : ''}
                        ${currentStatus !== 'draft' ? `
                            <div class="row-dropdown-item btn-change-status" data-flow-id="${flowId}" data-status="draft">
                                <i class="fa-solid fa-file-pen" style="color: #d97706;"></i> Set as Draft
                            </div>
                        ` : ''}
                        <div class="row-dropdown-divider"></div>
                        <div class="dropdown-header">FLOW ACTIONS</div>
                        <div class="row-dropdown-item btn-edit-flow" data-flow-id="${flowId}">
                            <i class="fa-regular fa-pen-to-square" style="color: var(--primary-indigo);"></i> Open Flow Builder
                        </div>
                        <div class="row-dropdown-item btn-view-analytics" data-flow-id="${flowId}">
                            <i class="fa-solid fa-chart-line" style="color: #0284c7;"></i> View Analytics
                        </div>
                        <div class="row-dropdown-item btn-duplicate-flow" data-flow-id="${flowId}">
                            <i class="fa-regular fa-copy" style="color: #64748b;"></i> Duplicate Flow
                        </div>
                        <div class="row-dropdown-item btn-test-flow" data-flow-id="${flowId}">
                            <i class="fa-solid fa-robot" style="color: #16a34a;"></i> Test Simulator
                        </div>
                        <div class="row-dropdown-item btn-export-flow" data-flow-id="${flowId}">
                            <i class="fa-solid fa-download" style="color: #475569;"></i> Export Config (JSON)
                        </div>
                        <div class="row-dropdown-divider"></div>
                        <div class="row-dropdown-item danger btn-delete-flow" data-flow-id="${flowId}">
                            <i class="fa-regular fa-trash-can"></i> Archive / Delete Flow
                        </div>
                    `;
                    parent.appendChild(menu);
                }
                return;
            }

            // Close any open dropdown menus on click outside
            document.querySelectorAll('.row-dropdown-menu.active').forEach(menu => {
                if (!menu.contains(e.target)) menu.classList.remove('active');
            });
            document.querySelectorAll('.created-flows-table tr.row-dropdown-open').forEach(r => {
                if (!r.contains(e.target)) r.classList.remove('row-dropdown-open');
            });

            // Edit Flow
            const editBtn = e.target.closest('.btn-edit-flow');
            if (editBtn) {
                const flowId = editBtn.dataset.flowId;
                window.location.href = `chatbot.html?flowId=${flowId}`;
                return;
            }

            // View Analytics
            const viewAnalyticsBtn = e.target.closest('.btn-view-analytics');
            if (viewAnalyticsBtn) {
                const flowId = viewAnalyticsBtn.dataset.flowId;
                window.location.href = `analytics.html?flowId=${flowId}`;
                return;
            }

            // Delete Flow
            const delBtn = e.target.closest('.btn-delete-flow');
            if (delBtn) {
                const flowId = delBtn.dataset.flowId;
                const targetFlow = state.flows.find(f => f.id == flowId);
                const flowName = targetFlow ? targetFlow.name : 'this flow';
                if (confirm(`Are you sure you want to archive "${flowName}"?`)) {
                    try {
                        await flowService.deleteFlow(flowId);
                        state.flows = state.flows.filter(f => f.id != flowId);
                        applyFiltersAndSort();
                        showToast(`Flow "${flowName}" archived successfully!`, 'info');
                    } catch (err) {
                        showToast('Error archiving flow', 'error');
                    }
                }
                return;
            }

            // Duplicate Flow
            const dupBtn = e.target.closest('.btn-duplicate-flow');
            if (dupBtn) {
                const flowId = dupBtn.dataset.flowId;
                const targetFlow = state.flows.find(f => f.id == flowId);
                if (targetFlow) {
                    document.getElementById('dup-flow-id').value = flowId;
                    document.getElementById('dup-flow-name').value = `${targetFlow.name} - Copy`;
                    openModal(modalDuplicateFlow);
                }
                return;
            }

            // Change Flow Status
            const statusBtn = e.target.closest('.btn-change-status');
            if (statusBtn) {
                const flowId = statusBtn.dataset.flowId;
                const newStatus = statusBtn.dataset.status;
                const targetFlow = state.flows.find(f => f.id == flowId);
                const flowName = targetFlow ? targetFlow.name : 'Flow';

                try {
                    await flowService.updateFlowStatus(flowId, newStatus);
                    if (targetFlow) targetFlow.status = newStatus;
                    applyFiltersAndSort();
                    showToast(`Flow "${flowName}" status changed to ${newStatus.toUpperCase()}!`, 'success');
                } catch (err) {
                    showToast(`Error updating status for "${flowName}"`, 'error');
                }
                return;
            }

            // Export Config JSON
            const exportBtn = e.target.closest('.btn-export-flow');
            if (exportBtn) {
                const flowId = exportBtn.dataset.flowId;
                const targetFlow = state.flows.find(f => f.id == flowId);
                if (targetFlow) {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetFlow, null, 2));
                    const dl = document.createElement('a');
                    dl.setAttribute("href", dataStr);
                    dl.setAttribute("download", `${targetFlow.name.replace(/\s+/g, '_')}_config.json`);
                    document.body.appendChild(dl);
                    dl.click();
                    dl.remove();
                    showToast(`Exported "${targetFlow.name}" configuration JSON`, 'info');
                }
                return;
            }

            // Test Flow
            const testBtn = e.target.closest('.btn-test-flow');
            if (testBtn) {
                const flowId = testBtn.dataset.flowId;
                const targetFlow = state.flows.find(f => f.id == flowId);
                if (targetFlow) {
                    document.getElementById('test-bot-name').textContent = `${targetFlow.name} (Simulator)`;
                    openModal(modalTestFlow);
                }
                return;
            }
        });

        // Form Submit: Create From Template
        const formTpl = document.getElementById('form-create-from-template');
        if (formTpl) formTpl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tplId = document.getElementById('tpl-modal-id').value;
            const name = document.getElementById('tpl-flow-name').value;
            const category = document.getElementById('tpl-flow-category').value;
            const description = document.getElementById('tpl-flow-desc').value;
            const keywords = document.getElementById('tpl-flow-keywords').value.split(',').map(s => s.trim());

            try {
                const newFlow = await flowService.createFlowFromTemplate(tplId, { name, category, description, keywords });
                closeModal(modalCreateFromTemplate);
                showToast(`Flow "${name}" created successfully as Draft!`, 'success');
                // Redirect directly to Flow Builder Workspace
                setTimeout(() => {
                    window.location.href = `chatbot.html?flowId=${newFlow.id}`;
                }, 400);
            } catch (err) {
                showToast('Error creating flow from template', 'error');
            }
        });

        // Form Submit: Create New Flow
        const formNew = document.getElementById('form-create-flow');
        if (formNew) formNew.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-flow-name').value;
            const category = document.getElementById('new-flow-category').value;
            const description = document.getElementById('new-flow-desc').value;
            const keywords = document.getElementById('new-flow-keywords').value.split(',').map(s => s.trim());

            try {
                const newFlow = await flowService.createFlow({ name, category, description, keywords });
                closeModal(modalCreateFlow);
                showToast(`Flow "${name}" created successfully!`, 'success');
                setTimeout(() => {
                    window.location.href = `chatbot.html?flowId=${newFlow.id}`;
                }, 400);
            } catch (err) {
                showToast('Error creating flow', 'error');
            }
        });

        // Form Submit: Duplicate Flow
        const formDup = document.getElementById('form-duplicate-flow');
        if (formDup) formDup.addEventListener('submit', async (e) => {
            e.preventDefault();
            const flowId = document.getElementById('dup-flow-id').value;
            const newName = document.getElementById('dup-flow-name').value;

            try {
                await flowService.duplicateFlow(flowId, { name: newName });
                await loadFlows();
                closeModal(modalDuplicateFlow);
                showToast(`Flow duplicated as "${newName}"!`, 'success');
            } catch (err) {
                showToast('Error duplicating flow', 'error');
            }
        });
    }

    // Modal Helpers
    function openModal(modal) {
        if (modal) modal.classList.add('active');
    }
    function closeModal(modal) {
        if (modal) modal.classList.remove('active');
    }

    // Toast Notification
    function showToast(msg, type = 'info') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.innerHTML = `<i class="fa-solid fa-circle-info" style="color: #6366f1;"></i> ${msg}`;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }
});
