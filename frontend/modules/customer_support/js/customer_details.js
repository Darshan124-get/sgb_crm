/**
 * customer_details.js
 * Customer Profile, Order items, Historical notes, and Photos management
 */

let currentCaseId = null;
let caseData = null;

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentCaseId = params.get('case_id');

    if (!currentCaseId) {
        window.showToast('No Case ID specified', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
        return;
    }

    loadCaseDetails();

    // Event Listeners
    document.getElementById('addNoteForm').addEventListener('submit', handleAddNote);
    document.getElementById('photoInput').addEventListener('change', handleUploadPhotos);

    document.getElementById('btnCopyPhone').addEventListener('click', () => {
        if (caseData && caseData.case && caseData.case.customer_phone) {
            window.copyToClipboard(caseData.case.customer_phone);
        }
    });

    document.getElementById('btnCallCustomer').addEventListener('click', () => {
        if (caseData && caseData.case) {
            window.callCustomer(caseData.case.customer_phone, caseData.case.customer_name, currentCaseId);
        }
    });
});

async function loadCaseDetails() {
    try {
        const data = await window.supportFetch(`/cases/${currentCaseId}`);
        if (!data || !data.success || !data.case) {
            window.showToast('Failed to load support case details', 'error');
            return;
        }

        caseData = data;
        const c = data.case;

        // Header
        document.getElementById('headerCaseNumber').textContent = `Case #${c.case_number}`;
        document.getElementById('headerStatusBadge').innerHTML = window.renderStatusBadge(c.status);
        document.getElementById('btnCompleteGuidance').href = `call_completion.html?case_id=${c.case_id}`;
        document.getElementById('btnLogCallLink').href = `call_completion.html?case_id=${c.case_id}`;
        const btnJC = document.getElementById('btnCreateJobCard');
        if (btnJC) {
            btnJC.href = `job_cards.html?action=create&phone=${encodeURIComponent(c.customer_phone || '')}&order_id=${c.order_id || ''}&case_id=${c.case_id || ''}`;
        }

        // Customer Card
        document.getElementById('custName').textContent = c.customer_name || 'Valued Customer';
        document.getElementById('custPhone').textContent = c.customer_phone || '-';
        document.getElementById('custAddress').textContent = c.address || 'Address not recorded';
        document.getElementById('custCity').textContent = c.city || c.district || '-';
        document.getElementById('custStatePin').textContent = `${c.state || '-'} ${c.pincode ? `(${c.pincode})` : ''}`;

        // Order Card
        document.getElementById('orderNumber').textContent = c.order_id ? `#${c.order_id}` : (c.manual_order_number || 'Manual Case');
        document.getElementById('orderChannel').textContent = c.purchase_source || 'SGB Direct';
        document.getElementById('orderAmount').textContent = c.total_amount ? `₹${Number(c.total_amount).toLocaleString('en-IN')}` : '₹0';
        document.getElementById('deliveryDate').textContent = window.formatDate(c.delivery_date || c.order_created_at);
        document.getElementById('assignedExec').textContent = c.assigned_name || 'Unassigned';

        // Follow-up status
        const followups = data.followups || [];
        if (followups.length > 0) {
            const fu = followups[0];
            document.getElementById('followupInfo').innerHTML = `
                ${window.formatDate(fu.scheduled_date)} 
                <span class="badge" style="font-size:0.65rem;">${fu.status}</span>
            `;
        } else if (c.status === 'completed') {
            document.getElementById('followupInfo').textContent = 'Scheduled (30 Days)';
        } else {
            document.getElementById('followupInfo').textContent = 'Scheduled upon completion';
        }

        // Render Order Items
        const items = data.order_items || [];
        const itemsContainer = document.getElementById('orderItemsList');
        if (items.length === 0) {
            itemsContainer.innerHTML = `<span style="color:#94a3b8;">${escapeHtml(c.product_summary || 'No product items listed')}</span>`;
        } else {
            itemsContainer.innerHTML = items.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px dashed #e2e8f0;">
                    <div>
                        <strong style="color: #0f172a;">${escapeHtml(item.product_name || 'Product')}</strong>
                        <div style="font-size: 0.75rem; color: #64748b;">Qty: ${item.quantity || 1} • SKU: ${item.sku || '-'}</div>
                    </div>
                    <span style="font-weight: 600; color: #334155;">₹${Number(item.total_price || item.price || 0).toLocaleString('en-IN')}</span>
                </div>
            `).join('');
        }

        // Render Notes
        renderNotes(data.notes || []);

        // Render Photos
        renderPhotos(data.photos || []);

        // Render Calls
        renderCalls(data.calls || []);

    } catch (e) {
        console.error('Error loading case details:', e);
        window.showToast('Error loading case details', 'error');
    }
}

function renderNotes(notes) {
    const list = document.getElementById('notesHistoryList');
    document.getElementById('notesCountBadge').textContent = `${notes.length} note${notes.length === 1 ? '' : 's'}`;

    if (notes.length === 0) {
        list.innerHTML = `<div style="color: #94a3b8; font-size: 0.85rem; padding: 1rem 0;">No notes added yet. Use the box above to add remarks.</div>`;
        return;
    }

    list.innerHTML = notes.map(n => `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #0284c7;">${escapeHtml(n.author_name || 'Staff')}</span>
                <span style="font-size: 0.75rem; color: #94a3b8;">${window.formatDateTime(n.created_at)}</span>
            </div>
            <div style="font-size: 0.875rem; color: #1e293b; line-height: 1.4; white-space: pre-wrap;">${escapeHtml(n.note)}</div>
        </div>
    `).join('');
}

function renderPhotos(photos) {
    const grid = document.getElementById('photoGalleryGrid');

    if (photos.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; color: #94a3b8; font-size: 0.85rem; padding: 1rem 0;">No installation photos or videos uploaded yet.</div>`;
        return;
    }

    grid.innerHTML = photos.map(p => {
        const mediaUrl = window.resolveMediaUrl ? window.resolveMediaUrl(p.file_url) : p.file_url;
        const isVideo = window.isSupportVideoFile ? window.isSupportVideoFile(p.file_url, p.file_name) : /\.(mp4|mov|webm|avi|mkv)$/i.test(p.file_url || '');
        const escapedUrl = escapeHtml(mediaUrl).replace(/'/g, '&#039;');
        const bodyHtml = isVideo
            ? `<video src="${escapedUrl}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover;background:#0f172a;"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.28);color:white;font-size:1.4rem;"><i class="fas fa-play-circle"></i></div>`
            : `<img src="${escapedUrl}" alt="Fitting Photo">`;
        return `
            <div class="photo-thumb-card" onclick="openLightbox('${escapedUrl}', ${isVideo})" style="cursor: pointer;" title="Click to view full size">
                ${bodyHtml}
            </div>
        `;
    }).join('');
}

function renderCalls(calls) {
    const container = document.getElementById('callTimelineList');

    if (calls.length === 0) {
        container.innerHTML = `<div style="color: #94a3b8; font-size: 0.85rem; padding: 1rem 0;">No calls logged yet. Click "Log Another Call" above to record customer contact.</div>`;
        return;
    }

    container.innerHTML = calls.map(c => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-time">${window.formatDateTime(c.created_at)} • Logged by ${escapeHtml(c.caller_name || 'Staff')}</div>
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">
                    [${c.call_type}] Outcome: <span style="text-transform: capitalize; color: #0284c7;">${c.call_outcome.replace(/_/g, ' ')}</span>
                </div>
                ${c.installation_status ? `<div style="font-size: 0.85rem; color: #334155;">Installation Status: <strong>${c.installation_status.replace(/_/g, ' ')}</strong></div>` : ''}
                ${c.guidance_provided ? `<div style="font-size: 0.85rem; color: #475569; margin-top: 0.2rem;">Guidance: ${escapeHtml(c.guidance_provided)}</div>` : ''}
                ${c.remarks ? `<div style="font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; font-style: italic;">Remarks: ${escapeHtml(c.remarks)}</div>` : ''}
            </div>
        </div>
    `).join('');
}

async function handleAddNote(e) {
    e.preventDefault();
    const input = document.getElementById('newNoteInput');
    const noteText = input.value.trim();
    if (!noteText) return;

    try {
        const data = await window.supportFetch(`/cases/${currentCaseId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ note: noteText })
        });

        if (data && data.success) {
            window.showToast('Note added successfully', 'success');
            input.value = '';
            loadCaseDetails();
        } else {
            window.showToast(data.message || 'Failed to add note', 'error');
        }
    } catch (e) {
        window.showToast('Error saving note', 'error');
    }
}

