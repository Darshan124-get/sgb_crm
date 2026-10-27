// Acefone Telephony Module Logic & Interactivity
function initAcefoneModule() {
    // 🔐 Admin Only Access Check 🔐
    const user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : {};
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'super-admin') {
        console.warn("Access denied: Acefone Telephony management is restricted to Admin only.");
        const homeUrl = typeof window.getHomeUrl === 'function' ? window.getHomeUrl(user) : 'modules/sales/dashboard.html';
        window.location.href = `${window.ROOT_PATH || '../../'}${homeUrl}`;
        return;
    }

    console.log("📡 Acefone Telephony module initializing...");

    // Initialize Charts
    initCallSummaryChart();
    initCallDistributionChart();
    initDidAssignmentChart();
    initDidLocationChart();
    initLogsStatusDistributionChart();
    initLogsTrendChart();
    initTopTelecallersChart();
    initRecordingStorageChart();
    initRecordingDurationTrendChart();
    initTopTelecallersRecordingChart();

    // Performance Tab Charts
    initPerfStatusDistChart();
    initPerfCallTrendChart();
    initPerfCallTypeDistChart();
    initPerfCallTimeAnalysisChart();
    initPerfAvgCallDurationChart();
    initPerfBestCallingDaysChart();

    // Tab Navigation Logic
    setupTabs();

    // Quick Action & Modal Handlers
    setupModals();

    // Token Visibility Toggle
    setupTokenToggle();

    // Load Real Telephony Data from Backend API
    loadTelephonyData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAcefoneModule);
} else {
    initAcefoneModule();
}

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
                    panel.style.display = (panel.getAttribute('data-display') === 'flex' || targetTab === 'performance') ? 'flex' : 'block';
                    if (targetTab === 'logs' && window.loadCdrCallLogs) {
                        window.loadCdrCallLogs();
                    }
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

// 3. Chart: DID Assignment Donut Chart
function initDidAssignmentChart() {
    const ctx = document.getElementById('didAssignmentChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Assigned', 'Unassigned', 'Inactive'],
            datasets: [{
                data: [8, 0, 0],
                backgroundColor: [
                    '#10b981', // Assigned Green
                    '#cbd5e1', // Unassigned Grey
                    '#ef4444'  // Inactive Red
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
                    cornerRadius: 8
                }
            }
        }
    });
}

// 4. Chart: DID by Location Bar Chart
function initDidLocationChart() {
    const ctx = document.getElementById('didLocationChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Bangalore', 'Chennai', 'Hyderabad', 'Mumbai', 'Kolkata', 'Delhi'],
            datasets: [{
                data: [3, 1, 1, 1, 1, 1],
                backgroundColor: [
                    '#10b981', // Bangalore Green
                    '#3b82f6', // Chennai Blue
                    '#f59e0b', // Hyderabad Orange
                    '#8b5cf6', // Mumbai Purple
                    '#ef4444', // Kolkata Red
                    '#06b6d4'  // Delhi Cyan
                ],
                borderRadius: 4,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
                },
                y: {
                    min: 0,
                    max: 3,
                    ticks: { stepSize: 1, color: '#64748b', font: { family: 'Inter', size: 10 } },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// 5. Chart: Call Logs Status Distribution Donut Chart
function initLogsStatusDistributionChart() {
    const ctx = document.getElementById('logsStatusDistributionChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Connected', 'Missed', 'No Answer', 'Busy', 'Failed'],
            datasets: [{
                data: [892, 213, 81, 42, 20],
                backgroundColor: [
                    '#10b981', // Connected Green
                    '#ef4444', // Missed Red
                    '#f97316', // No Answer Orange
                    '#ec4899', // Busy Pink
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
                    cornerRadius: 8
                }
            }
        }
    });
}

// 6. Chart: Call Trend (Last 14 Days) Line Chart
function initLogsTrendChart() {
    const ctx = document.getElementById('logsTrendChart');
    if (!ctx) return;

    const dates = ['17 Sep', '18 Sep', '19 Sep', '20 Sep', '21 Sep', '22 Sep', '23 Sep', '24 Sep', '25 Sep', '26 Sep', '27 Sep', '28 Sep', '29 Sep', '30 Sep'];

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Total Calls',
                    data: [70, 85, 110, 95, 75, 90, 110, 105, 140, 115, 112, 125, 105, 88],
                    borderColor: '#2563eb',
                    backgroundColor: '#2563eb',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: 'Connected',
                    data: [50, 62, 78, 68, 52, 65, 75, 72, 98, 79, 78, 88, 74, 62],
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: 'Missed',
                    data: [20, 23, 32, 27, 23, 25, 35, 33, 42, 36, 34, 37, 31, 26],
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 9 } }
                },
                y: {
                    min: 0,
                    max: 150,
                    ticks: { stepSize: 50, color: '#64748b', font: { family: 'Inter', size: 9 } },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// 7. Chart: Top Telecallers by Calls Horizontal Bar Chart
function initTopTelecallersChart() {
    const ctx = document.getElementById('topTelecallersChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Rahul Kumar', 'Priya Sharma', 'Arun Raj', 'Sneha K', 'Vikram S'],
            datasets: [{
                data: [320, 280, 210, 180, 140],
                backgroundColor: [
                    '#10b981', // Rahul Green
                    '#3b82f6', // Priya Blue
                    '#8b5cf6', // Arun Purple
                    '#f59e0b', // Sneha Orange
                    '#ec4899'  // Vikram Pink
                ],
                borderRadius: 4,
                barThickness: 10
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    min: 0,
                    max: 400,
                    ticks: { stepSize: 100, color: '#64748b', font: { family: 'Inter', size: 9 } },
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#334155', font: { family: 'Inter', size: 10, weight: 'bold' } }
                }
            }
        }
    });
}

// 8. Chart: Recording Storage Donut Chart
function initRecordingStorageChart() {
    const ctx = document.getElementById('recordingStorageChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Stored in R2', 'Pending Sync', 'Failed'],
            datasets: [{
                data: [531, 8, 3],
                backgroundColor: [
                    '#10b981', // Stored in R2 Green
                    '#f59e0b', // Pending Sync Yellow/Orange
                    '#ef4444'  // Failed Red
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
                    cornerRadius: 8
                }
            }
        }
    });
}

