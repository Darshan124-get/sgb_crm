/**
 * call_completion.js
 * Handles customer phone/video calling, recording assistance & installation guidance,
 * staging & uploading fitting photos, customer notes, and completing support with 30-day follow-up.
 */

let currentCaseId = null;
let caseData = null;
let stagedPhotos = []; // Array of File objects

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentCaseId = params.get('case_id');

    if (!currentCaseId) {
        window.showToast('No Case ID specified', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
        return;
    }

    loadCaseDetails();
    setupEventListeners();
});

// ── LOAD CASE DATA ──
async function loadCaseDetails() {
    try {
        const data = await window.supportFetch(`/cases/${currentCaseId}`);
        if (!data || !data.success || !data.case) {
            window.showToast('Unable to load case details', 'error');
            return;
        }

        caseData = data;
        const c = data.case;

        // Context Bar
        document.getElementById('ctxCustName').textContent = c.customer_name || 'Valued Customer';
        document.getElementById('ctxCustPhone').textContent = c.customer_phone || '-';
        document.getElementById('ctxOrderNum').textContent = c.order_id ? `#${c.order_id}` : (c.manual_order_number || 'Manual Case');
        document.getElementById('ctxProducts').textContent = c.product_summary || 'Agricultural Machinery & Supplies';
        document.getElementById('ctxDeliveryDate').textContent = `Delivered: ${window.formatDate(c.delivery_date)}`;
        
        // Header
        document.getElementById('backToCaseLink').href = `customer_details.html?case_id=${c.case_id}`;
        document.getElementById('caseBadge').innerHTML = window.renderStatusBadge(c.status);

        // Pre-fill existing guidance if case was previously contacted
        if (c.installation_status) {
            const matchRadio = document.querySelector(`input[name="installation_status"][value="${c.installation_status}"]`);
            if (matchRadio) matchRadio.checked = true;
        }

    } catch (err) {
        console.error('Error loading case details:', err);
    }
}

// ── SETUP EVENT LISTENERS ──
function setupEventListeners() {
    // Top Call Buttons
    document.getElementById('btnCallCustomerTop').addEventListener('click', () => {
        if (caseData && caseData.case) {
            window.callCustomer(caseData.case.customer_phone, caseData.case.customer_name, null);
        }
    });

    document.getElementById('btnVideoCallTop').addEventListener('click', handleVideoCall);

    // Call outcome radio switch
    const outcomeRadios = document.querySelectorAll('input[name="call_outcome"]');
    outcomeRadios.forEach(radio => {
        radio.addEventListener('change', handleOutcomeChange);
    });

    // Dropzone for photos
    const dropzone = document.getElementById('photoDropzone');
    const photoInput = document.getElementById('stagedPhotosInput');

    dropzone.addEventListener('click', () => photoInput.click());
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#0284c7';
        dropzone.style.background = '#e0f2fe';
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '#93c5fd';
        dropzone.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)';
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#93c5fd';
        dropzone.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesSelected(e.dataTransfer.files);
        }
    });

    photoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files);
        }
    });

    // Action buttons
    document.getElementById('btnSaveCallOnly').addEventListener('click', handleSaveCallOnly);
    document.getElementById('callCompletionForm').addEventListener('submit', handleCompleteSupport);

    // Schedule Follow-Up button for unreachable customers
    const btnSchedule = document.getElementById('btnScheduleFollowupSubmit');
    if (btnSchedule) {
        btnSchedule.addEventListener('click', handleScheduleFollowup);
    }

    // Initialize quick follow-up date (defaults to tomorrow)
    window.setQuickFollowupDate(1);
}

