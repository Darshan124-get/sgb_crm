/**
 * job_cards.js
 * Customer Support Job Cards Management UI Controller
 * Single-operator model: Support executive handles call, diagnosis, parts & completion.
 */

let currentPage = 1;
let totalPages = 1;
let currentStatus = 'all';
let searchQuery = '';
let currentJobType = '';
let currentPriority = '';
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check URL parameters for prefill or direct action
    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get('status');
    const initialPhone = urlParams.get('phone');
    const initialOrderId = urlParams.get('order_id');
    const initialCaseId = urlParams.get('case_id');
    const initialAction = urlParams.get('action');

    if (initialStatus) {
        currentStatus = initialStatus.toLowerCase();
        highlightActiveTab(currentStatus);
    }


    // 3. Search input debouncing
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

    // 4. Initial load of job cards
    await loadJobCards(1);

    // 5. Handle prefill from URL if coming from orders_delivered or support cases
    if (initialAction === 'create' || initialPhone || initialOrderId || initialCaseId) {
        openCreateJobModal({
            phone: initialPhone || '',
            order_id: initialOrderId || '',
            case_id: initialCaseId || ''
        });
    }
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
                        Failed to load job cards: ${res ? res.message : 'Unknown error'}
                    </td>
                </tr>
            `;
            return;
        }

        // Update Tab Badges
        if (res.statusCounts) {
            document.getElementById('badgeAll').textContent = res.statusCounts.all || 0;
            document.getElementById('badgeOpen').textContent = res.statusCounts.open || 0;
            document.getElementById('badgeInProgress').textContent = res.statusCounts['in progress'] || 0;
            document.getElementById('badgeOnHold').textContent = res.statusCounts['on hold'] || 0;
            document.getElementById('badgeCompleted').textContent = res.statusCounts.completed || 0;
            document.getElementById('badgeCancelled').textContent = res.statusCounts.cancelled || 0;
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
                                ${searchQuery ? `No jobs match "${searchQuery}".` : 'No Job Cards match the current filter criteria.'}
                            </p>
                            <button type="button" class="btn btn-primary btn-sm" onclick="openCreateJobModal()">
                                <i class="fas fa-plus-circle"></i> Create Job Card
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            updatePagination(res.pagination || { total: 0, page: 1, totalPages: 1 });
            return;
        }

        // Render Rows
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
    
    // Icon by job type
    let jobTypeIcon = 'fa-wrench';
    if (job.job_type === 'Installation') jobTypeIcon = 'fa-tools';
    else if (job.job_type === 'Inspection') jobTypeIcon = 'fa-search';
    else if (job.job_type === 'Replacement Assessment') jobTypeIcon = 'fa-exchange-alt';

    const customerPhoneClean = (job.customer_phone || '').replace(/[^0-9]/g, '');
    const formattedCreated = window.formatDate(job.created_at);
    const formattedDue = job.due_date ? window.formatDate(job.due_date) : '—';

    return `
        <tr class="job-row">
            <td>
                <div style="font-weight: 800; color: #0284c7; display: flex; align-items: center; gap: 0.35rem;">
                    <a href="job_card_details.html?id=${job.job_card_id}" style="color: #0284c7; text-decoration: none;" title="View details">
                        ${job.job_card_number}
                    </a>
                </div>
                <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.15rem;">
                    <i class="far fa-calendar-alt"></i> ${formattedCreated}
                </div>
            </td>
            <td>
                <div style="font-weight: 700; color: #1e293b;">${job.customer_name || 'Customer'}</div>
                <div style="font-size: 0.78rem; color: #475569; display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem;">
                    <span><i class="fas fa-phone-alt" style="font-size: 0.7rem; color: #0284c7;"></i> ${job.customer_phone || '—'}</span>
                    ${customerPhoneClean ? `
                        <button type="button" class="btn-call-mini" onclick="window.callCustomer('${customerPhoneClean}', '${escapeQuotes(job.customer_name)}')" title="Call Customer">
                            <i class="fas fa-phone"></i>
                        </button>
                    ` : ''}
                </div>
                ${job.customer_address ? `
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.15rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${job.customer_address}">
                        <i class="fas fa-map-marker-alt" style="font-size: 0.68rem; color: #94a3b8;"></i> ${job.customer_address}
                    </div>
                ` : ''}
            </td>
            <td>
                <span class="badge" style="background: #f1f5f9; color: #334155; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.3rem;">
                    <i class="fas ${jobTypeIcon}" style="color: #64748b; font-size: 0.7rem;"></i> ${job.job_type}
                </span>
                ${job.order_number ? `
                    <div style="font-size: 0.72rem; color: #0284c7; font-weight: 600; margin-top: 0.25rem;">
                        <i class="fas fa-shopping-bag"></i> ${job.order_number}
                    </div>
                ` : ''}
            </td>
            <td style="max-width: 240px;">
                <div style="font-weight: 600; color: #1e293b; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${job.product_summary || 'N/A'}">
                    ${job.product_summary || '<span style="color:#94a3b8;font-style:italic;">No product specified</span>'}
                </div>
                <div style="font-size: 0.76rem; color: #64748b; margin-top: 0.2rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${job.issue_description}">
                    ${job.issue_description}
                </div>
            </td>
            <td>
                <span class="priority-badge priority-${prioritySlug}">
                    <span class="priority-dot"></span> ${job.priority}
                </span>
            </td>
            <td>
                <span class="status-pill status-${statusSlug}">
                    ${job.status}
                </span>
            </td>
            <td>
                <div style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                    ${job.assigned_to_name ? `<i class="fas fa-user-circle" style="color: #64748b; font-size: 0.78rem;"></i> ${job.assigned_to_name}` : '<span style="color:#94a3b8;font-style:italic;">Unassigned</span>'}
                </div>
            </td>
            <td>
                <div style="font-size: 0.8rem; color: ${isPastDue(job.due_date, job.status) ? '#ef4444; font-weight:700;' : '#475569;'}">
                    ${formattedDue}
                    ${isPastDue(job.due_date, job.status) ? '<span style="font-size: 0.68rem; display: block; color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Overdue</span>' : ''}
                </div>
            </td>
            <td style="text-align: right;">
                <a href="job_card_details.html?id=${job.job_card_id}" class="btn btn-primary btn-sm" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;" title="View details and manage job card">
                    <i class="fas fa-folder-open"></i> Manage
                </a>
            </td>
        </tr>
    `;
}

/**
 * Check if a job card is past its due date
 */
function isPastDue(dueDateStr, status) {
    if (!dueDateStr) return false;
    if (status === 'Completed' || status === 'Cancelled') return false;
    try {
        const due = new Date(dueDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return due < today;
    } catch (e) {
        return false;
    }
}

/**
 * Escape quotes for inline JS attributes
 */
function escapeQuotes(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/**
 * Update pagination UI
 */
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

/**
 * Change page
 */
window.changePage = function (delta) {
    const target = currentPage + delta;
    if (target >= 1 && target <= totalPages) {
        loadJobCards(target);
    }
};

/**
 * Filter by status tab
 */
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

/**
 * Filter by dropdowns
 */
window.applyFilters = function () {
    const typeSelect = document.getElementById('typeFilter');
    const prioritySelect = document.getElementById('priorityFilter');
    currentJobType = typeSelect ? typeSelect.value : '';
    currentPriority = prioritySelect ? prioritySelect.value : '';
    loadJobCards(1);
};

/**
 * Reset all filters
 */
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

/**
 * Modal Handling: Create Job Card
 */
window.openCreateJobModal = function (prefill = {}) {
    const modal = document.getElementById('createJobModal');
    if (!modal) return;
    modal.style.display = 'flex';

    if (prefill.phone) {
        document.getElementById('jobCustomerPhone').value = prefill.phone;
        lookupCustomerForJob();
    }
    if (prefill.order_id) {
        const orderIdHidden = document.getElementById('jobOrderId');
        if (orderIdHidden) orderIdHidden.value = prefill.order_id;
    }
    if (prefill.case_id) {
        const caseIdHidden = document.getElementById('jobCaseId');
        if (caseIdHidden) caseIdHidden.value = prefill.case_id;
    }
};

window.closeCreateJobModal = function () {
    const modal = document.getElementById('createJobModal');
    if (!modal) return;
    modal.style.display = 'none';
    const form = document.getElementById('createJobForm');
    if (form) form.reset();
    
    const orderIdHidden = document.getElementById('jobOrderId');
    if (orderIdHidden) orderIdHidden.value = '';
    const caseIdHidden = document.getElementById('jobCaseId');
    if (caseIdHidden) caseIdHidden.value = '';
};

/**
 * Customer Auto-Lookup via Phone Number
 */
window.lookupCustomerForJob = async function () {
    const phoneInput = document.getElementById('jobCustomerPhone');
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!phone || phone.length < 8) {
        window.showToast('Please enter a valid phone number (at least 8 digits)', 'error');
        return;
    }

    try {
        window.showToast('Looking up customer details...', 'info');
        const res = await window.supportFetch(`/lookup-customer?phone=${encodeURIComponent(phone)}`);
        
        if (res && res.success && res.customer) {
            const cust = res.customer;
            const nameInput = document.getElementById('jobCustomerName');
            const addressInput = document.getElementById('jobCustomerAddress');

            if (nameInput && !nameInput.value.trim() && cust.name) {
                nameInput.value = cust.name;
            }
            if (addressInput && !addressInput.value.trim() && cust.address) {
                addressInput.value = cust.address;
            }

            // Auto-fill product from prior direct orders if available
            const orders = res.orders || [];
            if (orders.length > 0) {
                const productInput = document.getElementById('jobProductSummary');
                if (productInput && (!productInput.value.trim() || productInput.value.trim() === 'SGB Chaff Cutter')) {
                    if (orders[0].product_name) productInput.value = orders[0].product_name;
                }
                const orderIdHidden = document.getElementById('jobOrderId');
                if (orderIdHidden && !orderIdHidden.value) {
                    orderIdHidden.value = orders[0].order_id;
                }
            }

            window.showToast(`Found record for ${cust.name || 'Customer'}.`, 'success');
        } else {
            window.showToast('No prior records found for this phone. You can enter details manually.', 'info');
        }
    } catch (err) {
        console.error('Error looking up customer:', err);
        window.showToast('Could not query customer data', 'error');
    }
};

/**
 * Form Submit: Handle Create Job Card
 */
window.handleCreateJobCard = async function (event) {
    event.preventDefault();

    const submitBtn = document.getElementById('btnSubmitJobCard');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Generate Job Card';

    const phone = document.getElementById('jobCustomerPhone').value.trim();
    const name = document.getElementById('jobCustomerName').value.trim();
    const jobType = document.getElementById('jobType').value;
    const priority = document.getElementById('jobPriority').value;
    const issueDesc = document.getElementById('jobIssueDescription').value.trim();
    const address = document.getElementById('jobCustomerAddress').value.trim();
    const productSummary = document.getElementById('jobProductSummary').value.trim();
    const workRequired = document.getElementById('jobWorkRequired').value.trim();
    const dueDate = document.getElementById('jobDueDate').value;
    const notes = document.getElementById('jobNotes')?.value?.trim() || '';
    const orderId = document.getElementById('jobOrderId')?.value || '';
    const caseRef = document.getElementById('jobCaseId')?.value?.trim() || '';

    // Validation
    if (!phone || !name || !issueDesc) {
        window.showToast('Please fill in customer phone, name, and issue description.', 'error');
        return;
    }

    // Build FormData for multipart (handles photos upload)
    const formData = new FormData();
    formData.append('customer_name', name);
    formData.append('customer_phone', phone);
    formData.append('customer_address', address);
    formData.append('job_type', jobType);
    formData.append('priority', priority);
    formData.append('issue_description', issueDesc);
    formData.append('product_summary', productSummary);
    formData.append('work_required', workRequired);
    if (dueDate) formData.append('due_date', dueDate);
    if (notes) formData.append('notes', notes);
    if (orderId) formData.append('order_id', orderId);
    if (caseRef) formData.append('case_id', caseRef);

    // Photos
    const photoInput = document.getElementById('jobPhotos');
    if (photoInput && photoInput.files && photoInput.files.length > 0) {
        for (let i = 0; i < photoInput.files.length; i++) {
            formData.append('photos', photoInput.files[i]);
        }
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        }

        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/customer-support/job-cards`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            // Check if duplicate job card error
            if (data.existing_job_card_id) {
                alert(`⚠️ DUPLICATE PREVENTED:\n\n${data.message}\n\nYou can click OK to view the existing Job Card.`);
                window.location.href = `job_card_details.html?id=${data.existing_job_card_id}`;
                return;
            }
            window.showToast(data.message || 'Failed to create Job Card', 'error');
            return;
        }

        window.showToast(`Job Card ${data.job_card_number} created successfully!`, 'success');
        closeCreateJobModal();
        await loadJobCards(1);

    } catch (err) {
        console.error('Error creating job card:', err);
        window.showToast('Network error while generating Job Card', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
};
