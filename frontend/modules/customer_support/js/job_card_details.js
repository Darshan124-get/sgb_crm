/**
 * job_card_details.js
 * Unified 10-Section SGB Agro Job Card Controller
 * Supports: Create, Save as Draft, Resume Draft, Edit, Work in Progress, Complete, Cancel & A4 Print
 */

let currentJobCardId = null;
let currentJobCard = null;
let savedParts = [];
let savedLabour = [];
let savedBeforePhotos = [];
let savedAfterPhotos = [];
let savedLogs = [];
let initMeta = null;

// Queued unsaved files (preview + remove before upload)
let pendingBeforeFiles = [];
let pendingAfterFiles = [];

// Signature pad state
let signaturePadCtx = null;
let signatureHasStroke = false;
let signatureCleared = false;
let isDrawingSignature = false;

// Dirty tracking so Printable view always uses saved DB data
let formIsDirty = false;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentJobCardId = urlParams.get('id');

    await loadInitMetadata();
    initFormEventBindings();
    initSignaturePad();

    if (currentJobCardId) {
        await loadJobCardDetails();
    } else {
        setupCreateMode(urlParams);
    }
});

/**
 * Load next auto Job Card number, logged-in user, and active staff roster
 */
async function loadInitMetadata() {
    try {
        const res = await window.supportFetch('/job-cards/init-meta');
        if (res && res.success) {
            initMeta = res;
            populateStaffDropdown(res.staff_list || [], res.current_user?.user_id);
        }
    } catch (e) {
        console.warn('Metadata load warning:', e);
    }
}

function populateStaffDropdown(staffList, defaultUserId) {
    const sel = document.getElementById('inputAssignedTo');
    if (!sel) return;

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : {};
    const resolvedDefaultId = defaultUserId || currentUser.id || currentUser.user_id || '';

    let opts = '<option value="">-- Select Technician (Customer Support) --</option>';
    const seen = new Set();

    staffList.forEach(s => {
        seen.add(String(s.user_id));
        const roleLabel = s.role_name ? ` (${s.role_name})` : '';
        opts += `<option value="${s.user_id}">${escapeHtml(s.name)}${escapeHtml(roleLabel)}</option>`;
    });

    sel.innerHTML = opts;
    if (resolvedDefaultId && seen.has(String(resolvedDefaultId))) {
        sel.value = String(resolvedDefaultId);
    }
}

/**
 * Setup clean New Job Card creation page
 */
function setupCreateMode(urlParams) {
    const today = (initMeta && initMeta.today_date) || new Date().toISOString().slice(0, 10);
    const nextNum = (initMeta && initMeta.next_job_card_number) || 'Auto-Generated';
    const currentUser = (initMeta && initMeta.current_user) || (window.getCurrentUser ? window.getCurrentUser() : {});

    setVal('inputJobCardNumber', nextNum);
    setVal('inputJobCardDate', today);
    setVal('inputStatus', 'Open');
    setVal('inputCompletedByName', currentUser.name || 'Assigned Executive');

    const techSel = document.getElementById('inputAssignedTo');
    if (techSel && initMeta?.current_user?.user_id && techSel.querySelector(`option[value="${initMeta.current_user.user_id}"]`)) {
        techSel.value = String(initMeta.current_user.user_id);
    }

    document.getElementById('textJobCardNum').textContent = `New Job Card (${nextNum})`;
    document.getElementById('breadcrumbJobNum').textContent = 'Create New Job Card';

    // Handle URL prefill (?phone=...&order_id=...&case_id=...)
    const prePhone = urlParams.get('phone') || '';
    const preOrderId = urlParams.get('order_id') || '';
    const preCaseId = urlParams.get('case_id') || '';

    if (preOrderId) setVal('inputOrderId', preOrderId);
    if (preCaseId) setVal('inputCaseId', preCaseId);
    if (prePhone) {
        setVal('inputCustomerPhone', prePhone);
    }

    const splitContainer = document.getElementById('jcSplitContainer');
    if (splitContainer) {
        splitContainer.className = 'jc-split-container jc-create-mode';
    }

    // Create mode displays Steps 1 to 4 only (Before Service intake)
    renderPartsTable([]);
    renderLabourTable([]);
    recalculateAllFinancials();
    renderSavedPhotoGalleries();
    updateHeaderAndActionButtons({ status: 'Open', priority: 'Medium' }, true);

    document.getElementById('detailsLoading').style.display = 'none';
    document.getElementById('jobCardWorkspaceForm').style.display = 'flex';
    formIsDirty = false;

    if (prePhone) {
        lookupCustomerForJobCard();
    }
}

/**
 * Fetch saved Job Card details and populate all 10 sections
 */
async function loadJobCardDetails() {
    const loadingEl = document.getElementById('detailsLoading');
    const formEl = document.getElementById('jobCardWorkspaceForm');

    try {
        const res = await window.supportFetch(`/job-cards/${currentJobCardId}`);
        if (!res || !res.success || !res.job_card) {
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div style="max-width: 420px; margin: 0 auto; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                        <h3>Job Card Not Found</h3>
                        <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.5rem;">The requested Job Card could not be located.</p>
                        <a href="job_cards.html" class="btn btn-primary" style="margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-arrow-left"></i> Return to Job Cards
                        </a>
                    </div>
                `;
            }
            return;
        }

        currentJobCard = res.job_card;
        savedParts = res.parts || [];
        savedLabour = res.labour || [];
        savedBeforePhotos = res.before_photos || [];
        savedAfterPhotos = res.after_photos || [];
        savedLogs = res.logs || [];

        // Clear pending queues when fresh loaded
        pendingBeforeFiles = [];
        pendingAfterFiles = [];
        renderPendingPhotoPreviews('before');
        renderPendingPhotoPreviews('after');

        const splitContainer = document.getElementById('jcSplitContainer');
        if (splitContainer) {
            splitContainer.className = 'jc-split-container jc-manage-split';
        }

        const isEditable = currentJobCard.status !== 'Completed' && currentJobCard.status !== 'Cancelled';
        populateWorkspaceFromSavedCard(currentJobCard, res.financials || {});
        renderPartsTable(savedParts);
        if (savedParts.length === 0 && isEditable) addPartRow();
        renderLabourTable(savedLabour);
        if (savedLabour.length === 0 && isEditable) addLabourRow();
        recalculateAllFinancials(true); // apply saved tax/discount/paid precisely
        renderSavedPhotoGalleries();
        toggleReadOnlyMode(!isEditable);
        renderTimeline(savedLogs);
        renderPrintableJobCard();

        formIsDirty = false;
        if (loadingEl) loadingEl.style.display = 'none';
        if (formEl) formEl.style.display = 'flex';
        syncSignatureCanvasSize();

    } catch (err) {
        console.error('Error loading job card details:', err);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div style="color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    <p>Failed to connect to the server. Please refresh.</p>
                </div>
            `;
        }
    }
}

/**
 * Populate all 10 section fields from saved DB object
 */
function populateWorkspaceFromSavedCard(job, fin) {
    const isFinalized = job.status === 'Completed' || job.status === 'Cancelled';

    // Section 1: Job Card Info
    setVal('inputJobCardNumber', job.job_card_number);
    setVal('inputJobCardDate', formatInputDate(job.job_card_date || job.created_at));
    setVal('inputPromisedDate', formatInputDate(job.due_date || job.promised_date));
    setVal('inputJobType', job.job_type || 'Service/Repair');
    setVal('inputPriority', job.priority || 'Medium');

    const statusSel = document.getElementById('inputStatus');
    if (statusSel) {
        statusSel.value = job.status || 'Open';
    }

    if (job.assigned_to) {
        const techSel = document.getElementById('inputAssignedTo');
        if (techSel && !techSel.querySelector(`option[value="${job.assigned_to}"]`) && job.assigned_to_name) {
            const opt = document.createElement('option');
            opt.value = String(job.assigned_to);
            opt.textContent = job.assigned_to_name;
            techSel.appendChild(opt);
        }
        setVal('inputAssignedTo', String(job.assigned_to));
    }

    // Section 2: Customer & Machinery
    setVal('inputOrderId', job.order_id || '');
    setVal('inputCaseId', job.case_id || '');
    setVal('inputCustomerPhone', job.customer_phone || '');
    setVal('inputCustomerName', job.customer_name === 'Draft Customer' && job.status === 'Draft' ? '' : (job.customer_name || ''));
    setVal('inputCustomerAddress', job.customer_address || '');
    setVal('inputMachineMakeModel', job.machine_make_model || job.product_summary || '');
    setVal('inputSerialVin', job.serial_vin_number || '');
    setVal('inputHoursRun', job.hours_run || '');
    renderLinkedRefsBar(job);

    // Section 3: Customer Complaints / Work Requested
    const origComplaintBox = document.getElementById('historicalComplaintBox');
    const origComplaintVal = document.getElementById('valOriginalComplaint');
    if (job.original_issue_description && job.original_issue_description.trim()) {
        if (origComplaintBox) origComplaintBox.style.display = 'block';
        if (origComplaintVal) origComplaintVal.textContent = job.original_issue_description;
    } else if (origComplaintBox) {
        origComplaintBox.style.display = 'none';
    }

    setVal('inputSpecificComplaint', job.specific_complaint || '');
    setVal('inputIssueDescription', job.issue_description || '');
    setVal('inputWorkRequired', job.work_required || '');
    setVal('inputInitialDiagnosis', job.initial_diagnosis || '');
    setVal('inputAdditionalObservations', job.additional_observations || '');

    // Section 4: Before Work Condition
    setVal('inputBeforeWorkCondition', job.before_work_condition || '');
    setVal('inputInitialInspectionRemarks', job.initial_inspection_remarks || '');
    setVal('inputBeforeInitialDiagnosis', job.initial_diagnosis || '');

    // Section 7: Work Performed / Repair Details
    updateWorkPlannedMirror(job.work_required || '');
    setVal('inputDiagnosis', job.diagnosis || '');
    setVal('inputWorkPerformed', job.work_performed || '');
    setVal('inputPartsReplacedSummary', job.parts_replaced_summary || '');
    setVal('inputRepairDetails', job.repair_details || '');
    setVal('inputAdditionalRemarks', job.additional_remarks || job.notes || '');

    // Section 8: After Work
    setVal('inputFinalCondition', job.final_machine_condition || '');
    setVal('inputWorkCompletionRemarks', job.work_completion_remarks || '');
    setVal('displayFinalConditionSummary', job.final_machine_condition || '');

    // Section 9: Final Charges (Parts Total, Labour Total, Shipping / Delivery Charge, Grand Total)
    setVal('inputShippingCharge', parseFloat(fin.shipping_charge ?? job.shipping_charge ?? 0).toFixed(2));

    // Section 10: Completion Details & Signature
    setVal('inputWorkCompletionDate', formatInputDateTime(job.work_completion_date || job.completed_at));
    const currentUser = (initMeta && initMeta.current_user) || (window.getCurrentUser ? window.getCurrentUser() : {});
    setVal('inputCompletedByName', job.completed_by_name || (job.status === 'Completed' ? job.assigned_to_name : currentUser.name) || '');
    setVal('inputCustomerFeedback', job.customer_feedback || '');
    setVal('inputTechnicianRemarks', job.technician_remarks || '');

    signatureHasStroke = false;
    signatureCleared = false;
    clearCanvasOnly();

    const sigWrap = document.getElementById('savedSignaturePreviewWrap');
    const sigImg = document.getElementById('savedSignatureImg');
    const sigDateEl = document.getElementById('signatureDateText');
    const sigPadWrap = document.getElementById('signaturePadWrap');

    if (job.customer_signature && sigWrap && sigImg) {
        sigImg.src = job.customer_signature;
        sigWrap.style.display = 'block';
        if (sigDateEl) {
            sigDateEl.textContent = job.signature_date ? `Signed on ${window.formatDateTime(job.signature_date)}` : 'Customer Signature Recorded';
        }
    } else if (sigWrap) {
        sigWrap.style.display = 'none';
    }
    if (sigPadWrap) {
        sigPadWrap.style.display = isFinalized ? 'none' : 'block';
    }

    updateHeaderAndActionButtons(job, false);
    toggleReadOnlyMode(isFinalized);
}