// ── VIDEO CALL HANDLER ──
function handleVideoCall() {
    if (!caseData || !caseData.case || !caseData.case.customer_phone) {
        window.showToast('Customer phone not found', 'error');
        return;
    }

    const cleanPhone = caseData.case.customer_phone.replace(/[^0-9]/g, '');
    const choice = confirm(`Launch video assistance session with ${caseData.case.customer_name} via WhatsApp Web / Call?`);
    if (choice) {
        window.open(`https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(caseData.case.customer_name)},%20this%20is%20SGB%20Customer%20Support%20regarding%20your%20Order%20${caseData.case.order_id}%20installation.`, '_blank');
    }
}

// ── QUICK FOLLOW-UP DATE PRESET HELPER ──
window.setQuickFollowupDate = function (daysFromNow = 1) {
    const d = new Date();
    d.setDate(d.getDate() + Number(daysFromNow));
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const input = document.getElementById('followupDateInput');
    if (input) {
        input.value = dateStr;
        input.min = new Date().toISOString().split('T')[0];
    }
};

// ── OUTCOME CHANGE LISTENER ──
function handleOutcomeChange(e) {
    const outcome = e.target.value;
    const unreachableSection = document.getElementById('unreachableScheduleSection');
    const answeredContainer = document.getElementById('answeredDetailsContainer');

    const isUnreachable = ['not_answered', 'switched_off', 'not_reachable', 'busy', 'callback_required'].includes(outcome);

    if (isUnreachable) {
        // Customer did not answer / switched off / not reachable:
        // HIDE information taking, guidance, and photo upload
        // SHOW schedule follow-up date picker & remarks
        if (unreachableSection) unreachableSection.style.display = 'block';
        if (answeredContainer) answeredContainer.style.display = 'none';

        const dateInput = document.getElementById('followupDateInput');
        if (dateInput && !dateInput.value) {
            window.setQuickFollowupDate(1);
        }
        if (dateInput) {
            dateInput.min = new Date().toISOString().split('T')[0];
        }

        const remarksInput = document.getElementById('unreachableRemarks');
        if (remarksInput) {
            const suggestions = {
                not_answered: 'Customer did not answer call. Scheduled follow-up to re-attempt contact.',
                switched_off: 'Customer phone was switched off. Scheduled follow-up to re-attempt contact.',
                not_reachable: 'Customer phone not reachable / network issue. Scheduled follow-up to re-attempt contact.',
                busy: 'Customer line was busy. Scheduled follow-up to re-attempt contact.',
                callback_required: 'Customer requested a callback at a later time.'
            };
            remarksInput.value = suggestions[outcome] || 'Customer was unreachable. Scheduled follow-up.';
        }
    } else {
        // Customer answered / received call:
        // HIDE schedule follow-up card
        // SHOW guidance information and photo upload
        if (unreachableSection) unreachableSection.style.display = 'none';
        if (answeredContainer) answeredContainer.style.display = 'block';
    }
}

