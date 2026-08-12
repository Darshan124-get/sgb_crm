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
    let campaignsList = [];

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
            campaignsList = data;
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
                <td>${c.tag_line || ''}</td>
                <td style="font-weight: 500;">₹${parseFloat(c.ad_spend || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>
                    <span class="badge badge-${c.status}">
                        ${c.status.toUpperCase()}
                    </span>
                </td>
                <td class="action-btns">
                    <button onclick="window.editCampaign(${c.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="window.toggleCampaignStatus(${c.id})" title="${c.status === 'active' ? 'Deactivate' : 'Activate'}">
                        <i class="fas ${c.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                    <button onclick="window.goToCampaignAnalytics(${c.id})" title="Analytics" style="color:#3b82f6;"><i class="fas fa-chart-pie"></i></button>
                    <button onclick="window.deleteCampaign(${c.id})" title="Delete" style="color:#ef4444;"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `).join('');
    }

    function openCampaignModal(campaign = null) {
        const isEdit = !!campaign;
        const title = isEdit ? 'Edit Campaign' : 'Create a Campaign';

        const html = `
            <div class="modal-content premium-card" style="max-width: 800px; width: 100%; padding: 2rem; max-height: 90vh; overflow-y: auto;">
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
                        
                        <div class="form-group" style="margin-bottom: 1rem; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <label style="font-weight:600; font-size:0.875rem;">Auto Replies Sequence</label>
                                <button type="button" class="btn btn-outline" onclick="window.addAutoReplyBlock()" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"><i class="fas fa-plus"></i> Add Reply</button>
                            </div>
                            <div id="autoRepliesContainer" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                <!-- Blocks injected here -->
                            </div>
                        </div>
                        
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

    window.closeModal = function () {
        globalModal.classList.remove('show');
    };

    window.editCampaign = async function (id) {
        const camp = campaignsList.find(c => c.id === id);
        if (!camp) return;

        // Fetch full campaign details to get auto_replies
        let autoReplies = [];
        try {
            const res = await fetch(`${window.API_URL}/campaigns`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const fullCamp = data.find(c => c.id === id);
                if (fullCamp && fullCamp.auto_replies) {
                    autoReplies = typeof fullCamp.auto_replies === 'string' ? JSON.parse(fullCamp.auto_replies) : fullCamp.auto_replies;
                }
            }
        } catch (e) { console.error('Failed to fetch full campaign details for edit'); }

        openCampaignModal({ ...camp, auto_replies: autoReplies });
        renderAutoReplies(autoReplies);
    };

    window.currentAutoReplies = [];

    function renderAutoReplies(replies) {
        window.currentAutoReplies = replies || [];
        drawAutoReplies();
    }

    window.addAutoReplyBlock = function () {
        window.currentAutoReplies.push({ type: 'text', content: '' });
        drawAutoReplies();
    };

    window.removeAutoReply = function (index) {
        window.currentAutoReplies.splice(index, 1);
        drawAutoReplies();
    };

    window.moveAutoReply = function (index, dir) {
        if (dir === -1 && index > 0) {
            const temp = window.currentAutoReplies[index];
            window.currentAutoReplies[index] = window.currentAutoReplies[index - 1];
            window.currentAutoReplies[index - 1] = temp;
        } else if (dir === 1 && index < window.currentAutoReplies.length - 1) {
            const temp = window.currentAutoReplies[index];
            window.currentAutoReplies[index] = window.currentAutoReplies[index + 1];
            window.currentAutoReplies[index + 1] = temp;
        }
        drawAutoReplies();
    };

    window.updateReplyType = function (index, type) {
        window.currentAutoReplies[index].type = type;
        drawAutoReplies();
    }

    function drawAutoReplies() {
        const container = document.getElementById('autoRepliesContainer');
        if (!container) return;

        container.innerHTML = window.currentAutoReplies.map((reply, index) => {
            let inputHtml = '';
            if (reply.type === 'text') {
                inputHtml = `<textarea placeholder="Enter message text" oninput="window.currentAutoReplies[${index}].content = this.value" class="form-control-premium" style="width:100%; padding:0.75rem; border-radius:0.5rem; font-size:0.875rem; min-height:80px; resize:vertical; font-family:inherit; border:1px solid #cbd5e1; outline:none;">${reply.content || ''}</textarea>`;
            } else {
                // Media type
                inputHtml = `
                    <div style="display:flex; flex-direction: column; gap:0.75rem; background:#fff; padding:1rem; border-radius:0.5rem; border:1px dashed #cbd5e1;">
                        <input type="file" accept="${reply.type === 'image' ? 'image/*' : 'video/*'}" onchange="window.handleAutoReplyFile(event, ${index})" style="font-size:0.875rem;">
                        ${reply.url ? `<a href="${reply.url}" target="_blank" style="font-size:0.875rem; color:var(--primary-color); font-weight:500; text-decoration:none;"><i class="fas fa-external-link-alt"></i> View Current Media</a>` : ''}
                        ${reply.mediaData ? `<span style="font-size:0.875rem; color:#10b981; font-weight:500;"><i class="fas fa-check-circle"></i> New file selected</span>` : ''}
                        <input type="text" placeholder="Caption (optional)" oninput="window.currentAutoReplies[${index}].caption = this.value" value="${reply.caption || ''}" class="form-control-premium" style="width:100%; padding:0.75rem; border-radius:0.5rem; font-size:0.875rem; border:1px solid #cbd5e1; outline:none;">
                    </div>
                `;
            }

            return `
            <div style="border: 1px solid #e2e8f0; border-radius: 0.5rem; background: #f8fafc; overflow: hidden; margin-bottom: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <!-- Header of the reply block -->
                <div style="background: #f1f5f9; padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Step ${index + 1}</span>
                        <select onchange="window.updateReplyType(${index}, this.value)" style="padding: 0.25rem 0.5rem; font-size: 0.875rem; border-radius: 0.25rem; border: 1px solid #cbd5e1; outline:none;">
                            <option value="text" ${reply.type === 'text' ? 'selected' : ''}>Text Message</option>
                            <option value="image" ${reply.type === 'image' ? 'selected' : ''}>Image Message</option>
                            <option value="video" ${reply.type === 'video' ? 'selected' : ''}>Video Message</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 0.25rem;">
                        <button type="button" onclick="window.confirmAutoReply(this, ${index})" style="cursor:pointer; background:#fff; border:1px solid #10b981; border-radius:0.25rem; width:28px; height:28px; color:#10b981; display:flex; align-items:center; justify-content:center; margin-left:0.5rem;" title="Confirm Reply"><i class="fas fa-check"></i></button>
                        <button type="button" onclick="window.moveAutoReply(${index}, -1)" ${index === 0 ? 'disabled' : ''} style="cursor:${index === 0 ? 'not-allowed' : 'pointer'}; background:#fff; border:1px solid #e2e8f0; border-radius:0.25rem; width:28px; height:28px; color:${index === 0 ? '#cbd5e1' : '#64748b'}; display:flex; align-items:center; justify-content:center; margin-left:0.5rem;" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                        <button type="button" onclick="window.moveAutoReply(${index}, 1)" ${index === window.currentAutoReplies.length - 1 ? 'disabled' : ''} style="cursor:${index === window.currentAutoReplies.length - 1 ? 'not-allowed' : 'pointer'}; background:#fff; border:1px solid #e2e8f0; border-radius:0.25rem; width:28px; height:28px; color:${index === window.currentAutoReplies.length - 1 ? '#cbd5e1' : '#64748b'}; display:flex; align-items:center; justify-content:center; margin-left:0.25rem;" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                        <button type="button" onclick="window.removeAutoReply(${index})" style="cursor:pointer; background:#fff; border:1px solid #fee2e2; border-radius:0.25rem; width:28px; height:28px; color:#ef4444; display:flex; align-items:center; justify-content:center; margin-left:0.5rem;" title="Delete"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <!-- Body of the reply block -->
                <div style="padding: 1rem;">
                    ${inputHtml}
                </div>
            </div>
            `;
        }).join('');
    }

    window.handleAutoReplyFile = function (event, index) {
        const file = event.target.files[0];
        if (!file) return;

        const MAX_SIZE_MB = 130;
        const maxSizeBytes = MAX_SIZE_MB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            alert(`File is too large. Please upload a file smaller than ${MAX_SIZE_MB} MB.`);
            event.target.value = ''; // Reset file input
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            window.currentAutoReplies[index].mediaData = e.target.result;
            window.currentAutoReplies[index].mimeType = file.type;
            drawAutoReplies();
        };
        reader.readAsDataURL(file);
    };

    window.confirmAutoReply = function (btnEl, index) {
        // Visual feedback only, as state is saved via oninput
        btnEl.style.background = '#10b981';
        btnEl.style.color = '#fff';
        btnEl.innerHTML = '<i class="fas fa-check-double"></i>';
        setTimeout(() => {
            btnEl.style.background = '#fff';
            btnEl.style.color = '#10b981';
            btnEl.innerHTML = '<i class="fas fa-check"></i>';
        }, 1500);
    };

    window.toggleCampaignStatus = async function (id) {
        const camp = campaignsList.find(c => c.id === id);
        if (!camp) return;
        const newStatus = camp.status === 'active' ? 'deactive' : 'active';
        if (confirm(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} this campaign?`)) {
            try {
                const res = await fetch(`${window.API_URL}/campaigns/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        campaign_id: camp.campaign_id,
                        tag_line: camp.tag_line,
                        status: newStatus,
                        ad_spend: camp.ad_spend,
                        auto_replies: typeof camp.auto_replies === 'string' ? JSON.parse(camp.auto_replies) : camp.auto_replies
                    })
                });

                if (res.ok) {
                    loadCampaigns();
                    if (typeof window.showAlert === 'function') {
                        window.showAlert('Success', `Campaign successfully ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
                    } else {
                        alert(`Campaign successfully ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
                    }
                } else {
                    let errMsg = 'Failed to update campaign';
                    try {
                        const err = await res.json();
                        errMsg = err.error || errMsg;
                    } catch (jsonErr) {
                        errMsg = `Server error (Status: ${res.status})`;
                    }
                    if (typeof window.showAlert === 'function') {
                        window.showAlert('Error', errMsg, 'error');
                    } else {
                        alert(errMsg);
                    }
                }
            } catch (error) {
                console.error(error);
                if (typeof window.showAlert === 'function') {
                    window.showAlert('Error', 'Server connection error', 'error');
                } else {
                    alert('Server connection error');
                }
            }
        }
    };

    window.goToCampaignAnalytics = function (id) {
        window.location.href = `reports.html?tab=campaign-analytics&campaign_id=${id}`;
    };

    window.deleteCampaign = async function (id) {
        const camp = campaignsList.find(c => c.id === id);
        if (!camp) return;
        if (confirm(`Are you sure you want to delete campaign "${camp.campaign_id}"?`)) {
            try {
                const res = await fetch(`${window.API_URL}/campaigns/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    loadCampaigns();
                    if (typeof window.showAlert === 'function') {
                        window.showAlert('Success', 'Campaign deleted successfully', 'success');
                    } else {
                        alert('Campaign deleted successfully');
                    }
                } else {
                    let errMsg = 'Failed to delete campaign';
                    try {
                        const err = await res.json();
                        errMsg = err.error || errMsg;
                    } catch (jsonErr) {
                        errMsg = `Server error (Status: ${res.status})`;
                    }
                    if (typeof window.showAlert === 'function') {
                        window.showAlert('Error', errMsg, 'error');
                    } else {
                        alert(errMsg);
                    }
                }
            } catch (error) {
                console.error(error);
                if (typeof window.showAlert === 'function') {
                    window.showAlert('Error', 'Server connection error', 'error');
                } else {
                    alert('Server connection error');
                }
            }
        }
    };

    async function saveCampaign(isEdit) {
        const id = document.getElementById('c_id').value;
        const campaign_id = document.getElementById('c_campaign_id').value;
        const tag_line = document.getElementById('c_tag_line').value;
        const ad_spend = parseFloat(document.getElementById('c_ad_spend').value) || 0;
        const status = isEdit ? document.getElementById('c_status').value : 'active';

        const payload = { campaign_id, tag_line, ad_spend, status, auto_replies: window.currentAutoReplies };
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
                if (typeof window.showAlert === 'function') {
                    window.showAlert('Success', isEdit ? 'Campaign updated successfully!' : 'Campaign created successfully!', 'success');
                } else {
                    alert(isEdit ? 'Campaign updated successfully!' : 'Campaign created successfully!');
                }
            } else {
                let errMsg = 'Failed to save campaign';
                try {
                    const err = await res.json();
                    errMsg = err.error || errMsg;
                } catch (jsonErr) {
                    errMsg = `Server error (Status: ${res.status})`;
                }
                if (typeof window.showAlert === 'function') {
                    window.showAlert('Error', errMsg, 'error');
                } else {
                    alert(errMsg);
                }
            }
        } catch (error) {
            console.error(error);
            if (typeof window.showAlert === 'function') {
                window.showAlert('Error', 'Server connection error', 'error');
            } else {
                alert('Server connection error');
            }
        }
    }
});