function updateHeaderAndActionButtons(job, isNew) {
    const status = job.status || 'Open';
    const priority = job.priority || 'Medium';

    if (!isNew) {
        document.getElementById('textJobCardNum').textContent = job.job_card_number;
        document.getElementById('breadcrumbJobNum').textContent = job.job_card_number;
    }

    const statusBadge = document.getElementById('headerStatusBadge');
    if (statusBadge) {
        const slug = status.toLowerCase().replace(/\s+/g, '-');
        statusBadge.className = `status-pill status-${slug}`;
        statusBadge.textContent = status;
    }

    const priorityBadge = document.getElementById('headerPriorityBadge');
    if (priorityBadge) {
        const pSlug = priority.toLowerCase();
        priorityBadge.className = `priority-badge priority-${pSlug}`;
        priorityBadge.innerHTML = `<span class="priority-dot"></span> ${escapeHtml(priority)}`;
    }

    // Call buttons
    const phone = job.customer_phone || document.getElementById('inputCustomerPhone')?.value?.trim();
    const callTop = document.getElementById('btnCallCustomerTop');
    const callInline = document.getElementById('btnCallCustomerInline');
    if (phone && phone.replace(/[^0-9]/g, '').length >= 6) {
        if (callTop) {
            callTop.style.display = 'inline-flex';
            callTop.onclick = () => window.callCustomer(phone, job.customer_name || 'Customer');
        }
        if (callInline) {
            callInline.style.display = 'inline-flex';
            callInline.onclick = () => window.callCustomer(phone, job.customer_name || 'Customer');
        }
    } else {
        if (callTop) callTop.style.display = 'none';
        if (callInline) callInline.style.display = 'none';
    }

    // Action buttons visibility by lifecycle
    const btnCancel = document.getElementById('btnCancelJobCard');
    const btnDraft = document.getElementById('btnSaveDraft');
    const btnOpen = document.getElementById('btnSaveOpen');
    const btnWIP = document.getElementById('btnSaveWIP');
    const btnComplete = document.getElementById('btnCompleteJobCard');
    const banner = document.getElementById('jobBannerAlert');

    const btnPrintBottom = document.getElementById('btnPrintBottom');
    if (status === 'Completed' || status === 'Cancelled') {
        if (btnCancel) btnCancel.style.display = 'none';
        if (btnDraft) btnDraft.style.display = 'none';
        if (btnOpen) btnOpen.style.display = 'none';
        if (btnWIP) btnWIP.style.display = 'none';
        if (btnComplete) btnComplete.style.display = 'none';

        if (banner) {
            banner.style.display = 'flex';
            if (status === 'Completed') {
                banner.style.background = '#dcfce7';
                banner.style.border = '1px solid #86efac';
                banner.style.color = '#15803d';
                banner.innerHTML = `
                    <i class="fas fa-check-circle" style="font-size: 1.3rem;"></i>
                    <div>
                        <strong>Job Card Completed:</strong> Completed by <strong>${escapeHtml(job.completed_by_name || 'Staff')}</strong>
                        ${job.work_completion_date || job.completed_at ? ` on ${window.formatDateTime(job.work_completion_date || job.completed_at)}` : ''}.
                        All photos, parts, labour &amp; financial records are permanently preserved. Click <strong>Print Job Card</strong> for A4 printout.
                    </div>
                `;
            } else {
                banner.style.background = '#fee2e2';
                banner.style.border = '1px solid #fca5a5';
                banner.style.color = '#991b1b';
                banner.innerHTML = `
                    <i class="fas fa-ban" style="font-size: 1.3rem;"></i>
                    <div>
                        <strong>Job Card Cancelled:</strong> ${escapeHtml(job.cancellation_reason || 'No reason recorded.')}
                        ${job.cancelled_at ? ` (${window.formatDateTime(job.cancelled_at)})` : ''}
                    </div>
                `;
            }
        }
    } else if (isNew) {
        if (banner) banner.style.display = 'none';
        if (btnCancel) btnCancel.style.display = 'none';
        if (btnPrintBottom) btnPrintBottom.style.display = 'none';
        if (btnDraft) btnDraft.style.display = 'inline-flex';
        if (btnOpen) {
            btnOpen.style.display = 'inline-flex';
            btnOpen.innerHTML = '<i class="fas fa-check-circle"></i> Create Job Card';
        }
        if (btnWIP) btnWIP.style.display = 'none';
        if (btnComplete) btnComplete.style.display = 'none';
    } else if (status === 'Draft') {
        if (banner) {
            banner.style.display = 'flex';
            banner.style.background = '#f1f5f9';
            banner.style.border = '1px dashed #64748b';
            banner.style.color = '#334155';
            banner.innerHTML = `
                <i class="fas fa-file-alt" style="font-size: 1.2rem;"></i>
                <div><strong>Saved Draft:</strong> Left shows Before Service (Steps 1–4); Right shows After Service (Steps 5–10). Save Draft or click <strong>Resume &amp; Activate</strong> when ready.</div>
            `;
        }
        if (btnCancel) btnCancel.style.display = 'inline-flex';
        if (btnPrintBottom) btnPrintBottom.style.display = 'inline-flex';
        if (btnDraft) btnDraft.style.display = 'inline-flex';
        if (btnOpen) {
            btnOpen.style.display = 'inline-flex';
            btnOpen.innerHTML = '<i class="fas fa-play-circle"></i> Resume &amp; Activate (Open)';
        }
        if (btnWIP) btnWIP.style.display = 'none';
        if (btnComplete) btnComplete.style.display = 'inline-flex';
    } else {
        // Open, In Progress, On Hold
        if (banner) banner.style.display = 'none';
        if (btnCancel) btnCancel.style.display = 'inline-flex';
        if (btnPrintBottom) btnPrintBottom.style.display = 'inline-flex';
        if (btnDraft) btnDraft.style.display = 'none';
        if (btnOpen) btnOpen.style.display = 'none';
        if (btnWIP) btnWIP.style.display = 'inline-flex';
        if (btnComplete) btnComplete.style.display = 'inline-flex';
    }
}

function toggleReadOnlyMode(locked) {
    const form = document.getElementById('jobCardWorkspaceForm');
    if (!form) return;

    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(el => {
        if (el.id === 'inputJobCardNumber') return;
        el.disabled = locked;
    });

    const toggleHide = ['btnAddPartRow', 'btnAddLabourRow', 'beforePhotoDropzone', 'afterPhotoDropzone', 'btnLookupCustomer'];
    toggleHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = locked ? 'none' : '';
    });

    form.querySelectorAll('.row-del-btn, .jc-photo-del-btn').forEach(btn => {
        btn.style.display = locked ? 'none' : 'inline-flex';
    });
}

function renderLinkedRefsBar(job) {
    const bar = document.getElementById('linkedRefsBar');
    if (!bar) return;

    let html = '';
    if (job.order_id) {
        html += `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.76rem; font-weight:700;"><i class="fas fa-shopping-bag"></i> Order #${job.order_id}</span>`;
    }
    if (job.case_id) {
        html += `<a href="customer_details.html?case_id=${job.case_id}" class="badge" style="background:#dcfce7; color:#15803d; font-size:0.76rem; font-weight:700; text-decoration:none;"><i class="fas fa-headset"></i> Case #${escapeHtml(job.case_number || job.case_id)}</a>`;
    }
    bar.innerHTML = html;
}

