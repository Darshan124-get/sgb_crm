/**
 * job_card_details.js
 * Customer Support Single Job Card Detailed View, Parts & Resolution Management
 */

let currentJobCardId = null;
let currentJobCard = null;
let allJobPhotos = [];
let activePhotoFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentJobCardId = urlParams.get('id');

    if (!currentJobCardId) {
        alert('No Job Card ID provided.');
        window.location.href = 'job_cards.html';
        return;
    }

    await loadJobCardDetails();
});

/**
 * Fetch and render all Job Card details
 */
async function loadJobCardDetails() {
    const loadingEl = document.getElementById('detailsLoading');
    const contentEl = document.getElementById('jobCardContent');

    try {
        const res = await window.supportFetch(`/job-cards/${currentJobCardId}`);
        if (!res || !res.success || !res.job_card) {
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div style="max-width: 400px; margin: 0 auto; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                        <h3>Job Card Not Found</h3>
                        <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.5rem;">The requested Job Card could not be located or may have been deleted.</p>
                        <a href="job_cards.html" class="btn btn-primary" style="margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-arrow-left"></i> Return to Job Cards
                        </a>
                    </div>
                `;
            }
            return;
        }

        currentJobCard = res.job_card;
        allJobPhotos = res.photos || [];

        renderHeader(currentJobCard);
        renderCustomerAndOrder(currentJobCard);
        renderIssueAndWork(currentJobCard);
        renderDiagnosisAndResolution(currentJobCard);
        renderPartsAndCosts(res.parts || [], res.parts_total, res.grand_total);
        renderPhotos(allJobPhotos);
        renderTimeline(res.logs || []);

        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';

    } catch (err) {
        console.error('Error loading job card details:', err);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div style="color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    <p>Failed to connect to the server. Please check your network and refresh.</p>
                </div>
            `;
        }
    }
}

/**
 * Render Header and action controls
 */
function renderHeader(job) {
    const jobNumEl = document.getElementById('textJobCardNum');
    const breadcrumbEl = document.getElementById('breadcrumbJobNum');
    if (jobNumEl) jobNumEl.textContent = job.job_card_number;
    if (breadcrumbEl) breadcrumbEl.textContent = job.job_card_number;

    // Status Badge
    const statusBadge = document.getElementById('headerStatusBadge');
    const statusSlug = (job.status || 'open').toLowerCase().replace(/\s+/g, '-');
    if (statusBadge) {
        statusBadge.className = `status-pill status-${statusSlug}`;
        statusBadge.textContent = job.status;
    }

    // Priority Badge
    const priorityBadge = document.getElementById('headerPriorityBadge');
    const prioritySlug = (job.priority || 'medium').toLowerCase();
    if (priorityBadge) {
        priorityBadge.className = `priority-badge priority-${prioritySlug}`;
        priorityBadge.innerHTML = `<span class="priority-dot"></span> ${job.priority}`;
    }

    // Action buttons based on lifecycle state
    const btnStatus = document.getElementById('btnOpenStatusModal');
    const btnComplete = document.getElementById('btnOpenCompleteModal');
    const btnCallTop = document.getElementById('btnCallCustomerTop');
    const bannerAlert = document.getElementById('jobBannerAlert');

    if (job.customer_phone && btnCallTop) {
        btnCallTop.style.display = 'inline-flex';
        btnCallTop.onclick = () => window.callCustomer(job.customer_phone, job.customer_name);
    }

    if (bannerAlert) {
        if (job.status === 'Completed') {
            bannerAlert.style.display = 'flex';
            bannerAlert.style.background = '#dcfce7';
            bannerAlert.style.border = '1px solid #86efac';
            bannerAlert.style.color = '#15803d';
            bannerAlert.innerHTML = `
                <i class="fas fa-check-circle" style="font-size: 1.25rem;"></i>
                <div>
                    <strong>Job Card Completed:</strong> Work was successfully completed and recorded.
                    ${job.completed_at ? ` Completed on ${window.formatDateTime(job.completed_at)}.` : ''}
                </div>
            `;
            if (btnStatus) btnStatus.style.display = 'none';
            if (btnComplete) btnComplete.style.display = 'none';
        } else if (job.status === 'Cancelled') {
            bannerAlert.style.display = 'flex';
            bannerAlert.style.background = '#fee2e2';
            bannerAlert.style.border = '1px solid #fca5a5';
            bannerAlert.style.color = '#991b1b';
            bannerAlert.innerHTML = `
                <i class="fas fa-times-circle" style="font-size: 1.25rem;"></i>
                <div>
                    <strong>Job Card Cancelled:</strong> This service request has been cancelled and closed.
                </div>
            `;
            if (btnStatus) btnStatus.style.display = 'none';
            if (btnComplete) btnComplete.style.display = 'none';
        } else {
            bannerAlert.style.display = 'none';
            if (btnStatus) btnStatus.style.display = 'inline-flex';
            if (btnComplete) btnComplete.style.display = 'inline-flex';
        }
    }
}

