/**
 * followup_details.js
 * 30-Day Follow-Up Call Execution, Feedback Capture & Next Actions
 */

let currentFollowupId = null;
let followupData = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentFollowupId = params.get('followup_id');

    if (!currentFollowupId) {
        window.showToast('No Follow-Up ID specified', 'error');
        setTimeout(() => window.location.href = 'contacted_followup.html', 1500);
        return;
    }

    loadFollowupDetails();
    setupEventListeners();
});

// ── LOAD FOLLOW-UP DETAILS ──
async function loadFollowupDetails() {
    try {
        const data = await window.supportFetch(`/followups/${currentFollowupId}`);
        if (!data || !data.success || !data.followup) {
            window.showToast('Unable to load follow-up details', 'error');
            return;
        }

        followupData = data;
        const fu = data.followup;

        // Header & Status
        document.getElementById('followupStatusBadge').innerHTML = window.renderStatusBadge(fu.status);
        document.getElementById('viewFullCaseLink').href = `customer_details.html?case_id=${fu.case_id}`;

        // Customer & Order Info
        document.getElementById('fuCustName').textContent = fu.customer_name || 'Valued Customer';
        document.getElementById('fuCustPhone').textContent = fu.customer_phone || '-';
        document.getElementById('fuOrderNum').textContent = `#${fu.order_id}`;
        document.getElementById('fuProducts').textContent = fu.product_summary || 'Order Items';
        document.getElementById('fuDeliveryDate').textContent = window.formatDate(fu.delivery_date);
        document.getElementById('fuScheduledDate').textContent = window.formatDate(fu.scheduled_date);

        // Installation Info
        document.getElementById('fuInstallStatus').textContent = (fu.installation_status || 'Successfully Installed').replace(/_/g, ' ').toUpperCase();
        document.getElementById('fuCompletedDate').textContent = window.formatDate(fu.support_completed_at);
        document.getElementById('fuAssignedName').textContent = fu.assigned_name || 'Support Executive';

        // Photos Gallery
        renderPhotos(data.photos || []);

        // Timeline History
        renderTimeline(data.calls || [], data.notes || []);

        // Check if already completed
        if (fu.status === 'COMPLETED') {
            handleAlreadyCompleted(fu);
        }

    } catch (err) {
        console.error('Error in loadFollowupDetails:', err);
    }
}

// ── SETUP EVENT LISTENERS ──
function setupEventListeners() {
    document.getElementById('btnCallCustomer').addEventListener('click', () => {
        if (followupData && followupData.followup) {
            window.callCustomer(followupData.followup.customer_phone, followupData.followup.customer_name, null);
        }
    });

    document.getElementById('btnCopyPhone').addEventListener('click', () => {
        if (followupData && followupData.followup && followupData.followup.customer_phone) {
            window.copyToClipboard(followupData.followup.customer_phone);
        }
    });

    // Toggle Issue Description when 'Any Issues' changes or product condition is issue
    const issueRadios = document.querySelectorAll('input[name="any_issues"]');
    issueRadios.forEach(r => {
        r.addEventListener('change', toggleIssueDescription);
    });

    const condRadios = document.querySelectorAll('input[name="product_condition"]');
    condRadios.forEach(r => {
        r.addEventListener('change', toggleIssueDescription);
    });

    // Form submission
    document.getElementById('followupCallForm').addEventListener('submit', handleFollowupSubmit);
}

function toggleIssueDescription() {
    const issuesSelected = document.querySelector('input[name="any_issues"]:checked')?.value;
    const condSelected = document.querySelector('input[name="product_condition"]:checked')?.value;
    const issueDescBlock = document.getElementById('issueDescBlock');

    if (issuesSelected === 'yes' || condSelected === 'minor_issue' || condSelected === 'major_issue') {
        issueDescBlock.style.display = 'block';
    } else {
        issueDescBlock.style.display = 'none';
    }
}

// ── RENDER PHOTOS ──
function renderPhotos(photos) {
    const container = document.getElementById('fuPhotoList');
    if (!photos || photos.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 0.85rem;">No installation photos recorded.</div>';
        return;
    }

    container.innerHTML = photos.map(p => `
        <div class="photo-thumb-card" style="cursor: pointer;" onclick="window.open('${p.file_url}', '_blank')">
            <img src="${p.file_url}" alt="Fitting Photo">
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: white; font-size: 0.65rem; padding: 2px 4px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                ${p.file_name || 'Photo'}
            </div>
        </div>
    `).join('');
}

