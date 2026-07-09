document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    if (!window.requireAuth(['admin', 'whatsapp_manager'])) return;
    
    const token = localStorage.getItem('token');
    const user = window.getCurrentUser();

    // Sidebar and Profile Name are automatically handled by components.js

    // Elements
    const addCampaignBtn = document.getElementById('addCampaignBtn');
    const refreshDataBtn = document.getElementById('refreshDataBtn');
    const globalModal = document.getElementById('globalModal');
    const campaignTableBody = document.getElementById('campaignTableBody');

    // Load Data
    loadCampaigns();

    // Event Listeners
    if (addCampaignBtn) {
        addCampaignBtn.addEventListener('click', () => openCampaignModal());
    }
    if (refreshDataBtn) {
        refreshDataBtn.addEventListener('click', loadCampaigns);
    }

    // Close Modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === globalModal) {
            closeModal();
        }
    });

    async function loadCampaigns() {
        try {
            const res = await fetch(`${window.API_URL}/campaigns`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch campaigns');
            
            const data = await res.json();
            renderTable(data);
        } catch (error) {
            console.error('Error:', error);
            campaignTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Error loading campaigns</td></tr>`;
        }
    }

    function renderTable(campaigns) {
        if (!campaigns || campaigns.length === 0) {
            campaignTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b;">No campaigns found.</td></tr>`;
            return;
        }

        campaignTableBody.innerHTML = campaigns.map(c => `
            <tr>
                <td style="font-weight: 600; color: #1e293b;">${c.campaign_id}</td>
                <td>${c.tag_line}</td>
                <td style="font-weight: 500;">₹${parseFloat(c.ad_spend || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>
                    <span class="badge badge-${c.status}">
                        ${c.status.toUpperCase()}
                    </span>
                </td>
                <td class="action-btns">
                    <button onclick="window.editCampaign(${c.id}, '${c.campaign_id}', '${c.tag_line.replace(/'/g, "\\'")}', '${c.status}', ${c.ad_spend || 0})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="window.toggleCampaignStatus(${c.id}, '${c.campaign_id}', '${c.tag_line.replace(/'/g, "\\'")}', '${c.status}')" title="${c.status === 'active' ? 'Deactivate' : 'Activate'}">
                        <i class="fas ${c.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                    <button onclick="window.goToCampaignAnalytics(${c.id})" title="Analytics" style="color:#3b82f6;"><i class="fas fa-chart-pie"></i></button>
                </td>
            </tr>
        `).join('');
    }

    function openCampaignModal(campaign = null) {
        const isEdit = !!campaign;
        const title = isEdit ? 'Edit Campaign' : 'Create a Campaign';
        
        const html = `
            <div class="modal-content premium-card" style="max-width: 500px; width: 100%; padding: 2rem;">
                <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
                    <h2 style="font-size:1.5rem; font-weight:800; color:#1e293b; margin:0;">${title}</h2>
                    <span class="close-btn" onclick="window.closeModal()" style="cursor:pointer; font-size:1.5rem; color:#64748b;">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="campaignForm">
                        <input type="hidden" id="c_id" value="${isEdit ? campaign.id : ''}">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="c_campaign_id" style="display:block; margin-bottom:0.5rem; font-weight:600; font-size:0.875rem;">Campaign ID</label>
                            <input type="text" id="c_campaign_id" class="form-control-premium" value="${isEdit ? campaign.campaign_id : ''}" required style="width:100%; padding:0.75rem; border:1px solid #cbd5e1; border-radius:0.5rem;" ${isEdit ? 'readonly' : ''}>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="c_tag_line" style="display:block; margin-bottom:0.5rem; font-weight:600; font-size:0.875rem;">Tag Line / Text</label>
                            <textarea id="c_tag_line" class="form-control-premium" required style="width:100%; padding:0.75rem; border:1px solid #cbd5e1; border-radius:0.5rem; min-height:80px;">${isEdit ? campaign.tag_line : ''}</textarea>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="c_ad_spend" style="display:block; margin-bottom:0.5rem; font-weight:600; font-size:0.875rem;">Ad Spend Amount (₹)</label>
                            <input type="number" step="0.01" id="c_ad_spend" class="form-control-premium" value="${isEdit ? (campaign.ad_spend || 0) : ''}" style="width:100%; padding:0.75rem; border:1px solid #cbd5e1; border-radius:0.5rem;">
                        </div>
                        ${isEdit ? `
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="c_status" style="display:block; margin-bottom:0.5rem; font-weight:600; font-size:0.875rem;">Status</label>
                            <select id="c_status" class="form-control-premium" style="width:100%; padding:0.75rem; border:1px solid #cbd5e1; border-radius:0.5rem;">
                                <option value="active" ${campaign.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="deactive" ${campaign.status === 'deactive' ? 'selected' : ''}>Deactive</option>
                            </select>
                        </div>
                        ` : ''}
                        <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:2rem;">
                            <button type="button" class="btn btn-outline" onclick="window.closeModal()" style="padding:0.75rem 1.5rem; border-radius:0.5rem; border:none; background:#f1f5f9; color:#64748b; font-weight:600; cursor:pointer;">Cancel</button>
                            <button type="submit" class="btn" style="padding:0.75rem 1.5rem; border-radius:0.5rem; border:none; background:var(--primary-color); color:white; font-weight:600; cursor:pointer;">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        globalModal.innerHTML = html;
        globalModal.classList.add('show');

        document.getElementById('campaignForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveCampaign(isEdit);
        });
    }

    window.closeModal = function() {
        globalModal.classList.remove('show');
    };

    window.editCampaign = function(id, campaign_id, tag_line, status, ad_spend) {
        openCampaignModal({ id, campaign_id, tag_line, status, ad_spend });
    };

    window.toggleCampaignStatus = async function(id, campaign_id, tag_line, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'deactive' : 'active';
        if(confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} this campaign?`)) {
            try {
                const res = await fetch(`${window.API_URL}/campaigns/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        campaign_id,
                        tag_line,
                        status: newStatus
                    })
                });
                
                if (res.ok) {
                    loadCampaigns();
                } else {
                    const err = await res.json();
                    alert(err.error || 'Failed to update campaign');
                }
            } catch (error) {
                console.error(error);
                alert('Server error');
            }
        }
    };

    window.goToCampaignAnalytics = function(id) {
        window.location.href = `reports.html?tab=campaign-analytics&campaign_id=${id}`;
    };

    async function saveCampaign(isEdit) {
        const id = document.getElementById('c_id').value;
        const campaign_id = document.getElementById('c_campaign_id').value;
        const tag_line = document.getElementById('c_tag_line').value;
        const ad_spend = parseFloat(document.getElementById('c_ad_spend').value) || 0;
        const status = isEdit ? document.getElementById('c_status').value : 'active';

        const payload = { campaign_id, tag_line, ad_spend, status };
        const url = isEdit ? `${window.API_URL}/campaigns/${id}` : `${window.API_URL}/campaigns`;
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                closeModal();
                loadCampaigns();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to save campaign');
            }
        } catch (error) {
            console.error(error);
            alert('Server error');
        }
    }
});
