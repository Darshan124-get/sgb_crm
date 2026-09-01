document.addEventListener('DOMContentLoaded', () => {
    // 1. Load sidebar using existing components helper
    if (typeof window.loadSidebar === 'function') {
        window.loadSidebar('chatbot');
    }

    // 2. Fetch logged user name
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('profileName').textContent = user.name || 'Admin User';

    // 3. Load flows table
    fetchFlows();

    // 4. Bind search filter
    document.getElementById('flowSearch').addEventListener('keyup', (e) => {
        const query = e.target.value.toLowerCase();
        filterFlows(query);
    });
});

let loadedFlows = [];

// Fetch flows from backend
async function fetchFlows() {
    const token = localStorage.getItem('token');
    const tableBody = document.getElementById('flowsTableBody');
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading chatbot flows...</td></tr>`;

    try {
        const res = await fetch(`${window.API_URL}/chatbot/flows`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load flows');

        loadedFlows = await res.json();
        renderFlows(loadedFlows);
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading flows: ${err.message}</td></tr>`;
    }
}

// Render flow rows in Table
function renderFlows(flows) {
    const tableBody = document.getElementById('flowsTableBody');
    if (flows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No active flows found. Click "+ Create Flow" to start.</td></tr>`;
        return;
    }

    tableBody.innerHTML = flows.map(flow => {
        const keywords = flow.description || 'No description provided';
        const triggerType = flow.triggerType || (flow.category === 'enquiry' ? 'Keyword' : 'Campaign');
        const triggerDesc = (triggerType === 'Campaign' || triggerType === 'Ad Campaign')
            ? 'Ad Campaign Trigger'
            : (triggerType === 'Default' ? 'Default WhatsApp Entry' : 'Keyword Trigger');
        
        let statusBadgeClass = 'status-draft';
        if (flow.status === 'active') statusBadgeClass = 'status-active';
        if (flow.status === 'paused') statusBadgeClass = 'status-paused';

        const updatedDate = new Date(flow.updated_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <tr>
                <td>
                    <div style="font-weight:700; color:var(--secondary-color); font-family:'Outfit', sans-serif;">${escapeHtml(flow.name)}</div>
                    <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(keywords)}</div>
                </td>
                <td>
                    <div><strong>${escapeHtml(triggerDesc)}</strong></div>
                    <div style="font-size:0.75rem; color:#64748b; font-family:monospace;">${escapeHtml(flow.category)}</div>
                </td>
                <td>
                    <span style="font-family:monospace; background:#f1f5f9; padding:0.15rem 0.4rem; border-radius:0.25rem;">
                        ${flow.active_version ? 'v' + flow.active_version : 'No Version'}
                    </span>
                </td>
                <td>
                    <span class="flow-status-badge ${statusBadgeClass}">
                        <i class="fa-solid ${flow.status === 'active' ? 'fa-circle-check' : 'fa-circle-dot'}"></i>
                        ${flow.status}
                    </span>
                </td>
                <td><span style="color:#64748b; font-size:0.8rem;">${updatedDate}</span></td>
                <td>
                    <button class="btn-action" onclick="toggleFlowStatus(${flow.flow_id}, '${flow.status}')" title="${flow.status === 'active' ? 'Deactivate (Switch to Draft)' : 'Activate (Switch to Active)'}">
                        <i class="fa-solid ${flow.status === 'active' ? 'fa-toggle-on' : 'fa-toggle-off'}" style="color: ${flow.status === 'active' ? '#10b981' : '#94a3b8'}; font-size: 1.15rem;"></i>
                    </button>
                    <a href="chatbot.html?flowId=${flow.flow_id}" class="btn-action" title="Open in Flow Builder">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </a>
                    <button class="btn-action" onclick="duplicateFlow(${flow.flow_id})" title="Duplicate Flow">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button class="btn-action btn-danger" onclick="archiveFlow(${flow.flow_id})" title="Archive/Delete Flow">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Search and filtration
function filterFlows(query) {
    const filtered = loadedFlows.filter(flow => 
        flow.name.toLowerCase().includes(query) || 
        (flow.description && flow.description.toLowerCase().includes(query))
    );
    renderFlows(filtered);
}

// Trigger Modal dialog
function openCreateModal() {
    document.getElementById('createModal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
}

// Submit Create Flow request
async function submitCreateFlow() {
    const nameInput = document.getElementById('flowName');
    const name = (nameInput ? nameInput.value : '').trim();
    const description = (document.getElementById('flowDesc') ? document.getElementById('flowDesc').value : '').trim();
    const triggerType = document.getElementById('flowTrigger') ? document.getElementById('flowTrigger').value : 'Default';
    const keywords = (document.getElementById('flowKeywords') ? document.getElementById('flowKeywords').value : '').trim();

    if (!name) {
        alert('Please specify a Flow Name.');
        if (nameInput) nameInput.focus();
        return;
    }

    if (name.length < 2) {
        alert('Flow Name must be at least 2 characters long.');
        if (nameInput) nameInput.focus();
        return;
    }

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${window.API_URL}/chatbot/flows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, description, category: 'enquiry', triggerType, keywords })
        });
        
        if (!res.ok) throw new Error('Failed to create flow');
        const data = await res.json();
        
        // Redirect directly to the newly created Flow Builder Workspace Canvas!
        window.location.href = `chatbot.html?flowId=${data.flow_id}`;
    } catch (err) {
        alert('Error creating flow: ' + err.message);
    }
}

// Duplicate existing flow
async function duplicateFlow(flowId) {
    if (!confirm('Are you sure you want to duplicate this flow?')) return;
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${window.API_URL}/chatbot/flows/${flowId}/duplicate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Duplicate request failed');

        alert('Flow duplicated successfully.');
        fetchFlows();
    } catch (err) {
        alert('Error duplicating flow: ' + err.message);
    }
}

// Archive flow (soft-delete)
async function archiveFlow(flowId) {
    if (!confirm('Are you sure you want to archive this flow? It will be hidden from the active dashboard.')) return;
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${window.API_URL}/chatbot/flows/${flowId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Delete request failed');

        alert('Flow archived.');
        fetchFlows();
    } catch (err) {
        alert('Error archiving flow: ' + err.message);
    }
}

// Toggle flow status (active <-> draft)
async function toggleFlowStatus(flowId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'draft' : 'active';
    const token = localStorage.getItem('token');

    try {
        const res = await fetch(`${window.API_URL}/chatbot/flows/${flowId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('Status update failed');

        fetchFlows();
    } catch (err) {
        alert('Error updating flow status: ' + err.message);
    }
}

// HTML escape helper
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
