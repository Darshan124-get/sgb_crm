document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('message');
    const API_URL = window.API_URL;

    // Password Toggle Logic
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.querySelector('i').classList.toggle('fa-eye');
            togglePassword.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
    
    // Check for error messages in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'session_expired' && messageDiv) {
        messageDiv.textContent = 'Session expired. Please sign in again.';
        messageDiv.style.color = '#3b82f6'; // Blue for informational message
    }

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = document.getElementById('identifier').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('username', data.user.name);

                    // Role-based redirect to correct module using ROOT_PATH
                    const role = (data.user.role || '').toLowerCase();
                    const dest = window.ROLE_REDIRECTS[role] || 'index.html';
                    window.location.href = `${window.ROOT_PATH}${dest}`;
                } else {
                    messageDiv.textContent = data.message || 'Login failed';
                }
            } catch (err) {
                messageDiv.textContent = 'Could not connect to server';
            }
        });
    }


    // Handle Dashboard Data
    const dashboardBody = document.getElementById('contentBody');
    if (dashboardBody) {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');

        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        if (username) {
            const profileName = document.getElementById('profileName');
            if (profileName) profileName.textContent = username;
        }

        fetchDashboardStats(token);
    }

    async function fetchDashboardStats(token) {
        try {
            const response = await fetch(`${API_URL}/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById('totalUsers').textContent = data.totalUsers.toLocaleString();
                document.getElementById('activeSessions').textContent = data.activeSessions;
                document.getElementById('totalRevenue').textContent = data.totalRevenue;
            } else {
                // If token expired or invalid
                localStorage.removeItem('token');
                window.location.href = 'index.html';
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    }
    // Note: Sidebar toggles and logout are now handled in js/components.js
});