// ── RENDER TIMELINE ──
function renderTimeline(calls, notes) {
    const container = document.getElementById('fuHistoryTimeline');
    
    const events = [];
    calls.forEach(c => {
        events.push({
            type: 'call',
            title: `Call: ${c.call_outcome.replace(/_/g, ' ').toUpperCase()}`,
            desc: `${c.guidance_provided ? 'Guidance: ' + c.guidance_provided + '. ' : ''}${c.feedback || ''}`,
            author: c.caller_name || 'Support Staff',
            date: c.created_at
        });
    });

    notes.forEach(n => {
        events.push({
            type: 'note',
            title: 'Note Recorded',
            desc: n.note,
            author: n.author_name || 'Executive',
            date: n.created_at
        });
    });

    events.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (events.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 0.85rem;">No previous activity logged.</div>';
        return;
    }

    container.innerHTML = events.map(ev => `
        <div class="timeline-item">
            <div class="timeline-point ${ev.type === 'call' ? 'point-call' : 'point-note'}"></div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: #0f172a;">${ev.title}</h4>
                <span class="timeline-time">${window.formatDateTime(ev.date)}</span>
            </div>
            <p style="font-size: 0.85rem; color: #475569; margin-bottom: 0.25rem;">${ev.desc}</p>
            <div style="font-size: 0.75rem; color: #94a3b8;">Logged by ${ev.author}</div>
        </div>
    `).join('');
}

// ── HANDLE ALREADY COMPLETED STATE ──
function handleAlreadyCompleted(fu) {
    document.getElementById('alreadyCompletedBanner').style.display = 'block';

    // Pre-fill values
    if (fu.product_condition) {
        const condR = document.querySelector(`input[name="product_condition"][value="${fu.product_condition}"]`);
        if (condR) condR.checked = true;
    }
    if (fu.any_issues) {
        const issR = document.querySelector(`input[name="any_issues"][value="${fu.any_issues}"]`);
        if (issR) issR.checked = true;
    }
    if (fu.next_action) {
        const actR = document.querySelector(`input[name="next_action"][value="${fu.next_action}"]`);
        if (actR) actR.checked = true;
    }

    document.getElementById('customerFeedback').value = fu.customer_feedback || '';
    document.getElementById('issueDescription').value = fu.issue_description || '';
    document.getElementById('fuRemarks').value = fu.remarks || '';

    // Disable all inputs
    const form = document.getElementById('followupCallForm');
    Array.from(form.elements).forEach(el => el.disabled = true);

    document.getElementById('btnSubmitFollowup').style.display = 'none';
}

// ── HANDLE FORM SUBMISSION ──
async function handleFollowupSubmit(e) {
    e.preventDefault();

    const productCond = document.querySelector('input[name="product_condition"]:checked')?.value;
    const anyIssues = document.querySelector('input[name="any_issues"]:checked')?.value;
    const issueDesc = document.getElementById('issueDescription').value.trim();
    const feedback = document.getElementById('customerFeedback').value.trim();
    const nextAction = document.querySelector('input[name="next_action"]:checked')?.value;
    const remarks = document.getElementById('fuRemarks').value.trim();

    if (!productCond) {
        window.showToast('Please select current Product Condition', 'error');
        return;
    }
    if (!anyIssues) {
        window.showToast('Please specify if there are any issues', 'error');
        return;
    }
    if (!feedback) {
        window.showToast('Customer feedback details are required', 'error');
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitFollowup');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording Follow-Up...';

    try {
        const res = await window.supportFetch(`/followups/${currentFollowupId}/call`, {
            method: 'POST',
            body: JSON.stringify({
                product_condition: productCond,
                any_issues: anyIssues,
                customer_feedback: feedback,
                issue_description: issueDesc,
                next_action: nextAction,
                remarks: remarks
            })
        });

        if (!res || !res.success) {
            throw new Error(res ? res.message : 'Failed to record follow-up');
        }

        window.showToast('30-Day Follow-Up completed successfully!', 'success');
        setTimeout(() => {
            window.location.href = `customer_details.html?case_id=${followupData.followup.case_id}`;
        }, 1200);

    } catch (err) {
        window.showToast(err.message || 'Error recording follow-up', 'error');
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-check-circle"></i> Complete 30-Day Follow-Up';
    }
}