async function handleUploadPhotos(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = [];
    for (let file of files) {
        if (window.validateSupportMediaFile) {
            const check = window.validateSupportMediaFile(file);
            if (!check.ok) {
                window.showToast(check.reason, 'error');
                continue;
            }
        } else if (file.size > 550 * 1024 * 1024) {
            window.showToast(`Skipped "${file.name}": File is too large.`, 'error');
            continue;
        }

        if (window.compressSupportImageIfNeeded && file.type && file.type.startsWith('image/')) {
            try {
                file = await window.compressSupportImageIfNeeded(file);
            } catch (cErr) {
                console.warn('Image compress warn:', cErr);
            }
        }

        validFiles.push(file);
    }

    if (validFiles.length === 0) {
        e.target.value = '';
        return;
    }

    const formData = new FormData();
    validFiles.forEach(file => formData.append('photos', file));

    window.showToast(`Uploading ${validFiles.length} file(s)...`, 'info');

    try {
        const data = await window.supportFetch(`/cases/${currentCaseId}/photos`, {
            method: 'POST',
            body: formData
        });

        if (data && data.success) {
            window.showToast(data.message, 'success');
            loadCaseDetails();
        } else {
            window.showToast(data.message || 'Upload failed', 'error');
        }
    } catch (err) {
        window.showToast('Failed to upload photos', 'error');
    } finally {
        e.target.value = '';
    }
}

function openLightbox(url, isVideo = false) {
    const modal = document.getElementById('photoLightboxModal');
    const img = document.getElementById('lightboxImg');
    const vid = document.getElementById('lightboxVideo');
    const videoMode = Boolean(isVideo) || (window.isSupportVideoFile && window.isSupportVideoFile(url));
    if (videoMode && vid) {
        if (img) { img.style.display = 'none'; img.src = ''; }
        vid.src = url;
        vid.style.display = 'block';
    } else {
        if (vid) { vid.pause(); vid.style.display = 'none'; vid.src = ''; }
        if (img) { img.src = url; img.style.display = 'block'; }
    }
    modal.classList.add('active');
}

function closeCustomerLightbox() {
    const modal = document.getElementById('photoLightboxModal');
    const vid = document.getElementById('lightboxVideo');
    if (vid) { vid.pause(); vid.src = ''; }
    if (modal) modal.classList.remove('active');
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
