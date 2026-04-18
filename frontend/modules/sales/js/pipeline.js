/**
 * Sales Pipeline (Kanban Board) Logic - Sales View
 * SGB Agro CRM
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['sales', 'admin'])) return;

    // Configuration
    const pipelineStages = [
        { id: 'new', label: 'New Lead', icon: 'fa-star' },
        { id: 'assigned', label: 'Assigned', icon: 'fa-user-check' },
        { id: 'contacted', label: 'Contacted', icon: 'fa-phone-volume' },
        { id: 'followup', label: 'Follow-up', icon: 'fa-calendar-days' },
        { id: 'interested', label: 'Interested', icon: 'fa-thumbs-up' },
        { id: 'negotiation', label: 'Negotiation', icon: 'fa-comments-dollar' },
        { id: 'advance_paid', label: 'Advance Paid', icon: 'fa-receipt' },
        { id: 'converted', label: 'Converted', icon: 'fa-check-double' },
        { id: 'lost', label: 'Lost', icon: 'fa-trash-can' }
    ];

    const pipelineBoard = document.getElementById('pipeline-board');
    const token = localStorage.getItem('token');
    let allLeads = [];

    // --- Initialization ---

    async function init() {
        showLoading();
        // User profile name update
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const profileNameEl = document.getElementById('profileName');
        if (profileNameEl) profileNameEl.textContent = user.name || 'Sales Rep';

        await fetchLeads();
        renderPipeline();
        updateMetrics();
        bindEvents();
    }

    async function fetchLeads() {
        try {
            // Backend automatically filters by assigned_to for sales role
            const res = await fetch(`${window.API_URL}/leads`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                allLeads = await res.json();
            }
        } catch (err) {
            console.error("Failed to fetch leads:", err);
        }
    }

    function showLoading() {
        pipelineBoard.innerHTML = `
            <div style="padding: 3rem; text-align: center; width: 100%; color: #64748b;">
                <i class="fas fa-circle-notch fa-spin fa-2x"></i>
                <p style="margin-top: 1rem; font-weight: 600;">Building your board...</p>
            </div>
        `;
    }

    // --- Rendering ---

    function renderPipeline() {
        const searchTerm = document.getElementById('pipeline-search').value.toLowerCase();
        const sourceFilter = document.getElementById('filter-source').value;
        const scoreFilter = document.getElementById('filter-score').value;
        const langFilter = document.getElementById('filter-lang').value;

        // Filter leads locally (for UI filters)
        const filteredLeads = allLeads.filter(lead => {
            const matchesSearch = !searchTerm || 
                (lead.customer_name && lead.customer_name.toLowerCase().includes(searchTerm)) || 
                (lead.phone_number && lead.phone_number.includes(searchTerm));
            const matchesSource = !sourceFilter || lead.source === sourceFilter;
            const matchesScore = !scoreFilter || (lead.score || '').toLowerCase() === scoreFilter;
            const matchesLang = !langFilter || lead.language === langFilter;

            return matchesSearch && matchesSource && matchesScore && matchesLang;
        });

        pipelineBoard.innerHTML = '';

        pipelineStages.forEach(stage => {
            const stageLeads = filteredLeads.filter(l => l.status === stage.id);
            const column = createColumn(stage, stageLeads);
            pipelineBoard.appendChild(column);
        });

        initDragAndDrop();
    }

    function createColumn(stage, leads) {
        const col = document.createElement('div');
        col.className = 'pipeline-column';
        col.setAttribute('data-id', stage.id);

        col.innerHTML = `
            <div class="column-header">
                <div class="column-title">
                    <i class="fas ${stage.icon}"></i>
                    ${stage.label}
                </div>
                <div class="column-count">${leads.length}</div>
            </div>
            <div class="cards-container" id="container-${stage.id}">
                ${leads.map(lead => createCardHtml(lead)).join('')}
            </div>
        `;
        return col;
    }

    function createCardHtml(lead) {
        const overdue = isOverdue(lead.next_followup_date);
        const isTodayFollowup = isToday(lead.next_followup_date);
        
        let indicatorClass = '';
        let indicatorLabel = '';
        if (lead.next_followup_date) {
            if (overdue) { indicatorClass = 'fi-overdue'; indicatorLabel = 'Overdue'; }
            else if (isTodayFollowup) { indicatorClass = 'fi-today'; indicatorLabel = 'Today'; }
            else { indicatorClass = 'fi-upcoming'; indicatorLabel = 'Upcoming'; }
        }

        return `
            <div class="lead-card" draggable="true" data-id="${lead.lead_id}" id="lead-${lead.lead_id}">
                <div class="card-header">
                    <div>
                        <span class="card-name">${lead.customer_name || 'Unknown'}</span>
                        <span class="card-phone" style="display:block; font-size:0.75rem; color:#64748b; margin-top:2px;">${lead.phone_number}</span>
                    </div>
                    <span class="score-badge score-${(lead.score || 'COLD').toLowerCase()}">${lead.score || 'COLD'}</span>
                </div>
                
                <div class="card-meta">
                    <span class="status-badge" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">${lead.language || 'EN'}</span>
                    <span class="status-badge" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">${lead.source || 'Manual'}</span>
                </div>

                <div class="card-footer" style="padding-top: 0.75rem; border-top: 1px solid #f1f5f9; margin-top: 0.75rem;">
                    <div class="followup-indicator ${indicatorClass}" style="flex:1;">
                        ${indicatorLabel ? `<i class="fas fa-clock"></i> ${indicatorLabel}` : ''}
                    </div>
                    <div class="quick-actions">
                        <button class="qa-btn" title="Call" onclick="window.qaCall('${lead.phone_number}')"><i class="fas fa-phone"></i></button>
                        <button class="qa-btn" title="Details" onclick="window.viewLeadDetails(${lead.lead_id})"><i class="fas fa-eye"></i></button>
                        <button class="qa-btn" title="Add Note" onclick="window.qaNote(${lead.lead_id})"><i class="fas fa-sticky-note"></i></button>
                    </div>
                </div>
            </div>
        `;
    }

    function updateMetrics() {
        const total = allLeads.length;
        const hot = allLeads.filter(l => (l.score || '').toLowerCase() === 'hot').length;
        const converted = allLeads.filter(l => l.status === 'converted').length;
        const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;
        
        const elTotal = document.getElementById('stat-total-leads');
        const elHot = document.getElementById('stat-hot-leads');
        const elConv = document.getElementById('stat-conv-rate');

        if (elTotal) elTotal.textContent = total;
        if (elHot) elHot.textContent = hot;
        if (elConv) elConv.textContent = convRate + '%';
    }

    // --- Search & Filters ---

    function bindEvents() {
        const searchInput = document.getElementById('pipeline-search');
        if (searchInput) searchInput.addEventListener('input', debounce(renderPipeline, 300));
        
        ['filter-source', 'filter-score', 'filter-lang'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', renderPipeline);
        });
    }

    // --- Drag & Drop ---

    function initDragAndDrop() {
        const cards = document.querySelectorAll('.lead-card');
        const columns = document.querySelectorAll('.pipeline-column');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
            });
        });

        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                const leadId = e.dataTransfer.getData('text/plain');
                const newStatus = column.getAttribute('data-id');
                
                await handleLeadMove(leadId, newStatus);
            });
        });
    }

    async function handleLeadMove(leadId, newStatus) {
        const lead = allLeads.find(l => l.lead_id == leadId);
        if (!lead || lead.status === newStatus) return;

        // Automation Triggers
        if (newStatus === 'followup') {
            openFollowupModal(leadId, newStatus);
        } else if (newStatus === 'lost') {
            openLostReasonModal(leadId, newStatus);
        } else if (newStatus === 'converted') {
            // Trigger existing conversion wizard
            window.currentViewingLeadId = leadId;
            if (typeof window.handleLeadConversionModal === 'function') {
                window.handleLeadConversionModal();
            } else {
                updateLeadStatus(leadId, newStatus);
            }
        } else {
            await updateLeadStatus(leadId, newStatus);
        }
    }

    async function updateLeadStatus(leadId, status, additionalData = {}) {
        try {
            const lead = allLeads.find(l => l.lead_id == leadId);
            const payload = {
                ...lead,
                status: status,
                ...additionalData
            };

            const res = await fetch(`${window.API_URL}/leads/${leadId}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                // Log activity
                await fetch(`${window.API_URL}/leads/${leadId}/notes`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ note: `[Pipeline] Lead moved to ${status}.` })
                });

                // Update local state
                lead.status = status;
                Object.assign(lead, additionalData);
                renderPipeline();
                updateMetrics();
                if (window.showAlert) window.showAlert("Success", "Pipeline updated.", "success");
            }
        } catch (err) {
            console.error("Update failed:", err);
            if (window.showAlert) window.showAlert("Error", "Failed to update status.", "error");
        }
    }

    // --- Automation Modals ---

    function openFollowupModal(leadId, newStatus) {
        const content = `
            <div style="padding: 1rem;">
                <p>Schedule your next follow-up call:</p>
                <div class="form-group" style="margin-top:1rem;">
                    <label>Date & Time</label>
                    <input type="datetime-local" id="pi-followup-date" class="form-control-premium" style="width:100%;">
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button id="pi-confirm-followup" class="login-btn" style="margin:0; flex:1;">Schedule & Move</button>
                    <button onclick="window.hideModal()" class="login-btn btn-outline" style="margin:0; flex:1;">Cancel</button>
                </div>
            </div>
        `;
        window.showModal({ title: 'Next Follow-up', content, hideFooter: true });
        
        document.getElementById('pi-confirm-followup').onclick = async () => {
            const date = document.getElementById('pi-followup-date').value;
            if (!date) return alert("Please select a date.");
            
            await updateLeadStatus(leadId, newStatus, { next_followup_date: date });
            window.hideModal();
        };
    }

    function openLostReasonModal(leadId, newStatus) {
        const content = `
            <div style="padding: 1rem;">
                <p>Please specify why the lead was lost:</p>
                <div class="form-group" style="margin-top:1.5rem;">
                    <label>Reason</label>
                    <select id="pi-lost-reason" class="form-control-premium" style="width:100%;">
                        <option value="not_interested">Not Interested</option>
                        <option value="high_price">Price too high</option>
                        <option value="competitor">Bought from competitor</option>
                        <option value="wrong_number">Invalid contact</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group" style="margin-top:1rem;">
                    <label>Notes</label>
                    <textarea id="pi-lost-notes" class="form-control-premium" style="height: 80px; width:100%;"></textarea>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button id="pi-confirm-lost" class="login-btn" style="margin:0; flex:1; background: #dc2626;">Mark as Lost</button>
                    <button onclick="window.hideModal()" class="login-btn btn-outline" style="margin:0; flex:1;">Cancel</button>
                </div>
            </div>
        `;
        window.showModal({ title: 'Lost Lead Details', content, hideFooter: true });
        
        document.getElementById('pi-confirm-lost').onclick = async () => {
            const reason = document.getElementById('pi-lost-reason').value;
            const notes = document.getElementById('pi-lost-notes').value;
            
            await updateLeadStatus(leadId, newStatus, { lost_reason: reason, lost_notes: notes });
            window.hideModal();
        };
    }

    // --- Helpers ---

    function isOverdue(date) {
        if (!date) return false;
        return new Date(date) < new Date();
    }

    function isToday(date) {
        if (!date) return false;
        const d = new Date(date);
        const today = new Date();
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    init();
});

// --- Quick Actions (Shared with Admin) ---
window.qaCall = (phone) => {
    window.location.href = `tel:${phone}`;
};

window.qaNote = (leadId) => {
    const content = `
        <div style="padding: 1rem;">
            <div class="form-group">
                <label>Write a quick summary of your call</label>
                <textarea id="qa-note-text" class="form-control-premium" style="height: 120px; width:100%;"></textarea>
            </div>
            <button id="qa-save-note" class="login-btn" style="margin-top: 1.5rem; width:100%;">Add Note</button>
        </div>
    `;
    window.showModal({ title: 'Quick Interaction Note', content, hideFooter: true });
    
    document.getElementById('qa-save-note').onclick = async () => {
        const note = document.getElementById('qa-note-text').value;
        if (!note) return;
        
        try {
            const res = await fetch(`${window.API_URL}/leads/${leadId}/notes`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ note: `[Sales Note] ${note}` })
            });
            if (res.ok) {
                window.hideModal();
                if (window.showAlert) window.showAlert("Success", "Note recorded.", "success");
            }
        } catch (err) { console.error(err); }
    };
};