/**
 * Bind input event listeners (Calculator, Syncs, File Dropzones)
 */
function initFormEventBindings() {
    const form = document.getElementById('jobCardWorkspaceForm');
    if (form) {
        form.addEventListener('input', () => { formIsDirty = true; });
        form.addEventListener('change', () => { formIsDirty = true; });
    }

    // Two-way sync: Section 3 Initial Diagnosis <-> Section 4 Initial Diagnosis
    const diag3 = document.getElementById('inputInitialDiagnosis');
    const diag4 = document.getElementById('inputBeforeInitialDiagnosis');
    if (diag3 && diag4) {
        diag3.addEventListener('input', () => { diag4.value = diag3.value; });
        diag4.addEventListener('input', () => { diag3.value = diag4.value; });
    }

    // Mirror Work Planned into Section 7 read-only reference
    const workReq = document.getElementById('inputWorkRequired');
    if (workReq) {
        workReq.addEventListener('input', () => updateWorkPlannedMirror(workReq.value));
    }

    // Sync Final Condition into Section 10 display
    const finalCond = document.getElementById('inputFinalCondition');
    const finalMirror = document.getElementById('displayFinalConditionSummary');
    if (finalCond && finalMirror) {
        finalCond.addEventListener('input', () => { finalMirror.value = finalCond.value; });
    }

    // Lookup trigger on phone Enter
    const phoneInput = document.getElementById('inputCustomerPhone');
    if (phoneInput) {
        phoneInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                lookupCustomerForJobCard();
            }
        });
    }

    // Financial recalculations
    const shippingEl = document.getElementById('inputShippingCharge');
    if (shippingEl) shippingEl.addEventListener('input', () => recalculateAllFinancials(false, 'shipping'));

    // Photo & Video pickers (Before Work & After Work strictly separate)
    const validateAndQueueMedia = async (files, targetArray, stage) => {
        let added = 0;
        for (let f of files) {
            if (window.validateSupportMediaFile) {
                const check = window.validateSupportMediaFile(f);
                if (!check.ok) {
                    window.showToast(check.reason, 'error');
                    continue;
                }
            } else {
                const okType = f.type.startsWith('image/') || f.type.startsWith('video/');
                if (!okType || f.size > 550 * 1024 * 1024) {
                    window.showToast(`Skipped "${f.name}": Only images and videos are allowed.`, 'error');
                    continue;
                }
            }

            if (window.compressSupportImageIfNeeded && f.type && f.type.startsWith('image/')) {
                try {
                    f = await window.compressSupportImageIfNeeded(f);
                } catch (cErr) {
                    console.warn('Image compress warn:', cErr);
                }
            }

            targetArray.push(f);
            added++;
        }
        if (added > 0) {
            formIsDirty = true;
            renderPendingPhotoPreviews(stage);
        }
    };

    const beforeInput = document.getElementById('beforePhotosInput');
    if (beforeInput) {
        beforeInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            beforeInput.value = '';
            await validateAndQueueMedia(files, pendingBeforeFiles, 'before');
        });
    }

    const afterInput = document.getElementById('afterPhotosInput');
    if (afterInput) {
        afterInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            afterInput.value = '';
            await validateAndQueueMedia(files, pendingAfterFiles, 'after');
        });
    }
}

function updateWorkPlannedMirror(val) {
    const box = document.getElementById('bannerWorkPlannedRef');
    const span = document.getElementById('valWorkPlannedMirror');
    if (!box || !span) return;
    if (val && val.trim()) {
        span.textContent = val.trim();
        box.style.display = 'block';
    } else {
        box.style.display = 'none';
    }
}

/**
 * Customer Auto-Lookup (supports Leads, Orders & Past Job Cards)
 */
window.lookupCustomerForJobCard = async function () {
    const phone = (document.getElementById('inputCustomerPhone')?.value || '').trim();
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 4) {
        window.showToast('Please enter at least 4 digits of phone number to lookup.', 'error');
        return;
    }

    const panel = document.getElementById('customerLookupResults');
    try {
        window.showToast('Looking up customer details...', 'info');
        const res = await window.supportFetch(`/lookup-customer?phone=${encodeURIComponent(phone)}`);
        if (!res || !res.success) {
            window.showToast('Customer lookup failed.', 'error');
            return;
        }

        const cust = res.customer || res.lead || null;
        const orders = res.orders || [];
        const pastCards = res.past_job_cards || [];

        if (!cust && orders.length === 0 && pastCards.length === 0) {
            if (panel) panel.style.display = 'none';
            window.showToast('No existing customer record found. Enter details manually.', 'info');
            return;
        }

        // Auto-fill customer fields if currently blank
        const nameEl = document.getElementById('inputCustomerName');
        const addrEl = document.getElementById('inputCustomerAddress');
        const machEl = document.getElementById('inputMachineMakeModel');
        const vinEl = document.getElementById('inputSerialVin');

        if (cust) {
            if (nameEl && !nameEl.value.trim() && cust.name) nameEl.value = cust.name;
            if (addrEl && !addrEl.value.trim() && cust.address) addrEl.value = cust.address;
            if (machEl && !machEl.value.trim() && cust.machine_make_model) machEl.value = cust.machine_make_model;
            if (vinEl && !vinEl.value.trim() && cust.serial_vin_number) vinEl.value = cust.serial_vin_number;
            formIsDirty = true;
        }

        // Auto-select single eligible direct order if not already linked
        const eligibleOrders = orders.filter(o => !o.is_b2b_dealer);
        const orderIdInput = document.getElementById('inputOrderId');
        if (orderIdInput && !orderIdInput.value && eligibleOrders.length > 0) {
            const firstOrder = eligibleOrders[0];
            orderIdInput.value = String(firstOrder.order_id);
            if (machEl && !machEl.value.trim() && firstOrder.product_name) {
                machEl.value = firstOrder.product_name;
            }
            if (firstOrder.existing_case_id && !document.getElementById('inputCaseId')?.value) {
                setVal('inputCaseId', String(firstOrder.existing_case_id));
            }
        }

        // Render clickable lookup matches panel
        if (panel) {
            let panelHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                <strong style="color:#0369a1; font-size:0.82rem;"><i class="fas fa-user-check"></i> Customer Match Found</strong>
                <button type="button" onclick="document.getElementById('customerLookupResults').style.display='none'" style="border:none;background:none;color:#64748b;cursor:pointer;"><i class="fas fa-times"></i></button>
            </div>`;

            if (orders.length > 0) {
                panelHtml += `<div style="display:flex; flex-direction:column; gap:0.45rem;">`;
                orders.forEach(o => {
                    const isLinked = String(o.order_id) === String(document.getElementById('inputOrderId')?.value || '');
                    panelHtml += `
                        <div style="background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:0.5rem 0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; font-size:0.8rem;">
                            <div>
                                <strong>Order #${o.order_id}</strong> — ${escapeHtml(o.customer_name || '')}
                                <span style="color:#64748b;">• ₹${parseFloat(o.total_amount || 0).toLocaleString('en-IN')} • ${escapeHtml(o.order_status || '')}</span>
                                ${o.is_b2b_dealer ? '<span class="badge" style="background:#fee2e2;color:#b91c1c;font-size:0.68rem;margin-left:4px;">B2B Dealer (Not Eligible)</span>' : ''}
                                <div style="color:#334155; font-size:0.75rem;">${escapeHtml(o.items_summary || o.product_name || 'Standard Equipment')}</div>
                            </div>
                            ${!o.is_b2b_dealer ? `
                                <button type="button" class="btn ${isLinked ? 'btn-primary' : 'btn-outline'} btn-sm"
                                    onclick="applyLookupOrderSelection(${o.order_id}, '${escapeQuotes(o.customer_name || '')}', '${escapeQuotes(o.full_address || o.address || '')}', '${escapeQuotes(o.product_name || o.items_summary || '')}', ${o.existing_case_id || 'null'})">
                                    ${isLinked ? '<i class="fas fa-check"></i> Linked' : 'Use Order'}
                                </button>
                            ` : ''}
                        </div>
                    `;
                });
                panelHtml += `</div>`;
            }

            if (pastCards.length > 0) {
                panelHtml += `<div style="margin-top:0.55rem; font-size:0.75rem; color:#475569;">
                    <strong>Prior Job Cards:</strong> ${pastCards.map(jc => `<a href="job_card_details.html?id=${jc.job_card_id}" style="color:#0284c7;font-weight:700;">${escapeHtml(jc.job_card_number)} (${escapeHtml(jc.status)})</a>`).join(' • ')}
                </div>`;
            }

            panel.innerHTML = panelHtml;
            panel.style.display = 'block';
        }

        window.showToast(`Loaded info for ${cust?.name || 'Customer'}.`, 'success');
    } catch (err) {
        console.error('Lookup error:', err);
        window.showToast('Customer lookup failed.', 'error');
    }
};

window.applyLookupOrderSelection = function (orderId, custName, fullAddress, machineModel, caseId) {
    setVal('inputOrderId', String(orderId));
    if (caseId) setVal('inputCaseId', String(caseId));
    if (custName) setVal('inputCustomerName', custName);
    if (fullAddress) setVal('inputCustomerAddress', fullAddress);
    if (machineModel) setVal('inputMachineMakeModel', machineModel);
    renderLinkedRefsBar({ order_id: orderId, case_id: caseId });
    formIsDirty = true;
    window.showToast(`Linked Order #${orderId} to Job Card.`, 'success');
};

/**
 * Dynamic Parts & Materials Table (Section 5)
 */
function renderPartsTable(parts) {
    const tbody = document.getElementById('partsRowsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!parts || parts.length === 0) return;
    parts.forEach(p => addPartRow(p));
}

window.addPartRow = function (data = {}) {
    const tbody = document.getElementById('partsRowsBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'jc-part-row';
    const qty = parseFloat(data.quantity !== undefined ? data.quantity : 1);
    const price = parseFloat(data.unit_cost !== undefined ? data.unit_cost : 0);
    const isFoc = Boolean(data.is_foc === 1 || data.is_foc === true);

    tr.innerHTML = `
        <td><input type="text" class="part-num-input" placeholder="Code / SKU" value="${escapeHtml(data.part_number || '')}"></td>
        <td><input type="text" class="part-desc-input" placeholder="e.g. New Battery, Blade Set" value="${escapeHtml(data.part_name || '')}"></td>
        <td><input type="number" class="part-qty-input" min="0.01" step="0.01" value="${isNaN(qty) ? 1 : qty}" style="text-align:center;"></td>
        <td><input type="number" class="part-price-input" min="0" step="0.01" value="${isNaN(price) ? 0 : price}" style="text-align:right;"></td>
        <td style="text-align:center;">
            <label style="display:inline-flex;align-items:center;gap:0.25rem;cursor:pointer;font-size:0.75rem;font-weight:700;color:#15803d;">
                <input type="checkbox" class="part-foc-input" ${isFoc ? 'checked' : ''}> FOC
            </label>
        </td>
        <td style="text-align:right;font-weight:800;white-space:nowrap;" class="part-line-total-cell">₹0.00</td>
        <td><input type="text" class="part-remarks-input" placeholder="Remarks" value="${escapeHtml(data.remarks || '')}"></td>
        <td style="text-align:center;">
            <button type="button" class="spare-part-del-btn row-del-btn" title="Remove part" onclick="removeDynamicRow(this)">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;

    tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => {
            formIsDirty = true;
            recalculateAllFinancials(false, 'parts');
        });
        inp.addEventListener('change', () => {
            formIsDirty = true;
            recalculateAllFinancials(false, 'parts');
        });
    });

    tbody.appendChild(tr);
    recalculateAllFinancials(false, 'parts');
};

/**
 * Dynamic Labour & Service Charges Table (Section 6)
 */
function renderLabourTable(labourList) {
    const tbody = document.getElementById('labourRowsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!labourList || labourList.length === 0) return;
    labourList.forEach(l => addLabourRow(l));
}

window.addLabourRow = function (data = {}) {
    const tbody = document.getElementById('labourRowsBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'jc-labour-row';
    // Preserve previously stored total_cost for legacy rows that had non-unit hours
    const hrs = parseFloat(data.hours !== undefined && data.hours !== null && data.hours !== '' ? data.hours : 1);
    const chargeVal = data.total_cost !== undefined && data.total_cost !== null && data.total_cost !== ''
        ? parseFloat(data.total_cost)
        : (parseFloat(data.charge ?? data.amount ?? data.rate ?? 0) * (isNaN(hrs) ? 1 : hrs));

    tr.innerHTML = `
        <td><input type="text" class="labour-desc-input" placeholder="e.g. Service Charge, Engine Overhaul" value="${escapeHtml(data.labour_description || '')}"></td>
        <td><input type="number" class="labour-rate-input" min="0" step="0.01" value="${isNaN(chargeVal) ? 0 : chargeVal}" style="text-align:right;font-weight:700;"></td>
        <td><input type="text" class="labour-remarks-input" placeholder="Remarks" value="${escapeHtml(data.remarks || '')}"></td>
        <td style="text-align:center;">
            <button type="button" class="spare-part-del-btn row-del-btn" title="Remove entry" onclick="removeDynamicRow(this)">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;

    tr.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => {
            formIsDirty = true;
            recalculateAllFinancials(false, 'labour');
        });
    });

    tbody.appendChild(tr);
    recalculateAllFinancials(false, 'labour');
};

