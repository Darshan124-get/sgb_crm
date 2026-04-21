// ============================================================
// schedule.js — Management & tracking of follow-ups
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initScheduleModule();
});

let currentTab = 'today';
let scheduleData = [];
let staffList = [];

async function initScheduleModule() {
    setupEventListeners();
    await fetchStaffList();
    loadDashboardStats();
    refreshSchedule();
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.p-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.p-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentTab = e.target.getAttribute('data-tab');
            refreshSchedule();
        });
    });

    // Filters
    document.getElementById('filter-date').addEventListener('change', refreshSchedule);
    document.getElementById('filter-status').addEventListener('change', refreshSchedule);
    document.getElementById('filter-staff').addEventListener('change', refreshSchedule);
    
    // Search with debounce
    let searchTimeout;
    document.getElementById('schedule-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => refreshSchedule(), 300);
    });

    // Drawer close
    document.getElementById('closeDrawer').addEventListener('click', closeSideDrawer);
    document.getElementById('drawerOverlay').addEventListener('click', closeSideDrawer);
}

async function fetchStaffList() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${window.API_URL}/users?role=sales`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            staffList = await response.json();
            const staffSelect = document.getElementById('filter-staff');
            staffList.forEach(user => {
                const opt = document.createElement('option');
                opt.value = user.user_id;
                opt.textContent = `${user.name} (${user.language || 'General'})`;
                staffSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error fetching staff:', err);
    }
}

async function loadDashboardStats() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${window.API_URL}/schedules/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('stat-today').textContent = stats.today || 0;
            document.getElementById('stat-overdue').textContent = stats.overdue || 0;
            document.getElementById('stat-upcoming').textContent = stats.upcoming || 0;
            document.getElementById('stat-completed').textContent = stats.completed || 0;
            
            // Tab counter
            document.getElementById('count-overdue').textContent = stats.overdue || 0;
            document.getElementById('count-overdue').style.display = stats.overdue > 0 ? 'inline-block' : 'none';
        }
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

async function refreshSchedule() {
    const tbody = document.getElementById('scheduleTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</td></tr>';

    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
        tab: currentTab,
        dateFilter: document.getElementById('filter-date').value,
        leadStatus: document.getElementById('filter-status').value,
        staffId: document.getElementById('filter-staff').value,
        search: document.getElementById('schedule-search').value
    });

    try {
        const response = await fetch(`${window.API_URL}/schedules?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            scheduleData = await response.json();
            renderTable(scheduleData);
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Failed to fetch schedules.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Network error.</td></tr>';
    }
}