/**
 * Render Customer & Order section
 */
function renderCustomerAndOrder(job) {
    document.getElementById('valCustomerName').textContent = job.customer_name || 'Customer';
    
    const phoneEl = document.getElementById('valCustomerPhone');
    if (phoneEl) phoneEl.textContent = job.customer_phone || '—';
    
    const callBtnInline = document.getElementById('btnCallCustomerInline');
    if (callBtnInline && job.customer_phone) {
        callBtnInline.onclick = () => window.callCustomer(job.customer_phone, job.customer_name);
    }

    document.getElementById('valCustomerAddress').textContent = job.customer_address || '—';

    // Order Info
    const orderInfoEl = document.getElementById('valOrderInfo');
    if (orderInfoEl) {
        if (job.order_id) {
            const total = job.order_total_amount ? `(₹${parseFloat(job.order_total_amount).toLocaleString('en-IN')})` : '';
            orderInfoEl.innerHTML = `
                <span style="color: #0284c7; font-weight: 700;">
                    <i class="fas fa-shopping-bag"></i> Order #${job.order_id} ${total}
                </span>
                <span class="badge" style="font-size:0.7rem; background:#f1f5f9; color:#475569; margin-left: 0.35rem;">
                    ${job.order_status || 'Delivered'}
                </span>
            `;
        } else {
            orderInfoEl.innerHTML = '<span style="color: #64748b; font-weight: 500;">Direct B2C Customer (No order linked)</span>';
        }
    }

    // Support Case Info
    const caseInfoEl = document.getElementById('valCaseInfo');
    if (caseInfoEl) {
        if (job.case_id) {
            caseInfoEl.innerHTML = `
                <a href="cases.html" style="color: #0284c7; text-decoration: none; font-weight: 700;">
                    <i class="fas fa-headset"></i> Case #${job.case_number || job.case_id}
                </a>
                <span class="badge" style="font-size:0.7rem; background:#e0f2fe; color:#0369a1; margin-left: 0.35rem;">
                    ${job.case_status || 'Open'}
                </span>
            `;
        } else {
            caseInfoEl.innerHTML = '<span style="color: #94a3b8; font-weight: 500;">None</span>';
        }
    }

    // Assigned To
    const assignedEl = document.getElementById('valAssignedTo');
    if (assignedEl) {
        assignedEl.textContent = job.assigned_to_name || 'Unassigned';
    }

    // Dates
    document.getElementById('valCreatedAt').textContent = window.formatDateTime(job.created_at);
    
    const dueEl = document.getElementById('valDueDate');
    if (dueEl) {
        if (job.due_date) {
            const formatted = window.formatDate(job.due_date);
            const isOverdue = job.status !== 'Completed' && job.status !== 'Cancelled' && new Date(job.due_date) < new Date().setHours(0,0,0,0);
            dueEl.innerHTML = `
                <span style="${isOverdue ? 'color: #ef4444; font-weight: 800;' : ''}">${formatted}</span>
                ${isOverdue ? '<span class="badge" style="background:#fee2e2; color:#b91c1c; font-size:0.68rem; margin-left:0.35rem;">Overdue</span>' : ''}
            `;
        } else {
            dueEl.textContent = '—';
        }
    }
}

/**
 * Render Issue description & Planned tasks
 */
function renderIssueAndWork(job) {
    const jobTypeBadge = document.getElementById('valJobTypeBadge');
    if (jobTypeBadge) jobTypeBadge.textContent = job.job_type || 'Service/Repair';

    document.getElementById('valProductSummary').textContent = job.product_summary || 'Not specified';
    document.getElementById('valIssueDescription').textContent = job.issue_description || '—';
    document.getElementById('valWorkRequired').textContent = job.work_required || 'No specific tasks planned.';

    const notesContainer = document.getElementById('notesContainer');
    const valNotes = document.getElementById('valNotes');
    if (job.notes && job.notes.trim()) {
        if (notesContainer) notesContainer.style.display = 'block';
        if (valNotes) valNotes.textContent = job.notes;
    } else {
        if (notesContainer) notesContainer.style.display = 'none';
    }
}