// ── HANDLE SCHEDULE FOLLOW-UP (CUSTOMER UNREACHABLE) ──
async function handleScheduleFollowup() {
    const outcomeRadio = document.querySelector('input[name="call_outcome"]:checked');
    if (!outcomeRadio) {
        window.showToast('Please select a Call Outcome', 'error');
        return;
    }
    const outcome = outcomeRadio.value;

    const dateInput = document.getElementById('followupDateInput');
    const scheduledDate = dateInput ? dateInput.value : '';
    if (!scheduledDate) {
        window.showToast('Please select a Follow-Up Date', 'error');
        if (dateInput) dateInput.focus();
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (scheduledDate < todayStr) {
        window.showToast('Follow-up date cannot be in the past', 'error');
        return;
    }

    const timeSlot = document.getElementById('followupTimeSlot')?.value || '';
    const remarks = document.getElementById('unreachableRemarks')?.value.trim() || '';

    const submitBtn = document.getElementById('btnScheduleFollowupSubmit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scheduling Follow-Up...';

    try {
        const res = await window.supportFetch(`/cases/${currentCaseId}/calls`, {
            method: 'POST',
            body: JSON.stringify({
                call_type: 'INITIAL',
                call_outcome: outcome,
                scheduled_date: scheduledDate,
                preferred_time_slot: timeSlot,
                remarks: remarks
            })
        });

        if (!res || !res.success) {
            throw new Error(res ? res.message : 'Failed to schedule follow-up');
        }

        window.showToast(`Follow-up scheduled for ${window.formatDate(scheduledDate)}! Call attempt saved.`, 'success');

        setTimeout(() => {
            window.location.href = `customer_details.html?case_id=${currentCaseId}`;
        }, 1200);

    } catch (err) {
        console.error('Error scheduling follow-up:', err);
        window.showToast(err.message || 'Error scheduling follow-up', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> Schedule Follow-Up &amp; Save Call Attempt';
    }
}

// ── PHOTO STAGING & PREVIEWS ──
function handleFilesSelected(fileList) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    let addedCount = 0;
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!validTypes.includes(file.type)) {
            window.showToast(`Skipped "${file.name}": Unsupported format. Only JPG, PNG, WEBP allowed.`, 'error');
            continue;
        }
        if (file.size > maxSize) {
            window.showToast(`Skipped "${file.name}": File size exceeds 10MB limit.`, 'error');
            continue;
        }

        stagedPhotos.push(file);
        addedCount++;
    }

    if (addedCount > 0) {
        renderStagedPhotos();
        window.showToast(`${addedCount} photo(s) staged for upload`, 'success');
    }
}

function renderStagedPhotos() {
    const container = document.getElementById('stagedPhotosList');
    container.innerHTML = '';

    stagedPhotos.forEach((file, index) => {
        const thumbCard = document.createElement('div');
        thumbCard.className = 'photo-thumb-card';

        const objUrl = URL.createObjectURL(file);
        thumbCard.innerHTML = `
            <img src="${objUrl}" alt="${file.name}">
            <button type="button" class="photo-thumb-remove" title="Remove image" onclick="removeStagedPhoto(${index})">
                <i class="fas fa-times"></i>
            </button>
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: white; font-size: 0.65rem; padding: 2px 4px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                ${file.name}
            </div>
        `;
        container.appendChild(thumbCard);
    });
}

window.removeStagedPhoto = function (index) {
    stagedPhotos.splice(index, 1);
    renderStagedPhotos();
};

// ── UPLOAD STAGED PHOTOS HELPER ──
async function uploadStagedPhotosToServer(callId = null) {
    if (stagedPhotos.length === 0) return true;

    try {
        const formData = new FormData();
        if (callId) formData.append('call_id', callId);

        stagedPhotos.forEach(file => {
            formData.append('photos', file);
        });

        const res = await window.supportFetch(`/cases/${currentCaseId}/photos`, {
            method: 'POST',
            body: formData
        });

        if (res && res.success) {
            stagedPhotos = [];
            renderStagedPhotos();
            return true;
        } else {
            window.showToast(res ? res.message : 'Photo upload failed', 'error');
            return false;
        }
    } catch (err) {
        console.error('Error uploading photos:', err);
        window.showToast('Photo upload encountered an error', 'error');
        return false;
    }
}

