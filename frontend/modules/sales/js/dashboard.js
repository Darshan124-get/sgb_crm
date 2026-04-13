document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['sales', 'admin'])) return;

    const API_URL = `${window.BASE_URL}/api`;
    const token   = localStorage.getItem('token');
    const user    = JSON.parse(localStorage.getItem('user') || '{}');

    document.getElementById('welcomeMessage').textContent = `${user.name || 'Sales'}'s Dashboard`;
    document.getElementById('profileName').textContent    = user.name || 'Sales Rep';
    document.getElementById('todayDate').textContent      = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    try {
        const res  = await fetch(`${API_URL}/reports/dashboard-stats`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.status === 401) { window.doLogout(); return; }
        const data = await res.json();

        document.getElementById('leadsToday').textContent    = data.kpis.leadsToday ?? 0;
        document.getElementById('leadsMTD').textContent      = data.kpis.leadsMTD ?? 0;
        document.getElementById('urgentAlerts').textContent  = data.kpis.urgentAlerts ?? 0;
        document.getElementById('conversionRate').textContent= `${data.kpis.conversionRate ?? 0}%`;
        document.getElementById('revenueMTD').textContent    = `₹${(data.kpis.revenueMTD || 0).toLocaleString()}`;
        document.getElementById('overdueBadge').textContent  = `${data.kpis.urgentAlerts ?? 0} Overdue`;
        document.getElementById('notifBadge').textContent    = data.kpis.urgentAlerts ?? 0;

        renderPipeline(data.funnel || []);
        renderUrgentPanel(data.urgentTasks || []);
        initChart(data);
    } catch(e) { console.error('Sales dashboard error:', e); }
});

function renderPipeline(funnel) {
    const el = document.getElementById('pipelineMiniView');
    if (!el) return;
    const stages = [
        { id:'new',       label:'New Leads',  color:'#3b82f6' },
        { id:'contacted', label:'Contacted',  color:'#8b5cf6' },
        { id:'interested',label:'Interested', color:'#f59e0b' },
        { id:'converted', label:'Converted',  color:'#10b981' }
    ];
    const maxCount = Math.max(...funnel.map(f => f.count), 1);
    el.innerHTML = stages.map(s => {
        const f = funnel.find(f => f.status === s.id) || { count: 0 };
        const pct = Math.min((f.count / maxCount) * 100, 100);
        return `<div style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:0.75rem;font-weight:600;color:#475569;">${s.label}</span>
                <span style="font-size:0.75rem;font-weight:800;color:#1e293b;">${f.count}</span>
            </div>
            <div style="height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:${s.color};transition:width 0.6s ease;"></div>
            </div>
        </div>`;
    }).join('');
}

function renderUrgentPanel(tasks) {
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
            </div>
            <a href="leads.html?leadId=${t.lead_id}" style="padding:6px 14px;background:#3b82f6;color:white;border-radius:6px;font-size:0.7rem;font-weight:700;text-decoration:none;">Call Now</a>
        </div>`).join('');
}

function initChart(data) {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Week 1','Week 2','Week 3','Week 4'],
            datasets: [{
                label: 'My Leads',
                data: [Math.floor(Math.random()*10)+2, Math.floor(Math.random()*10)+2, Math.floor(Math.random()*10)+2, data.kpis.conversionRate || 0],
                borderColor: '#3b82f6', backgroundColor:'rgba(59,130,246,0.1)', tension:0.4, fill:true, borderWidth:2, pointRadius:4
            }, {
                label: 'Conversions',
                data: [1, 2, 1, Math.round((data.kpis.leadsMTD||0) * (data.kpis.conversionRate||0) / 100)],
                borderColor: '#10b981', backgroundColor:'rgba(16,185,129,0.1)', tension:0.4, fill:true, borderWidth:2, pointRadius:4
            }]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top'}}, scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'}},x:{grid:{display:false}}} }
    });
}