/**
 * Render Diagnosis & Work Performed
 */
function renderDiagnosisAndResolution(job) {
    const card = document.getElementById('diagnosisCard');
    if (!card) return;

    if (job.diagnosis || job.work_performed || job.status === 'Completed') {
        card.style.display = 'block';
        document.getElementById('valDiagnosis').textContent = job.diagnosis || 'Diagnosis pending.';
        document.getElementById('valWorkPerformed').textContent = job.work_performed || 'Resolution pending.';
        const completedAtEl = document.getElementById('valCompletedAt');
        if (completedAtEl) {
            completedAtEl.textContent = job.completed_at ? `Completed: ${window.formatDateTime(job.completed_at)}` : '';
        }
    } else {
        card.style.display = 'none';
    }
}

/**
 * Render Spare Parts table
 */
function renderPartsAndCosts(parts) {
    const tbody = document.getElementById('partsTableBody');
    const countBadge = document.getElementById('partsCountBadge');
    if (countBadge) countBadge.textContent = `${parts.length} Part${parts.length === 1 ? '' : 's'}`;

    if (!tbody) return;

    if (parts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #94a3b8; padding: 1.5rem;">
                    No spare parts recorded for this job.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = parts.map(p => `
            <tr>
                <td style="font-weight: 600; color: #1e293b;">${p.part_name}</td>
                <td style="color: #64748b; font-family: monospace; font-size: 0.8rem;">${p.part_number || '—'}</td>
                <td style="text-align: center; font-weight: 700;">${p.quantity}</td>
                <td style="color: #475569; font-size: 0.85rem;">${p.remarks ? p.remarks : '<span style="color:#94a3b8; font-style:italic;">Standard replacement</span>'}</td>
            </tr>
        `).join('');
    }
}

/**
 * Render Photo gallery
 */
function renderPhotos(photos) {
    const gallery = document.getElementById('photoGallery');
    if (!gallery) return;

    const filtered = activePhotoFilter === 'all' 
        ? photos 
        : photos.filter(p => (p.photo_type || '').toLowerCase() === activePhotoFilter);

    if (filtered.length === 0) {
        gallery.innerHTML = `
            <p style="font-size: 0.85rem; color: #94a3b8; grid-column: 1 / -1; text-align: center; padding: 1.5rem 0;">
                No ${activePhotoFilter !== 'all' ? activePhotoFilter : ''} photos available.
            </p>
        `;
        return;
    }

    gallery.innerHTML = filtered.map(p => {
        const fullUrl = p.file_url.startsWith('http') ? p.file_url : `${window.ROOT_PATH}${p.file_url.replace(/^\//, '')}`;
        const photoType = p.photo_type || 'photo';
        const uploader = p.uploaded_by_name || 'Staff';
        const dateStr = window.formatDate(p.created_at);
        const caption = `${photoType.toUpperCase()} Photo — Uploaded by ${uploader} on ${dateStr}`;

        return `
            <div class="photo-thumb-card" title="Click to enlarge">
                <img src="${fullUrl}" alt="${photoType} photo" onclick="openLightbox('${fullUrl}', '${escapeQuotes(caption)}')" onerror="this.src='https://placehold.co/150x150/e2e8f0/64748b?text=Image+Error';">
                <span class="photo-tag-pill">${photoType}</span>
            </div>
        `;
    }).join('');
}

/**
 * Filter photo gallery by stage
 */
window.filterPhotos = function (stage) {
    activePhotoFilter = stage.toLowerCase();
    
    // Update active filter pill button
    const buttons = document.querySelectorAll('.photo-filter-btn');
    buttons.forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === activePhotoFilter) {
            btn.style.background = '#0284c7';
            btn.style.color = 'white';
        } else {
            btn.style.background = '#f8fafc';
            btn.style.color = '#475569';
        }
    });

    renderPhotos(allJobPhotos);
};

/**
 * Render Activity History Timeline
 */
