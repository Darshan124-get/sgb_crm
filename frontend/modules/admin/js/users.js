// users.js - PBAC Organization Management for Super Admin

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['admin', 'super-admin'])) return;

    const currentUser = window.getCurrentUser();
    const currentRole = (currentUser.role || '').toLowerCase();

    // Only super-admin can see Admin & Manager Creation tab
    if (currentRole !== 'super-admin') {
        const adminTabBtn = document.querySelector('.settings-nav-item[data-tab="admins"]');
        if (adminTabBtn) adminTabBtn.style.display = 'none';
    }

    if (currentRole !== 'super-admin' && currentRole !== 'admin') {
        const deptTabBtn = document.querySelector('.settings-nav-item[data-tab="departments"]');
        if (deptTabBtn) deptTabBtn.style.display = 'none';
        
        // Auto-switch to users tab for managers
        const usersTabBtn = document.querySelector('.settings-nav-item[data-tab="users"]');
        if (usersTabBtn) {
            setTimeout(() => usersTabBtn.click(), 50); // Click after listeners are attached
        }
    }

    // Tab Navigation Logic
    const tabBtns = document.querySelectorAll('.settings-nav-item');
    const tabSections = document.querySelectorAll('.tab-section');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-tab');
            
            // Prevent non-super-admins from accessing the admins tab
            if (targetTab === 'admins' && currentRole !== 'super-admin') {
                return;
            }

            // Ensure inner sidebar is visible for main tabs
            const innerSidebar = document.querySelector('.settings-sidebar');
            if (innerSidebar) innerSidebar.style.display = 'block';

            // Update Active State on Buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Show Target Tab Content
            tabSections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(`tab-${targetTab}`).classList.add('active');

            if (targetTab === 'departments') {
                fetchDepartments();
            } else if (targetTab === 'admins') {
                fetchAdmins();
            } else if (targetTab === 'users') {
                fetchAllPbacUsers();
            }
        });
    });

    // User Filter Event Listeners
    const userSearchInput = document.getElementById('userSearch');
    const userFilterDeptSelect = document.getElementById('userFilterDept');
    const userFilterRoleSelect = document.getElementById('userFilterRole');
    const userFilterStatusSelect = document.getElementById('userFilterStatus');

    if (userSearchInput) userSearchInput.addEventListener('input', applyUserFilters);
    if (userFilterDeptSelect) userFilterDeptSelect.addEventListener('change', applyUserFilters);
    if (userFilterRoleSelect) userFilterRoleSelect.addEventListener('change', applyUserFilters);
    if (userFilterStatusSelect) userFilterStatusSelect.addEventListener('change', applyUserFilters);

    // ==========================================
    // DEPARTMENTS LOGIC
    // ==========================================
    // DOM Elements & State
    const deptTbody = document.getElementById('departmentTableBody');
    const deptModal = document.getElementById('departmentModal');
    const deptForm = document.getElementById('departmentForm');
    const deptCountText = document.getElementById('deptCountText');
    const managerSelect = document.getElementById('deptManager');

    const adminModal = document.getElementById('adminModal');
    const adminForm = document.getElementById('adminForm');
    const roleSelect = document.getElementById('adminRole');
    const departmentSelect = document.getElementById('adminDepartment');

    let allDepartments = [];
    let allUsers = [];
    let pbacUsersList = [];
    let allRoles = [];

    // Modal Listeners
    document.getElementById('btnCreateDepartment').addEventListener('click', () => openDeptModal());
    document.getElementById('btnCloseDeptModal').addEventListener('click', closeDeptModal);
    document.getElementById('btnCancelDeptModal').addEventListener('click', closeDeptModal);
    deptForm.addEventListener('submit', handleSaveDepartment);

    document.getElementById('btnCreateAdmin').addEventListener('click', () => openAdminModal());
    document.getElementById('btnCloseAdminModal').addEventListener('click', closeAdminModal);
    document.getElementById('btnCancelAdminModal').addEventListener('click', closeAdminModal);
    adminForm.addEventListener('submit', handleSaveAdmin);

    // Initialize first tab
    await fetchUsers();
    await fetchDepartments();
    await fetchRoles();

    async function fetchUsers() {
        try {
            const res = await fetch(`${window.API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            
            const usersList = Array.isArray(data) ? data : (data.users || []);
            if (res.ok) {
                allUsers = usersList;
                populateManagerDropdown();
            }
        } catch (e) {
            console.error('Failed to fetch users:', e);
        }
    }

    function populateManagerDropdown() {
        managerSelect.innerHTML = '<option value="">-- Select Manager --</option>';
        
        // Filter users to only those with a manager role
        const managerUsers = allUsers.filter(u => u.role_name && u.role_name.toLowerCase().includes('manager'));
        
        managerUsers.forEach(u => {
            const option = document.createElement('option');
            option.value = u.user_id;
            option.textContent = `${u.name} (${u.email})`;
            managerSelect.appendChild(option);
        });
    }

    async function fetchDepartments() {
        try {
            const res = await fetch(`${window.API_URL}/departments`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                allDepartments = data.departments;
                renderDeptTable();
                populateUserFilterDropdowns();
            } else {
                window.showAlert('Error', data.message || 'Failed to load departments', 'error');
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    function renderDeptTable() {
        deptTbody.innerHTML = '';
        if (allDepartments.length === 0) {
            deptTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#64748b;">No departments found.</td></tr>';
            deptCountText.textContent = `Showing 0 entries`;
            return;
        }

        allDepartments.forEach(dept => {
            const tr = document.createElement('tr');
            const dateStr = new Date(dept.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const badgeClass = dept.status === 'active' ? 'active' : 'inactive';
            const badgeText = dept.status === 'active' ? 'Active' : 'Inactive';

            tr.innerHTML = `
                <td>
                    <div style="display:flex;align-items:center;gap:0.75rem;">
                        <i class="fas fa-briefcase" style="color:#3b82f6;"></i>
                        <span style="font-weight:600;">${dept.name}</span>
                    </div>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        ${dept.manager_name ? `<div class="avatar" style="width:24px;height:24px;font-size:0.7rem;"><i class="fas fa-user"></i></div> <span>${dept.manager_name}</span>` : '<span style="color:#94a3b8;">Unassigned</span>'}
                    </div>
                </td>
                <td style="font-weight:600;color:#475569;">${dept.total_users || 0}</td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td>${dateStr}</td>
                <td>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn-edit" data-id="${dept.id}" style="background:none;border:none;color:#3b82f6;cursor:pointer;padding:0.25rem;"><i class="fas fa-edit"></i></button>
                        <button class="btn-delete" data-id="${dept.id}" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:0.25rem;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            `;
            deptTbody.appendChild(tr);
        });

        deptCountText.textContent = `Showing 1 to ${allDepartments.length} of ${allDepartments.length} entries`;

        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const dept = allDepartments.find(d => d.id == id);
                if (dept) openDeptModal(dept);
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                deleteDepartment(id);
            });
        });
    }

    function openDeptModal(dept = null) {
        if (dept) {
            document.getElementById('deptModalTitle').textContent = 'Edit Department';
            document.getElementById('deptId').value = dept.id;
            document.getElementById('deptName').value = dept.name;
            document.getElementById('deptCode').value = dept.department_code || '';
            document.getElementById('deptDesc').value = dept.description || '';
            document.getElementById('deptStatus').value = dept.status || 'active';
            document.getElementById('deptManager').value = dept.manager_id || '';
        } else {
            document.getElementById('deptModalTitle').textContent = 'Create Department';
            deptForm.reset();
            document.getElementById('deptId').value = '';
        }
        deptModal.classList.add('active');
    }

    function closeDeptModal() {
        deptModal.classList.remove('active');
    }

    async function handleSaveDepartment(e) {
        e.preventDefault();
        
        const id = document.getElementById('deptId').value;
        const payload = {
            name: document.getElementById('deptName').value,
            department_code: document.getElementById('deptCode').value,
            description: document.getElementById('deptDesc').value,
            status: document.getElementById('deptStatus').value,
            manager_id: document.getElementById('deptManager').value || null
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${window.API_URL}/departments/${id}` : `${window.API_URL}/departments`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                window.showAlert('Success', `Department successfully ${id ? 'updated' : 'created'}`, 'success');
                closeDeptModal();
                fetchDepartments();
            } else {
                window.showAlert('Error', data.message || 'Failed to save department', 'error');
            }
        } catch (error) {
            console.error('Error saving department:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    async function deleteDepartment(id) {
        if (!confirm('Are you sure you want to delete this department? Users belonging to it might lose access.')) return;

        try {
            const res = await fetch(`${window.API_URL}/departments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                window.showAlert('Success', 'Department deleted', 'success');
                fetchDepartments();
            } else {
                window.showAlert('Error', data.message || 'Failed to delete department', 'error');
            }
        } catch (error) {
            console.error('Error deleting department:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    // ==========================================
    // ADMINS & MANAGERS LOGIC
    // ==========================================
    
    async function fetchRoles() {
        try {
            const res = await fetch(`${window.API_URL}/users/roles`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            
            // The API might return an array directly or an object { success: true, roles: [...] }
            allRoles = Array.isArray(data) ? data : (data.roles || []);
            
            if (allRoles.length > 0) {
                roleSelect.innerHTML = '<option value="">-- Select Role --</option>';
                
                // Only allow Admin and Manager for this form
                const adminRole = allRoles.find(r => r.name.toLowerCase() === 'admin');
                const managerRole = allRoles.find(r => r.name.toLowerCase() === 'manager') || { role_id: 'manager', name: 'Manager' }; // Fallback if 'manager' role doesn't exist yet
                
                if (adminRole) {
                    const optAdmin = document.createElement('option');
                    optAdmin.value = adminRole.role_id;
                    optAdmin.textContent = 'Admin';
                    roleSelect.appendChild(optAdmin);
                }
                
                const optManager = document.createElement('option');
                optManager.value = managerRole.role_id;
                optManager.textContent = 'Manager';
                roleSelect.appendChild(optManager);
            }
            
            renderRolesTable();
            populateUserFilterDropdowns();
            
        } catch (e) {
            console.error('Failed to fetch roles:', e);
        }
    }

    function renderRolesTable() {
        const tbody = document.getElementById('roleTableBody');
        if (!tbody) return; // In case the tab isn't added yet

        if (!allRoles || allRoles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;">No roles found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        allRoles.forEach(role => {
            // Placeholder values for permissions and users counts since we don't fetch them currently
            const permissionsCount = Math.floor(Math.random() * 50) + 10; // Mock data
            const usersCount = allUsers ? allUsers.filter(u => u.role_id === role.role_id).length : 0; // Actual data based on fetched users, if available

            const statusBadge = role.status === 'inactive' 
                ? '<span style="background:#fef2f2;color:#ef4444;padding:0.15rem 0.5rem;border-radius:12px;font-size:0.7rem;font-weight:600;margin-left:0.5rem;">Inactive</span>'
                : '<span style="background:#f0fdf4;color:#22c55e;padding:0.15rem 0.5rem;border-radius:12px;font-size:0.7rem;font-weight:600;margin-left:0.5rem;">Active</span>';

            const isSystemRole = role.name.toLowerCase() === 'admin' || role.name.toLowerCase() === 'super-admin';
            const actionHtml = isSystemRole 
                ? `<span style="color:#94a3b8;font-size:0.8rem;padding-right:0.5rem;"><i class="fas fa-lock"></i> System</span>`
                : `<button class="btn-edit-role" data-id="${role.role_id}" style="background:none;border:none;color:#3b82f6;cursor:pointer;padding:0.25rem;margin-right:0.5rem;"><i class="fas fa-edit"></i></button>
                   <button class="btn-delete-role" data-id="${role.role_id}" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:0.25rem;"><i class="fas fa-trash"></i></button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><div style="font-weight:600;display:flex;align-items:center;">${role.name.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ${statusBadge}</div></td>
                <td style="color:#64748b; font-size:0.875rem;">${role.description || 'No description provided'}</td>
                <td style="text-align:center;"><span style="background:#f1f5f9; color:#475569; padding:0.2rem 0.5rem; border-radius:12px; font-size:0.75rem; font-weight:700;">${permissionsCount}</span></td>
                <td style="text-align:center;">${usersCount}</td>
                <td style="text-align:right;">
                    ${actionHtml}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners for edit/delete
        document.querySelectorAll('.btn-edit-role').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const role = allRoles.find(r => r.role_id == id);
                if (role) openRoleModal(role);
            });
        });

        document.querySelectorAll('.btn-delete-role').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                handleDeleteRole(id);
            });
        });
    }

    function openRoleModal(role = null) {
        if (role) {
            document.getElementById('roleModalTitle').textContent = 'Edit Role';
            document.getElementById('roleId').value = role.role_id;
            document.getElementById('roleName').value = role.name;
            document.getElementById('roleDescription').value = role.description || '';
            document.getElementById('roleStatus').value = role.status || 'active';
        } else {
            document.getElementById('roleModalTitle').textContent = 'Create Role';
            roleForm.reset();
            document.getElementById('roleId').value = '';
            document.getElementById('roleStatus').value = 'active';
        }
        roleModal.classList.add('active');
    }

    function closeRoleModal() {
        roleModal.classList.remove('active');
    }

    async function handleSaveRole(e) {
        e.preventDefault();
        
        const id = document.getElementById('roleId').value;
        const payload = {
            name: document.getElementById('roleName').value,
            description: document.getElementById('roleDescription').value,
            status: document.getElementById('roleStatus').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${window.API_URL}/users/roles/${id}` : `${window.API_URL}/users/roles`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success || res.ok) {
                window.showAlert('Success', data.message || `Role successfully ${id ? 'updated' : 'created'}`, 'success');
                closeRoleModal();
                fetchRoles(); // Refresh the roles list
            } else {
                window.showAlert('Error', data.message || 'Failed to save role', 'error');
            }
        } catch (error) {
            console.error('Error saving role:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    async function handleDeleteRole(id) {
        if (!confirm('Are you sure you want to delete this role?')) return;

        try {
            const res = await fetch(`${window.API_URL}/users/roles/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success || res.ok) {
                window.showAlert('Success', 'Role deleted', 'success');
                fetchRoles();
            } else {
                window.showAlert('Error', data.message || 'Failed to delete role', 'error');
            }
        } catch (error) {
            console.error('Error deleting role:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    // Toggle Department Assignment visibility based on Role
    const departmentGroup = document.getElementById('adminDepartment').closest('.form-group');
    
    roleSelect.addEventListener('change', (e) => {
        const selectedText = e.target.options[e.target.selectedIndex]?.text;
        if (selectedText === 'Manager') {
            departmentGroup.style.display = 'flex';
            document.getElementById('adminDepartment').required = true;
        } else {
            departmentGroup.style.display = 'none';
            document.getElementById('adminDepartment').value = '';
            document.getElementById('adminDepartment').required = false;
        }
    });

    function populateAdminDepartments() {
        departmentSelect.innerHTML = '<option value="">-- Select Department --</option>';
        allDepartments.forEach(d => {
            const option = document.createElement('option');
            option.value = d.id;
            option.textContent = d.name;
            departmentSelect.appendChild(option);
        });
    }

    async function openAdminModal(admin = null) {
        if (allRoles.length === 0) await fetchRoles();
        populateAdminDepartments();
        
        // Hide department by default
        departmentGroup.style.display = 'none';

        if (admin) {
            document.getElementById('adminModalTitle').textContent = 'Edit Admin / Manager';
            document.getElementById('adminId').value = admin.user_id;
            document.getElementById('adminName').value = admin.name;
            document.getElementById('adminEmail').value = admin.email;
            document.getElementById('adminPhone').value = admin.phone || '';
            document.getElementById('adminPassword').required = false;
            document.getElementById('adminPassAsterisk').style.display = 'none';
            
            // Set role and trigger change event to show/hide department
            document.getElementById('adminRole').value = admin.role_id || '';
            const event = new Event('change');
            document.getElementById('adminRole').dispatchEvent(event);
            
            document.getElementById('adminDepartment').value = admin.department_id || '';
        } else {
            document.getElementById('adminModalTitle').textContent = 'Create Admin / Manager';
            adminForm.reset();
            document.getElementById('adminId').value = '';
            document.getElementById('adminPassword').required = true;
            document.getElementById('adminPassAsterisk').style.display = 'inline';
        }
        adminModal.classList.add('active');
    }

    function closeAdminModal() {
        adminModal.classList.remove('active');
    }

    async function handleSaveAdmin(e) {
        e.preventDefault();
        
        const id = document.getElementById('adminId').value;
        const payload = {
            name: document.getElementById('adminName').value,
            email: document.getElementById('adminEmail').value,
            phone: document.getElementById('adminPhone').value,
            role_id: document.getElementById('adminRole').value,
            department_id: document.getElementById('adminDepartment').value || null
        };
        
        const pwd = document.getElementById('adminPassword').value;
        if (pwd) payload.password = pwd;

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${window.API_URL}/users/${id}` : `${window.API_URL}/users`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success || res.ok) {
                window.showAlert('Success', data.message || `User successfully ${id ? 'updated' : 'created'}`, 'success');
                closeAdminModal();
                fetchAdmins();
                fetchUsers(); // refresh manager list
            } else {
                window.showAlert('Error', data.message || 'Failed to save user', 'error');
            }
        } catch (error) {
            console.error('Error saving admin:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    async function fetchAdmins() {
        const adminTbody = document.getElementById('adminTableBody');
        adminTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;">Fetching admins...</td></tr>';
        
        try {
            const res = await fetch(`${window.API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            
            const usersList = Array.isArray(data) ? data : (data.users || []);
            
            if (res.ok) {
                adminTbody.innerHTML = '';
                // Filter to show admins, super-admins, or people assigned to departments
                const filteredUsers = usersList.filter(u => u.role_name === 'admin' || u.role_name === 'super-admin' || u.role_name?.includes('manager'));

                if(filteredUsers.length === 0) {
                     adminTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;">No admins or managers found.</td></tr>';
                     return;
                }

                const currentUser = window.getCurrentUser() || { role: 'admin' };

                filteredUsers.forEach(admin => {
                    const isSystemAdmin = admin.role_name === 'admin' || admin.role_name === 'super-admin';
                    const canEdit = currentUser.role === 'super-admin' || currentUser.id == admin.user_id || (!isSystemAdmin && currentUser.role === 'admin');
                    
                    const actionHtml = canEdit 
                        ? `<button class="btn-edit-admin" data-id="${admin.user_id}" style="background:none;border:none;color:#3b82f6;cursor:pointer;padding:0.25rem;"><i class="fas fa-edit"></i></button>`
                        : `<span style="color:#94a3b8;font-size:0.8rem;"><i class="fas fa-lock"></i> Restricted</span>`;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><div style="font-weight:600;">${admin.name}</div></td>
                        <td>${admin.email}</td>
                        <td><span style="background:#e0e7ff;color:#3730a3;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.75rem;font-weight:700;text-transform:capitalize;">${admin.role_name?.replace(/-/g, ' ').replace(/_/g, ' ') || 'No Role'}</span></td>
                        <td><span class="status-badge ${admin.status === 'active' ? 'active' : 'inactive'}">${admin.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                        <td>
                            ${actionHtml}
                        </td>
                    `;
                    adminTbody.appendChild(tr);
                });

                document.querySelectorAll('.btn-edit-admin').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        const admin = usersList.find(u => u.user_id == id);
                        if (admin) openAdminModal(admin);
                    });
                });
            }
        } catch (e) {
            console.error(e);
            adminTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:red;">Error loading admins</td></tr>';
        }
    }

    // ==========================================
    // PBAC USERS LOGIC (WIZARD & PERMISSIONS)
    // ==========================================
    const PERMISSION_SCHEMA = {
        'Sales': ['Lead Management', 'Sales Pipeline', 'Schedules', 'Orders', 'Dealers', 'Inventory', 'Campaigns'],
        'Billing': ['Billing'],
        'Shipping': ['Shipping'],
        'Packing': ['Packing'],
        'WhatsApp': ['WhatsApp Chats']
    };

    let selectedPermissions = [];
    let wizardCurrentStep = 1;
    let selectedCategory = 'Sales'; // Default category

    const userWizardModal = document.getElementById('userWizardModal');
    const wizardForm = document.getElementById('userWizardForm');
    const btnWizardNext = document.getElementById('btnWizardNext');
    const btnWizardBack = document.getElementById('btnWizardBack');
    const btnWizardCancel = document.getElementById('btnWizardCancel');
    const btnWizardSubmit = document.getElementById('btnWizardSubmit');

    document.getElementById('btnCreateUser').addEventListener('click', () => openUserWizard());
    document.getElementById('btnCloseUserModal').addEventListener('click', closeUserWizard);
    btnWizardCancel.addEventListener('click', closeUserWizard);

    btnWizardNext.addEventListener('click', handleWizardNext);
    btnWizardBack.addEventListener('click', handleWizardBack);
    wizardForm.addEventListener('submit', handleWizardSubmit);

    document.getElementById('wizardRole').addEventListener('change', (e) => {
        const roleSelect = e.target;
        if(roleSelect.selectedIndex === -1) return;
        const text = roleSelect.options[roleSelect.selectedIndex].text.toLowerCase();
        const langGroup = document.getElementById('languageSelectionGroup');
        if (langGroup) {
            langGroup.style.display = text.includes('telecaller') ? 'block' : 'none';
        }
    });

    // The listener for users tab is now handled in the main tab navigation block.

    async function fetchAllPbacUsers() {
        const tbody = document.getElementById('userTableBody');
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Fetching users...</td></tr>';
        
        try {
            const res = await fetch(`${window.API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            const usersList = Array.isArray(data) ? data : (data.users || []);
            
            if (res.ok) {
                pbacUsersList = usersList;
                applyUserFilters();
            } else {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:red;">Error loading users</td></tr>';
            }
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:red;">Error loading users</td></tr>';
        }
    }

    function populateUserFilterDropdowns() {
        const deptSelect = document.getElementById('userFilterDept');
        const roleSelect = document.getElementById('userFilterRole');

        if (deptSelect) {
            const currentValue = deptSelect.value;
            deptSelect.innerHTML = '<option value="">All Departments</option>';
            allDepartments.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = d.name;
                deptSelect.appendChild(opt);
            });
            if (currentValue && allDepartments.some(d => d.id == currentValue)) {
                deptSelect.value = currentValue;
            }
        }

        if (roleSelect) {
            const currentValue = roleSelect.value;
            roleSelect.innerHTML = '<option value="">All Roles</option>';
            const rolesToExclude = ['billing_manager', 'shipping', 'shipping_manager', 'viewer', 'whatsapp_manager'];
            allRoles.forEach(r => {
                if (rolesToExclude.includes(r.name.toLowerCase())) return;
                const opt = document.createElement('option');
                opt.value = r.role_id;
                const formattedName = r.name.replace(/[-_]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                opt.textContent = formattedName;
                roleSelect.appendChild(opt);
            });
            if (currentValue && allRoles.some(r => r.role_id == currentValue)) {
                roleSelect.value = currentValue;
            }
        }
    }

    function applyUserFilters() {
        const query = (document.getElementById('userSearch')?.value || '').toLowerCase().trim();
        const deptId = document.getElementById('userFilterDept')?.value || '';
        const roleId = document.getElementById('userFilterRole')?.value || '';
        const status = document.getElementById('userFilterStatus')?.value || '';

        const filtered = pbacUsersList.filter(user => {
            const matchesSearch = !query || 
                (user.name && user.name.toLowerCase().includes(query)) ||
                (user.email && user.email.toLowerCase().includes(query)) ||
                (user.employee_id && user.employee_id.toLowerCase().includes(query));

            const matchesDept = !deptId || user.department_id == deptId;
            const matchesRole = !roleId || user.role_id == roleId;
            const matchesStatus = !status || user.status === status;

            return matchesSearch && matchesDept && matchesRole && matchesStatus;
        });

        renderPbacUsers(filtered);
    }

    function renderPbacUsers(filteredUsers) {
        const tbody = document.getElementById('userTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (filteredUsers.length === 0) {
             tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">No users found.</td></tr>';
             return;
        }

        const currentUser = window.getCurrentUser() || { role: 'admin' };
        
        let displayUsers = filteredUsers;
        if (currentUser.is_manager && currentUser.role !== 'admin' && currentUser.role !== 'super-admin') {
            displayUsers = filteredUsers.filter(u => !u.role_name?.includes('manager') && u.role_name !== 'admin' && u.role_name !== 'super-admin');
        }

        if (displayUsers.length === 0) {
             tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">No users found.</td></tr>';
             return;
        }

        displayUsers.forEach(user => {
            const isSystemAdmin = user.role_name === 'admin' || user.role_name === 'super-admin';
            const isManagerTarget = user.role_name?.includes('manager');
            const isSameDept = user.department_id == currentUser.department_id;
            
            const canEdit = currentUser.role === 'super-admin' 
                || currentUser.id == user.user_id 
                || (!isSystemAdmin && currentUser.role === 'admin')
                || (currentUser.is_manager && isSameDept && !isSystemAdmin && !isManagerTarget);

            let actionHtml = '';
            if (canEdit) {
                const statusColor = user.status === 'active' ? '#10b981' : '#94a3b8';
                const statusIcon = user.status === 'active' ? 'fa-toggle-on' : 'fa-toggle-off';
                const statusTitle = user.status === 'active' ? 'Deactivate User' : 'Activate User';

                actionHtml = `
                    <button class="btn-toggle-status" data-id="${user.user_id}" data-status="${user.status}" title="${statusTitle}" style="background:none;border:none;color:${statusColor};cursor:pointer;padding:0.25rem;margin-right:0.5rem;font-size:1.15rem;vertical-align:middle;">
                        <i class="fas ${statusIcon}"></i>
                    </button>
                    <button class="btn-edit-user" data-id="${user.user_id}" title="Edit User" style="background:none;border:none;color:#3b82f6;cursor:pointer;padding:0.25rem;margin-right:0.5rem;font-size:1rem;vertical-align:middle;"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete-user" data-id="${user.user_id}" title="Delete User" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:0.25rem;font-size:1rem;vertical-align:middle;"><i class="fas fa-trash"></i></button>
                `;
            } else {
                actionHtml = `<span style="color:#94a3b8;font-size:0.8rem;"><i class="fas fa-lock"></i> Restricted</span>`;
            }

            const tr = document.createElement('tr');
            const deptName = allDepartments.find(d => d.id == user.department_id)?.name || '-';
            const lastLogin = 'Never';
            const badgeClass = user.status === 'active' ? 'active' : 'inactive';
            const badgeText = user.status === 'active' ? 'Active' : 'Inactive';
            
            tr.innerHTML = `
                <td>
                    <div class="user-row-clickable" data-id="${user.user_id}" style="display:flex;align-items:center;gap:0.75rem;cursor:pointer;" title="View User Profile">
                        <div style="width:36px;height:36px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#475569;font-weight:bold;">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:600;color:#2563eb;text-decoration:none;" class="user-name-link">${user.name}</div>
                            <div style="font-size:0.8rem;color:#64748b;">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td>${user.employee_id || '-'}</td>
                <td>${deptName}</td>
                <td>${user.role_name ? user.role_name.replace(/[-_]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '-'}</td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td>${lastLogin}</td>
                <td style="text-align:right;">
                    ${actionHtml}
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.user-row-clickable').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                openUserProfile(id);
            });
        });

        document.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const user = pbacUsersList.find(u => u.user_id == id);
                if (user) openUserWizard(user);
            });
        });

        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this user?')) {
                    handleDeleteUser(id);
                }
            });
        });

        document.querySelectorAll('.btn-toggle-status').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const currentStatus = e.currentTarget.getAttribute('data-status');
                const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
                handleToggleStatus(id, nextStatus);
            });
        });
    }

    async function handleToggleStatus(userId, nextStatus) {
        try {
            const res = await fetch(`${window.API_URL}/users/${userId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: nextStatus })
            });
            const data = await res.json();
            if (res.ok || data.success) {
                window.showAlert('Success', `User status updated to ${nextStatus}`, 'success');
                fetchAllPbacUsers();
            } else {
                window.showAlert('Error', data.message || 'Failed to update user status', 'error');
            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    async function openUserWizard(user = null) {
        wizardForm.reset();
        document.getElementById('wizardUserId').value = user ? user.user_id : '';
        selectedPermissions = [];
        if (allRoles.length === 0) await fetchRoles();
        if (allDepartments.length === 0) await fetchDepartments();
        populateWizardDropdowns();

        if (user) {
            document.getElementById('wizardName').value = user.name || '';
            document.getElementById('wizardEmail').value = user.email || '';
            document.getElementById('wizardPhone').value = user.phone || '';
            document.getElementById('wizardEmployeeId').value = user.employee_id || '';
            document.getElementById('wizardPassword').value = '********';
            document.getElementById('wizardConfirmPassword').value = '********';
            document.getElementById('wizardPassword').removeAttribute('required');
            document.getElementById('wizardConfirmPassword').removeAttribute('required');
            document.getElementById('wizardDept').value = user.department_id || '';
            document.getElementById('wizardRole').value = user.role_id || '';
            
            const langGroup = document.getElementById('languageSelectionGroup');
            if (user.role_name && user.role_name.toLowerCase().includes('telecaller')) {
                langGroup.style.display = 'block';
                const userLangs = (user.language || 'EN').split(',');
                const codeMap = {
                    'kannada': ['kn', 'ka', 'kannada'],
                    'english': ['en', 'english'],
                    'hindi': ['hi', 'hindi'],
                    'tamil': ['tn', 'ta', 'tamil'],
                    'telugu': ['te', 'telugu'],
                    'marathi': ['mr', 'marathi'],
                    'malayalam': ['ml', 'malayalam']
                };
                document.querySelectorAll('input[name="wizardLanguages"]').forEach(cb => {
                    const cbValLower = cb.value.toLowerCase();
                    const matchedCodes = codeMap[cbValLower] || [cbValLower];
                    cb.checked = userLangs.some(lang => matchedCodes.includes(lang.trim().toLowerCase()));
                });
            } else {
                langGroup.style.display = 'none';
            }
            
            try {
                selectedPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || []);
            } catch(e) {
                selectedPermissions = [];
            }
        } else {
            document.getElementById('wizardPassword').setAttribute('required', 'true');
            document.getElementById('wizardConfirmPassword').setAttribute('required', 'true');
            // Uncheck all languages for new user
            document.querySelectorAll('input[name="wizardLanguages"]').forEach(cb => cb.checked = false);
        }

        showWizardStep(1);
        userWizardModal.style.display = 'flex';
    }

    async function handleDeleteUser(id) {
        try {
            const res = await fetch(`${window.API_URL}/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (res.ok || data.success) {
                window.showAlert('Success', 'User deleted', 'success');
                fetchAllPbacUsers();
            } else {
                window.showAlert('Error', data.message || 'Failed to delete user', 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    function closeUserWizard() {
        userWizardModal.style.display = 'none';
    }

    function populateWizardDropdowns() {
        const currentUser = window.getCurrentUser();
        const currentRole = (currentUser.role || '').toLowerCase();
        
        const deptSelect = document.getElementById('wizardDept');
        deptSelect.innerHTML = '<option value="">-- Select Department --</option>';
        allDepartments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            deptSelect.appendChild(opt);
        });

        // PBAC: Lock department for Managers
        if (currentUser && currentUser.is_manager && currentRole !== 'admin' && currentRole !== 'super-admin') {
            deptSelect.value = currentUser.department_id;
            deptSelect.disabled = true;
            
            // Hide the "Create Department" box in wizard step 2
            const createDeptBox = document.querySelector('#wizardPane2 .btn-outline').closest('div');
            if(createDeptBox) createDeptBox.style.display = 'none';
        } else {
            deptSelect.disabled = false;
            const createDeptBox = document.querySelector('#wizardPane2 .btn-outline').closest('div');
            if(createDeptBox) createDeptBox.style.display = 'block';
        }

        const roleSelect = document.getElementById('wizardRole');
        roleSelect.innerHTML = '<option value="">-- Select Role --</option>';
        allRoles.forEach(r => {
            // Managers cannot assign admin, super-admin, or other manager roles
            if (currentUser.is_manager && currentRole !== 'super-admin' && currentRole !== 'admin') {
                if (r.name === 'admin' || r.name === 'super-admin' || r.name.toLowerCase().includes('manager')) return;
            }
            
            const opt = document.createElement('option');
            opt.value = r.role_id;
            
            // Format name nicely (e.g., 'telecaller_executive' -> 'Telecaller Executive')
            const formattedName = r.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            opt.textContent = formattedName;
            
            roleSelect.appendChild(opt);
        });

        roleSelect.addEventListener('change', (e) => {
            const selectedRoleId = e.target.value;
            const role = allRoles.find(r => r.role_id == selectedRoleId);
            if (role && role.default_permissions) {
                try {
                    selectedPermissions = JSON.parse(role.default_permissions) || [];
                } catch(err) {
                    selectedPermissions = [];
                }
            } else {
                selectedPermissions = [];
            }
            updatePermissionsSummary();
        });
    }

    function showWizardStep(step) {
        wizardCurrentStep = step;
        
        // Update Step Indicators
        document.querySelectorAll('.wizard-step').forEach(el => {
            const s = parseInt(el.getAttribute('data-step'));
            if(s === step) {
                el.classList.add('active');
                el.style.color = '#3b82f6';
                el.querySelector('div').style.background = '#3b82f6';
                el.querySelector('div').style.color = 'white';
            } else if (s < step) {
                el.classList.remove('active');
                el.style.color = '#10b981';
                el.querySelector('div').style.background = '#10b981';
                el.querySelector('div').style.color = 'white';
                el.querySelector('div').innerHTML = '<i class="fas fa-check"></i>';
            } else {
                el.classList.remove('active');
                el.style.color = '#64748b';
                el.querySelector('div').style.background = '#e2e8f0';
                el.querySelector('div').style.color = '#64748b';
                el.querySelector('div').innerHTML = s;
            }
        });

        // Show/Hide Panes
        for(let i=1; i<=4; i++) {
            document.getElementById(`wizardPane${i}`).style.display = (i === step) ? 'block' : 'none';
        }

        // Show/Hide Buttons
        btnWizardBack.style.visibility = (step === 1) ? 'hidden' : 'visible';
        
        if(step === 4) {
            btnWizardNext.style.display = 'none';
            btnWizardCancel.style.display = 'block';
            btnWizardSubmit.style.display = 'block';
            renderPermissionCategories();
            updatePermissionsSummary();
        } else {
            btnWizardNext.style.display = 'block';
            btnWizardCancel.style.display = 'none';
            btnWizardSubmit.style.display = 'none';
        }
    }

    function handleWizardNext() {
        // Basic validation before next
        if(wizardCurrentStep === 1) {
            if(!document.getElementById('wizardName').value || 
               !document.getElementById('wizardEmail').value || 
               !document.getElementById('wizardPhone').value ||
               !document.getElementById('wizardEmployeeId').value ||
               !document.getElementById('wizardPassword').value) {
                window.showAlert('Validation', 'Please fill all required personal details.', 'error');
                return;
            }
            if(document.getElementById('wizardPassword').value !== document.getElementById('wizardConfirmPassword').value) {
                window.showAlert('Validation', 'Passwords do not match.', 'error');
                return;
            }
        }
        if(wizardCurrentStep === 2) {
            if(!document.getElementById('wizardDept').value) {
                window.showAlert('Validation', 'Please select a department.', 'error');
                return;
            }
        }
        if(wizardCurrentStep === 3) {
            if(!document.getElementById('wizardRole').value) {
                window.showAlert('Validation', 'Please select a role.', 'error');
                return;
            }
        }
        
        showWizardStep(wizardCurrentStep + 1);
    }

    function handleWizardBack() {
        if(wizardCurrentStep > 1) {
            showWizardStep(wizardCurrentStep - 1);
        }
    }

    function renderPermissionCategories() {
        const container = document.getElementById('permissionCategories');
        container.innerHTML = '';

        Object.keys(PERMISSION_SCHEMA).forEach(category => {
            const div = document.createElement('div');
            div.style.padding = '1rem 1.5rem';
            div.style.cursor = 'pointer';
            div.style.fontWeight = '500';
            div.style.borderBottom = '1px solid #e2e8f0';
            div.style.color = (category === selectedCategory) ? '#3b82f6' : '#475569';
            div.style.background = (category === selectedCategory) ? '#eff6ff' : 'transparent';
            div.style.borderLeft = (category === selectedCategory) ? '3px solid #3b82f6' : '3px solid transparent';
            
            div.innerHTML = `<i class="fas fa-folder" style="margin-right:0.5rem;width:20px;"></i> ${category}`;
            
            div.addEventListener('click', () => {
                selectedCategory = category;
                renderPermissionCategories(); // re-render to update active styling
                renderPermissionCheckboxes(); // update right pane
            });
            
            container.appendChild(div);
        });

        renderPermissionCheckboxes();
    }

    function renderPermissionCheckboxes() {
        document.getElementById('permissionCategoryTitle').textContent = `${selectedCategory} Features`;
        const container = document.getElementById('permissionCheckboxes');
        container.innerHTML = '';

        const features = PERMISSION_SCHEMA[selectedCategory];
        
        features.forEach(feature => {
            const permId = `${selectedCategory.toLowerCase()}_${feature.toLowerCase().replace(/\s+/g, '_')}`;
            const isChecked = selectedPermissions.includes(permId);
            
            const label = document.createElement('label');
            label.setAttribute('for', permId);
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '0.75rem';
            label.style.cursor = 'not-allowed';
            label.style.fontSize = '0.95rem';
            label.style.color = '#64748b'; // Dim color to show it's disabled
            
            label.innerHTML = `
                <input type="checkbox" id="${permId}" name="${permId}" value="${permId}" ${isChecked ? 'checked' : ''} disabled style="width:16px;height:16px;accent-color:#3b82f6;cursor:not-allowed;">
                ${feature} (Full Access)
            `;

            label.querySelector('input').addEventListener('change', (e) => {
                if(e.target.checked) {
                    if(!selectedPermissions.includes(permId)) selectedPermissions.push(permId);
                } else {
                    selectedPermissions = selectedPermissions.filter(p => p !== permId);
                }
                updatePermissionsSummary();
            });

            container.appendChild(label);
        });
    }

    function updatePermissionsSummary() {
        const deptSelect = document.getElementById('wizardDept');
        const roleSelect = document.getElementById('wizardRole');
        
        document.getElementById('summaryDept').textContent = deptSelect.options[deptSelect.selectedIndex]?.text || '-';
        document.getElementById('summaryRole').textContent = roleSelect.options[roleSelect.selectedIndex]?.text || '-';
        document.getElementById('summaryPerms').textContent = `${selectedPermissions.length} Selected`;
    }

    async function handleWizardSubmit(e) {
        e.preventDefault();
        const selectedLanguages = Array.from(document.querySelectorAll('input[name="wizardLanguages"]:checked')).map(cb => cb.value).join(',');

        const payload = {
            name: document.getElementById('wizardName').value,
            email: document.getElementById('wizardEmail').value,
            phone: document.getElementById('wizardPhone').value,
            employee_id: document.getElementById('wizardEmployeeId').value,
            password: document.getElementById('wizardPassword').value,
            department_id: document.getElementById('wizardDept').value,
            role_id: document.getElementById('wizardRole').value,
            permissions: selectedPermissions,
            language: selectedLanguages || 'EN'
        };

        const userId = document.getElementById('wizardUserId').value;
        const method = userId ? 'PUT' : 'POST';
        const url = userId ? `${window.API_URL}/users/${userId}` : `${window.API_URL}/users`;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok || data.success) {
                window.showAlert('Success', `User successfully ${userId ? 'updated' : 'created'}!`, 'success');
                closeUserWizard();
                fetchAllPbacUsers();
                if (activeProfileUserId && activeProfileUserId == userId) {
                    openUserProfile(userId);
                }
            } else {
                window.showAlert('Error', data.message || 'Failed to save user', 'error');
            }
        } catch (error) {
            console.error('Error saving PBAC user:', error);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    // ==========================================
    // USER PROFILE VIEW LOGIC
    // ==========================================
    let activeProfileUserId = null;
    let activeProfileUserObj = null;

    async function openUserProfile(userId) {
        activeProfileUserId = userId;
        const tabSections = document.querySelectorAll('.tab-section');
        const tabBtns = document.querySelectorAll('.settings-nav-item');

        tabBtns.forEach(b => b.classList.remove('active'));
        tabSections.forEach(sec => sec.classList.remove('active'));

        // Hide inner sidebar for full-screen user detail page view
        const innerSidebar = document.querySelector('.settings-sidebar');
        if (innerSidebar) innerSidebar.style.display = 'none';

        const profileTabSec = document.getElementById('tab-user-profile');
        if (profileTabSec) profileTabSec.classList.add('active');

        // Reset sub-tabs to Overview
        const subTabs = document.querySelectorAll('#profileSubTabs .profile-tab-item');
        const panes = document.querySelectorAll('.profile-pane-content');
        subTabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.style.display = 'none');
        if (subTabs[0]) subTabs[0].classList.add('active');
        const overviewPane = document.getElementById('ptab-overview');
        if (overviewPane) overviewPane.style.display = 'block';

        // Fetch detailed user profile
        try {
            const res = await fetch(`${window.API_URL}/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const user = await res.json();
            if (!res.ok) {
                window.showAlert('Error', user.message || 'Failed to load user profile', 'error');
                return;
            }

            activeProfileUserObj = user;

            // 1. Header Banner
            const initial = (user.name || '?').charAt(0).toUpperCase();
            document.getElementById('userProfileAvatar').textContent = initial;
            document.getElementById('userProfileName').textContent = user.name || 'User Profile';
            document.getElementById('profileBreadcrumbName').textContent = user.name || 'User Profile';
            document.getElementById('userProfileEmail').textContent = user.email || '-';
            document.getElementById('userProfileEmpId').textContent = user.employee_id || 'SGB-017';
            
            const formattedRole = user.role_name ? user.role_name.replace(/[-_]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Staff Member';
            document.getElementById('userProfileRoleBadge').innerHTML = `<i class="fas fa-user-shield"></i> ${formattedRole}`;
            
            const isOnline = user.status === 'active';
            const statusBadge = document.getElementById('userProfileStatusBadge');
            statusBadge.className = `status-badge ${isOnline ? 'active' : 'inactive'}`;
            statusBadge.textContent = isOnline ? 'Active' : 'Inactive';
            document.getElementById('userProfileStatusDot').style.background = isOnline ? '#10b981' : '#cbd5e1';

            // Meta grid
            document.getElementById('userProfilePhone').textContent = user.phone || '-';
            document.getElementById('userProfileLocation').textContent = user.address || 'Tamil Nadu, India';
            document.getElementById('userProfileDept').textContent = user.department_name || (allDepartments.find(d => d.id == user.department_id)?.name) || 'Sales';
            document.getElementById('userProfileReporting').textContent = user.reporting_to || 'Admin';
            
            const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '12 Mar 2024';
            document.getElementById('userProfileJoining').textContent = joinDate;
            document.getElementById('userProfileLastLogin').textContent = user.last_login ? new Date(user.last_login).toLocaleString() : '27 Aug 2026, 03:15 PM';

            // 2. Stat Cards (Role-Based Dynamic Rendering)
            if (user.stat_cards && Array.isArray(user.stat_cards) && user.stat_cards.length > 0) {
                const statGrid = document.querySelector('.profile-stat-grid-5');
                if (statGrid) {
                    statGrid.innerHTML = user.stat_cards.map(c => `
                        <div class="p-stat-card">
                            <div class="p-stat-icon-wrapper" style="background:${c.bg};color:${c.color};">
                                <i class="fas ${c.icon}"></i>
                            </div>
                            <div>
                                <div class="p-stat-val">${c.value}</div>
                                <div class="p-stat-lbl">${c.label}</div>
                            </div>
                        </div>
                    `).join('');
                }
            } else {
                if (document.getElementById('statLeadsAssigned')) document.getElementById('statLeadsAssigned').textContent = user.leads_assigned || 0;
                if (document.getElementById('statLeadsConverted')) document.getElementById('statLeadsConverted').textContent = user.leads_converted || 0;
                if (document.getElementById('statOrdersCreated')) document.getElementById('statOrdersCreated').textContent = user.orders_created || 0;
                if (document.getElementById('statTotalSales')) document.getElementById('statTotalSales').textContent = `₹${Number(user.total_sales || 0).toLocaleString('en-IN')}`;
                if (document.getElementById('statConversionRate')) document.getElementById('statConversionRate').textContent = `${user.conversion_rate || 0}%`;
            }

            // 3. User Info Card
            document.getElementById('infoFullName').textContent = user.name || '-';
            document.getElementById('infoEmail').textContent = user.email || '-';
            document.getElementById('infoPhone').textContent = user.phone || '-';
            document.getElementById('infoEmpId').textContent = user.employee_id || '-';
            document.getElementById('infoDept').textContent = user.department_name || 'Sales';
            document.getElementById('infoRole').textContent = formattedRole;
            document.getElementById('infoJoining').textContent = joinDate;
            document.getElementById('infoStatus').innerHTML = `<span class="status-badge ${isOnline ? 'active' : 'inactive'}">${isOnline ? 'Active' : 'Inactive'}</span>`;
            document.getElementById('infoAddress').textContent = user.address || 'Coimbatore, Tamil Nadu, India';
            document.getElementById('infoBio').textContent = user.bio || `Handles ${formattedRole} leads, follow-ups, and customer conversions.`;

            // 4. Activity Timeline
            renderActivityTimeline(user.recent_activity || []);

            // 5. Roles & Permissions Card
            document.getElementById('permPrimaryRole').textContent = formattedRole;
            document.getElementById('permOtherRoles').textContent = user.department_name ? `${user.department_name} Team` : 'Sales Team';
            
            let userPerms = [];
            try {
                userPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : (user.permissions || []);
            } catch(e) { userPerms = []; }

            const defaultPermItems = [
                'Lead Management', 'WhatsApp Communication', 'View Orders', 'Create Orders', 'Update Follow-ups', 'Reports & Analytics (View)'
            ];

            const permsToDisplay = userPerms.length > 0 ? userPerms.map(p => p.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : defaultPermItems;
            const permListHtml = permsToDisplay.map(p => `<div class="permission-check-item"><i class="fas fa-check-circle"></i> ${p}</div>`).join('');
            document.getElementById('profilePermissionsList').innerHTML = permListHtml;

            // 6. System Info Card
            document.getElementById('sysCreatedBy').textContent = user.created_by || 'admin';
            document.getElementById('sysCreatedOn').textContent = user.created_at ? new Date(user.created_at).toLocaleString() : '12 Mar 2024, 10:30 AM';
            document.getElementById('sysLastUpdated').textContent = user.updated_at ? new Date(user.updated_at).toLocaleString() : '27 Aug 2026, 03:15 PM';

        } catch (e) {
            console.error('Error fetching user profile:', e);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    }

    function renderActivityTimeline(activities) {
        const timelineContainer = document.getElementById('profileActivityTimeline');
        const fullTimelineContainer = document.getElementById('fullActivityTimeline');
        if (!timelineContainer) return;

        if (!activities || activities.length === 0) {
            const defaultActivities = [
                { title: 'Logged in to the system', time: '03:15 PM', icon: 'fa-user', bg: '#eff6ff', color: '#3b82f6', sub: 'IP: 117.248.XX.XX' },
                { title: 'Updated lead status - Interested to Converted', time: '02:45 PM', icon: 'fa-circle-check', bg: '#f0fdf4', color: '#10b981', sub: 'Lead: +91 98765 11111' },
                { title: 'Created Order #ORD-2026-0987', time: '02:30 PM', icon: 'fa-shopping-cart', bg: '#fff7ed', color: '#f97316', sub: 'Amount: ₹24,500' },
                { title: 'Sent WhatsApp message', time: '01:55 PM', icon: 'fa-message', bg: '#f0fdf4', color: '#10b981', sub: 'To: +91 91234 56789' },
                { title: 'Updated follow-up for lead', time: '12:20 PM', icon: 'fa-calendar', bg: '#faf5ff', color: '#a855f7', sub: 'Lead: +91 99887 66554' }
            ];
            
            const html = defaultActivities.map(a => `
                <div class="timeline-event-item">
                    <div class="timeline-event-dot" style="background:${a.bg};color:${a.color};border-color:${a.bg};">
                        <i class="fas ${a.icon}"></i>
                    </div>
                    <div>
                        <div class="timeline-event-title">${a.title}</div>
                        <div class="timeline-event-sub">${a.sub}</div>
                    </div>
                    <div class="timeline-event-time">${a.time}</div>
                </div>
            `).join('');

            timelineContainer.innerHTML = html;
            if (fullTimelineContainer) fullTimelineContainer.innerHTML = html;
            return;
        }

        const html = activities.map(act => {
            const timeStr = act.created_at ? new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM';
            const icon = act.type === 'order' ? 'fa-shopping-cart' : act.type === 'lead' ? 'fa-user-check' : 'fa-info-circle';
            const bg = act.type === 'order' ? '#fff7ed' : act.type === 'lead' ? '#f0fdf4' : '#eff6ff';
            const color = act.type === 'order' ? '#f97316' : act.type === 'lead' ? '#10b981' : '#3b82f6';

            return `
                <div class="timeline-event-item">
                    <div class="timeline-event-dot" style="background:${bg};color:${color};border-color:${bg};">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div>
                        <div class="timeline-event-title">${act.title}</div>
                        <div class="timeline-event-sub">${act.description || ''}</div>
                    </div>
                    <div class="timeline-event-time">${timeStr}</div>
                </div>
            `;
        }).join('');

        timelineContainer.innerHTML = html;
        if (fullTimelineContainer) fullTimelineContainer.innerHTML = html;
    }

    // Breadcrumb Back button
    document.getElementById('btnBackToUsersList')?.addEventListener('click', () => {
        const tabSections = document.querySelectorAll('.tab-section');
        const tabBtns = document.querySelectorAll('.settings-nav-item');
        tabSections.forEach(sec => sec.classList.remove('active'));
        tabBtns.forEach(b => b.classList.remove('active'));

        // Restore inner sidebar when returning to Users table
        const innerSidebar = document.querySelector('.settings-sidebar');
        if (innerSidebar) innerSidebar.style.display = 'block';

        const usersTabBtn = document.querySelector('.settings-nav-item[data-tab="users"]');
        if (usersTabBtn) usersTabBtn.classList.add('active');
        document.getElementById('tab-users')?.classList.add('active');
    });

    // Profile Sub-tabs handler
    document.querySelectorAll('#profileSubTabs .profile-tab-item').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetPtab = e.currentTarget.getAttribute('data-ptab');
            document.querySelectorAll('#profileSubTabs .profile-tab-item').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');

            document.querySelectorAll('.profile-pane-content').forEach(p => p.style.display = 'none');
            const targetPane = document.getElementById(`ptab-${targetPtab}`);
            if (targetPane) targetPane.style.display = 'block';
        });
    });

    // Edit user triggers from profile
    document.getElementById('btnEditUserProfile')?.addEventListener('click', () => {
        if (activeProfileUserObj) openUserWizard(activeProfileUserObj);
    });
    document.getElementById('btnEditUserSection')?.addEventListener('click', () => {
        if (activeProfileUserObj) openUserWizard(activeProfileUserObj);
    });

    // Password reset from profile
    document.getElementById('btnResetUserPassword')?.addEventListener('click', async () => {
        if (!activeProfileUserId) return;
        const newPwd = prompt('Enter new password for this user (at least 6 characters):');
        if (!newPwd) return;
        if (newPwd.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }

        try {
            const res = await fetch(`${window.API_URL}/users/${activeProfileUserId}/password`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ newPassword: newPwd })
            });
            const data = await res.json();
            if (res.ok || data.success) {
                window.showAlert('Success', 'User password reset successfully', 'success');
            } else {
                window.showAlert('Error', data.message || 'Failed to reset password', 'error');
            }
        } catch (err) {
            console.error('Password reset error:', err);
            window.showAlert('Error', 'Server connection failed', 'error');
        }
    });
});