window.removeDynamicRow = function (btn) {
    const tr = btn.closest('tr');
    if (tr) tr.remove();
    formIsDirty = true;
    recalculateAllFinancials(false, 'rows');
};

/**
 * Recalculate Parts Total, Labour Total, Taxable, Taxes, Grand Total, Balance & Payment Status
 */
function recalculateAllFinancials(preserveSavedTaxAndPaid = false, triggerSource = '') {
    let partsTotal = 0;
    document.querySelectorAll('#partsRowsBody .jc-part-row').forEach(row => {
        const qty = Math.max(0, parseFloat(row.querySelector('.part-qty-input')?.value || 0));
        const unitCost = Math.max(0, parseFloat(row.querySelector('.part-price-input')?.value || 0));
        const isFoc = Boolean(row.querySelector('.part-foc-input')?.checked);
        const lineTotal = isFoc ? 0 : round2(qty * unitCost);
        partsTotal = round2(partsTotal + lineTotal);

        const totalCell = row.querySelector('.part-line-total-cell');
        if (totalCell) {
            totalCell.innerHTML = isFoc
                ? `<span class="foc-badge">FOC</span> ₹0.00`
                : `₹${lineTotal.toFixed(2)}`;
        }
    });

    let labourTotal = 0;
    document.querySelectorAll('#labourRowsBody .jc-labour-row').forEach(row => {
        const charge = Math.max(0, parseFloat(row.querySelector('.labour-rate-input')?.value || 0));
        const lineTotal = round2(charge);
        labourTotal = round2(labourTotal + lineTotal);
    });

    // Legacy fallback if older completed card had service_cost stored without labour child rows
    if (labourTotal === 0 && savedLabour.length === 0 && currentJobCard && parseFloat(currentJobCard.service_cost || 0) > 0 && document.querySelectorAll('#labourRowsBody .jc-labour-row').length === 0) {
        labourTotal = round2(parseFloat(currentJobCard.service_cost));
    }

    const shippingEl = document.getElementById('inputShippingCharge');
    const shippingCharge = Math.max(0, parseFloat(shippingEl?.value || 0) || 0);
    const grandTotal = round2(partsTotal + labourTotal + shippingCharge);

    setText('displayPartsTotalTable', `₹${partsTotal.toFixed(2)}`);
    setText('displayLabourTotalTable', `₹${labourTotal.toFixed(2)}`);
    setVal('finPartsTotal', partsTotal.toFixed(2));
    setVal('finLabourTotal', labourTotal.toFixed(2));
    setVal('finGrandTotal', grandTotal.toFixed(2));
}

function collectPartsFromTable() {
    const list = [];
    document.querySelectorAll('#partsRowsBody .jc-part-row').forEach(row => {
        const partNum = (row.querySelector('.part-num-input')?.value || '').trim();
        const desc = (row.querySelector('.part-desc-input')?.value || '').trim();
        const qty = parseFloat(row.querySelector('.part-qty-input')?.value || 1);
        const unitCost = parseFloat(row.querySelector('.part-price-input')?.value || 0);
        const isFoc = Boolean(row.querySelector('.part-foc-input')?.checked);
        const remarks = (row.querySelector('.part-remarks-input')?.value || '').trim();
        if (desc || partNum || remarks) {
            list.push({
                part_number: partNum || null,
                part_name: desc,
                quantity: isNaN(qty) ? 1 : qty,
                unit_cost: isNaN(unitCost) ? 0 : unitCost,
                is_foc: isFoc,
                remarks: remarks || null
            });
        }
    });
    return list;
}

function collectLabourFromTable() {
    const list = [];
    document.querySelectorAll('#labourRowsBody .jc-labour-row').forEach(row => {
        const desc = (row.querySelector('.labour-desc-input')?.value || '').trim();
        const charge = parseFloat(row.querySelector('.labour-rate-input')?.value || 0);
        const remarks = (row.querySelector('.labour-remarks-input')?.value || '').trim();
        const safeCharge = isNaN(charge) ? 0 : charge;
        if (desc || remarks || safeCharge > 0) {
            list.push({
                labour_description: desc,
                hours: 1,
                rate: safeCharge,
                charge: safeCharge,
                remarks: remarks || null
            });
        }
    });
    return list;
}

/**
 * Separate Pending Previews & Saved Galleries for Before Work / After Work Photos
 */
