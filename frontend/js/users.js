document.addEventListener('DOMContentLoaded', async () => {
    const userTableBody = document.getElementById('userTableBody');
    const staffRoleSelect = document.getElementById('staffRole');
    const userForm = document.getElementById('userForm');
    const userModal = document.getElementById('userModal');
    const addUserBtn = document.getElementById('addUserBtn');
    const languageGroup = document.getElementById('languageGroup');
    const passwordGroup = document.getElementById('passwordGroup');

    const API_URL = `${window.BASE_URL}/api/users`;
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const DEFAULT_ROLES = [
        { role_id: 1, name: 'Super-Admin' },
        { role_id: 2, name: 'Sales' },
        { role_id: 3, name: 'Billing' },
        { role_id: 4, name: 'Packaging' },
        { role_id: 5, name: 'Shipping' }
    ];

    // 1. Initial Load
    async function init() {
        renderRoles(DEFAULT_ROLES); // Show defaults immediately for better UX
        await fetchRoles();
        await fetchUsers();
    }
    init();

    // 2. Event Listeners
    addUserBtn.addEventListener('click', () => {
        openModal();
    });

    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelModal').addEventListener('click', closeModal);

    staffRoleSelect.addEventListener('change', (e) => {
        const selectedIndex = e.target.selectedIndex;
        if (selectedIndex <= 0) {
            languageGroup.style.display = 'none';
            return;
        }
        const selectedRoleName = e.target.options[selectedIndex].text.toLowerCase();
        languageGroup.style.display = selectedRoleName.includes('sales') ? 'block' : 'none';
    });

    userForm.addEventListener('submit', handleFormSubmit);

    // Language Tags Interaction
    const languageTagsContainer = document.getElementById('languageTags');
    const staffLanguagesInput = document.getElementById('staffLanguages');

    languageTagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('lang-option')) {
            e.target.classList.toggle('selected');
            updateStaffLanguages();
        }
    });

    function updateStaffLanguages() {
        const selected = Array.from(languageTagsContainer.querySelectorAll('.lang-option.selected'))
            .map(opt => opt.dataset.value);
        staffLanguagesInput.value = selected.join(',');
    }

    function setStaffLanguages(langs) {
        const langArray = (langs || '').split(',').map(l => l.trim());
        const options = languageTagsContainer.querySelectorAll('.lang-option');
        options.forEach(opt => {
            if (langArray.includes(opt.dataset.value)) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
        updateStaffLanguages();
    }

    // 3. API Functions
    function renderRoles(roles) {
        if (!roles || roles.length === 0) return;
        staffRoleSelect.innerHTML = '<option value="">Select a Role</option>' + 
            roles.map(r => `<option value="${r.role_id}">${r.name}</option>`).join('');
    }

    async function fetchRoles() {
        try {
            const res = await fetch(`${API_URL}/roles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const roles = await res.json();
            if (roles && roles.length > 0) {
                renderRoles(roles);
            }
        } catch (err) {
            console.error('Failed to load live roles, using defaults:', err);
            renderRoles(DEFAULT_ROLES); // Ensure defaults are used on error
        }
    }

    async function fetchUsers() {
        try {
            const res = await fetch(API_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Unauthorized');
            const users = await res.json();
            renderUsers(users);
        } catch (err) {
            console.error('Failed to load users:', err);
            if (err.message === 'Unauthorized') window.location.href = 'index.html';
        }
    }

    function renderUsers(users) {
        userTableBody.innerHTML = users.map(user => {
            const roleClass = user.role_name?.toLowerCase().includes('admin') ? 'role-admin' :
                             user.role_name?.toLowerCase().includes('sales') ? 'role-sales' : 'role-operations';
            
            const languages = (user.language || '').split(',').filter(l => l.trim()).map(l => `<span class="language-tag">${l.trim()}</span>`).join('');
            const initial = (user.name || '?').charAt(0).toUpperCase();

            return `
                <tr>
                    <td>
                        <div class="user-info">
                            <div class="user-avatar">${initial}</div>
                            <div>
                                <div style="font-weight: 600; color: #1e293b;">${user.name}</div>
                                <div style="font-size: 0.75rem; color: #64748b;">${user.email}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="role-badge ${roleClass}">${user.role_name || 'No Role'}</span></td>
                    <td>${languages || '<span style="color:#94a3b8; font-size:0.75rem;">Global</span>'}</td>
                    <td style="font-size: 0.875rem; color: #475569;">${user.phone || '-'}</td>
                    <td>
                        <span style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; font-weight: 600; color: ${user.status === 'active' ? '#10b981' : '#ef4444'}">
                            <i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i>
                            ${user.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn-action" onclick="editStaff(${user.user_id}, '${user.name}', '${user.email}', '${user.phone}', ${user.role_id}, '${user.language}')" title="Edit">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-action" onclick="resetStaffPassword(${user.user_id})" title="Reset Password">
                                <i class="fa-solid fa-key"></i>
                            </button>
                            <button class="btn-action delete" onclick="deleteStaff(${user.user_id})" title="Remove">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn.innerHTML;
        
        const userId = document.getElementById('userId').value;
        const selectedLangs = staffLanguagesInput.value;
        const roleId = document.getElementById('staffRole').value;

        if (!roleId) {
            alert('Please select an operational role.');
            return;
        }
        
        const data = {
            name: document.getElementById('staffName').value,
            email: document.getElementById('staffEmail').value,
            phone: document.getElementById('staffPhone').value,
            role_id: parseInt(roleId),
            language: selectedLangs,
            password: userId ? undefined : document.getElementById('staffPassword').value
        };

        const method = userId ? 'PUT' : 'POST';
        const url = userId ? `${API_URL}/${userId}` : API_URL;

        try {
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
            submitBtn.disabled = true;

            const res = await fetch(url, {
                method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                closeModal();
                fetchUsers();
                // Show a brief success toast if needed
            } else {
                const err = await res.json();
                alert(err.message || 'Action failed');
            }
        } catch (err) {
            console.error('Action failed:', err);
            alert('A network error occurred. Please check the console.');
        } finally {
            submitBtn.innerHTML = originalBtnHtml;
            submitBtn.disabled = false;
        }
    }

    // Modal Helpers
    function openModal() {
        userForm.reset();
        document.getElementById('userId').value = '';
        document.getElementById('modalTitle').innerText = 'Add New Staff Member';
        passwordGroup.style.display = 'block';
        languageGroup.style.display = 'none';
        setStaffLanguages(''); // Reset tags
        userModal.classList.add('active');
    }

    window.closeModal = function() {
        userModal.classList.remove('active');
    };

    // Global Functions for Action Buttons
    window.editStaff = function(id, name, email, phone, roleId, langs) {
        openModal();
        document.getElementById('userId').value = id;
        document.getElementById('modalTitle').innerText = 'Edit Staff Member';
        document.getElementById('staffName').value = name;
        document.getElementById('staffEmail').value = email;
        document.getElementById('staffPhone').value = phone;
        document.getElementById('staffRole').value = roleId;
        passwordGroup.style.display = 'none'; // Don't edit password here

        // Sync languages using tags
        setStaffLanguages(langs);
        
        // Show language box if it's a sales role
        const selectedRoleText = document.getElementById('staffRole').options[document.getElementById('staffRole').selectedIndex].text.toLowerCase();
        languageGroup.style.display = selectedRoleText.includes('sales') ? 'block' : 'none';
    };

    window.resetStaffPassword = async function(id) {
        const newPassword = prompt('Enter new password for this staff member (min 6 chars):');
        if (!newPassword || newPassword.length < 6) return;

        try {
            const res = await fetch(`${API_URL}/${id}/password`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newPassword })
            });

            if (res.ok) alert('Password updated successfully');
        } catch (err) {
            console.error('Reset failed:', err);
        }
    };

    window.deleteStaff = async function(id) {
        if (!confirm('Are you sure you want to remove this staff member?')) return;

        try {
            const res = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) fetchUsers();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };
});