// 9. Chart: Recording Duration Trend Bar Chart
function initRecordingDurationTrendChart() {
    const ctx = document.getElementById('recordingDurationTrendChart');
    if (!ctx) return;

    const days = Array.from({length: 30}, (_, i) => `${i + 1} Sep`);
    // Sample daily recording hours
    const durationData = [
        3.5, 4.2, 2.1, 5.0, 6.2, 4.8, 3.1, 5.5, 7.0, 4.2, 
        6.8, 5.1, 8.2, 6.0, 4.5, 7.3, 8.5, 5.2, 6.1, 7.8, 
        9.0, 6.5, 8.0, 7.1, 6.8, 8.9, 9.5, 7.2, 6.4, 5.0
    ];

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Total Duration (Hours)',
                data: durationData,
                backgroundColor: '#2563eb',
                borderRadius: 2,
                barThickness: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => ` Duration: ${ctx.raw} hours`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'Inter', size: 9 },
                        callback: function(val, index) {
                            // Show tick every 5 days
                            return (index === 0 || index === 4 || index === 9 || index === 14 || index === 19 || index === 24 || index === 29) ? days[index] : '';
                        }
                    }
                },
                y: {
                    min: 0,
                    max: 15,
                    ticks: { stepSize: 5, color: '#64748b', font: { family: 'Inter', size: 9 }, callback: (val) => `${val}h` },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// 10. Chart: Top Telecallers by Recording Time Horizontal Bar Chart
function initTopTelecallersRecordingChart() {
    const ctx = document.getElementById('topTelecallersRecordingChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Rahul Kumar', 'Priya Sharma', 'Arun Raj', 'Sneha K', 'Vikram S'],
            datasets: [{
                data: [3.2, 2.13, 1.75, 1.33, 0.96], // Hours
                backgroundColor: [
                    '#2563eb', // Rahul Blue
                    '#0284c7', // Priya Sky Blue
                    '#8b5cf6', // Arun Purple
                    '#f59e0b', // Sneha Orange
                    '#ec4899'  // Vikram Pink
                ],
                borderRadius: 4,
                barThickness: 10
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    cornerRadius: 8,
                    callbacks: {
                        label: function(ctx) {
                            const valMap = ['3h 12m', '2h 08m', '1h 45m', '1h 20m', '0h 58m'];
                            return ` Recording Time: ${valMap[ctx.dataIndex]}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    min: 0,
                    max: 4,
                    ticks: { stepSize: 1, color: '#64748b', font: { family: 'Inter', size: 9 }, callback: (val) => `${val}h` },
                    grid: { color: '#f1f5f9' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#334155', font: { family: 'Inter', size: 10, weight: 'bold' } }
                }
            }
        }
    });
}

// 11. Performance Tab: Call Status Distribution Doughnut Chart
function initPerfStatusDistChart() {
    const ctx = document.getElementById('perfStatusDistChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Connected', 'Missed', 'No Answer', 'Busy', 'Failed'],
            datasets: [{
                data: [892, 213, 81, 42, 20],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#334155'],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '76%',
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', cornerRadius: 8 }
            }
        }
    });
}

// 12. Performance Tab: Call Trend (Last 14 Days) Line Chart
function initPerfCallTrendChart() {
    const ctx = document.getElementById('perfCallTrendChart');
    if (!ctx) return;

    const days = ['17 Sep', '18 Sep', '19 Sep', '20 Sep', '21 Sep', '22 Sep', '23 Sep', '24 Sep', '25 Sep', '26 Sep', '27 Sep', '28 Sep', '29 Sep', '30 Sep'];

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'Total Calls',
                    data: [80, 120, 100, 115, 135, 120, 125, 140, 180, 150, 148, 130, 160, 140],
                    borderColor: '#2563eb',
                    backgroundColor: '#2563eb',
                    borderWidth: 2,
                    tension: 0.35,
                    pointRadius: 2.5,
                    pointHoverRadius: 5
                },
                {
                    label: 'Connected',
                    data: [50, 85, 72, 70, 75, 70, 72, 85, 105, 102, 98, 88, 100, 85],
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    tension: 0.35,
                    pointRadius: 2.5,
                    pointHoverRadius: 5
                },
                {
                    label: 'Missed',
                    data: [20, 22, 18, 25, 20, 18, 22, 28, 30, 25, 22, 20, 24, 20],
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    borderWidth: 2,
                    tension: 0.35,
                    pointRadius: 2.5,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', cornerRadius: 8 }
            },
            scales: {
                x: {
                    grid: { color: '#f1f5f9' },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 9 } }
                },
                y: {
                    min: 0,
                    max: 200,
                    ticks: { stepSize: 50, color: '#64748b', font: { family: 'Inter', size: 9 } },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// 13. Performance Tab: Call Type Distribution Doughnut Chart
function initPerfCallTypeDistChart() {
    const ctx = document.getElementById('perfCallTypeDistChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Outbound', 'Inbound', 'Manual', 'Others'],
            datasets: [{
                data: [980, 156, 72, 40],
                backgroundColor: ['#2563eb', '#06b6d4', '#f59e0b', '#8b5cf6'],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '76%',
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', cornerRadius: 8 }
            }
        }
    });
}

// 14. Performance Tab: Call Time Analysis Stacked Bar Chart
function initPerfCallTimeAnalysisChart() {
    const ctx = document.getElementById('perfCallTimeAnalysisChart');
    if (!ctx) return;

    const hours = ['8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hours,
            datasets: [
                {
                    label: 'Connected',
                    data: [20, 40, 70, 80, 95, 60, 75, 65, 45, 30, 25, 15],
                    backgroundColor: '#10b981',
                    borderRadius: 2
                },
                {
                    label: 'Missed',
                    data: [8, 15, 20, 25, 22, 15, 18, 15, 12, 8, 6, 4],
                    backgroundColor: '#ef4444',
                    borderRadius: 2
                },
                {
                    label: 'Busy',
                    data: [4, 8, 12, 15, 14, 8, 10, 8, 6, 4, 3, 2],
                    backgroundColor: '#f59e0b',
                    borderRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', cornerRadius: 8 }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 9 } }
                },
                y: {
                    stacked: true,
                    min: 0,
                    max: 200,
                    ticks: { stepSize: 50, color: '#64748b', font: { family: 'Inter', size: 9 } },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// 15. Performance Tab: Average Call Duration Vertical Bar Chart
function initPerfAvgCallDurationChart() {
    const ctx = document.getElementById('perfAvgCallDurationChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Rahul', 'Priya', 'Arun', 'Sneha', 'Vikram'],
            datasets: [{
                data: [245, 210, 168, 142, 98],
                backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'],
                borderRadius: 4,
                barThickness: 32
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => ` Duration: ${ctx.raw}s`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#475569', font: { family: 'Inter', size: 10, weight: '600' } }
                },
                y: {
                    min: 0,
                    max: 300,
                    ticks: { stepSize: 100, color: '#64748b', font: { family: 'Inter', size: 9 }, callback: (v) => `${v}s` },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// 16. Performance Tab: Best Calling Days Vertical Bar Chart
function initPerfBestCallingDaysChart() {
    const ctx = document.getElementById('perfBestCallingDaysChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Total Calls',
                data: [128, 156, 142, 178, 168, 94, 82],
                backgroundColor: '#2563eb',
                borderRadius: 4,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', cornerRadius: 8 }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#475569', font: { family: 'Inter', size: 9, weight: '600' } }
                },
                y: {
                    min: 0,
                    max: 200,
                    ticks: { stepSize: 50, color: '#64748b', font: { family: 'Inter', size: 9 } },
                    grid: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// ==========================================
// REAL BACKEND TELEPHONY API INTEGRATION
// ==========================================

async function loadTelephonyData() {
    console.log("📡 Connecting Acefone Frontend to Backend API...");
    await Promise.allSettled([
        loadIntegrationDetails(),
        loadCrmUsers(),
        loadAcefoneAgents(),
        loadDids(),
        loadAgents(),
        loadCdrCallLogs(),
        loadPerformanceData()
    ]);
}

// Global stores
window.rawCrmUsers = [];
window.rawAcefoneAgents = [];
window.rawDids = [];

// 1. Fetch CRM Telecallers/Users
async function loadCrmUsers() {
    try {
        const data = await safeFetchJson('/telephony/crm-users');
        if (data.success && Array.isArray(data.users)) {
            window.rawCrmUsers = data.users;
            renderCrmUsersDropdown(data.users);
        } else {
            renderCrmUsersDropdown([]);
        }
    } catch (err) {
        console.warn("Failed to load CRM users:", err.message);
        renderCrmUsersDropdown([]);
    }
}

function renderCrmUsersDropdown(users) {
    const select = document.getElementById('crmUserSelect');
    const testSelect = document.getElementById('testAgentSelect');
    const didCrmSelect = document.getElementById('didCrmUserSelect');
    const didAgentSelect = document.getElementById('didAcefoneAgentSelect');

    if (users.length === 0) {
        if (select) select.innerHTML = '<option value="">No active CRM telecallers found</option>';
        if (testSelect) testSelect.innerHTML = '<option value="">No active CRM telecallers found</option>';
        if (didCrmSelect) didCrmSelect.innerHTML = '<option value="">No active CRM telecallers found</option>';
        if (didAgentSelect) didAgentSelect.innerHTML = '<option value="">No Acefone agents available</option>';
        return;
    }
    const optionsHtml = '<option value="">Select CRM Telecaller...</option>' + 
        users.map(u => `<option value="${u.user_id}">${u.name} (${u.role || 'Telecaller'}${u.phone ? ' - ' + u.phone : ''})</option>`).join('');

    const agentOptionsHtml = '<option value="">Select Acefone Agent...</option>' +
        users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');

    if (select) {
        select.innerHTML = optionsHtml;
        select.onchange = function() {
            const userId = this.value;
            const userObj = (window.rawCrmUsers || []).find(u => String(u.user_id) === String(userId));
            const phoneInput = document.getElementById('agentPhoneInput');
            if (userObj && userObj.phone && phoneInput) {
                phoneInput.value = userObj.phone;
            }
        };
    }
    if (testSelect) testSelect.innerHTML = optionsHtml;
    if (didCrmSelect) didCrmSelect.innerHTML = optionsHtml;
    if (didAgentSelect) didAgentSelect.innerHTML = agentOptionsHtml;
    const cdrTelecallerSelect = document.getElementById('cdrFilterTelecaller');
    if (cdrTelecallerSelect) {
        cdrTelecallerSelect.innerHTML = '<option value="">All Telecallers</option>' + 
            users.map(u => `<option value="${u.user_id}">${u.name}</option>`).join('');
    }
}

// 2. Fetch Acefone Agents
async function loadAcefoneAgents() {
    try {
        const data = await safeFetchJson('/telephony/acefone-agents');
        if (data.success && Array.isArray(data.agents)) {
            window.rawAcefoneAgents = data.agents;
            window.acefoneAgentSource = data.source;
            renderAcefoneAgentsDropdown(data.agents);
        } else {
            renderAcefoneAgentsDropdown([]);
        }
        return data;
    } catch (err) {
        console.warn("Failed to load Acefone agents:", err.message);
        renderAcefoneAgentsDropdown([]);
        return { success: false, error: err.message };
    }
}

function renderAcefoneAgentsDropdown(agents) {
    const select = document.getElementById('acefoneAgentSelect');
    const didAgentSelect = document.getElementById('didAcefoneAgentSelect');
    if (agents.length === 0) {
        if (select) select.innerHTML = '<option value="">No Acefone agents available</option>';
        if (didAgentSelect) didAgentSelect.innerHTML = '<option value="">No Acefone agents available</option>';
        return;
    }
    const optionsHtml = '<option value="">Select Acefone Agent...</option>' +
        agents.map(a => `<option value="${a.agent_name}">${a.agent_name} (Ext: ${a.extension})</option>`).join('');
    
    if (select) select.innerHTML = optionsHtml;
    if (didAgentSelect) didAgentSelect.innerHTML = optionsHtml;
}

// Sync Agents from Acefone API
window.syncAgentsFromAcefone = async function() {
    try {
        const res = await loadAcefoneAgents();
        await loadCrmUsers();
        if (window.showAlert) {
            if (res && res.source === 'acefone_api') {
                window.showAlert("Sync Complete", `✅ Successfully fetched ${window.rawAcefoneAgents.length || 0} live agents directly from Acefone API!`, "success");
            } else {
                window.showAlert("Acefone Token Notice", `⚠️ Acefone API returned 403 (Permission Denied) on /v1/users.\n\nTo fetch live agents directly from Acefone, please edit your API token in Acefone Portal and enable 'Users / Agent Management' scope.`, "info");
            }
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Sync Failed", err.message, "error");
    }
};

// Auto-populate Extension and Agent Mobile when Acefone Agent is selected
window.onAcefoneAgentChange = function() {
    const select = document.getElementById('acefoneAgentSelect');
    const extInput = document.getElementById('extensionInput');
    const phoneInput = document.getElementById('agentPhoneInput');
    if (!select || !extInput) return;

    const selectedId = select.value;
    const agent = window.rawAcefoneAgents.find(a => String(a.acefone_agent_id) === String(selectedId));

    if (agent) {
        extInput.value = agent.extension || '';
        if (phoneInput && agent.agent_phone) phoneInput.value = agent.agent_phone;
    } else {
        extInput.value = '';
    }
};

// When a CRM Telecaller is picked from the dropdown, pre-fill form if already mapped
window.onCrmUserChange = function() {
    const crmUserSelect = document.getElementById('crmUserSelect');
    const acefoneAgentInput = document.getElementById('acefoneAgentNameInput') || document.getElementById('acefoneAgentSelect');
    const extInput = document.getElementById('extensionInput');
    const phoneInput = document.getElementById('agentPhoneInput');
    const defaultDidSelect = document.getElementById('defaultDidSelect');
    if (!crmUserSelect) return;

    const selectedUserId = crmUserSelect.value;
    if (!selectedUserId) return;

    const existingMapping = (window.rawMappedAgents || []).find(m => String(m.crm_user_id) === String(selectedUserId));

    if (existingMapping) {
        if (acefoneAgentInput) acefoneAgentInput.value = existingMapping.agent_name || existingMapping.acefone_agent_id || '';
        if (extInput) extInput.value = existingMapping.extension || '';
        if (phoneInput) phoneInput.value = existingMapping.agent_phone || '';

        // Check assigned DIDs
        const assignedIds = (existingMapping.assigned_dids || []).map(d => String(d.id));
        document.querySelectorAll('input[name="did_checkbox"]').forEach(cb => {
            cb.checked = assignedIds.includes(String(cb.value));
        });

        // Update default DID dropdown & value
        updateDefaultDidOptions();
        if (defaultDidSelect && existingMapping.default_outbound_did_id) {
            defaultDidSelect.value = existingMapping.default_outbound_did_id;
        }

        // Set calling mode radio
        const callingChannel = existingMapping.calling_channel || 'extension';
        const radio = document.querySelector(`input[name="callingChannel"][value="${callingChannel}"]`);
        if (radio) radio.checked = true;
    }
};

// 3. Fetch DIDs Inventory & Render Checkbox Group
async function loadDids() {
    try {
        const data = await safeFetchJson('/telephony/dids');
        if (data.success && Array.isArray(data.dids)) {
            window.rawDids = data.dids;
            renderDidsTable(data.dids);
            renderDidsCheckboxGroup(data.dids);
        }
    } catch (err) {
        console.warn("Failed to load DIDs:", err.message);
    }
}

function renderDidsCheckboxGroup(dids) {
    const container = document.getElementById('assignedDidsGroup');
    if (!container) return;

    if (dids.length === 0) {
        container.innerHTML = '<div style="font-size: 0.75rem; color: #64748b;">No active DIDs configured in inventory</div>';
        return;
    }

    const editingAgentId = window.editingAgentId ? parseInt(window.editingAgentId) : null;

    container.innerHTML = dids.map(d => {
        const assignedToAgentId = d.telephony_agent_id ? parseInt(d.telephony_agent_id) : null;
        const isAssignedToOther = assignedToAgentId && assignedToAgentId !== editingAgentId;
        const agentLabel = d.acefone_agent_name || d.crm_user_name || 'Another Agent';

        if (isAssignedToOther) {
            return `
                <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; font-weight: 600; color: #94a3b8; cursor: not-allowed; padding: 0.2rem 0; opacity: 0.75;" title="Already assigned to ${agentLabel}">
                    <span style="display: flex; align-items: center; gap: 0.4rem;">
                        <input type="checkbox" name="did_checkbox" value="${d.id}" data-number="${d.did_number}" disabled style="cursor: not-allowed;">
                        <span style="font-family: monospace; font-size: 0.8rem; text-decoration: line-through;">${d.did_number}</span>
                        <span style="color: #ef4444; font-weight: 700; font-size: 0.72rem;">(Assigned to ${agentLabel})</span>
                    </span>
                    <span class="badge-status" style="font-size: 0.65rem; padding: 0.15rem 0.4rem; background: #fee2e2; color: #dc2626; border-radius: 4px;">● Occupied</span>
                </label>
            `;
        }

        return `
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; font-weight: 600; color: #0f172a; cursor: pointer; padding: 0.2rem 0;">
                <span style="display: flex; align-items: center; gap: 0.4rem;">
                    <input type="checkbox" name="did_checkbox" value="${d.id}" data-number="${d.did_number}" onchange="updateDefaultDidOptions()" accent-color="#10b981">
                    <span style="font-family: monospace; font-size: 0.8rem;">${d.did_number}</span>
                    <span style="color: #64748b; font-weight: 500;">(${d.display_name || 'Main'})</span>
                </span>
                <span class="badge-status badge-connected" style="font-size: 0.65rem; padding: 0.15rem 0.4rem;">● Available</span>
            </label>
        `;
    }).join('');

    updateDefaultDidOptions();
}

// Dynamic Default Outbound DID Dropdown (Picks only from assigned DIDs)
window.updateDefaultDidOptions = function() {
    const select = document.getElementById('defaultDidSelect');
    if (!select) return;

    const checkboxes = document.querySelectorAll('input[name="did_checkbox"]:checked');
    if (checkboxes.length === 0) {
        select.innerHTML = '<option value="">Select DID from assigned checkboxes above...</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    const currentVal = select.value;

    select.innerHTML = '<option value="">Select Default Outbound DID...</option>' +
        Array.from(checkboxes).map(cb => {
            const id = cb.value;
            const num = cb.getAttribute('data-number');
            return `<option value="${id}">${num} (Outbound Default)</option>`;
        }).join('');

    if (currentVal && Array.from(checkboxes).some(cb => cb.value === currentVal)) {
        select.value = currentVal;
    } else if (checkboxes.length > 0) {
        select.value = checkboxes[0].value;
    }
};

// Form Reset Helper
window.resetAgentMappingForm = function() {
    window.editingAgentId = null;
    const form = document.getElementById('agentMappingForm');
    if (form) form.reset();
    if (window.rawDids) renderDidsCheckboxGroup(window.rawDids);
    document.querySelectorAll('input[name="did_checkbox"]').forEach(cb => cb.checked = false);
    if (window.updateDefaultDidOptions) updateDefaultDidOptions();

    const saveBtn = document.getElementById('btnSaveAgentMapping');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Mapping';
        saveBtn.classList.remove('btn-editing');
    }
    const formTitle = document.getElementById('agentMappingFormTitle');
    if (formTitle) {
        formTitle.innerHTML = `<i class="fas fa-user-plus" style="color: #2563eb; margin-right: 0.35rem;"></i> Add / Edit Mapping`;
    }
};

// 4. Save Agent Mapping Handler
window.saveAgentMapping = async function(event) {
    if (event) event.preventDefault();

    const crmUserSelect = document.getElementById('crmUserSelect');
    const acefoneAgentInput = document.getElementById('acefoneAgentNameInput') || document.getElementById('acefoneAgentSelect');
    const extInput = document.getElementById('extensionInput');
    const phoneInput = document.getElementById('agentPhoneInput');
    const defaultDidSelect = document.getElementById('defaultDidSelect');
    const channelRadio = document.querySelector('input[name="callingChannel"]:checked');

    const crmUserId = crmUserSelect ? crmUserSelect.value : '';
    const agentNameInputVal = acefoneAgentInput ? acefoneAgentInput.value.trim() : '';
    const extension = extInput ? extInput.value.trim() : '';
    const agentPhone = phoneInput ? phoneInput.value.trim() : '';
    const defaultOutboundDidId = defaultDidSelect ? defaultDidSelect.value : '';
    const callingChannel = channelRadio ? channelRadio.value : 'extension';

    const selectedDidCheckboxes = document.querySelectorAll('input[name="did_checkbox"]:checked');
    const didIds = Array.from(selectedDidCheckboxes).map(cb => parseInt(cb.value));

    if (!crmUserId) {
        if (window.showAlert) window.showAlert('Required Field', 'Please select a CRM Telecaller.', 'error');
        else alert('Please select a CRM Telecaller.');
        return;
    }

    if (!agentNameInputVal) {
        if (window.showAlert) window.showAlert('Required Field', 'Please enter an Acefone Agent name.', 'error');
        else alert('Please enter an Acefone Agent name.');
        return;
    }

    if (!agentPhone) {
        if (window.showAlert) window.showAlert('Required Field', 'Please enter Agent Mobile Number.', 'error');
        else alert('Please enter Agent Mobile Number.');
        return;
    }

    if (didIds.length === 0) {
        if (window.showAlert) window.showAlert('Required Field', 'Please assign at least 1 DID number.', 'error');
        else alert('Please assign at least 1 DID number.');
        return;
    }

    if (!defaultOutboundDidId) {
        if (window.showAlert) window.showAlert('Required Field', 'Please select a Default Outbound DID.', 'error');
        else alert('Please select a Default Outbound DID.');
        return;
    }

    const agentName = agentNameInputVal;
    const acefoneAgentId = `ace_agent_${agentName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const saveBtn = document.getElementById('btnSaveAgentMapping');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const data = await safeFetchJson('/telephony/agents/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: window.editingAgentId || null,
                crm_user_id: crmUserId,
                acefone_agent_id: acefoneAgentId,
                agent_name: agentName,
                agent_phone: agentPhone,
                extension: extension,
                calling_channel: callingChannel,
                default_outbound_did_id: defaultOutboundDidId,
                did_ids: didIds
            })
        });

        if (data.success) {
            if (window.showAlert) {
                window.showAlert('Mapping Saved', `✅ Telecaller ${agentName} successfully mapped with DIDs!`, 'success');
            } else {
                alert(`✅ Telecaller ${agentName} successfully mapped with DIDs!`);
            }
            resetAgentMappingForm();
            await loadAgents();
        } else {
            if (window.showAlert) {
                window.showAlert('Mapping Error', data.error || 'Failed to save mapping', 'error');
            } else {
                alert(`❌ Mapping Error: ${data.error || 'Failed'}`);
            }
        }
    } catch (err) {
        if (window.showAlert) {
            window.showAlert('Network Error', err.message, 'error');
        } else {
            alert(`❌ Network Error: ${err.message}`);
        }
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = window.editingAgentId ? '<i class="fas fa-check-circle"></i> Update Mapping' : '<i class="fas fa-save"></i> Save Mapping';
        }
    }
};

// 5. Fetch & Render Mapped Agents Table
async function loadAgents() {
    try {
        const data = await safeFetchJson('/telephony/agents');
        if (data.success && Array.isArray(data.agents)) {
            window.rawMappedAgents = data.agents;
            renderAgentsTable(data.agents);
        }
    } catch (err) {
        console.warn("Failed to load agents:", err.message);
    }
}

function renderAgentsTable(agents) {
    const tableBody = document.getElementById('agentsTableBody');
    if (!tableBody) return;

    if (agents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: #64748b; padding: 2rem;">
                    <i class="fas fa-user-slash" style="font-size: 1.5rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
                    No mapped telecaller agents found. Fill the form on the right to assign an agent.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = agents.map((agent, index) => {
        const assignedDidsList = (agent.assigned_dids || []).map(d => d.did_number).join(', ') || agent.default_did_number || 'No DIDs';
        const avatarBgColors = ['#ec4899', '#a855f7', '#14b8a6', '#3b82f6', '#f59e0b', '#0ea5e9'];
        const avatarBg = avatarBgColors[index % avatarBgColors.length];
        const initials = agent.crm_user_name ? agent.crm_user_name.slice(0,2).toUpperCase() : 'AG';

        return `
            <tr>
                <td style="font-weight: 700; color: #64748b;">${index + 1}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="mapping-avatar-circle" style="background: ${avatarBg}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.72rem;">${initials}</div>
                        <div>
                            <div style="font-weight: 800; color: #0f172a;">${agent.crm_user_name || 'CRM Telecaller'}</div>
                            <div style="font-size: 0.68rem; color: #64748b;">(${agent.crm_user_email || 'User ID: ' + agent.crm_user_id})</div>
                        </div>
                    </div>
                </td>
                <td style="font-weight: 600;">
                    ${agent.agent_name}
                    <div style="font-size: 0.68rem; color: #64748b;">(${agent.acefone_agent_id})</div>
                </td>
                <td style="font-family: monospace; font-weight: 700; color: #2563eb;">${agent.extension || '-'}</td>
                <td>${agent.agent_phone || '-'}</td>
                <td>
                    <div style="font-weight: 700; font-size: 0.76rem; color: #0f172a;">${agent.default_did_number ? '★ ' + agent.default_did_number : 'Default DID'}</div>
                    <div style="font-size: 0.68rem; color: #059669; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${assignedDidsList}">
                        ${assignedDidsList}
                    </div>
                </td>
                <td><span class="badge-status ${agent.is_active ? 'badge-connected' : 'badge-missed'}">● ${agent.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style="font-weight: 600; color: #475569; text-transform: capitalize;">${agent.calling_channel}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <button class="btn-test-call-sm" onclick="triggerTestCall('${agent.crm_user_id}')" title="Test Click-to-Call"><i class="fas fa-phone-alt"></i> Test</button>
                        <button class="btn-more-sm" onclick="editAgentMapping(${agent.id})" style="color: #2563eb; background: #eff6ff; border-color: #bfdbfe;" title="Edit Agent Mapping"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn-more-sm" onclick="deleteAgentMapping(${agent.id}, '${agent.agent_name}')" style="color: #ef4444;" title="Delete Agent Mapping"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Edit Agent Mapping Handler
window.editAgentMapping = function(agentId) {
    const agent = (window.rawMappedAgents || []).find(a => a.id === agentId);
    if (!agent) {
        console.warn("Agent not found for ID:", agentId);
        return;
    }

    window.editingAgentId = agentId;
    if (window.rawDids) renderDidsCheckboxGroup(window.rawDids);

    // 1. Select CRM User
    const crmUserSelect = document.getElementById('crmUserSelect');
    if (crmUserSelect) {
        crmUserSelect.value = agent.crm_user_id;
    }

    // 2. Acefone Agent Name
    const acefoneAgentInput = document.getElementById('acefoneAgentNameInput') || document.getElementById('acefoneAgentSelect');
    if (acefoneAgentInput) {
        acefoneAgentInput.value = agent.agent_name || '';
    }

    // 3. Extension
    const extInput = document.getElementById('extensionInput');
    if (extInput) {
        extInput.value = agent.extension || '';
    }

    // 4. Agent Phone
    const phoneInput = document.getElementById('agentPhoneInput');
    if (phoneInput) {
        phoneInput.value = agent.agent_phone || '';
    }

    // 5. Calling Channel radio button
    const channelRadio = document.querySelector(`input[name="callingChannel"][value="${agent.calling_channel || 'both'}"]`);
    if (channelRadio) {
        channelRadio.checked = true;
    }

    // 6. Check assigned DIDs
    const assignedDids = agent.assigned_dids || [];
    const assignedIds = assignedDids.map(d => typeof d === 'object' ? d.id : d);

    document.querySelectorAll('input[name="did_checkbox"]').forEach(cb => {
        const val = parseInt(cb.value);
        cb.checked = assignedIds.includes(val);
    });

    // 7. Update Default DID dropdown options dynamically
    if (window.updateDefaultDidOptions) {
        window.updateDefaultDidOptions();
    }

    // 8. Select default outbound DID
    const defaultDidSelect = document.getElementById('defaultDidSelect');
    if (defaultDidSelect && agent.default_outbound_did_id) {
        defaultDidSelect.value = agent.default_outbound_did_id;
    }

    // 9. Update Form title & Save Button text to show editing state
    const formTitle = document.getElementById('agentMappingFormTitle');
    if (formTitle) {
        formTitle.innerHTML = `<i class="fas fa-edit" style="color: #2563eb; margin-right: 0.35rem;"></i> Edit Mapping: <strong>${agent.agent_name}</strong>`;
    }

    const saveBtn = document.getElementById('btnSaveAgentMapping');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Update Mapping';
        saveBtn.classList.add('btn-editing');
    }

    // Smooth scroll to mapping form
    const targetElement = document.getElementById('agentMappingForm') || document.getElementById('crmUserSelect');
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (window.showAlert) {
        window.showAlert('Edit Mode', `Loaded mapping details for "${agent.agent_name}". Modify form and click Update Mapping.`, 'info');
    }
};

// Delete Agent Mapping Handler
window.deleteAgentMapping = async function(agentId, agentName) {
    if (!confirm(`Are you sure you want to remove agent mapping for "${agentName}"?`)) return;

    try {
        const data = await safeFetchJson(`/telephony/agents/${agentId}`, { method: 'DELETE' });
        if (data.success) {
            if (window.showAlert) window.showAlert('Deleted', `Agent mapping for ${agentName} removed.`, 'info');
            else alert(`Agent mapping for ${agentName} removed.`);
            await loadAgents();
        } else {
            alert(`Error: ${data.error || 'Failed to delete'}`);
        }
    } catch (err) {
        alert(`Network error: ${err.message}`);
    }
};

// Helper for resolving API endpoint relative to window.API_URL or local backend port 5000
function getApiUrl(endpoint) {
    let base = window.API_URL;
    if (!base) {
        if (window.location && window.location.port === '5000') {
            base = '/api';
        } else {
            base = 'http://127.0.0.1:5000/api';
        }
    }
    base = base.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return `${base}${path}`;
}

async function safeFetchJson(endpoint, options = {}) {
    const fullUrl = getApiUrl(endpoint);
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };
    const reqOptions = {
        ...options,
        headers
    };
    const res = await fetch(fullUrl, reqOptions);
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(`Server returned status ${res.status}: ${text.slice(0, 150)}`);
    }
    return data;
}

function getWebhookBaseUrl() {
    if (window.API_URL) {
        return window.API_URL.replace(/\/api\/?$/, '');
    }
    if (window.location && window.location.port === '5000') {
        return window.location.origin;
    }
    return 'http://127.0.0.1:5000';
}

// 1. Fetch Integration Status & Settings
async function loadIntegrationDetails() {
    // Populate Webhook URL
    const webhookUrlEl = document.getElementById('webhookUrlDisplay');
    if (webhookUrlEl) {
        const webhookBase = getWebhookBaseUrl();
        webhookUrlEl.textContent = `${webhookBase}/api/integrations/acefone/webhook`;
    }

    try {
        const data = await safeFetchJson('/telephony/integration');
        if (data.success && data.integration) {
            updateIntegrationUI(data.integration);
        }
    } catch (err) {
        console.warn("Failed to load integration details:", err.message);
    }
}

// Utility: Format Date Time cleanly
function formatDateTime(isoStr) {
    if (!isoStr) return 'Never';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return 'Never';
        return d.toLocaleString('en-US', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    } catch (e) {
        return 'Never';
    }
}

// Comprehensive UI state update for header, overview, and API tab
function updateIntegrationUI(int) {
    const isConfigured = int && int.credential_last_four && int.masked_token !== 'Not Configured';
    const healthStatus = int ? (int.health_status || 'unconfigured') : 'unconfigured';
    const envStr = (int && int.environment) ? (int.environment.charAt(0).toUpperCase() + int.environment.slice(1)) : 'Production';
    const maskedToken = isConfigured ? int.masked_token : 'Not Configured';
    const lastTestedStr = formatDateTime(int ? int.last_tested_at : null);
    const lastWebhookStr = int && int.last_webhook_at ? formatDateTime(int.last_webhook_at) : 'No webhooks received';

    // 1. Inputs
    const configInput = document.getElementById('apiConfigTokenInput');
    if (configInput) configInput.placeholder = isConfigured ? maskedToken : 'Enter your Acefone API token';
    const envSelect = document.getElementById('apiEnvironmentSelect');
    if (envSelect && int && int.environment) envSelect.value = int.environment;

    // 2. Token display elements
    const tokenVal = document.getElementById('apiTokenVal');
    if (tokenVal) tokenVal.textContent = maskedToken;

    // 3. Overview Card Fields
    const overviewEnvVal = document.getElementById('overviewEnvVal');
    if (overviewEnvVal) overviewEnvVal.textContent = envStr;
    const overviewLastTestedVal = document.getElementById('overviewLastTestedVal');
    if (overviewLastTestedVal) overviewLastTestedVal.textContent = lastTestedStr;
    const overviewLastWebhookVal = document.getElementById('overviewLastWebhookVal');
    if (overviewLastWebhookVal) overviewLastWebhookVal.textContent = lastWebhookStr;

    // 4. API Info Fields
    const infoEnvVal = document.getElementById('infoEnvVal');
    if (infoEnvVal) infoEnvVal.textContent = envStr;
    const infoLastTestedVal = document.getElementById('infoLastTestedVal');
    if (infoLastTestedVal) infoLastTestedVal.textContent = lastTestedStr;
    const infoLastWebhookVal = document.getElementById('infoLastWebhookVal');
    if (infoLastWebhookVal) infoLastWebhookVal.textContent = lastWebhookStr;

    // Elements for Header & Badges & Banners
    const headerBadge = document.getElementById('headerStatusBadge');
    const headerDot = document.getElementById('headerStatusDot');
    const headerText = document.getElementById('headerStatusText');

    const ovBadge = document.getElementById('overviewBadgeStatus');
    const ovDot = document.getElementById('overviewBadgeDot');
    const ovText = document.getElementById('overviewBadgeText');
    const ovStatusVal = document.getElementById('overviewStatusVal');

    const apiBanner = document.getElementById('apiBannerContainer');
    const apiBannerIcon = document.getElementById('apiBannerIcon');
    const apiBannerTitle = document.getElementById('apiBannerTitle');
    const apiBannerSub = document.getElementById('apiBannerSub');
    const apiBannerLastTested = document.getElementById('apiBannerLastTested');

    const tokenBadge = document.getElementById('tokenStatusBadge');
    const connBox = document.getElementById('connStatusBox');
    const connDot = document.getElementById('connStatusDot');
    const connTitle = document.getElementById('connStatusTitle');
    const connSub = document.getElementById('connStatusSub');
    const infoTokenStatus = document.getElementById('infoTokenStatusVal');

    if (!isConfigured) {
        // STATE: NOT CONFIGURED
        if (headerBadge) { headerBadge.style.background = '#f1f5f9'; headerBadge.style.color = '#64748b'; }
        if (headerDot) { headerDot.style.background = '#94a3b8'; }
        if (headerText) { headerText.textContent = 'Not Configured'; }

        if (ovBadge) { ovBadge.style.background = '#fef3c7'; ovBadge.style.color = '#b45309'; }
        if (ovDot) { ovDot.style.background = '#f59e0b'; }
        if (ovText) { ovText.textContent = 'Not Configured'; }
        if (ovStatusVal) { ovStatusVal.innerHTML = '<span style="color: #94a3b8;">●</span> Not Configured'; }

        if (apiBanner) { apiBanner.className = 'api-banner-warning'; apiBanner.style.background = '#fffbeb'; apiBanner.style.borderColor = '#fde68a'; }
        if (apiBannerIcon) { apiBannerIcon.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #d97706;"></i>'; }
        if (apiBannerTitle) { apiBannerTitle.textContent = 'Acefone Integration Not Configured'; }
        if (apiBannerSub) { apiBannerSub.textContent = 'Please enter your Acefone API token below and click Save Settings.'; }
        if (apiBannerLastTested) { apiBannerLastTested.textContent = 'Last tested: Never'; }

        if (tokenBadge) { tokenBadge.style.background = '#f1f5f9'; tokenBadge.style.color = '#64748b'; tokenBadge.style.borderColor = '#cbd5e1'; tokenBadge.innerHTML = '<span style="color: #94a3b8;">●</span> Not Configured'; }

        if (connBox) { connBox.style.background = '#f8fafc'; connBox.style.borderColor = '#e2e8f0'; }
        if (connDot) { connDot.style.background = '#94a3b8'; }
        if (connTitle) { connTitle.textContent = 'Not Configured'; connTitle.style.color = '#475569'; }
        if (connSub) { connSub.textContent = 'Please configure your API token'; }
        if (infoTokenStatus) { infoTokenStatus.innerHTML = '<span style="color: #94a3b8;">●</span> Not Configured'; infoTokenStatus.style.color = '#64748b'; }

    } else if (healthStatus === 'healthy' || healthStatus === 'configured') {
        // STATE: CONNECTED & HEALTHY
        if (headerBadge) { headerBadge.style.background = '#dcfce7'; headerBadge.style.color = '#15803d'; }
        if (headerDot) { headerDot.style.background = '#10b981'; }
        if (headerText) { headerText.textContent = 'Acefone Connected'; }

        if (ovBadge) { ovBadge.style.background = '#dcfce7'; ovBadge.style.color = '#15803d'; }
        if (ovDot) { ovDot.style.background = '#10b981'; }
        if (ovText) { ovText.textContent = 'Connected'; }
        if (ovStatusVal) { ovStatusVal.innerHTML = '<span style="color: #10b981;">●</span> Active'; ovStatusVal.style.color = '#10b981'; }

        if (apiBanner) { apiBanner.className = 'api-banner-success'; apiBanner.style.background = '#f0fdf4'; apiBanner.style.borderColor = '#bbf7d0'; }
        if (apiBannerIcon) { apiBannerIcon.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i>'; }
        if (apiBannerTitle) { apiBannerTitle.textContent = 'Acefone is connected successfully!'; }
        if (apiBannerSub) { apiBannerSub.textContent = 'Your API token is valid and connection is working.'; }
        if (apiBannerLastTested) { apiBannerLastTested.textContent = `Last tested: ${lastTestedStr}`; }

        if (tokenBadge) { tokenBadge.style.background = '#dcfce7'; tokenBadge.style.color = '#15803d'; tokenBadge.style.borderColor = '#bbf7d0'; tokenBadge.innerHTML = '<span style="color: #10b981;">●</span> Valid'; }

        if (connBox) { connBox.style.background = '#f0fdf4'; connBox.style.borderColor = '#bbf7d0'; }
        if (connDot) { connDot.style.background = '#10b981'; }
        if (connTitle) { connTitle.textContent = 'Connected'; connTitle.style.color = '#10b981'; }
        if (connSub) { connSub.textContent = 'Acefone integration is active'; }
        if (infoTokenStatus) { infoTokenStatus.innerHTML = '<span style="color: #10b981;">●</span> Valid'; infoTokenStatus.style.color = '#10b981'; }

    } else {
        // STATE: FAILED / DEGRADED
        if (headerBadge) { headerBadge.style.background = '#fee2e2'; headerBadge.style.color = '#b91c1c'; }
        if (headerDot) { headerDot.style.background = '#ef4444'; }
        if (headerText) { headerText.textContent = 'Connection Failed'; }

        if (ovBadge) { ovBadge.style.background = '#fee2e2'; ovBadge.style.color = '#b91c1c'; }
        if (ovDot) { ovDot.style.background = '#ef4444'; }
        if (ovText) { ovText.textContent = 'Connection Failed'; }
        if (ovStatusVal) { ovStatusVal.innerHTML = '<span style="color: #ef4444;">●</span> Connection Failed'; ovStatusVal.style.color = '#ef4444'; }

        if (apiBanner) { apiBanner.className = 'api-banner-failed'; apiBanner.style.background = '#fef2f2'; apiBanner.style.borderColor = '#fecaca'; }
        if (apiBannerIcon) { apiBannerIcon.innerHTML = '<i class="fas fa-times-circle" style="color: #ef4444;"></i>'; }
        if (apiBannerTitle) { apiBannerTitle.textContent = 'Acefone Connection Failed'; }
        if (apiBannerSub) { apiBannerSub.textContent = 'API token is invalid or server connection failed. Please verify credentials.'; }
        if (apiBannerLastTested) { apiBannerLastTested.textContent = `Last tested: ${lastTestedStr}`; }

        if (tokenBadge) { tokenBadge.style.background = '#fee2e2'; tokenBadge.style.color = '#b91c1c'; tokenBadge.style.borderColor = '#fecaca'; tokenBadge.innerHTML = '<span style="color: #ef4444;">●</span> Invalid'; }

        if (connBox) { connBox.style.background = '#fef2f2'; connBox.style.borderColor = '#fecaca'; }
        if (connDot) { connDot.style.background = '#ef4444'; }
        if (connTitle) { connTitle.textContent = 'Connection Failed'; connTitle.style.color = '#ef4444'; }
        if (connSub) { connSub.textContent = 'API token is invalid or connection error'; }
        if (infoTokenStatus) { infoTokenStatus.innerHTML = '<span style="color: #ef4444;">●</span> Invalid'; infoTokenStatus.style.color = '#ef4444'; }
    }
}

// Clipboard Helpers
window.copyToClipboard = function(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if (window.showAlert) window.showAlert('Copied', `Copied to clipboard: ${text}`, 'success');
    }).catch(err => {
        if (window.showAlert) window.showAlert('Copy Error', err.message, 'error');
    });
};

window.copyWebhookUrl = function() {
    const webhookBase = getWebhookBaseUrl();
    const url = `${webhookBase}/api/integrations/acefone/webhook`;
    window.copyToClipboard(url);
};

// Save API Credentials Form Handler
window.saveApiCredentials = async function(event) {
    if (event) event.preventDefault();
    const tokenInput = document.getElementById('apiConfigTokenInput');
    const envSelect = document.getElementById('apiEnvironmentSelect');
    const tokenVal = tokenInput ? tokenInput.value.trim() : '';

    if (!tokenVal) {
        if (window.showAlert) window.showAlert("Required", "Please enter a valid API token.", "error");
        return;
    }

    const saveBtn = document.getElementById('btnSaveApiSettings');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    try {
        const data = await safeFetchJson('/telephony/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_token: tokenVal,
                environment: envSelect ? envSelect.value : 'production'
            })
        });

        if (data.success) {
            if (window.showAlert) {
                window.showAlert("Saved Successfully", `API credentials saved successfully!\nMasked Token: ${data.masked_token}`, "success");
            }
            if (tokenInput) tokenInput.value = '';
            await loadIntegrationDetails();
            await runConnectionTest();
        } else {
            if (window.showAlert) window.showAlert("Save Error", data.error || 'Failed to save settings', "error");
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Network Error", err.message, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Settings';
        }
    }
};

// Test Acefone API Connection
window.runConnectionTest = async function() {
    console.log("⚡ Testing connection to Acefone API...");
    try {
        const data = await safeFetchJson('/telephony/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        await loadIntegrationDetails();
        if (data.success) {
            if (window.showAlert) {
                window.showAlert("Connection Passed", "✅ Connection Test Passed! Acefone API is connected & healthy.", "success");
            }
        } else {
            if (window.showAlert) {
                window.showAlert("Connection Failed", data.message || data.error || 'Invalid API Token or Network Issue', "error");
            }
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Network Error", err.message, "error");
    }
};



// 3. Fetch DIDs Inventory
async function loadDids() {
    try {
        const data = await safeFetchJson('/telephony/dids');
        if (data.success && Array.isArray(data.dids)) {
            window.rawDids = data.dids;
            renderDidsTable(data.dids);
            renderDidsCheckboxGroup(data.dids);
        }
    } catch (err) {
        console.warn("Failed to load DIDs:", err.message);
    }
}

function updateDidKpiCards(dids) {
    const list = Array.isArray(dids) ? dids : [];
    const total = list.length;
    const active = list.filter(d => d.status === 'active' || d.status === 'ACTIVE').length;
    const assigned = list.filter(d => d.crm_user_id || (d.destination_name && d.destination_name !== '-')).length;
    const unassigned = total - assigned;

    const totalEl = document.getElementById('kpiTotalDidsCount');
    if (totalEl) totalEl.textContent = total;

    const activeEl = document.getElementById('kpiActiveDidsCount');
    if (activeEl) activeEl.textContent = active;

    const assignedEl = document.getElementById('kpiAssignedDidsCount');
    if (assignedEl) assignedEl.textContent = assigned;

    const unassignedEl = document.getElementById('kpiUnassignedDidsCount');
    if (unassignedEl) unassignedEl.textContent = unassigned < 0 ? 0 : unassigned;

    const agentsDidsEl = document.getElementById('agentsTabAvailableDidsCount');
    if (agentsDidsEl) agentsDidsEl.textContent = total;

    const agentsDidsSub = document.getElementById('agentsTabAvailableDidsSub');
    if (agentsDidsSub) {
        agentsDidsSub.innerHTML = `
            <span style="color: #10b981; font-weight: 700;">${assigned} Assigned</span>
            <span style="color: #059669; font-weight: 700; margin-left: 6px;">🍃 ${unassigned < 0 ? 0 : unassigned} Unassigned</span>
        `;
    }
}

function renderDidsTable(dids) {
    updateDidKpiCards(dids);

    const tableBody = document.getElementById('didsTableBody') || document.querySelector('#tab-panel-dids tbody');
    if (!tableBody) return;

    if (dids.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #64748b; padding: 2rem;">
                    <i class="fas fa-sim-card" style="font-size: 1.5rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
                    No DIDs found. Enter a DID Number and click "Save DID" to add your virtual number.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = dids.map((did, index) => {
        const statusBadge = did.status === 'active' 
            ? '<span class="badge-status badge-connected">● Active</span>' 
            : '<span class="badge-status badge-missed">● Inactive</span>';

        return `
            <tr>
                <td style="font-weight: 700; color: #64748b;">${index + 1}</td>
                <td style="font-weight: 800; color: #0f172a; font-family: monospace; font-size: 0.85rem;">
                    ${did.did_number}
                    ${did.display_name ? `<div style="font-size: 0.68rem; color: #64748b; font-family: sans-serif; font-weight: 500;">${did.display_name}</div>` : ''}
                </td>
                <td>${statusBadge}</td>
                <td style="text-align: right; white-space: nowrap;">
                    <button class="btn-edit-sm" onclick="editDid(${did.id})" title="Edit DID"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn-delete-sm" onclick="deleteDid(${did.id}, '${did.did_number}')" title="Delete DID" style="margin-left: 4px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; padding: 0.25rem 0.55rem; font-size: 0.72rem; font-weight: 600; cursor: pointer;"><i class="fas fa-trash-alt"></i> Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Delete DID Handler
window.deleteDid = async function(didId, numberStr) {
    if (!confirm(`Are you sure you want to delete DID number ${numberStr || ''}?`)) return;

    try {
        const data = await safeFetchJson(`/telephony/dids/${didId}`, {
            method: 'DELETE'
        });
        if (data.success) {
            if (window.showAlert) window.showAlert("Deleted", `✅ DID number ${numberStr || ''} deleted successfully!`, "success");
            await loadDids();
        } else {
            if (window.showAlert) window.showAlert("Delete Error", data.error || "Failed to delete DID", "error");
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Network Error", err.message, "error");
    }
};

// Sync DIDs directly from Acefone API (/v1/my_number)
window.syncDidsFromAcefone = async function() {
    const btn = document.getElementById('btnSyncDids');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
    }
    try {
        const data = await safeFetchJson('/telephony/dids/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (data.success && Array.isArray(data.dids)) {
            window.rawDids = data.dids;
            renderDidsTable(data.dids);
            renderDidsCheckboxGroup(data.dids);
            if (window.showAlert) {
                window.showAlert("Sync Complete", `✅ Successfully fetched ${data.dids.length} live DIDs from Acefone API!`, "success");
            }
        } else {
            if (window.showAlert) {
                window.showAlert("Manual Mode Recommended", `⚠️ Acefone API did not return DIDs automatically (${data.error || 'Permission Denied'}).\n\nYou can easily add and manage your DID numbers manually using the "Add / Edit DID" form.`, "info");
            }
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Network Error", err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync from Acefone';
        }
    }
};

// Open Modal Handler for Adding New DID
window.openAddDidModal = function() {
    resetDidForm();
    const titleEl = document.getElementById('modalDidTitle');
    if (titleEl) titleEl.textContent = 'Add New DID Number';
    if (window.openAcefoneModal) window.openAcefoneModal('modalAddEditDid');
};

// Edit DID form filler
window.editDid = function(didId) {
    const did = (window.rawDids || []).find(d => String(d.id) === String(didId));
    if (!did) return;

    if (document.getElementById('didIdInput')) document.getElementById('didIdInput').value = did.id;
    if (document.getElementById('didNumberInput')) document.getElementById('didNumberInput').value = did.did_number || '';
    if (document.getElementById('didDisplayNameInput')) document.getElementById('didDisplayNameInput').value = did.display_name || '';

    const statusSelect = document.getElementById('didStatusSelect');
    if (statusSelect) statusSelect.value = did.status || 'active';

    const notesInput = document.getElementById('didNotesInput');
    if (notesInput) notesInput.value = did.notes || '';

    const titleEl = document.getElementById('modalDidTitle');
    if (titleEl) titleEl.textContent = 'Edit DID Number';

    if (window.openAcefoneModal) window.openAcefoneModal('modalAddEditDid');
};

// Save DID Form handler
window.saveDidForm = async function(event) {
    if (event) event.preventDefault();

    const id = document.getElementById('didIdInput') ? document.getElementById('didIdInput').value : '';
    const did_number = document.getElementById('didNumberInput') ? document.getElementById('didNumberInput').value.trim() : '';
    const display_name = document.getElementById('didDisplayNameInput') ? document.getElementById('didDisplayNameInput').value.trim() : '';
    const status = document.getElementById('didStatusSelect') ? document.getElementById('didStatusSelect').value : 'active';
    const notes = document.getElementById('didNotesInput') ? document.getElementById('didNotesInput').value.trim() : '';

    if (!did_number) {
        if (window.showAlert) window.showAlert("Required Field", "Please enter a valid DID Number.", "error");
        return;
    }

    try {
        const data = await safeFetchJson('/telephony/dids/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id, did_number, display_name, status, notes
            })
        });

        if (data.success) {
            if (window.showAlert) window.showAlert("Saved Successfully", "✅ DID saved successfully!", "success");
            if (window.closeAcefoneModal) window.closeAcefoneModal('modalAddEditDid');
            resetDidForm();
            await loadDids();
        } else {
            if (window.showAlert) window.showAlert("Save Error", data.error || 'Failed to save DID', "error");
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Network Error", err.message, "error");
    }
};

window.resetDidForm = function() {
    const form = document.getElementById('didForm');
    if (form) form.reset();
    if (document.getElementById('didIdInput')) document.getElementById('didIdInput').value = '';
};

window.filterDidsTable = function() {
    const searchVal = (document.getElementById('searchDidInput')?.value || '').toLowerCase();
    const statusVal = document.getElementById('filterDidStatus')?.value || '';

    const filtered = (window.rawDids || []).filter(d => {
        const numMatch = !searchVal || (d.did_number || '').toLowerCase().includes(searchVal) || (d.display_name || '').toLowerCase().includes(searchVal) || (d.crm_user_name || '').toLowerCase().includes(searchVal);
        const statusMatch = !statusVal || String(d.status).toLowerCase() === statusVal.toLowerCase();
        return numMatch && statusMatch;
    });

    renderDidsTable(filtered);
};

// 4. REAL ACEFONE CDR LOGS INTEGRATION & CLOUDFLARE R2 AUDIO
window.cdrCurrentPage = 1;
window.cdrPageLimit = 25;
window.cdrTotalPages = 1;
window.cdrCurrentCalls = [];
window.cdrSelectedCall = null;
window.cdrSearchDebounceTimer = null;

// Format duration in mm:ss or hh:mm:ss
function formatCdrDuration(totalSeconds) {
    const s = parseInt(totalSeconds, 10) || 0;
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hours > 0) {
        return `${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Format Date & Time cleanly
function formatCdrDate(dateStr) {
    if (!dateStr) return { date: '--', time: '--', full: '--' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: String(dateStr), time: '', full: String(dateStr) };
    const dateFormatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
        date: dateFormatted,
        time: timeFormatted,
        full: `${dateFormatted}, ${timeFormatted}`
    };
}

// Primary CDR Fetch Function
window.loadCdrCallLogs = async function(page = window.cdrCurrentPage) {
    window.cdrCurrentPage = page;
    const tableBody = document.getElementById('cdrTableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 2rem; color: #64748b;">
                    <i class="fas fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Fetching real Acefone CDR records...
                </td>
            </tr>
        `;
    }

    try {
        const typeEl = document.getElementById('cdrFilterCallType');
        const statusEl = document.getElementById('cdrFilterCallStatus');
        const telecallerEl = document.getElementById('cdrFilterTelecaller');
        const searchEl = document.getElementById('cdrSearchInput');

        const params = new URLSearchParams({
            page: String(window.cdrCurrentPage),
            limit: String(window.cdrPageLimit)
        });

        if (typeEl && typeEl.value && typeEl.value !== 'all') {
            params.append('call_type', typeEl.value);
        }
        if (statusEl && statusEl.value && statusEl.value !== 'all') {
            params.append('status', statusEl.value);
        }
        if (telecallerEl && telecallerEl.value) {
            params.append('telecaller_id', telecallerEl.value);
        }
        if (searchEl && searchEl.value.trim()) {
            params.append('search', searchEl.value.trim());
        }

        const data = await safeFetchJson(`/telephony/calls?${params.toString()}`);
        if (!data || !data.success) {
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="11" style="text-align: center; padding: 2rem; color: #ef4444;">
                            <i class="fas fa-exclamation-circle" style="margin-right: 0.5rem;"></i> ${(data && data.error) || 'Failed to load Call Logs'}
                        </td>
                    </tr>
                `;
            }
            return;
        }

        // Update KPI summary cards
        if (data.stats) {
            const kpiTotal = document.getElementById('cdrKpiTotalCalls');
            const kpiConn = document.getElementById('cdrKpiConnectedCalls');
            const kpiConnPct = document.getElementById('cdrKpiConnectedPct');
            const kpiMiss = document.getElementById('cdrKpiMissedCalls');
            const kpiMissPct = document.getElementById('cdrKpiMissedPct');
            const kpiTalk = document.getElementById('cdrKpiTotalTalkTime');
            const kpiCust = document.getElementById('cdrKpiUniqueCustomers');

            if (kpiTotal) kpiTotal.textContent = (data.stats.total_calls || 0).toLocaleString();
            if (kpiConn) kpiConn.textContent = (data.stats.connected_calls || 0).toLocaleString();
            if (kpiConnPct) kpiConnPct.innerHTML = `<i class="fas fa-arrow-up" style="margin-right: 2px;"></i> ${data.stats.connected_pct || 0}%`;
            if (kpiMiss) kpiMiss.textContent = (data.stats.missed_calls || 0).toLocaleString();
            if (kpiMissPct) kpiMissPct.innerHTML = `<i class="fas fa-arrow-down" style="margin-right: 2px;"></i> ${data.stats.missed_pct || 0}%`;
            if (kpiTalk) kpiTalk.textContent = formatCdrDuration(data.stats.total_talk_time_seconds || 0);
            if (kpiCust) kpiCust.textContent = (data.stats.unique_customers || 0).toLocaleString();
        }

        window.cdrCurrentCalls = Array.isArray(data.calls) ? data.calls : [];
        window.renderCdrTable(window.cdrCurrentCalls);
        window.renderCdrPagination(data.pagination || { page: window.cdrCurrentPage, limit: window.cdrPageLimit, total: window.cdrCurrentCalls.length, totalPages: 1 });

        // Select the first call if available
        if (window.cdrCurrentCalls.length > 0) {
            window.selectCdrCallDetail(window.cdrCurrentCalls[0].id, false);
        } else {
            window.resetCdrCallDetail();
        }

        // Also update overview dashboard table if present
        renderOverviewLogsPreview(window.cdrCurrentCalls.slice(0, 5));
    } catch (err) {
        console.error("Error loading CDR records:", err);
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 2rem; color: #ef4444;">
                        <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i> Network error loading CDR logs: ${err.message}
                    </td>
                </tr>
            `;
        }
    }
};

// Render CDR Table Rows
window.renderCdrTable = function(calls) {
    const tableBody = document.getElementById('cdrTableBody');
    if (!tableBody) return;

    if (!calls || calls.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 3rem 1rem; color: #64748b;">
                    <i class="fas fa-inbox" style="font-size: 2rem; color: #cbd5e1; display: block; margin-bottom: 0.5rem;"></i>
                    No call records found matching criteria. Click <strong>Sync Acefone CDR</strong> to pull latest calls.
                </td>
            </tr>
        `;
        return;
    }

    const startIndex = (window.cdrCurrentPage - 1) * window.cdrPageLimit;

    tableBody.innerHTML = calls.map((call, idx) => {
        const dt = formatCdrDate(call.started_at);
        const isSelected = window.cdrSelectedCall && window.cdrSelectedCall.id === call.id;
        const isConnectedAndTalking = (call.technical_status === 'CONNECTED' || call.technical_status === 'ANSWERED' || call.technical_status === 'COMPLETED') && parseInt(call.talk_time_seconds || 0, 10) > 0;
        const statusClass = isConnectedAndTalking 
            ? 'status-pill-connected' 
            : (call.technical_status === 'BUSY' ? 'status-pill-busy' : 'status-pill-missed');

        const statusLabel = isConnectedAndTalking
            ? 'Connected'
            : (call.technical_status === 'BUSY' ? 'Busy' : (call.technical_status === 'NO_ANSWER' ? 'No Answer' : 'Missed'));

        const isOutbound = (call.direction || '').toLowerCase().includes('out');
        const durationFormatted = isConnectedAndTalking ? formatCdrDuration(call.talk_time_seconds || 0) : '00:00';

        const hasAudio = Boolean(call.r2_object_key || call.acefone_recording_url || call.recording_url);

        const initials = (call.crm_user_name || 'TC').split(' ').map(s => s[0]).join('').substring(0, 2).toUpperCase();

        return `
            <tr style="background: ${isSelected ? '#eff6ff' : '#ffffff'}; cursor: pointer; transition: background 0.15s;" onclick="selectCdrCallDetail(${call.id}, false)">
                <td style="text-align: center;" onclick="event.stopPropagation();"><input type="checkbox"></td>
                <td style="font-weight: 600; color: #64748b; font-size: 0.75rem;">${startIndex + idx + 1}</td>
                <td>
                    <div style="font-size: 0.78rem; font-weight: 700; color: #1e293b;">${dt.date}</div>
                    <div style="font-size: 0.68rem; color: #64748b;">${dt.time}</div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <div class="telecaller-avatar" style="background: #e0e7ff; color: #3730a3; font-size: 0.72rem; font-weight: 800; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${initials}</div>
                        <div>
                            <span style="font-weight: 700; color: #1e293b; font-size: 0.8rem; display: block;">${call.crm_user_name || 'Telecaller'}</span>
                            <span style="font-size: 0.68rem; color: #64748b;">${call.agent_extension ? 'Ext ' + call.agent_extension : ''}</span>
                        </div>
                    </div>
                </td>
                <td style="font-weight: 700; color: #0f172a; font-size: 0.82rem;">${call.customer_phone || '--'}</td>
                <td>
                    <span style="font-size: 0.72rem; color: ${isOutbound ? '#047857' : '#2563eb'}; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isOutbound ? '#10b981' : '#3b82f6'};"></span>
                        ${isOutbound ? 'Outbound' : 'Inbound'}
                    </span>
                </td>
                <td style="font-weight: 700; color: #0f172a; font-size: 0.8rem;">${durationFormatted}</td>
                <td><span class="status-pill ${statusClass}"><span class="dot"></span> ${statusLabel}</span></td>
                <td style="text-align: center;" onclick="event.stopPropagation();">
                    ${hasAudio ? `
                        <button class="btn-play-icon" onclick="selectCdrCallDetail(${call.id}, true)" title="Play Audio Recording (Cloudflare R2)" style="background: #10b981; color: white; width: 26px; height: 26px; border-radius: 50%; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem;">
                            <i class="fas fa-play"></i>
                        </button>
                    ` : '<span style="color: #cbd5e1; font-size: 0.8rem;">-</span>'}
                </td>
                <td>
                    ${call.lead_id ? `
                        <span style="font-weight: 700; color: #2563eb; font-size: 0.78rem;">#${call.lead_id}</span>
                        ${call.lead_name ? `<div style="font-size: 0.68rem; color: #64748b;">${call.lead_name}</div>` : ''}
                    ` : '<span style="color: #94a3b8; font-size: 0.75rem;">Customer</span>'}
                </td>
                <td style="text-align: right;" onclick="event.stopPropagation();">
                    <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                        <button class="btn-icon-view" onclick="selectCdrCallDetail(${call.id}, false)" title="View Details" style="border: 1px solid #e2e8f0; background: white; border-radius: 4px; padding: 0.25rem 0.45rem; cursor: pointer;">
                            <i class="far fa-eye" style="color: #475569;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// Render CDR Pagination Controls
window.renderCdrPagination = function(pagination) {
    const infoEl = document.getElementById('cdrPaginationInfo');
    const controlsEl = document.getElementById('cdrPaginationControls');
    if (!infoEl || !controlsEl) return;

    const total = pagination.total || 0;
    const page = pagination.page || 1;
    const limit = pagination.limit || window.cdrPageLimit;
    const totalPages = pagination.totalPages || Math.ceil(total / limit) || 1;

    window.cdrTotalPages = totalPages;

    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    infoEl.textContent = `Showing ${start} to ${end} of ${total.toLocaleString()} calls`;

    let html = '';
    // Previous button
    html += `<button onclick="loadCdrCallLogs(${Math.max(1, page - 1)})" ${page <= 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} class="btn-outline-blue" style="padding: 0.25rem 0.5rem; background: #ffffff; color: #64748b; border-color: #cbd5e1; border-radius: 4px;"><i class="fas fa-chevron-left"></i></button>`;

    // Pages display
    const maxButtons = 5;
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        html += `<button onclick="loadCdrCallLogs(1)" class="btn-outline-blue" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; background: #ffffff; color: #475569; border-color: #cbd5e1; border-radius: 4px;">1</button>`;
        if (startPage > 2) html += `<span style="color: #94a3b8; padding: 0 0.2rem;">...</span>`;
    }

    for (let p = startPage; p <= endPage; p++) {
        if (p === page) {
            html += `<button class="btn-solid-green" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; border-radius: 4px; background: #059669; color: white; border: none; font-weight: 700;">${p}</button>`;
        } else {
            html += `<button onclick="loadCdrCallLogs(${p})" class="btn-outline-blue" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; background: #ffffff; color: #475569; border-color: #cbd5e1; border-radius: 4px; cursor: pointer;">${p}</button>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span style="color: #94a3b8; padding: 0 0.2rem;">...</span>`;
        html += `<button onclick="loadCdrCallLogs(${totalPages})" class="btn-outline-blue" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; background: #ffffff; color: #475569; border-color: #cbd5e1; border-radius: 4px;">${totalPages}</button>`;
    }

    // Next button
    html += `<button onclick="loadCdrCallLogs(${Math.min(totalPages, page + 1)})" ${page >= totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} class="btn-outline-blue" style="padding: 0.25rem 0.5rem; background: #ffffff; color: #64748b; border-color: #cbd5e1; border-radius: 4px;"><i class="fas fa-chevron-right"></i></button>`;

    controlsEl.innerHTML = html;
};

// Select and Display Call Details in the Right Panel
window.selectCdrCallDetail = function(callId, autoPlay = false) {
    const call = (window.cdrCurrentCalls || []).find(c => c.id === callId);
    if (!call) return;

    window.cdrSelectedCall = call;

    const dt = formatCdrDate(call.started_at);
    const isOutbound = (call.direction || '').toLowerCase().includes('out');

    // Status pill
    const statusBadge = document.getElementById('cdrDetailStatusBadge');
    if (statusBadge) {
        const isConn = (call.technical_status === 'CONNECTED' || call.technical_status === 'ANSWERED' || call.technical_status === 'COMPLETED') && parseInt(call.talk_time_seconds || 0, 10) > 0;
        const isMiss = (call.technical_status === 'MISSED' || call.technical_status === 'CANCELLED' || !isConn);
        statusBadge.className = `status-pill ${isConn ? 'status-pill-connected' : (call.technical_status === 'BUSY' ? 'status-pill-busy' : 'status-pill-missed')}`;
        statusBadge.innerHTML = `<span class="dot"></span> ${isConn ? 'Connected' : (call.technical_status === 'BUSY' ? 'Busy' : 'Missed')}`;
    }

    const dateEl = document.getElementById('cdrDetailDate');
    if (dateEl) dateEl.textContent = dt.full;

    // Telecaller Info
    const avatarEl = document.getElementById('cdrDetailAvatar');
    const nameEl = document.getElementById('cdrDetailTelecallerName');
    const roleEl = document.getElementById('cdrDetailTelecallerRole');
    const initials = (call.crm_user_name || 'TC').split(' ').map(s => s[0]).join('').substring(0, 2).toUpperCase();

    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.innerHTML = `${call.crm_user_name || 'Telecaller'} <i class="fas fa-phone-alt" style="font-size: 0.7rem; color: #10b981; margin-left: 4px;"></i>`;
    if (roleEl) roleEl.textContent = call.agent_extension ? `Extension ${call.agent_extension}` : 'Telecaller';

    // Metadata Table
    const custEl = document.getElementById('cdrDetailCustomerNumber');
    const leadEl = document.getElementById('cdrDetailLeadContext');
    const dirEl = document.getElementById('cdrDetailDirection');
    const idEl = document.getElementById('cdrDetailCallId');
    const talkEl = document.getElementById('cdrDetailTalkTime');
    const didEl = document.getElementById('cdrDetailDid');
    const extEl = document.getElementById('cdrDetailExtension');
    const statEl = document.getElementById('cdrDetailTechnicalStatus');
    const causeEl = document.getElementById('cdrDetailHangupCause');

    if (custEl) custEl.textContent = call.customer_phone || '--';
    if (leadEl) {
        if (call.lead_id) {
            leadEl.textContent = `#${call.lead_id} (${call.lead_name || 'Lead'})`;
        } else {
            leadEl.textContent = 'Customer Call';
        }
    }
    if (dirEl) dirEl.textContent = isOutbound ? 'Outgoing (Click to Call)' : 'Incoming';
    if (idEl) idEl.textContent = call.acefone_call_id || call.call_id || '--';
    if (talkEl) talkEl.textContent = formatCdrDuration(call.talk_time_seconds || call.duration_seconds || 0);
    if (didEl) didEl.textContent = call.did_number || '--';
    if (extEl) extEl.textContent = call.agent_extension || '--';
    if (statEl) {
        statEl.textContent = call.technical_status || 'UNKNOWN';
        statEl.style.color = (call.technical_status === 'CONNECTED' || call.technical_status === 'COMPLETED') ? '#10b981' : '#ef4444';
    }
    if (causeEl) causeEl.textContent = call.hangup_reason || 'Normal';

    // Audio Player
    const player = document.getElementById('cdrDetailAudioPlayer');
    const downloadBtn = document.getElementById('cdrDetailAudioDownload');
    const noAudioEl = document.getElementById('cdrDetailNoAudio');

    const audioUrl = call.r2_object_key 
        ? getApiUrl(`/media/${call.r2_object_key}`)
        : (call.acefone_recording_url || call.recording_url || null);

    if (audioUrl) {
        if (player) {
            player.src = audioUrl;
            player.style.display = 'block';
            if (autoPlay) {
                player.play().catch(e => console.log('Autoplay prevented:', e));
            }
        }
        if (downloadBtn) {
            downloadBtn.href = audioUrl;
            downloadBtn.style.display = 'inline-flex';
        }
        if (noAudioEl) noAudioEl.style.display = 'none';
    } else {
        if (player) {
            player.pause();
            player.src = '';
            player.style.display = 'none';
        }
        if (downloadBtn) downloadBtn.style.display = 'none';
        if (noAudioEl) noAudioEl.style.display = 'block';
    }

    // Refresh rows highlight
    const tbody = document.getElementById('cdrTableBody');
    if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, i) => {
            const rowCall = (window.cdrCurrentCalls || [])[i];
            if (rowCall && rowCall.id === call.id) {
                row.style.background = '#eff6ff';
            } else {
                row.style.background = '#ffffff';
            }
        });
    }
};

window.resetCdrCallDetail = function() {
    window.cdrSelectedCall = null;
    const player = document.getElementById('cdrDetailAudioPlayer');
    if (player) {
        player.pause();
        player.src = '';
        player.style.display = 'none';
    }
    const downloadBtn = document.getElementById('cdrDetailAudioDownload');
    if (downloadBtn) downloadBtn.style.display = 'none';
    const noAudioEl = document.getElementById('cdrDetailNoAudio');
    if (noAudioEl) noAudioEl.style.display = 'block';
};

// Sync CDR from Acefone API Real Endpoint
window.syncCdrFromAcefone = async function() {
    const btn = document.getElementById('btnSyncCdr');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing Acefone...';
    }

    try {
        const data = await safeFetchJson('/telephony/cdr/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 50, autoOffloadAudio: true })
        });

        if (data && data.success) {
            if (window.showAlert) {
                window.showAlert(
                    "Acefone CDR Synced", 
                    `✅ Synced ${data.synced_count || 0} calls from Acefone API.${data.recordings_offloaded ? ' ' + data.recordings_offloaded + ' recordings offloaded to Cloudflare R2.' : ''}`,
                    "success"
                );
            }
            await window.loadCdrCallLogs(1);
        } else {
            if (window.showAlert) {
                window.showAlert("Sync Error", (data && data.error) || "Could not sync CDR logs from Acefone", "error");
            }
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Sync Failed", err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
};

// Filter and Search Handlers
window.applyCdrFilters = function() {
    window.loadCdrCallLogs(1);
};

window.debounceCdrSearch = function() {
    clearTimeout(window.cdrSearchDebounceTimer);
    window.cdrSearchDebounceTimer = setTimeout(() => {
        window.loadCdrCallLogs(1);
    }, 350);
};

window.changeCdrPageLimit = function(newLimit) {
    window.cdrPageLimit = parseInt(newLimit, 10) || 25;
    window.loadCdrCallLogs(1);
};

// Initiate Click to Call Back
window.cdrInitiateCallBack = async function() {
    if (!window.cdrSelectedCall) {
        if (window.showAlert) window.showAlert("No Call Selected", "Please select a call record from the table.", "error");
        return;
    }
    const call = window.cdrSelectedCall;
    const phone = call.customer_phone;
    if (!phone) {
        if (window.showAlert) window.showAlert("Invalid Phone", "Customer phone number is missing.", "error");
        return;
    }

    const crmUserId = call.crm_user_id || (window.rawCrmUsers && window.rawCrmUsers[0] ? window.rawCrmUsers[0].user_id : null);
    if (!crmUserId) {
        if (window.showAlert) window.showAlert("Agent Missing", "No CRM telecaller found to place this call.", "error");
        return;
    }

    if (window.showAlert) {
        window.showAlert("Initiating Call", `Calling back customer ${phone}...`, "info");
    }

    try {
        const data = await safeFetchJson('/telephony/click-to-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crm_user_id: crmUserId, destination_phone: phone })
        });
        if (data && data.success) {
            if (window.showAlert) {
                window.showAlert("Call Triggered", `✅ Call placed! Ref ID: ${data.acefone_ref_id}`, "success");
            }
        } else {
            if (window.showAlert) window.showAlert("Call Failed", (data && data.error) || "Failed to trigger call", "error");
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Call Error", err.message, "error");
    }
};

// Export CSV of Current CDR Logs
window.exportCdrCsv = function() {
    const calls = window.cdrCurrentCalls;
    if (!calls || calls.length === 0) {
        if (window.showAlert) window.showAlert("No Data", "No call records to export.", "info");
        return;
    }

    const headers = ["Call ID", "Date", "Time", "Telecaller", "Customer Phone", "Direction", "Duration (s)", "Talk Time (s)", "Status", "Hangup Reason", "Recording URL"];
    const rows = calls.map(c => {
        const dt = formatCdrDate(c.started_at);
        const recUrl = c.r2_object_key ? getApiUrl('/media/' + c.r2_object_key) : (c.acefone_recording_url || '');
        return [
            c.acefone_call_id || c.call_id || c.id,
            dt.date,
            dt.time,
            `"${(c.crm_user_name || 'Telecaller').replace(/"/g, '""')}"`,
            c.customer_phone,
            c.direction,
            c.duration_seconds || 0,
            c.talk_time_seconds || 0,
            c.technical_status || '',
            `"${(c.hangup_reason || '').replace(/"/g, '""')}"`,
            `"${recUrl}"`
        ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sgb_acefone_cdr_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Render small preview in overview dashboard tab
function renderOverviewLogsPreview(calls) {
    const tableBody = document.querySelector('#tab-panel-overview tbody');
    if (!tableBody || !calls || calls.length === 0) return;

    tableBody.innerHTML = calls.map(call => `
        <tr>
            <td>${new Date(call.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${call.crm_user_name || 'Telecaller'}</td>
            <td>${call.customer_phone}</td>
            <td><span class="badge-status ${call.technical_status === 'CONNECTED' || call.technical_status === 'COMPLETED' ? 'badge-connected' : 'badge-missed'}">${call.technical_status}</span></td>
            <td>${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s</td>
            <td>
                ${call.r2_object_key ? `<button class="btn-play-icon" onclick="selectCdrCallDetail(${call.id}, true)" title="Play Recording"><i class="fas fa-play"></i></button>` : '-'}
            </td>
            <td><a href="#" class="lead-id-tag">#${call.lead_id || call.id}</a></td>
        </tr>
    `).join('');
}

// 5. Fetch Performance Metrics
async function loadPerformanceData() {
    try {
        const data = await safeFetchJson('/telephony/performance');
        if (data.success && Array.isArray(data.performance)) {
            console.log("📊 Telecaller performance loaded:", data.performance);
        }
    } catch (err) {
        console.warn("Failed to load performance data:", err.message);
    }
}

// Play Real Audio Recording from Cloudflare R2 Stream
window.playRealRecording = function(objectKey) {
    const audioUrl = getApiUrl(`/media/${objectKey}`);
    const audio = new Audio(audioUrl);
    audio.play();
    if (window.showAlert) window.showAlert("Playing Recording", "Playing call recording audio stream...", "info");
};

// Trigger Test Click to Call
window.triggerTestCall = async function(crmUserId) {
    const userObj = (window.rawCrmUsers || []).find(u => String(u.user_id) === String(crmUserId));
    const userName = userObj ? userObj.name : 'Telecaller';
    
    if (window.showAlert) {
        window.showAlert("Initiating Call", `Triggering test Click to Call for ${userName}...`, "info");
    }

    try {
        const data = await safeFetchJson('/telephony/click-to-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crm_user_id: crmUserId, destination_phone: "+919902018031" })
        });
        if (data.success) {
            if (window.showAlert) {
                window.showAlert("Call Initiated", `✅ Click to Call Success!\nRef ID: ${data.acefone_ref_id}`, "success");
            }
            if (data.call_id && window.monitorCallStatus) {
                window.monitorCallStatus(data.call_id);
            }
        } else {
            if (window.showAlert) {
                window.showAlert("Call Failed", data.error || data.message || "Click to Call failed", "error");
            }
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Network Error", err.message, "error");
    }
};

// Execute Test Call from Card Form
window.executeTestCallFromCard = async function() {
    const testSelect = document.getElementById('testAgentSelect');
    const phoneInput = document.getElementById('testCustomerPhoneInput');
    const crmUserId = testSelect ? testSelect.value : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!crmUserId) {
        if (window.showAlert) window.showAlert("Selection Required", "Please select a CRM Telecaller for the test call.", "error");
        return;
    }
    if (!phone) {
        if (window.showAlert) window.showAlert("Required Field", "Please enter a test customer phone number.", "error");
        return;
    }

    if (window.showAlert) {
        window.showAlert("Initiating Call", `Triggering test call to ${phone}...`, "info");
    }

    try {
        const data = await safeFetchJson('/telephony/click-to-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crm_user_id: crmUserId, destination_phone: phone })
        });
        if (data.success) {
            if (window.showAlert) {
                window.showAlert("Call Initiated", `✅ Click to Call Success!\nRef ID: ${data.acefone_ref_id}`, "success");
            }
            if (data.call_id && window.monitorCallStatus) {
                window.monitorCallStatus(data.call_id);
            }
        } else {
            if (window.showAlert) {
                window.showAlert("Call Failed", data.error || data.message || "Failed to trigger test call", "error");
            }
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Network Error", err.message, "error");
    }
};