function renderTimeline(logs) {
    const container = document.getElementById('activityTimeline');
    if (!container) return;

    if (logs.length === 0) {
        container.innerHTML = `
            <p style="font-size: 0.85rem; color: #94a3b8; text-align: center; padding: 1rem 0;">
                No activity logged yet.
            </p>
        `;
        return;
    }

    container.innerHTML = logs.map(log => {
        let actionIcon = 'fa-info-circle';
        let dotColor = '#0284c7';

        if (log.action === 'CREATED') {
            actionIcon = 'fa-plus-circle';
            dotColor = '#0284c7';
        } else if (log.action === 'STATUS_CHANGE') {
            actionIcon = 'fa-sync-alt';
            dotColor = '#f59e0b';
        } else if (log.action === 'COMPLETED') {
            actionIcon = 'fa-check-circle';
            dotColor = '#059669';
        } else if (log.action === 'PHOTO_UPLOADED') {
            actionIcon = 'fa-camera';
            dotColor = '#7c3aed';
        }

        const performer = log.performed_by_name || 'System / Staff';
        const timeFormatted = window.formatDateTime(log.created_at);

        return `
            <div class="timeline-item">
                <div class="timeline-dot" style="background: ${dotColor};"></div>
                <div class="timeline-content">
                    <div class="timeline-meta">
                        <strong style="color: #1e293b;"><i class="fas ${actionIcon}" style="color: ${dotColor};"></i> ${log.action}</strong>
                        <span>${timeFormatted}</span>
                    </div>
                    ${log.previous_status && log.new_status ? `
                        <div style="font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.25rem;">
                            Status: <span style="text-decoration: line-through; color: #94a3b8;">${log.previous_status}</span> ➔ <span style="color: #0284c7;">${log.new_status}</span>
                        </div>
                    ` : ''}
                    <div style="font-size: 0.82rem; color: #334155; line-height: 1.4;">
                        ${log.notes || 'Activity completed.'}
                    </div>
                    <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.35rem;">
                        <i class="fas fa-user-edit"></i> ${performer}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Modal Opener & Closer Helpers
 */
window.openStatusModal = function () {
    if (!currentJobCard) return;
    const modal = document.getElementById('updateStatusModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const select = document.getElementById('selectNewStatus');
    if (select) {
        if (currentJobCard.status === 'Open') select.value = 'In Progress';
        else if (currentJobCard.status === 'In Progress') select.value = 'On Hold';
        else select.value = 'In Progress';
    }
    onStatusSelectChanged();
};

window.onStatusSelectChanged = function () {
    const select = document.getElementById('selectNewStatus');
    const group = document.getElementById('cancellationReasonGroup');
    const input = document.getElementById('inputCancellationReason');

    if (select && select.value === 'Cancelled') {
        if (group) group.style.display = 'block';
        if (input) input.required = true;
    } else {
        if (group) group.style.display = 'none';
        if (input) {
            input.required = false;
            input.value = '';
        }
    }
};

window.handleUpdateStatus = async function (e) {
    e.preventDefault();

    const statusSelect = document.getElementById('selectNewStatus');
    const newStatus = statusSelect ? statusSelect.value : '';
    const cancellationReason = document.getElementById('inputCancellationReason').value.trim();
    const notes = document.getElementById('inputStatusNotes').value.trim();
    const submitBtn = document.getElementById('btnSubmitStatus');

    if (newStatus === 'Cancelled' && !cancellationReason) {
        window.showToast('Cancellation reason is strictly required.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        }

        const res = await window.supportFetch(`/job-cards/${currentJobCardId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
                status: newStatus,
                cancellation_reason: cancellationReason,
                notes: notes
            })
        });

        if (!res || !res.success) {
            window.showToast(res ? res.message : 'Failed to update status', 'error');
            return;
        }

        window.showToast(`Status updated to ${newStatus}`, 'success');
        closeModal('updateStatusModal');
        await loadJobCardDetails();

    } catch (err) {
        console.error('Error updating status:', err);
        window.showToast('Failed to update status', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Update Status';
        }
    }
};

/**
 * Completion Modal & Dynamic Parts Rows
 */