function renderPendingPhotoPreviews(stage) {
    const files = stage === 'before' ? pendingBeforeFiles : pendingAfterFiles;
    const container = document.getElementById(stage === 'before' ? 'beforePendingPreviews' : 'afterPendingPreviews');
    if (!container) return;

    if (!files || files.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'grid';
    container.innerHTML = files.map((file, idx) => {
        const blobUrl = URL.createObjectURL(file);
        const isVideo = window.isSupportVideoFile
            ? window.isSupportVideoFile(file, file.name)
            : (file.type || '').startsWith('video/');
        const mediaEl = isVideo
            ? `<video src="${blobUrl}" controls muted preload="metadata" style="width:100%;height:110px;object-fit:cover;display:block;background:#0f172a;cursor:pointer;" onclick="openLightbox('${blobUrl}', 'Pending Video: ${escapeQuotes(file.name)}', true)"></video>`
            : `<img src="${blobUrl}" alt="${escapeHtml(file.name)}" onclick="openLightbox('${blobUrl}', 'Pending Upload: ${escapeQuotes(file.name)}', false)">`;
        return `
            <div class="jc-photo-card" style="border-color: #0284c7;">
                ${mediaEl}
                <button type="button" class="jc-photo-del-btn" title="Remove before saving" onclick="removePendingPhoto('${stage}', ${idx})">
                    <i class="fas fa-times"></i>
                </button>
                <div class="jc-photo-meta">
                    <strong style="color: #0284c7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${isVideo ? '<i class="fas fa-video"></i> ' : ''}${escapeHtml(file.name)}</strong>
                    <span style="color: #64748b;">Ready to save (Unsaved)</span>
                </div>
            </div>
        `;
    }).join('');
}

window.removePendingPhoto = function (stage, index) {
    if (stage === 'before') {
        pendingBeforeFiles.splice(index, 1);
        renderPendingPhotoPreviews('before');
    } else {
        pendingAfterFiles.splice(index, 1);
        renderPendingPhotoPreviews('after');
    }
};

function renderSavedPhotoGalleries() {
    renderSingleGallery('beforeSavedGallery', savedBeforePhotos, 'beforePhotoCountBadge', 'Before');
    renderSingleGallery('afterSavedGallery', savedAfterPhotos, 'afterPhotoCountBadge', 'After');
}

function renderSingleGallery(containerId, photos, badgeId, labelPrefix) {
    const container = document.getElementById(containerId);
    const badge = document.getElementById(badgeId);
    if (badge) badge.textContent = `${photos.length} ${labelPrefix} Photo${photos.length === 1 ? '' : 's'}`;
    if (!container) return;

    if (!photos || photos.length === 0) {
        container.innerHTML = `<p style="font-size: 0.82rem; color: #94a3b8; grid-column: 1 / -1; margin: 0.4rem 0;">No ${labelPrefix}-Work photos uploaded yet.</p>`;
        return;
    }

    const isLocked = currentJobCard && (currentJobCard.status === 'Completed' || currentJobCard.status === 'Cancelled');

    container.innerHTML = photos.map(p => {
        const fullUrl = resolvePhotoUrl(p.file_url);
        const uploader = p.uploaded_by_name || 'Staff';
        const ts = window.formatDateTime(p.created_at);
        const tagLabel = p.photo_type === 'issue' ? 'BEFORE (LEGACY ISSUE)' : p.photo_type;
        const isVideo = window.isSupportVideoFile
            ? window.isSupportVideoFile(p.file_url, p.file_name)
            : /\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i.test(p.file_url || p.file_name || '');
        const caption = `${labelPrefix}-Work ${isVideo ? 'Video' : 'Photo'} — Uploaded by ${uploader} on ${ts}`;
        const thumbHtml = isVideo
            ? `<div style="position:relative;cursor:pointer;" onclick="openLightbox('${fullUrl}', '${escapeQuotes(caption)}', true)">
                   <video src="${fullUrl}" preload="metadata" style="width:100%;height:110px;object-fit:cover;display:block;background:#0f172a;"></video>
                   <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.3);color:white;font-size:1.5rem;pointer-events:none;"><i class="fas fa-play-circle"></i></div>
               </div>`
            : `<img src="${fullUrl}" alt="${escapeHtml(p.file_name)}"
                    onclick="openLightbox('${fullUrl}', '${escapeQuotes(caption)}', false)"
                    onerror="this.src='https://placehold.co/200x140/e2e8f0/64748b?text=Photo+Unavailable';">`;

        return `
            <div class="jc-photo-card">
                ${thumbHtml}
                ${!isLocked ? `
                    <button type="button" class="jc-photo-del-btn" title="Delete saved media" onclick="deleteSavedPhoto(${p.photo_id}, '${escapeQuotes(p.file_name)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
                <div class="jc-photo-meta">
                    <span style="font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(p.file_name)}">${isVideo ? '<i class="fas fa-video"></i> ' : ''}${escapeHtml(p.file_name)}</span>
                    <span><i class="fas fa-user"></i> ${escapeHtml(uploader)}</span>
                    <span><i class="far fa-clock"></i> ${ts}</span>
                    <span style="font-size:0.65rem; font-weight:700; color:#475569; text-transform:uppercase;">${escapeHtml(tagLabel)}</span>
                </div>
            </div>
        `;
    }).join('');
}

window.deleteSavedPhoto = async function (photoId, fileName) {
    if (!currentJobCardId) return;
    if (!confirm(`Are you sure you want to permanently remove "${fileName}" from this Job Card?`)) {
        return;
    }

    try {
        const res = await window.supportFetch(`/job-cards/${currentJobCardId}/photos/${photoId}`, {
            method: 'DELETE'
        });
        if (!res || !res.success) {
            window.showToast(res ? res.message : 'Could not delete photo.', 'error');
            return;
        }
        window.showToast('Photo permanently removed.', 'success');
        await loadJobCardDetails();
    } catch (err) {
        console.error('Delete photo error:', err);
        window.showToast('Failed to delete photo.', 'error');
    }
};

/**
 * HTML5 Signature Pad (Mouse & Touchscreen via Pointer Events)
 */
function syncSignatureCanvasSize() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas || signatureHasStroke) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width) || 400;
    const height = Math.round(rect.height) || 145;
    if (canvas.width === width * dpr && canvas.height === height * dpr && signaturePadCtx) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    signaturePadCtx = canvas.getContext('2d');
    signaturePadCtx.setTransform(1, 0, 0, 1, 0, 0);
    signaturePadCtx.scale(dpr, dpr);
    signaturePadCtx.lineCap = 'round';
    signaturePadCtx.lineJoin = 'round';
    signaturePadCtx.lineWidth = 2.2;
    signaturePadCtx.strokeStyle = '#0f172a';
}

function initSignaturePad() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas) return;

    syncSignatureCanvasSize();

    const getPos = (evt) => {
        const bounds = canvas.getBoundingClientRect();
        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
        return {
            x: clientX - bounds.left,
            y: clientY - bounds.top
        };
    };

    const startDraw = (evt) => {
        if (currentJobCard && (currentJobCard.status === 'Completed' || currentJobCard.status === 'Cancelled')) return;
        syncSignatureCanvasSize();
        evt.preventDefault();
        isDrawingSignature = true;
        const pos = getPos(evt);
        signaturePadCtx.beginPath();
        signaturePadCtx.moveTo(pos.x, pos.y);
    };

    const moveDraw = (evt) => {
        if (!isDrawingSignature) return;
        evt.preventDefault();
        const pos = getPos(evt);
        signaturePadCtx.lineTo(pos.x, pos.y);
        signaturePadCtx.stroke();
        signatureHasStroke = true;
        signatureCleared = false;
        formIsDirty = true;
    };

    const endDraw = () => {
        if (!isDrawingSignature) return;
        isDrawingSignature = false;
        signaturePadCtx.closePath();
    };

    canvas.addEventListener('pointerdown', startDraw);
    canvas.addEventListener('pointermove', moveDraw);
    window.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);
}

function clearCanvasOnly() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas || !signaturePadCtx) return;
    signaturePadCtx.save();
    signaturePadCtx.setTransform(1, 0, 0, 1, 0, 0);
    signaturePadCtx.clearRect(0, 0, canvas.width, canvas.height);
    signaturePadCtx.restore();
}

window.clearCustomerSignature = function () {
    clearCanvasOnly();
    signatureHasStroke = false;
    signatureCleared = true;
    formIsDirty = true;
    const sigWrap = document.getElementById('savedSignaturePreviewWrap');
    if (sigWrap) sigWrap.style.display = 'none';
};

function resolveSignaturePayload() {
    if (signatureHasStroke) {
        const canvas = document.getElementById('signatureCanvas');
        if (canvas) return canvas.toDataURL('image/png');
    }
    if (signatureCleared) {
        return '';
    }
    return undefined; // leave existing saved signature untouched
}

/**
 * Collect FormData across all 10 sections
 */
function buildJobCardFormData(targetStatus) {
    const formData = new FormData();
    const parts = collectPartsFromTable();
    const labour = collectLabourFromTable();

    const techSelect = document.getElementById('inputAssignedTo');
    const assignedTo = techSelect ? techSelect.value : '';
    const techName = techSelect && techSelect.selectedIndex >= 0
        ? techSelect.options[techSelect.selectedIndex].text.replace(/\s*\([^)]*\)$/, '').trim()
        : '';

    const statusToSend = targetStatus || document.getElementById('inputStatus')?.value || 'Open';
    const machineModel = (document.getElementById('inputMachineMakeModel')?.value || '').trim();
    const promisedDate = document.getElementById('inputPromisedDate')?.value || '';

    formData.append('status', statusToSend);
    formData.append('job_card_date', document.getElementById('inputJobCardDate')?.value || '');
    formData.append('assigned_to', assignedTo);
    formData.append('technician_name', techName);
    formData.append('promised_date', promisedDate);
    formData.append('due_date', promisedDate);
    formData.append('job_type', document.getElementById('inputJobType')?.value || 'Service/Repair');
    formData.append('priority', document.getElementById('inputPriority')?.value || 'Medium');

    formData.append('order_id', document.getElementById('inputOrderId')?.value || '');
    formData.append('case_id', document.getElementById('inputCaseId')?.value || '');
    formData.append('customer_name', (document.getElementById('inputCustomerName')?.value || '').trim());
    formData.append('customer_phone', (document.getElementById('inputCustomerPhone')?.value || '').trim());
    formData.append('customer_address', (document.getElementById('inputCustomerAddress')?.value || '').trim());
    formData.append('machine_make_model', machineModel);
    formData.append('product_summary', machineModel);
    formData.append('serial_vin_number', (document.getElementById('inputSerialVin')?.value || '').trim());
    formData.append('hours_run', (document.getElementById('inputHoursRun')?.value || '').trim());

    formData.append('specific_complaint', (document.getElementById('inputSpecificComplaint')?.value || '').trim());
    formData.append('issue_description', (document.getElementById('inputIssueDescription')?.value || '').trim());
    formData.append('work_required', (document.getElementById('inputWorkRequired')?.value || '').trim());
    formData.append('initial_diagnosis', (document.getElementById('inputInitialDiagnosis')?.value || '').trim());
    formData.append('additional_observations', (document.getElementById('inputAdditionalObservations')?.value || '').trim());

    formData.append('before_work_condition', (document.getElementById('inputBeforeWorkCondition')?.value || '').trim());
    formData.append('initial_inspection_remarks', (document.getElementById('inputInitialInspectionRemarks')?.value || '').trim());

    formData.append('diagnosis', (document.getElementById('inputDiagnosis')?.value || '').trim());
    formData.append('work_performed', (document.getElementById('inputWorkPerformed')?.value || '').trim());
    formData.append('parts_replaced_summary', (document.getElementById('inputPartsReplacedSummary')?.value || '').trim());
    formData.append('repair_details', (document.getElementById('inputRepairDetails')?.value || '').trim());
    formData.append('additional_remarks', (document.getElementById('inputAdditionalRemarks')?.value || '').trim());

    formData.append('final_machine_condition', (document.getElementById('inputFinalCondition')?.value || '').trim());
    formData.append('work_completion_remarks', (document.getElementById('inputWorkCompletionRemarks')?.value || '').trim());

    formData.append('parts', JSON.stringify(parts));
    formData.append('labour', JSON.stringify(labour));

    formData.append('shipping_charge', document.getElementById('inputShippingCharge')?.value || '0');

    formData.append('work_completion_date', document.getElementById('inputWorkCompletionDate')?.value || '');
    formData.append('customer_feedback', (document.getElementById('inputCustomerFeedback')?.value || '').trim());
    formData.append('technician_remarks', (document.getElementById('inputTechnicianRemarks')?.value || '').trim());

    const sig = resolveSignaturePayload();
    if (sig !== undefined) {
        formData.append('customer_signature', sig);
    }

    pendingBeforeFiles.forEach(f => formData.append('before_photos', f));
    pendingAfterFiles.forEach(f => formData.append('after_photos', f));

    return formData;
}

/**
 * Save Job Card (Create Draft / Create Open / Save Draft / Resume Draft / Save WIP)
 */
window.resumeOrActivateJobCard = function () {
    const selected = document.getElementById('inputStatus')?.value;
    const nextStatus = (!selected || selected === 'Draft') ? 'Open' : selected;
    return window.saveJobCardRecord(nextStatus);
};

window.saveJobCardRecord = async function (explicitStatus = null) {
    const targetStatus = explicitStatus || document.getElementById('inputStatus')?.value || 'Open';
    const isDraft = targetStatus === 'Draft';

    const custName = (document.getElementById('inputCustomerName')?.value || '').trim();
    const custPhone = (document.getElementById('inputCustomerPhone')?.value || '').trim();
    const issueDesc = (document.getElementById('inputIssueDescription')?.value || '').trim();
    const specComplaint = (document.getElementById('inputSpecificComplaint')?.value || '').trim();

    if (!isDraft) {
        if (!custName) {
            window.showToast('Please enter Customer Name.', 'error');
            document.getElementById('inputCustomerName')?.focus();
            return false;
        }
        if (!custPhone) {
            window.showToast('Please enter Customer Phone Number.', 'error');
            document.getElementById('inputCustomerPhone')?.focus();
            return false;
        }
        if (!issueDesc && !specComplaint) {
            window.showToast('Please enter Customer Reported Problem or Specific Complaint.', 'error');
            document.getElementById('inputIssueDescription')?.focus();
            return false;
        }
    }

    const formData = buildJobCardFormData(targetStatus);
    const url = currentJobCardId
        ? `${window.API_URL}/customer-support/job-cards/${currentJobCardId}`
        : `${window.API_URL}/customer-support/job-cards`;
    const method = currentJobCardId ? 'PUT' : 'POST';

    const actionBtns = ['btnSaveDraft', 'btnSaveOpen', 'btnSaveWIP', 'btnCompleteJobCard'];
    actionBtns.forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = true;
    });

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            if (data.existing_job_card_id) {
                alert(`DUPLICATE JOB CARD DETECTED:\n\n${data.message}\n\nClick OK to open the existing Job Card.`);
                window.location.href = `job_card_details.html?id=${data.existing_job_card_id}`;
                return false;
            }
            window.showToast(data.message || 'Failed to save Job Card.', 'error');
            return false;
        }

        const wasNew = !currentJobCardId;
        window.showToast(data.message || 'Job Card saved!', 'success');

        if (wasNew && data.job_card_id) {
            const flashMsg = isDraft
                ? `Job Card ${data.job_card_number} saved as Draft. Click Manage to resume or complete after service.`
                : `Job Card ${data.job_card_number} created! Click Manage to record service, after-work photos & completion.`;
            try { sessionStorage.setItem('jc_flash_toast', flashMsg); } catch (e) {}
            const nextQuery = isDraft ? '?status=draft' : '';
            window.location.href = `job_cards.html${nextQuery}`;
            return true;
        }

        await loadJobCardDetails();
        return true;

    } catch (err) {
        console.error('Save Job Card error:', err);
        window.showToast('Network error while saving Job Card.', 'error');
        return false;
    } finally {
        actionBtns.forEach(id => {
            const b = document.getElementById(id);
            if (b) b.disabled = false;
        });
    }
};

/**
 * Complete Job Card (with strict verification per Section 10)
 */
window.completeCurrentJobCard = async function () {
    const custName = (document.getElementById('inputCustomerName')?.value || '').trim();
    const custPhone = (document.getElementById('inputCustomerPhone')?.value || '').trim();
    const issueDesc = (document.getElementById('inputIssueDescription')?.value || '').trim();
    const specComplaint = (document.getElementById('inputSpecificComplaint')?.value || '').trim();
    const diagnosis = (document.getElementById('inputDiagnosis')?.value || '').trim();
    const workPerformed = (document.getElementById('inputWorkPerformed')?.value || '').trim();
    const finalCond = (document.getElementById('inputFinalCondition')?.value || '').trim();

    if (!custName || !custPhone) {
        window.showToast('Customer Name and Phone are required before completion.', 'error');
        return;
    }
    if (!issueDesc && !specComplaint) {
        window.showToast('Complaint details are required before completion.', 'error');
        return;
    }
    if (!diagnosis) {
        window.showToast('Please enter Diagnosis / Findings in Section 7 before completion.', 'error');
        document.getElementById('inputDiagnosis')?.focus();
        return;
    }
    if (!workPerformed) {
        window.showToast('Please enter Actual Work Performed in Section 7 before completion.', 'error');
        document.getElementById('inputWorkPerformed')?.focus();
        return;
    }
    if (!finalCond) {
        window.showToast('Please enter Final Machine Condition in Section 8 before completion.', 'error');
        document.getElementById('inputFinalCondition')?.focus();
        return;
    }

    const parts = collectPartsFromTable();
    const labour = collectLabourFromTable();
    for (const p of parts) {
        if (!p.part_name) {
            window.showToast('Please enter Part Description for every part row or remove blank rows.', 'error');
            return;
        }
    }
    for (const l of labour) {
        if (!l.labour_description) {
            window.showToast('Please enter Labour Description for every labour row or remove blank rows.', 'error');
            return;
        }
    }

    // Populate default completion timestamp if left blank
    const compDateEl = document.getElementById('inputWorkCompletionDate');
    if (compDateEl && !compDateEl.value) {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        compDateEl.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }

    if (!confirm('Finalize and mark this Job Card as Completed? Once completed, records are locked for audit & printing.')) {
        return;
    }

    const btn = document.getElementById('btnCompleteJobCard');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing...';
    }

    try {
        // If user clicked Complete directly while still in Create mode, create first as Open then complete
        if (!currentJobCardId) {
            const created = await window.saveJobCardRecord('Open');
            if (!created || !currentJobCardId) return;
        }

        const formData = buildJobCardFormData('Completed');
        const res = await fetch(`${window.API_URL}/customer-support/job-cards/${currentJobCardId}/complete`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            window.showToast(data.message || 'Could not complete Job Card.', 'error');
            return;
        }

        window.showToast('Job Card completed successfully!', 'success');
        await loadJobCardDetails();
    } catch (err) {
        console.error('Complete error:', err);
        window.showToast('Network error while completing Job Card.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Job Card';
        }
    }
};

/**
 * Cancel Job Card Modal & Submit
 */
window.openCancelJobModal = function () {
    if (!currentJobCardId) {
        window.location.href = 'job_cards.html';
        return;
    }
    const modal = document.getElementById('cancelJobModal');
    if (modal) modal.style.display = 'flex';
};

window.handleCancelJobSubmit = async function (e) {
    e.preventDefault();
    const reason = (document.getElementById('inputCancellationReason')?.value || '').trim();
    if (!reason) {
        window.showToast('Cancellation reason is required.', 'error');
        return;
    }

    const btn = document.getElementById('btnConfirmCancel');
    if (btn) btn.disabled = true;

    try {
        const res = await window.supportFetch(`/job-cards/${currentJobCardId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
                status: 'Cancelled',
                cancellation_reason: reason
            })
        });
        if (!res || !res.success) {
            window.showToast(res ? res.message : 'Failed to cancel Job Card.', 'error');
            return;
        }

        window.showToast('Job Card cancelled.', 'success');
        closeModal('cancelJobModal');
        await loadJobCardDetails();
    } catch (err) {
        window.showToast('Error cancelling Job Card.', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
};

/**
 * Render Activity History Timeline
 */
function renderTimeline(logs) {
    const card = document.getElementById('activityTimelineCard');
    const container = document.getElementById('activityTimeline');
    if (!card || !container) return;

    card.style.display = 'block';
    if (!logs || logs.length === 0) {
        container.innerHTML = `<p style="font-size: 0.85rem; color: #94a3b8; text-align: center; padding: 1rem 0;">No activity recorded yet.</p>`;
        return;
    }

    container.innerHTML = logs.map(log => {
        let actionIcon = 'fa-info-circle';
        let dotColor = '#0284c7';

        if (log.action === 'CREATED' || log.action === 'DRAFT_CREATED') {
            actionIcon = 'fa-plus-circle'; dotColor = '#0284c7';
        } else if (log.action === 'DRAFT_SAVED' || log.action === 'WORK_SAVED' || log.action === 'RESUMED') {
            actionIcon = 'fa-save'; dotColor = '#6366f1';
        } else if (log.action === 'STATUS_CHANGE' || log.action === 'STATUS_CHANGED') {
            actionIcon = 'fa-sync-alt'; dotColor = '#f59e0b';
        } else if (log.action === 'COMPLETED') {
            actionIcon = 'fa-check-circle'; dotColor = '#059669';
        } else if (log.action === 'CANCELLED') {
            actionIcon = 'fa-ban'; dotColor = '#dc2626';
        } else if (log.action === 'PHOTO_UPLOADED' || log.action === 'PHOTO_DELETED') {
            actionIcon = 'fa-camera'; dotColor = '#7c3aed';
        }

        const performer = log.performed_by_name || 'System / Staff';
        const timeFormatted = window.formatDateTime(log.created_at);

        return `
            <div class="timeline-item">
                <div class="timeline-dot" style="background: ${dotColor};"></div>
                <div class="timeline-content">
                    <div class="timeline-meta">
                        <strong style="color: #1e293b;"><i class="fas ${actionIcon}" style="color: ${dotColor};"></i> ${escapeHtml(log.action)}</strong>
                        <span>${timeFormatted}</span>
                    </div>
                    ${log.previous_status && log.new_status ? `
                        <div style="font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.25rem;">
                            Status: <span style="text-decoration: line-through; color: #94a3b8;">${escapeHtml(log.previous_status)}</span> ➔ <span style="color: #0284c7;">${escapeHtml(log.new_status)}</span>
                        </div>
                    ` : ''}
                    <div style="font-size: 0.82rem; color: #334155; line-height: 1.4;">
                        ${escapeHtml(log.notes || 'Activity recorded.')}
                    </div>
                    <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.35rem;">
                        <i class="fas fa-user-edit"></i> ${escapeHtml(performer)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Print Saved Job Card (A4 Format matching physical SGB Agro Job Card)
 */
window.printSavedJobCard = async function () {
    if (!currentJobCardId || !currentJobCard) {
        window.showToast('Please save the Job Card as Draft or Open before printing.', 'info');
        return;
    }
    if (formIsDirty) {
        const saveFirst = confirm('You have unsaved changes. Save changes before printing so the printout includes your latest data?');
        if (saveFirst) {
            const ok = await window.saveJobCardRecord(null);
            if (!ok) return;
        }
    }

    renderPrintableJobCard();

    // Give images a quick tick to ensure browser caches rendered images before opening print dialog
    setTimeout(() => {
        window.print();
    }, 180);
};

function renderPrintableJobCard() {
    const el = document.getElementById('printableJobCard');
    if (!el || !currentJobCard) return;

    const job = currentJobCard;
    const parts = savedParts || [];
    const labour = savedLabour || [];
    const beforeImgs = savedBeforePhotos || [];
    const afterImgs = savedAfterPhotos || [];

    const partsTotal = round2(parts.reduce((s, p) => s + (p.is_foc ? 0 : (parseFloat(p.total_cost) || 0)), 0));
    const labourTotal = round2(labour.length > 0
        ? labour.reduce((s, l) => s + (parseFloat(l.total_cost) || 0), 0)
        : (parseFloat(job.labour_total) || parseFloat(job.service_cost) || 0));
    const discount = round2(parseFloat(job.discount_amount) || 0);
    const taxable = round2(Math.max(0, partsTotal + labourTotal - discount));
    const taxAmt = round2(parseFloat(job.tax_amount) || 0);
    const shippingCharge = round2(parseFloat(job.shipping_charge) || 0);
    const grandTotal = round2(Math.max(0, taxable + taxAmt + shippingCharge));
    const paid = round2(parseFloat(job.amount_paid) || 0);
    const balance = round2(Math.max(0, grandTotal - paid));

    const partsRowsHtml = parts.length > 0
        ? parts.map((p, idx) => {
            const qty = parseFloat(p.quantity || 1);
            const unitCost = parseFloat(p.unit_cost || 0);
            const isFoc = Boolean(p.is_foc);
            const lineTot = isFoc ? 0 : round2(parseFloat(p.total_cost || (qty * unitCost)));
            return `
                <tr>
                    <td class="ctr">${idx + 1}</td>
                    <td>${escapeHtml(p.part_number || '—')}</td>
                    <td><strong>${escapeHtml(p.part_name)}</strong>${isFoc ? ' <span style="border:1px solid #000;padding:0 3px;font-size:8px;font-weight:800;">FOC</span>' : ''}${p.remarks ? `<br><span style="font-size:8.5px;color:#444;">${escapeHtml(p.remarks)}</span>` : ''}</td>
                    <td class="ctr">${qty}</td>
                    <td class="num">₹${unitCost.toFixed(2)}</td>
                    <td class="num"><strong>${isFoc ? 'FOC — ₹0.00' : `₹${lineTot.toFixed(2)}`}</strong></td>
                </tr>
            `;
        }).join('')
        : `<tr><td colspan="6" class="ctr" style="color:#555;">No spare parts recorded</td></tr>`;

    const labourRowsHtml = labour.length > 0
        ? labour.map((l, idx) => {
            const amt = parseFloat(l.total_cost !== undefined && l.total_cost !== null ? l.total_cost : (l.rate || 0)) || 0;
            return `
            <tr>
                <td class="ctr">${idx + 1}</td>
                <td><strong>${escapeHtml(l.labour_description)}</strong></td>
                <td>${l.remarks ? escapeHtml(l.remarks) : '—'}</td>
                <td class="num"><strong>₹${amt.toFixed(2)}</strong></td>
            </tr>
        `;
        }).join('')
        : (parseFloat(job.service_cost || 0) > 0
            ? `<tr><td class="ctr">1</td><td>Service / Labour Charge</td><td>—</td><td class="num"><strong>₹${parseFloat(job.service_cost).toFixed(2)}</strong></td></tr>`
            : `<tr><td colspan="4" class="ctr" style="color:#555;">No labour entries recorded</td></tr>`);

    const renderPrintPhotos = (list) => {
        if (!list || list.length === 0) {
            return `<div class="print-sec-content" style="color:#555; font-size:9px;">No photos attached.</div>`;
        }
        return `
            <div class="print-photos-grid">
                ${list.map(p => {
                    const isVideo = window.isSupportVideoFile
                        ? window.isSupportVideoFile(p.file_url, p.file_name)
                        : /\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i.test(p.file_url || p.file_name || '');
                    const visual = isVideo
                        ? `<div style="height:68px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#334155;font-size:10px;font-weight:700;border-bottom:1px solid #cbd5e1;">VIDEO ATTACHMENT</div>`
                        : `<img src="${resolvePhotoUrl(p.file_url)}" alt="${escapeHtml(p.file_name)}">`;
                    return `
                        <div class="print-photo-item">
                            ${visual}
                            <div class="print-photo-cap">${escapeHtml(p.file_name)} (${escapeHtml(p.uploaded_by_name || 'Staff')})</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };

    el.innerHTML = `
        <div class="print-sheet">
            <!-- Header -->
            <div class="print-header-box">
                <div class="print-company-brand">
                    <img src="../../assets/logo.png" alt="SGB Agro Logo" onerror="this.style.display='none'">
                    <div>
                        <h1 class="print-company-title">SGB AGRO INDUSTRIES</h1>
                        <p class="print-doc-subtitle">Customer Support &amp; Technical Service — Job Card</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 13px; font-weight: 900;">${escapeHtml(job.job_card_number)}</div>
                    <div style="font-size: 9.5px; font-weight: 700;">Status: ${escapeHtml(job.status)} | Priority: ${escapeHtml(job.priority)}</div>
                    <div style="font-size: 9px;">Type: ${escapeHtml(job.job_type)}</div>
                </div>
            </div>

            <!-- Job Card Meta -->
            <div class="print-meta-grid">
                <div class="print-meta-cell">
                    <span class="print-lbl">Job Card Date</span>
                    <span class="print-val">${window.formatDate(job.job_card_date || job.created_at)}</span>
                </div>
                <div class="print-meta-cell">
                    <span class="print-lbl">Promised Date</span>
                    <span class="print-val">${job.due_date ? window.formatDate(job.due_date) : '—'}</span>
                </div>
                <div class="print-meta-cell">
                    <span class="print-lbl">Technician / Responsible</span>
                    <span class="print-val">${escapeHtml(job.assigned_to_name || job.technician_name || '—')}</span>
                </div>
                <div class="print-meta-cell">
                    <span class="print-lbl">Linked Order / Case</span>
                    <span class="print-val">${job.order_id ? `Order #${job.order_id}` : 'Direct'} ${job.case_number ? `/ Case #${escapeHtml(job.case_number)}` : ''}</span>
                </div>
            </div>

            <!-- Customer & Machinery Details -->
            <div class="print-two-col">
                <div class="print-col-box">
                    <span class="print-lbl">Customer Details</span>
                    <div style="font-size: 11px; font-weight: 800; margin: 2px 0;">${escapeHtml(job.customer_name || '—')}</div>
                    <div><strong>Phone:</strong> ${escapeHtml(job.customer_phone || '—')}</div>
                    <div><strong>Address:</strong> ${escapeHtml(job.customer_address || '—')}</div>
                </div>
                <div class="print-col-box">
                    <span class="print-lbl">Machinery Details</span>
                    <div><strong>Make / Model:</strong> ${escapeHtml(job.machine_make_model || job.product_summary || '—')}</div>
                    <div><strong>Serial / VIN No.:</strong> ${escapeHtml(job.serial_vin_number || '—')}</div>
                    <div><strong>Hours Run:</strong> ${escapeHtml(job.hours_run || '—')}</div>
                </div>
            </div>

            <!-- Customer Complaints / Work Requested -->
            <div class="print-sec-bar">Customer Complaints &amp; Work Requested</div>
            <div class="print-sec-content">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div><strong>Specific Complaint:</strong> ${escapeHtml(job.specific_complaint || '—')}</div>
                    <div><strong>Initial Diagnosis:</strong> ${escapeHtml(job.initial_diagnosis || '—')}</div>
                </div>
                <div style="margin-top:4px;"><strong>Customer Reported Problem:</strong> ${escapeHtml(job.issue_description || '—')}</div>
                ${job.original_issue_description && job.original_issue_description !== job.issue_description ? `
                    <div style="margin-top:3px; font-size:9px;"><strong>Historical Original Complaint:</strong> ${escapeHtml(job.original_issue_description)}</div>
                ` : ''}
                <div style="margin-top:4px;"><strong>Work Requested (Planned):</strong> ${escapeHtml(job.work_required || '—')}</div>
                ${job.additional_observations ? `<div style="margin-top:3px;"><strong>Additional Observations:</strong> ${escapeHtml(job.additional_observations)}</div>` : ''}
            </div>

            <!-- Before Work Condition & Photos -->
            <div class="print-sec-bar">Before Work — Machine Condition &amp; Inspection Photos</div>
            <div class="print-sec-content">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div><strong>Initial Condition:</strong> ${escapeHtml(job.before_work_condition || '—')}</div>
                    <div><strong>Inspection Remarks:</strong> ${escapeHtml(job.initial_inspection_remarks || '—')}</div>
                </div>
            </div>
            ${renderPrintPhotos(beforeImgs)}

            <!-- Parts & Materials Used -->
            <div class="print-sec-bar">Parts &amp; Materials Used</div>
            <table class="print-table">
                <thead>
                    <tr>
                        <th class="ctr" style="width:28px;">#</th>
                        <th style="width:95px;">Part No.</th>
                        <th>Part Description</th>
                        <th class="ctr" style="width:50px;">Qty</th>
                        <th class="num" style="width:75px;">Unit Price</th>
                        <th class="num" style="width:90px;">Total</th>
                    </tr>
                </thead>
                <tbody>${partsRowsHtml}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" class="num"><strong>Parts Total</strong></td>
                        <td class="num"><strong>₹${partsTotal.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>

            <!-- Labour & Service Charges -->
            <div class="print-sec-bar">Labour &amp; Service Charges</div>
            <table class="print-table">
                <thead>
                    <tr>
                        <th class="ctr" style="width:28px;">#</th>
                        <th>Labour / Service Description</th>
                        <th style="width:160px;">Remarks</th>
                        <th class="num" style="width:100px;">Charge (₹)</th>
                    </tr>
                </thead>
                <tbody>${labourRowsHtml}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="num"><strong>Labour Total</strong></td>
                        <td class="num"><strong>₹${labourTotal.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>

            <!-- Work Performed -->
            <div class="print-sec-bar">Work Performed / Repair Details</div>
            <div class="print-sec-content">
                <div><strong>Diagnosis / Findings:</strong> ${escapeHtml(job.diagnosis || '—')}</div>
                <div style="margin-top:3px;"><strong>Actual Work Performed:</strong> ${escapeHtml(job.work_performed || '—')}</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top:3px;">
                    <div><strong>Parts Replaced:</strong> ${escapeHtml(job.parts_replaced_summary || '—')}</div>
                    <div><strong>Repair Details:</strong> ${escapeHtml(job.repair_details || '—')}</div>
                </div>
                ${job.additional_remarks || job.notes ? `<div style="margin-top:3px;"><strong>Additional Remarks:</strong> ${escapeHtml(job.additional_remarks || job.notes)}</div>` : ''}
            </div>

            <!-- After Work Condition & Photos -->
            <div class="print-sec-bar">After Work — Final Machine Condition &amp; Proof Photos</div>
            <div class="print-sec-content">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div><strong>Final Machine Condition:</strong> ${escapeHtml(job.final_machine_condition || '—')}</div>
                    <div><strong>Completion Remarks:</strong> ${escapeHtml(job.work_completion_remarks || '—')}</div>
                </div>
            </div>
            ${renderPrintPhotos(afterImgs)}

            <!-- Final Charges + Completion Feedback Split -->
            <div class="print-two-col">
                <div class="print-col-box">
                    <span class="print-lbl">Completion Details &amp; Customer Feedback</span>
                    <div style="margin-top:3px;"><strong>Work Completion Date:</strong> ${job.work_completion_date || job.completed_at ? window.formatDateTime(job.work_completion_date || job.completed_at) : '—'}</div>
                    <div><strong>Completed By:</strong> ${escapeHtml(job.completed_by_name || '—')}</div>
                    <div style="margin-top:4px;"><strong>Customer Feedback:</strong> ${escapeHtml(job.customer_feedback || '—')}</div>
                    <div style="margin-top:3px;"><strong>Technician Remarks:</strong> ${escapeHtml(job.technician_remarks || '—')}</div>
                </div>
                <div class="print-col-box" style="padding: 0;">
                    <table class="print-table" style="border:none;">
                        <tbody>
                            <tr><td>Parts Total</td><td class="num">₹${partsTotal.toFixed(2)}</td></tr>
                            <tr><td>Labour Total</td><td class="num">₹${labourTotal.toFixed(2)}</td></tr>
                            <tr><td>Shipping / Delivery Charge</td><td class="num">₹${shippingCharge.toFixed(2)}</td></tr>
                            ${discount > 0 ? `<tr><td>Discount</td><td class="num">- ₹${discount.toFixed(2)}</td></tr>` : ''}
                            ${taxAmt > 0 ? `<tr><td>Applicable Taxes (${round2(parseFloat(job.tax_percent || 0))}%)</td><td class="num">₹${taxAmt.toFixed(2)}</td></tr>` : ''}
                            <tr style="background:#f1f5f9;"><td><strong>GRAND TOTAL</strong></td><td class="num"><strong>₹${grandTotal.toFixed(2)}</strong></td></tr>
                            ${paid > 0 ? `<tr><td>Amount Paid (${escapeHtml(job.payment_mode || '—')})</td><td class="num">₹${paid.toFixed(2)}</td></tr>
                            <tr><td><strong>Balance Amount (${escapeHtml(job.payment_status || 'Unpaid')})</strong></td><td class="num"><strong>₹${balance.toFixed(2)}</strong></td></tr>` : `<tr><td colspan="2" style="font-size:8.5px;color:#475569;"><em>Discount, GST/taxes &amp; payment settled separately in Billing.</em></td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Signatures -->
            <div class="print-footer-signs">
                <div class="print-sign-box">
                    <div>
                        <span class="print-lbl">Customer Signature &amp; Acceptance</span>
                        ${job.customer_signature ? `<img src="${job.customer_signature}" class="print-sign-img" alt="Customer Signature">` : '<div style="height:38px;"></div>'}
                    </div>
                    <div style="border-top: 1px solid #000; padding-top: 3px; font-size: 9px;">
                        ${escapeHtml(job.customer_name || 'Customer')} ${job.signature_date ? `• ${window.formatDate(job.signature_date)}` : ''}
                    </div>
                </div>
                <div class="print-sign-box" style="text-align: right;">
                    <div>
                        <span class="print-lbl">For SGB AGRO INDUSTRIES</span>
                        <div style="height: 38px;"></div>
                    </div>
                    <div style="border-top: 1px solid #000; padding-top: 3px; font-size: 9px;">
                        Technician / Authorized Signatory (${escapeHtml(job.completed_by_name || job.assigned_to_name || 'Staff')})
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Helpers
 */
function resolvePhotoUrl(rawUrl) {
    if (window.resolveMediaUrl) return window.resolveMediaUrl(rawUrl);
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http') || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
    return `${window.ROOT_PATH || '../../'}${rawUrl.replace(/^\//, '')}`;
}

function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val !== undefined && val !== null ? val : '';
}

function formatInputDate(val) {
    if (!val) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return String(val);
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatInputDateTime(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window.openLightbox = function (url, caption, isVideo = false) {
    const modal = document.getElementById('lightboxModal');
    const img = document.getElementById('lightboxImg');
    const vid = document.getElementById('lightboxVideo');
    const captionEl = document.getElementById('lightboxCaption');
    const videoMode = Boolean(isVideo) || (window.isSupportVideoFile && window.isSupportVideoFile(url, caption));
    if (modal && (img || vid)) {
        if (videoMode && vid) {
            if (img) { img.style.display = 'none'; img.src = ''; }
            vid.src = url;
            vid.style.display = 'block';
        } else {
            if (vid) { vid.pause(); vid.style.display = 'none'; vid.src = ''; }
            if (img) { img.src = url; img.style.display = 'block'; }
        }
        if (captionEl) captionEl.textContent = caption || '';
        modal.style.display = 'flex';
    }
};

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modalId === 'lightboxModal') {
        const vid = document.getElementById('lightboxVideo');
        if (vid) { vid.pause(); vid.src = ''; }
    }
    if (modal) modal.style.display = 'none';
};
