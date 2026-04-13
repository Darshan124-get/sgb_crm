document.addEventListener('DOMContentLoaded', async () => {
    const API_URL = `${window.BASE_URL}/api`;
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Personalize Welcome
    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg && user.name) {
        welcomeMsg.textContent = `${user.name}'s Control Tower`;
    }

    async function fetchDashboardData() {
        try {
            const response = await fetch(`${API_URL}/reports/dashboard-stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Unauthenticated');
            const data = await response.json();

            // Populate KPIs
            if (document.getElementById('leadsToday')) document.getElementById('leadsToday').textContent = data.kpis.leadsToday;
            if (document.getElementById('leadsMTD')) document.getElementById('leadsMTD').textContent = data.kpis.leadsMTD;
            if (document.getElementById('urgentAlerts')) document.getElementById('urgentAlerts').textContent = data.kpis.urgentAlerts;
            if (document.getElementById('revenueMTD')) document.getElementById('revenueMTD').textContent = `₹${data.kpis.revenueMTD.toLocaleString()}`;
            if (document.getElementById('conversionRate')) document.getElementById('conversionRate').textContent = `${data.kpis.conversionRate}%`;
            
            const overdueBadge = document.getElementById('overdueBadge');
            if (overdueBadge) overdueBadge.textContent = `${data.kpis.urgentAlerts} Overdue`;

            // Render Pipeline
            renderPipelineView(data.funnel);

            // Render Urgent Mission Panel
            renderUrgentPanel(data.urgentTasks);

            // Render Charts
            initCharts(data);

        } catch (error) {
            console.error('Dashboard Error:', error);
            if (error.message === 'Unauthenticated') window.location.href = 'index.html';
        }
    }

    function renderPipelineView(funnel) {
        const panel = document.getElementById('pipelineMiniView');
        if (!panel) return;

        const stages = [
            { id: 'new', label: 'New Lead', color: '#3b82f6' },
            { id: 'contacted', label: 'Contacted', color: '#8b5cf6' },
            { id: 'interested', label: 'Interested', color: '#f59e0b' },
            { id: 'converted', label: 'Converted', color: '#10b981' }
        ];

        panel.innerHTML = stages.map(stage => {
            const found = funnel.find(f => f.status === stage.id) || { count: 0 };
            return `
                <div class="pipeline-item" style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 0.75rem; font-weight: 600; color: #475569;">${stage.label}</span>
                        <span style="font-size: 0.75rem; font-weight: 800; color: #1e293b;">${found.count}</span>
                    </div>
                    <div style="height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: ${Math.min((found.count / 10) * 100, 100)}%; background: ${stage.color};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderUrgentPanel(tasks) {
        const panel = document.getElementById('urgentPanel');
        if (!panel) return;

        if (!tasks || tasks.length === 0) {
            panel.innerHTML = '<div style="padding: 3rem; text-align: center; color: #94a3b8;"><i class="fas fa-check-circle fa-2x"></i><p style="margin-top:0.5rem;">All caught up! No urgent tasks.</p></div>';
            return;
        }

        panel.innerHTML = tasks.map(task => `
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <p style="font-weight: 700; font-size: 0.875rem; color: #1e293b;">${task.customer_name}</p>
                    <p style="font-size: 0.75rem; color: #ef4444; font-weight: 600;">
                        <i class="far fa-clock"></i> Due: ${new Date(task.followup_date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short'})}
                    </p>
                </div>
                <button class="btn-action primary mini" onclick="window.location.href='lead-management.html?leadId=${task.lead_id}'" style="padding: 6px 14px; font-size: 0.7rem; border-radius: 6px;">
                    Call Now
                </button>
            </div>
        `).join('');
    }

    function initCharts(data) {
        const perfCtx = document.getElementById('performanceChart');
        if (!perfCtx) return;

        new Chart(perfCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['W1', 'W2', 'W3', 'W4'],
                datasets: [{
                    label: 'Success Rate',
                    data: [10, 25, 18, data.kpis.conversionRate],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } }
            }
        });
    }

    fetchDashboardData();
});
