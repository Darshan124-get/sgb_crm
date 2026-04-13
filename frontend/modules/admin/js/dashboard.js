document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['admin'])) return;

    const API_URL = window.API_URL;
    const token   = localStorage.getItem('token');
    const user    = window.getCurrentUser();


    // Personalize
    document.getElementById('welcomeMessage').textContent = `${user.name || 'Admin'}'s Control Tower`;
    document.getElementById('profileName').textContent    = user.name || 'Administrator';
    document.getElementById('todayDate').textContent      = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    try {
        const res  = await fetch(`${API_URL}/reports/dashboard-stats`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401) { window.doLogout(); return; }
        const data = await res.json();

        document.getElementById('totalLeads').textContent    = data.kpis.leadsMTD ?? '—';
        document.getElementById('totalRevenue').textContent  = `₹${(data.kpis.revenueMTD || 0).toLocaleString()}`;
        document.getElementById('conversionRate').textContent = `${data.kpis.conversionRate ?? 0}%`;
        document.getElementById('overdueTasks').textContent  = data.kpis.urgentAlerts ?? 0;
        document.getElementById('overdueBadge').textContent  = `${data.kpis.urgentAlerts ?? 0} Overdue`;
        document.getElementById('notifBadge').textContent    = data.kpis.urgentAlerts ?? 0;

        renderPipeline(data.funnel);
        renderUrgentPanel(data.urgentTasks);
        initChart(data);
    } catch (e) { console.error('Dashboard load error:', e); }

    function renderPipeline(funnel = []) {
        const el = document.getElementById('pipelineMiniView');
        if (!el) return;
        const stages = [
            { id:'new',       label:'New Lead',   color:'#3b82f6' },
            { id:'contacted', label:'Contacted',  color:'#8b5cf6' },
            { id:'interested',label:'Interested', color:'#f59e0b' },
            { id:'converted', label:'Converted',  color:'#10b981' },
            { id:'lost',      label:'Lost',       color:'#ef4444' }
        ];
        el.innerHTML = stages.map(s => {
            const found = funnel.find(f => f.status === s.id) || { count:0 };
            const pct   = Math.min((found.count / Math.max(...funnel.map(f=>f.count), 1)) * 100, 100);
            return `<div style="margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                    <span style="font-size:0.75rem;font-weight:600;color:#475569;">${s.label}</span>
                    <span style="font-size:0.75rem;font-weight:800;color:#1e293b;">${found.count}</span>
                </div>
                <div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${s.color};transition:width 0.6s ease;"></div>
                </div>
            </div>`;
        }).join('');
    }

    function renderUrgentPanel(tasks = []) {
        const el = document.getElementById('urgentPanel');
        if (!el) return;
        if (!tasks.length) {
            el.innerHTML = '<div style="padding:3rem;text-align:center;color:#94a3b8;"><i class="fas fa-check-circle fa-2x"></i><p style="margin-top:0.5rem;">All caught up! No urgent tasks.</p></div>';
            return;
        }
        el.innerHTML = tasks.map(t => `
            <div style="padding:1.25rem 1.5rem;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <p style="font-weight:700;font-size:0.875rem;color:#1e293b;">${t.customer_name}</p>
                    <p style="font-size:0.75rem;color:#ef4444;font-weight:600;"><i class="far fa-clock"></i> Due: ${new Date(t.followup_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</p>
                    <p style="font-size:0.7rem;color:#64748b;">Assigned to: ${t.assigned_to_name || 'Unassigned'}</p>
                </div>
                <a href="leads.html?leadId=${t.lead_id}" style="padding:6px 14px;background:#3b82f6;color:white;border-radius:6px;font-size:0.7rem;font-weight:700;text-decoration:none;">View Lead</a>
            </div>`).join('');
    }

    function initChart(data) {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['New', 'Contacted', 'Interested', 'Converted', 'Lost'],
                datasets: [{
                    label: 'Lead Stage Count',
                    data: (data.funnel || []).map(f => f.count),
                    backgroundColor: ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444'],
                    borderRadius: 8
                }]
            },
            options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,grid:{display:false}},x:{grid:{display:false}}} }
        });
    }
});