function renderTable(data) {
    const tbody = document.getElementById('scheduleTableBody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No records found for this view.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(item => {
        const dateObj = new Date(item.followup_date);
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = dateObj.toLocaleDateString();
        
        const priorityClass = `score-${(item.lead_score || 'cold').toLowerCase()}`;
        const statusClass = `status-${(item.lead_status || 'new').toLowerCase()}`;

        return `
            <tr class="${currentTab === 'overdue' ? 'row-overdue' : ''}">
                <td class="time-cell">
                    <div class="time-main">${timeStr}</div>
                    <div class="time-sub">${dateStr}</div>
                </td>
                <td class="cust-cell">
                    <div class="cust-name">${item.customer_name || 'Unknown'}</div>
                    <div class="cust-phone">${item.phone_number || '-'}</div>
                </td>
                <td class="status-cell"><span class="status-badge ${statusClass}">${item.lead_status}</span></td>
                <td class="priority-cell"><span class="score-badge ${priorityClass}">${item.lead_score || 'COLD'}</span></td>
                <td>
                    <div class="staff-tag">
                        <div class="staff-avatar">${(item.staff_name || '?').charAt(0)}</div>
                        <span>${item.staff_name || 'Unassigned'}</span>
                    </div>
                </td>
                <td class="interaction-cell">
                    <p class="last-note">${item.remarks || 'No notes available'}</p>
                </td>
                <td style="text-align: right;">
                    <div class="action-btn-group">
                        <button class="btn-icon-premium view" title="View Details" onclick="openLeadDrawer(${item.lead_id})"><i class="fa-solid fa-eye"></i></button>
                        ${item.status === 'pending' ? `
                            <button class="btn-icon-premium call" title="Call Lead" onclick="window.location.href='tel:${item.phone_number}'"><i class="fa-solid fa-phone"></i></button>
                            <button class="btn-icon-premium check" title="Mark Done" onclick="updateFollowupStatus(${item.followup_id}, 'completed')"><i class="fa-solid fa-check"></i></button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ─── Lead Drawer Logic ──────────────────────────────────────────

async function openLeadDrawer(leadId) {
    const drawer = document.getElementById('sideDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const content = document.getElementById('drawerContent');

    drawer.classList.add('active');
    overlay.classList.add('active');
    
    content.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Pulling customer context...</div>';

    const token = localStorage.getItem('token');
    try {
        const [leadRes, notesRes] = await Promise.all([
            fetch(`${window.API_URL}/leads/${leadId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${window.API_URL}/leads/${leadId}/notes`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (leadRes.ok) {
            const lead = await leadRes.json();
            const notes = await notesRes.json();
            renderDrawerContent(lead, notes);
        }
    } catch (err) {
        content.innerHTML = '<div class="error-state">Failed to load lead details.</div>';
    }
}

function renderDrawerContent(lead, notes) {
    const content = document.getElementById('drawerContent');
    content.innerHTML = `
        <div class="drawer-section main-info">
            <div class="drawer-cust-header">
                <div class="large-avatar">${lead.customer_name?.charAt(0) || '?'}</div>
                <div class="cust-meta">
                    <h4>${lead.customer_name || 'Unknown'}</h4>
                    <span class="score-badge score-${(lead.score || 'cold').toLowerCase()}">${lead.score}</span>
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <label>Phone</label>
                    <p>${lead.phone_number}</p>
                </div>
                <div class="info-item">
                    <label>Language</label>
                    <p>${lead.language}</p>
                </div>
                <div class="info-item">
                    <label>Location</label>
                    <p>${lead.city}, ${lead.state}</p>
                </div>
                <div class="info-item">
                    <label>Stage</label>
                    <p><span class="status-badge status-${lead.status}">${lead.status}</span></p>
                </div>
            </div>
        </div>

        <div class="drawer-section controls">
            <label class="premium-label">Quick Actions</label>
            <div class="action-grid">
                <button class="btn btn-primary" onclick="openRescheduleModal(${lead.lead_id})"><i class="fa-solid fa-calendar-plus"></i> Reschedule</button>
                <button class="btn btn-outline" onclick="openReassignModal(${lead.lead_id})"><i class="fa-solid fa-user-pen"></i> Reassign</button>
            </div>
        </div>

        <div class="drawer-section whatsapp">
            <div class="wa-card">
                <div class="wa-header">
                    <i class="fa-brands fa-whatsapp"></i>
                    <span>WhatsApp Integration</span>
                </div>
                <div class="wa-body">
                    <p>Automated reminders are currently ${lead.reminders_enabled ? '<span style="color:#10b981">Active</span>' : '<span style="color:#ef4444">Disabled</span>'}</p>
                    <button id="reminderToggleBtn" class="btn-wa-toggle" onclick="toggleLeadReminders(${lead.lead_id}, ${lead.reminders_enabled})">
                        ${lead.reminders_enabled ? 'Disable' : 'Enable'} Reminders
                    </button>
                </div>
            </div>
        </div>

        <div class="drawer-section timeline">
            <label class="premium-label">Interaction History</label>
            <div class="notes-timeline">
                ${notes.length > 0 ? notes.map(n => `
                    <div class="note-item">
                        <div class="note-time">${new Date(n.created_at).toLocaleString()}</div>
                        <div class="note-text">${n.note}</div>
                        <div class="note-author">— ${n.user_name}</div>
                    </div>
                `).join('') : '<p class="empty-text">No previous interactions recorded.</p>'}
            </div>
        </div>
    `;
}

async function toggleLeadReminders(leadId, currentState) {
    const token = localStorage.getItem('token');
    const newState = !currentState;
    
    // Find the followup_id for this lead in the current view to use the schedule route
    // Or just use the lead_id if I change the route. 
    // Actually, I'll update the route to accept leadId or use the /api/schedules/:id/reminders where id is followupId.
    // Let's find the followupId from the scheduleData.
    const item = scheduleData.find(d => d.lead_id === leadId);
    if (!item) return;

    try {
        const response = await fetch(`${window.API_URL}/schedules/${item.followup_id}/reminders`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled: newState })
        });

        if (response.ok) {
            window.showAlert("Success", `Reminders ${newState ? 'enabled' : 'disabled'}!`, "success");
            // Refresh drawer
            openLeadDrawer(leadId);
        }
    } catch (err) {
        window.showAlert("Error", "Failed to update reminders.", "error");
    }
}

function closeSideDrawer() {
    document.getElementById('sideDrawer').classList.remove('active');
    document.getElementById('drawerOverlay').classList.remove('active');
}

// ─── Post-Refinement Operations ───────────────────────────────

async function updateFollowupStatus(followupId, status) {
    if (!confirm(`Are you sure you want to mark this as ${status}?`)) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${window.API_URL}/schedules/${followupId}/status`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            window.showAlert("Success", "Schedule updated successfully!", "success");
            loadDashboardStats();
            refreshSchedule();
            closeSideDrawer();
        }
    } catch (err) {
        window.showAlert("Error", "Failed to update record.", "error");
    }
}

// Reschedule & Reassign utilize the global modal system from components.js

window.openRescheduleModal = function(leadId) {
    const content = `
        <div style="padding: 1rem;">
            <div class="form-group">
                <label class="premium-label">New Follow-up Date & Time</label>
                <input type="datetime-local" id="new-followup-date" class="form-control-premium" required>
            </div>
            <div class="form-group" style="margin-top: 1rem;">
                <label class="premium-label">Reason for Rescheduling</label>
                <textarea id="reschedule-reason" class="form-control-premium" rows="3" placeholder="e.g. Customer requested callback later..."></textarea>
            </div>
            <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                <button class="btn btn-primary" style="flex:2" onclick="performReschedule(${leadId})">Confirm Reschedule</button>
                <button class="btn btn-outline" style="flex:1" onclick="window.hideModal()">Cancel</button>
            </div>
        </div>
    `;
    window.showModal({ title: 'Reschedule Follow-up', content, hideFooter: true });
};

window.performReschedule = async function(leadId) {
    const newDate = document.getElementById('new-followup-date').value;
    const reason = document.getElementById('reschedule-reason').value;
    if (!newDate) return alert('Please select a date.');

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${window.API_URL}/schedules/${leadId}/reschedule`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ next_followup_date: newDate, reason })
        });
        
        if (response.ok) {
            window.hideModal();
            window.showAlert("Success", "Re-scheduled successfully!", "success");
            loadDashboardStats();
            refreshSchedule();
            closeSideDrawer();
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

window.openReassignModal = function(leadId) {
    const content = `
        <div style="padding: 1rem;">
            <div class="form-group">
                <label class="premium-label">Transfer to Team Member</label>
                <select id="new-staff-select" class="form-control-premium">
                    <option value="">Select Staff...</option>
                    ${staffList.map(u => `<option value="${u.user_id}">${u.name} (${u.language || 'General'})</option>`).join('')}
                </select>
            </div>
            <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                <button class="btn btn-primary" style="flex:2" onclick="performReassign(${leadId})">Confirm Reassignment</button>
                <button class="btn btn-outline" style="flex:1" onclick="window.hideModal()">Cancel</button>
            </div>
        </div>
    `;
    window.showModal({ title: 'Reassign Schedule', content, hideFooter: true });
};

window.performReassign = async function(leadId) {
    const staffId = document.getElementById('new-staff-select').value;
    if (!staffId) return alert('Please select a staff member.');

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${window.API_URL}/schedules/${leadId}/reassign`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ assigned_to: staffId })
        });
        
        if (response.ok) {
            window.hideModal();
            window.showAlert("Success", "Re-assigned successfully!", "success");
            loadDashboardStats();
            refreshSchedule();
            closeSideDrawer();
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
};