window.openCompleteModal = function () {
    const modal = document.getElementById('completeJobModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const container = document.getElementById('sparePartsRowsContainer');
    if (container && container.children.length === 0) {
        // Add one initial empty part row
        addSparePartRow();
    }
};

window.addSparePartRow = function (data = {}) {
    const container = document.getElementById('sparePartsRowsContainer');
    if (!container) return;

    const rowId = `partRow_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'spare-part-input-row';

    row.innerHTML = `
        <input type="text" class="part-name-input" placeholder="e.g. Run Capacitor, V-Belt" required value="${data.part_name || ''}">
        <input type="text" class="part-sku-input" placeholder="Part # / SKU" value="${data.part_number || ''}">
        <input type="number" class="part-qty-input" min="1" step="1" value="${data.quantity || 1}" style="text-align: center;">
        <input type="text" class="part-remarks-input" placeholder="Reason / condition (optional)" value="${data.remarks || ''}">
        <button type="button" class="spare-part-del-btn" onclick="removeSparePartRow('${rowId}')" title="Remove Part">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

    container.appendChild(row);
};

window.removeSparePartRow = function (rowId) {
    const el = document.getElementById(rowId);
    if (el) el.remove();
};

/**
 * Handle Complete Job Card Form Submission
 */
window.handleCompleteJobCard = async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById('btnSubmitComplete');
    const diagnosis = document.getElementById('completeDiagnosis').value.trim();
    const workPerformed = document.getElementById('completeWorkPerformed').value.trim();
    const completionNotes = document.getElementById('completeNotes').value.trim();

    if (!diagnosis || !workPerformed) {
        window.showToast('Please provide both technical diagnosis and work performed.', 'error');
        return;
    }

    // Collect dynamic spare parts
    const parts = [];
    const rows = document.querySelectorAll('#sparePartsRowsContainer .spare-part-input-row');
    for (const row of rows) {
        const partName = row.querySelector('.part-name-input').value.trim();
        const partSku = row.querySelector('.part-sku-input').value.trim();
        const qty = parseInt(row.querySelector('.part-qty-input').value, 10) || 1;
        const remarks = row.querySelector('.part-remarks-input').value.trim();

        if (partName) {
            parts.push({
                part_name: partName,
                part_number: partSku || null,
                quantity: qty,
                remarks: remarks || null
            });
        }
    }

    const formData = new FormData();
    formData.append('diagnosis', diagnosis);
    formData.append('work_performed', workPerformed);
    formData.append('service_cost', '0.00');
    formData.append('completion_notes', completionNotes);
    formData.append('parts', JSON.stringify(parts));

    // After photos
    const photoInput = document.getElementById('completePhotos');
    if (photoInput && photoInput.files && photoInput.files.length > 0) {
        for (let i = 0; i < photoInput.files.length; i++) {
            formData.append('photos', photoInput.files[i]);
        }
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing Job...';
        }

        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/customer-support/job-cards/${currentJobCardId}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            window.showToast(data.message || 'Failed to complete Job Card', 'error');
            return;
        }

        window.showToast('Job Card marked completed. Parts list submitted to Billing!', 'success');
        closeModal('completeJobModal');
        await loadJobCardDetails();

    } catch (err) {
        console.error('Error completing job card:', err);
        window.showToast('Network error while completing Job Card', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Finalize & Mark Completed';
        }
    }
};

/**
 * Upload Photos Modal Handler
 */
window.openUploadPhotosModal = function () {
    const modal = document.getElementById('uploadPhotosModal');
    if (modal) modal.style.display = 'flex';
};

window.handleUploadPhotos = async function (e) {
    e.preventDefault();

    const photoType = document.getElementById('selectPhotoType').value;
    const fileInput = document.getElementById('inputPhotoFiles');
    const submitBtn = document.getElementById('btnSubmitPhotos');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        window.showToast('Please select at least one photo to upload.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('photo_type', photoType);
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('photos', fileInput.files[i]);
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        }

        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/customer-support/job-cards/${currentJobCardId}/photos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            window.showToast(data.message || 'Failed to upload photos', 'error');
            return;
        }

        window.showToast('Photos uploaded successfully!', 'success');
        closeModal('uploadPhotosModal');
        const form = document.getElementById('uploadPhotosForm');
        if (form) form.reset();
        await loadJobCardDetails();

    } catch (err) {
        console.error('Error uploading photos:', err);
        window.showToast('Failed to upload photos', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Photos';
        }
    }
};

/**
 * Lightbox Preview
 */
window.openLightbox = function (url, caption) {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    const captionEl = document.getElementById('lightboxCaption');

    if (modal && img) {
        img.src = url;
        if (captionEl) captionEl.textContent = caption || '';
        modal.style.display = 'flex';
    }
};

/**
 * Generic Modal Closer
 */
window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};

/**
 * Helper: Escape quotes for inline strings
 */
function escapeQuotes(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
