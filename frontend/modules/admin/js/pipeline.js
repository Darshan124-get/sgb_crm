/**
 * Sales Pipeline (Kanban Board) Logic
 * SGB Agro CRM
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['admin'])) return;

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
    let allStaff = [];

    // --- initialization ---

    async function init() {
        showLoading();
        await Promise.all([
            fetchStaff(),
            fetchLeads()
        ]);
        renderPipeline();
        updateMetrics();
        bindEvents();
    }

    async function fetchStaff() {
        try {
            const res = await fetch(`${window.API_URL}/users?role=sales`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                allStaff = await res.json();
                populateStaffFilter();
            }
        } catch (err) {
            console.error("Failed to fetch staff:", err);
        }
    }

    async function fetchLeads() {
        try {
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

    function populateStaffFilter() {
        const select = document.getElementById('filter-staff');
        if (!select) return;
        allStaff.forEach(staff => {
            const opt = document.createElement('option');
            opt.value = staff.user_id;
            opt.textContent = staff.name;
            select.appendChild(opt);
        });
    }

    function showLoading() {
        pipelineBoard.innerHTML = `
            <div style="padding: 3rem; text-align: center; width: 100%; color: #64748b;">
                <i class="fas fa-circle-notch fa-spin fa-2x"></i>
                <p style="margin-top: 1rem; font-weight: 600;">Building your pipeline...</p>
            </div>
        `;
    }

    // --- Rendering ---

    function renderPipeline() {
        const searchTerm = document.getElementById('pipeline-search').value.toLowerCase();
        const staffFilter = document.getElementById('filter-staff').value;
        const sourceFilter = document.getElementById('filter-source').value;
        const scoreFilter = document.getElementById('filter-score').value;
        const langFilter = document.getElementById('filter-lang').value;

        // Filter leads
        const filteredLeads = allLeads.filter(lead => {
            const matchesSearch = !searchTerm || 
                (lead.customer_name && lead.customer_name.toLowerCase().includes(searchTerm)) || 
                (lead.phone_number && lead.phone_number.includes(searchTerm));
            const matchesStaff = !staffFilter || lead.assigned_to == staffFilter;
            const matchesSource = !sourceFilter || lead.source === sourceFilter;
            const matchesScore = !scoreFilter || (lead.score || '').toLowerCase() === scoreFilter;
            const matchesLang = !langFilter || lead.language === langFilter;

            return matchesSearch && matchesStaff && matchesSource && matchesScore && matchesLang;
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
                        <span class="card-phone">${lead.phone_number}</span>
                    </div>
                    <span class="score-badge score-${(lead.score || 'COLD').toLowerCase()}">${lead.score || 'COLD'}</span>
                </div>
                
                <div class="card-meta">
                    <span class="status-badge" style="font-size: 0.65rem; padding: 0.2rem 0.5rem;">${lead.language || 'EN'}</span>
                    <span class="status-badge" style="font-size: 0.65rem; padding: 0.2rem 0.5rem;">${lead.source || 'Manual'}</span>
                </div>

                <div class="card-staff">
                    <i class="fas fa-user-tie"></i>
                    ${lead.assigned_to_name || 'Unassigned'}
                </div>

                <div class="card-footer">
                    <div class="followup-indicator ${indicatorClass}">
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
        
        // Stuck = unassigned or in same status for > 3 days (mock logic for now if timestamp available)
        const stuck = allLeads.filter(l => !l.assigned_to).length;

        document.getElementById('stat-total-leads').textContent = total;
        document.getElementById('stat-hot-leads').textContent = hot;
        document.getElementById('stat-conv-rate').textContent = convRate + '%';
        document.getElementById('stat-stuck-leads').textContent = stuck;
    }

    // --- Search & Filters ---

    function bindEvents() {
        document.getElementById('pipeline-search').addEventListener('input', debounce(renderPipeline, 300));
        ['filter-staff', 'filter-source', 'filter-score', 'filter-lang'].forEach(id => {
            document.getElementById(id).addEventListener('change', renderPipeline);
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
            // direct update
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
                renderPipeline();
                updateMetrics();
                window.showAlert("Success", "Lead board updated.", "success");
            }
        } catch (err) {
            console.error("Update failed:", err);
            window.showAlert("Error", "Failed to update lead.", "error");
        }
    }

    // --- Automation Modals ---

    function openFollowupModal(leadId, newStatus) {
        const content = `
            <div style="padding: 1rem;">
                <p>Set a follow-up date for this lead:</p>
                <div class="form-group">
                    <label>Next Follow-up Date</label>
                    <input type="datetime-local" id="pi-followup-date" class="form-group input">
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button id="pi-confirm-followup" class="login-btn" style="margin:0; flex:1;">Save & Move</button>
                    <button onclick="window.hideModal()" class="login-btn btn-outline" style="margin:0; flex:1; background:#f1f5f9; color:#475569;">Cancel</button>
                </div>
            </div>
        `;
        window.showModal({ title: 'Schedule Follow-up', content, hideFooter: true });
        
        document.getElementById('pi-confirm-followup').onclick = async () => {
            const date = document.getElementById('pi-followup-date').value;
            if (!date) return alert("Date is required");
            
            await updateLeadStatus(leadId, newStatus, { next_followup_date: date });
            window.hideModal();
        };
    }

    function openLostReasonModal(leadId, newStatus) {
        const content = `
            <div style="padding: 1rem;">
                <p>Why was this lead lost?</p>
                <div class="form-group">
                    <label>Reason</label>
                    <select id="pi-lost-reason" class="form-group input">
                        <option value="not_interested">Not Interested</option>
                        <option value="price_issue">Price Issue</option>
                        <option value="no_response">No Response</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Additional Notes</label>
                    <textarea id="pi-lost-notes" class="form-group input" style="height: 80px;"></textarea>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button id="pi-confirm-lost" class="login-btn" style="margin:0; flex:1; background: #dc2626;">Confirm Lost</button>
                    <button onclick="window.hideModal()" class="login-btn btn-outline" style="margin:0; flex:1; background:#f1f5f9; color:#475569;">Cancel</button>
                </div>
            </div>
        `;
        window.showModal({ title: 'Lead Lost', content, hideFooter: true });
        
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

// --- Quick Actions ---
window.qaCall = (phone) => {
    window.location.href = `tel:${phone}`;
};

window.qaNote = (leadId) => {
    const content = `
        <div style="padding: 1rem;">
            <div class="form-group">
                <label>Add a quick note</label>
                <textarea id="qa-note-text" class="form-group input" style="height: 100px;"></textarea>
            </div>
            <button id="qa-save-note" class="login-btn" style="margin-top: 1rem;">Save Note</button>
        </div>
    `;
    window.showModal({ title: 'Add Note', content, hideFooter: true });
    
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
                body: JSON.stringify({ note: `[Quick Note] ${note}` })
            });
            if (res.ok) {
                window.hideModal();
                window.showAlert("Success", "Note saved.", "success");
            }
        } catch (err) { console.error(err); }
    };
};