// ── SAVE CALL LOG ONLY (KEEP CASE OPEN) ──
async function handleSaveCallOnly() {
    const outcomeRadio = document.querySelector('input[name="call_outcome"]:checked');
    if (!outcomeRadio) {
        window.showToast('Please select a Call Outcome', 'error');
        return;
    }

    const callOutcome = outcomeRadio.value;
    const installRadio = document.querySelector('input[name="installation_status"]:checked');
    const installStatus = (callOutcome === 'answered') ? (installRadio ? installRadio.value : null) : null;

    const guidanceProvided = document.getElementById('guidanceProvided').value.trim();
    const installInstructions = document.getElementById('installInstructions').value.trim();
    const productUsageGuidance = document.getElementById('productUsageGuidance').value.trim();
    const customerQuestions = document.getElementById('customerQuestions').value.trim();
    const reportedProblems = document.getElementById('reportedProblems').value.trim();
    const notes = document.getElementById('notesContent').value.trim();
    const remarks = document.getElementById('remarksContent').value.trim();

    const saveBtn = document.getElementById('btnSaveCallOnly');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // 1. Record call
        const callRes = await window.supportFetch(`/cases/${currentCaseId}/calls`, {
            method: 'POST',
            body: JSON.stringify({
                call_type: 'INITIAL',
                call_outcome: callOutcome,
                installation_status: installStatus,
                guidance_provided: guidanceProvided,
                installation_instructions: installInstructions,
                product_usage_guidance: productUsageGuidance,
                customer_questions: customerQuestions,
                reported_problems: reportedProblems,
                feedback: notes,
                remarks: remarks
            })
        });

        if (!callRes || !callRes.success) {
            throw new Error(callRes ? callRes.message : 'Failed to save call');
        }

        const callId = callRes.call_id;

        // 2. Upload any staged photos
        if (stagedPhotos.length > 0) {
            await uploadStagedPhotosToServer(callId);
        }

        window.showToast('Call log recorded. Support case updated.', 'success');
        setTimeout(() => {
            window.location.href = `customer_details.html?case_id=${currentCaseId}`;
        }, 1200);

    } catch (err) {
        window.showToast(err.message || 'Failed to save call log', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Call Log Only (Keep Open)';
    }
}

// ── COMPLETE SUPPORT & SCHEDULE 30-DAY FOLLOW-UP ──
async function handleCompleteSupport(e) {
    e.preventDefault();

    const outcomeRadio = document.querySelector('input[name="call_outcome"]:checked');
    if (!outcomeRadio) {
        window.showToast('Please select a Call Outcome', 'error');
        return;
    }

    const callOutcome = outcomeRadio.value;
    if (callOutcome === 'not_answered' || callOutcome === 'callback_required') {
        window.showToast('Cannot complete support when customer is unreachable. Please use "Save Call Log Only".', 'error');
        return;
    }

    const installRadio = document.querySelector('input[name="installation_status"]:checked');
    if (!installRadio) {
        window.showToast('Please select an Installation Status', 'error');
        return;
    }
    const installStatus = installRadio.value;

    const guidanceProvided = document.getElementById('guidanceProvided').value.trim() || 'Product guidance and instructions explained.';
    const notes = document.getElementById('notesContent').value.trim();
    const remarks = document.getElementById('remarksContent').value.trim();

    // Confirm action
    const confirmed = confirm(
        `Are you sure you want to COMPLETE initial support for Order #${caseData.case.order_id}?\n\n` +
        `This will finalize the case and automatically schedule a 30-Day Follow-Up check.`
    );
    if (!confirmed) return;

    const completeBtn = document.getElementById('btnCompleteSupport');
    completeBtn.disabled = true;
    completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Completing Support...';

    try {
        // 1. Upload photos first if staged
        if (stagedPhotos.length > 0) {
            await uploadStagedPhotosToServer(null);
        }

        // 2. Complete support and auto-schedule 30-day follow-up
        const res = await window.supportFetch(`/cases/${currentCaseId}/complete`, {
            method: 'POST',
            body: JSON.stringify({
                call_outcome: callOutcome,
                installation_status: installStatus,
                guidance_provided: guidanceProvided,
                notes: notes,
                remarks: remarks
            })
        });

        if (!res || !res.success) {
            throw new Error(res ? res.message : 'Failed to complete support');
        }

        const scheduledDateFormatted = window.formatDate(res.scheduled_date);
        window.showToast(`Support Completed! 30-Day Follow-up scheduled for ${scheduledDateFormatted}`, 'success');

        setTimeout(() => {
            window.location.href = `customer_details.html?case_id=${currentCaseId}`;
        }, 1500);

    } catch (err) {
        window.showToast(err.message || 'Failed to complete support', 'error');
        completeBtn.disabled = false;
        completeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Support &amp; Schedule 30-Day Follow-Up';
    }
}
