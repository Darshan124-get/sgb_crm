// Acefone Telephony Module Logic & Interactivity
document.addEventListener('DOMContentLoaded', () => {
    // Guard: Disable telephony page for Customer Support panel users
    if (typeof window.getCurrentUser === 'function') {
        const currentUser = window.getCurrentUser();
        const role = (currentUser && currentUser.role ? currentUser.role : '').toLowerCase();
        if (role.includes('support') && !role.includes('admin')) {
            alert('The Telephony module is temporarily disabled for the Customer Support panel. Redirecting to Support Dashboard.');
            window.location.href = '../customer_support/dashboard.html';
            return;
        }
    }

    console.log("Acefone Telephony module initialized.");

    // Initialize Charts
    initCallSummaryChart();
    initCallDistributionChart();

    // Tab Navigation Logic
    setupTabs();

    // Quick Action & Modal Handlers
    setupModals();

    // Token Visibility Toggle
    setupTokenToggle();
});

// 1. Chart: Today's Call Summary Line/Area Chart
function initCallSummaryChart() {
    const ctx = document.getElementById('callSummaryChart');
    if (!ctx) return;

    const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM'];
    
    // Gradient fill for line chart
    const chartCtx = ctx.getContext('2d');
    const greenGradient = chartCtx.createLinearGradient(0, 0, 0, 200);
    greenGradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    greenGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [
                {
                    label: 'Connected Calls',
                    data: [14, 8, 12, 6, 15, 20, 14, 25, 27],
                    borderColor: '#10b981',
                    borderWidth: 2.5,
                    backgroundColor: greenGradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 3,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#0f172a',
                    titleFont: { family: 'Inter', size: 12, weight: 'bold' },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    min: 0,
                    max: 30,
                    ticks: { stepSize: 10, color: '#64748b', font: { family: 'Inter', size: 11 } },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// 2. Chart: Call Status Distribution Donut Chart
function initCallDistributionChart() {
    const ctx = document.getElementById('callDistributionChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Connected', 'Missed', 'Busy', 'Failed'],
            datasets: [{
                data: [96, 18, 7, 3],
                backgroundColor: [
                    '#10b981', // Connected Green
                    '#ef4444', // Missed Red
                    '#f59e0b', // Busy Yellow/Orange
                    '#2563eb'  // Failed Blue
                ],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const total = 124;
                            const val = context.raw;
                            const pct = Math.round((val / total) * 100);
                            return ` ${context.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Tab Switching
function setupTabs() {
    const tabBtns = document.querySelectorAll('.acefone-tab-btn');
    const tabPanels = document.querySelectorAll('.acefone-tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabPanels.forEach(panel => {
                if (panel.id === `tab-panel-${targetTab}`) {
                    panel.style.display = 'block';
                } else {
                    panel.style.display = 'none';
                }
            });
        });
    });
}

// Modal Handlers & Quick Actions
function setupModals() {
    window.openAcefoneModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.closeAcefoneModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    };

    // Close on overlay click
    document.querySelectorAll('.acefone-modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });
}

// API Token Visibility Toggle
function setupTokenToggle() {
    const tokenDisplay = document.getElementById('apiTokenVal');
    const toggleBtn = document.getElementById('toggleApiToken');

    if (tokenDisplay && toggleBtn) {
        let isVisible = false;
        const realToken = "ace_live_8f93a19b2c4e710d8a";
        const maskedToken = "********************";

        toggleBtn.addEventListener('click', () => {
            isVisible = !isVisible;
            if (isVisible) {
                tokenDisplay.textContent = realToken;
                toggleBtn.classList.remove('fa-eye');
                toggleBtn.classList.add('fa-eye-slash');
            } else {
                tokenDisplay.textContent = maskedToken;
                toggleBtn.classList.remove('fa-eye-slash');
                toggleBtn.classList.add('fa-eye');
            }
        });
    }

    const configTokenInput = document.getElementById('apiConfigTokenInput');
    const configTokenBtn = document.getElementById('btnToggleConfigToken');
    if (configTokenInput && configTokenBtn) {
        configTokenBtn.addEventListener('click', () => {
            const currentType = configTokenInput.getAttribute('type');
            if (currentType === 'password') {
                configTokenInput.setAttribute('type', 'text');
                configTokenBtn.classList.remove('fa-eye');
                configTokenBtn.classList.add('fa-eye-slash');
            } else {
                configTokenInput.setAttribute('type', 'password');
                configTokenBtn.classList.remove('fa-eye-slash');
                configTokenBtn.classList.add('fa-eye');
            }
        });
    }
}

// Audio Player simulation
window.playRecordingSimulation = function(callId) {
    alert(`Playing call recording for Call ${callId}... (Audio simulation)`);
};
