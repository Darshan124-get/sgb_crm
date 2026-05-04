document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    if (!window.requireAuth(['admin'])) return;

    const API_URL = window.API_URL;
    const token = localStorage.getItem('token');
    const userModal = document.getElementById('userModal');
    const userForm = document.getElementById('userForm');
    let usersData = [];
    let rolesData = [];

    // 2. Initial Data Load
    await Promise.all([fetchRoles(), fetchUsers()]);

    // 3. Tab Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.color = '#64748b';
                b.style.borderBottom = 'none';
            });
            btn.classList.add('active');
            btn.style.color = '#3b82f6';
            btn.style.borderBottom = '2px solid #3b82f6';
            tabContents.forEach(content => {
                content.style.display = content.id === `tab-${tabId}` ? 'block' : 'none';
            });
            if (tabId === 'roles') renderRolesTab();
        });
    });

    // 4. UI Events
    document.getElementById('btnInvite').addEventListener('click', () => window.openModal());
    document.getElementById('btnCancel').addEventListener('click', () => window.closeModal());
    document.getElementById('userSearch').addEventListener('input', (e) => filterUsers(e.target.value));

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveUser();
    });

    // 5. Global Modal Methods
    window.openModal = function(userId = null) {
        userForm.reset();
        document.getElementById('editUserId').value = userId || '';
        document.getElementById('passGroup').style.display = userId ? 'none' : 'block';
        document.getElementById('modalTitle').textContent = userId ? 'Edit Staff Member' : 'Add New Staff Member';
        
        // Reset multiples select
        const langSelect = document.getElementById('userLang');
        Array.from(langSelect.options).forEach(opt => opt.selected = false);

        if (userId) {
            const u = usersData.find(x => x.user_id === userId);
            if (u) {
                document.getElementById('userName').value = u.name;
                document.getElementById('userEmail').value = u.email;
                document.getElementById('userPhone').value = u.phone || '';
                document.getElementById('userRole').value = rolesData.find(r => r.name.toLowerCase() === u.role_name.toLowerCase())?.role_id || '';
                
                const langs = (u.language || 'EN').split(',');
                Array.from(langSelect.options).forEach(opt => {
                    if (langs.includes(opt.value)) opt.selected = true;
                });
            }
        }

        userModal.style.display = 'flex';
        // Force repaint for animation
        userModal.offsetHeight; 
        userModal.style.opacity = '1';
        userModal.style.pointerEvents = 'auto';
        userModal.querySelector('.premium-card').style.transform = 'translateY(0)';
    };

    window.closeModal = function() {
        userModal.style.opacity = '0';
        userModal.style.pointerEvents = 'none';
        userModal.querySelector('.premium-card').style.transform = 'translateY(20px)';
        setTimeout(() => { userModal.style.display = 'none'; }, 300);
    };

    // 6. Data Methods
    async function fetchRoles() {
        try {
            const res = await fetch(`${API_URL}/users/roles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            rolesData = await res.json();
            const select = document.getElementById('userRole');
            select.innerHTML = rolesData.map(r => `<option value="${r.role_id}">${r.name.toUpperCase()}</option>`).join('');
        } catch (err) { console.error('Roles fetch error:', err); }
    }

    async function fetchUsers() {
        try {
            const res = await fetch(`${API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) { window.doLogout(); return; }
            usersData = await res.json();
            renderTable(usersData);
            updateStats(usersData);
        } catch (err) { console.error('Users fetch error:', err); }
    }

    function renderTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!users.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:#94a3b8;">No staff members found.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => {
            const rate = u.leads_handled > 0 ? Math.round((u.conversions / u.leads_handled) * 100) : 0;
            const performanceColor = rate >= 15 ? '#10b981' : rate >= 5 ? '#3b82f6' : '#94a3b8';
            
            return `
                <tr style="border-bottom:1px solid #f1f5f9;transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding:1.25rem 1.5rem;">
                        <div style="display:flex;align-items:center;gap:0.75rem;">
                            <div style="width:36px;height:36px;border-radius:10px;background:#f1f5f9;color:#3b82f6;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;box-shadow:inset 0 0 0 1px #e2e8f0;">
                                ${(u.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p style="font-weight:700;color:#1e293b;font-size:0.875rem;">${u.name}</p>
                                <p style="font-size:0.75rem;color:#64748b;">${u.email}</p>
                            </div>
                        </div>
                    </td>
                    <td style="padding:1.25rem 1.5rem;">
                        <span style="padding:4px 10px;background:#f1f5f9;color:#475569;border-radius:6px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.02em;">
                            ${u.role_name}
                        </span>
                    </td>
                    <td style="padding:1.25rem 1.5rem;">
                        <div style="display:flex;gap:4px;flex-wrap:wrap;">
                            ${(u.language || 'EN').split(',').map(l => `<span style="font-size:0.75rem;font-weight:700;color:#64748b;background:#f8fafc;padding:2px 6px;border:1px solid #e2e8f0;border-radius:4px;">${l}</span>`).join('')}
                        </div>
                    </td>
                    <td style="padding:1.25rem 1.5rem;">
                        <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:600;color:${u.status === 'active' ? '#10b981' : '#f43f5e'}">
                            <span style="width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px ${u.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)'}"></span>
                            ${u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                        </span>
                    </td>
                    <td style="padding:1.25rem 1.5rem;">
                        <div style="width:100%;max-width:140px;">
                            <div style="display:flex;justify-content:space-between;font-size:0.7rem;font-weight:800;margin-bottom:6px;">
                                <span style="color:#64748b;">CONVERSION</span>
                                <span style="color:${performanceColor}">${rate}%</span>
                            </div>
                            <div style="height:6px;width:100%;background:#f1f5f9;border-radius:10px;overflow:hidden;">
                                <div style="height:100%;width:${rate}%;background:${performanceColor};border-radius:10px;box-shadow:0 0 10px ${performanceColor}33;"></div>
                            </div>
                            <p style="font-size:0.65rem;color:#94a3b8;margin-top:4px;">${u.conversions} closed out of ${u.leads_handled}</p>
                        </div>
                    </td>
                    <td style="padding:1.25rem 1.5rem;">
                        <div style="display:flex;gap:0.75rem;color:#94a3b8;">
                            <i class="fas fa-edit action-icon-btn" onclick="window.editUser(${u.user_id})" title="Edit Profile" style="cursor:pointer;transition:color 0.2s;"></i>
                            <i class="fas fa-key action-icon-btn" onclick="window.resetPass(${u.user_id})" title="Reset Password" style="cursor:pointer;transition:color 0.2s;"></i>
                            <i class="fas fa-trash action-icon-btn" onclick="window.deleteUser(${u.user_id})" title="Delete Staff" style="cursor:pointer;transition:color 0.2s;"></i>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function saveUser() {
        const id = document.getElementById('editUserId').value;
        const langSelect = document.getElementById('userLang');
        const selectedLangs = Array.from(langSelect.selectedOptions).map(opt => opt.value).join(',');
        const password = document.getElementById('userPass').value;

        // Validation
        if (!id && !password) {
            alert('Initial password is required for new staff members.');
            return;
        }

        const payload = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            phone: document.getElementById('userPhone').value,
            role_id: document.getElementById('userRole').value,
            language: selectedLangs || 'EN',
        };

        if (!id) payload.password = password;

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_URL}/users/${id}` : `${API_URL}/users`;

        try {
            const saveBtn = document.querySelector('#userForm button[type="submit"]');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const res = await fetch(url, {
                method,
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                window.closeModal();
                await fetchUsers();
                // Optional: Success toast
                console.log('User saved:', data);
            } else {
                alert(data.message || 'Error saving user. Check if email is already in use.');
            }
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        } catch (e) { 
            alert('Network error - Please check your server connection.');
            console.error('Save error:', e);
        }
    }

    function updateStats(users) {
        document.getElementById('countTotal').textContent = users.length;
        document.getElementById('countActive').textContent = users.filter(u => u.status === 'active').length;
        const totalLeads = users.reduce((sum, u) => sum + (u.leads_handled || 0), 0);
        const totalConv = users.reduce((sum, u) => sum + (u.conversions || 0), 0);
        const avg = totalLeads > 0 ? Math.round((totalConv / totalLeads) * 100) : 0;
        document.getElementById('avgConversion').textContent = `${avg}%`;
        const top = [...users].sort((a,b) => (b.conversions - a.conversions))[0];
        document.getElementById('topPerformer').textContent = top ? top.name : '-';
    }

    function filterUsers(query) {
        const q = query.toLowerCase();
        renderTable(usersData.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
    }

    function renderRolesTab() {
        const rolePerms = {
            'admin': ['Full System Access', 'Role Management', 'Financial Audit', 'Advanced Settings'],
            'sales': ['Lead Pipeline', 'Customer Database', 'Order Management', 'Follow-up Reminders'],
            'billing': ['GST Invoicing', 'Payment Tracking', 'Inventory Valuation', 'Tax Reports'],
            'packing': ['Quality Check', 'Barcode Generation', 'Stock Fulfillment', 'Manifesting'],
            'shipping': ['Courier Integration', 'Live Tracking', 'RTO Management', 'Zone Mapping']
        };
        const rolesList = document.getElementById('rolesList');
        rolesList.innerHTML = rolesData.map(r => `
            <div class="premium-card" style="padding:1.75rem;border-left:4px solid #3b82f6;">
                <h3 style="font-size:1.1rem;font-weight:800;color:#1e293b;margin:0 0 0.5rem 0;">${r.name.toUpperCase()}</h3>
                <p style="font-size:0.875rem;color:#64748b;margin-bottom:1.5rem;">${r.description || 'Access level'}</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
                    ${(rolePerms[r.name.toLowerCase()] || ['Basic Access']).map(p => `<span style="font-size:0.75rem;font-weight:600;padding:4px 12px;background:#f1f5f9;border-radius:20px;color:#475569;"><i class="fas fa-check-circle" style="color:#10b981;margin-right:6px;"></i>${p}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    window.editUser = (id) => window.openModal(id);
    window.deleteUser = async (id) => {
        if (!confirm('Remove this staff member?')) return;
        try {
            const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) await fetchUsers();
        } catch (e) { alert('Delete failed'); }
    };
    window.resetPass = async (id) => {
        const pass = prompt('New password:');
        if (!pass) return;
        try {
            const res = await fetch(`${API_URL}/users/${id}/password`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: pass })
            });
            if (res.ok) alert('Password updated');
        } catch (e) { alert('Update failed'); }
    };
});
