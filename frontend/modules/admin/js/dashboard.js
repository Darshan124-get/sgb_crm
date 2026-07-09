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

        document.getElementById('totalLeads').textContent    = data.kpis.totalLeads ?? '—';
        document.getElementById('totalRevenue').textContent  = `₹${(data.kpis.revenueMTD || 0).toLocaleString()}`;
        document.getElementById('conversionRate').textContent = `${data.kpis.conversionRate ?? 0}%`;
        document.getElementById('overdueTasks').textContent  = data.kpis.urgentAlerts ?? 0;
        
        document.getElementById('notifBadge').textContent    = data.kpis.urgentAlerts ?? 0;

        renderPipeline(data.funnel);
        initLocationPieChart(data.locationDistribution);
        initChart(data);

        // ─── Low Stock Alerts ───
        const stockRes = await fetch(`${API_URL}/inventory/low-stock`, { headers: { 'Authorization': `Bearer ${token}` } });
        const lowStock = await stockRes.json();
        if (lowStock.length > 0) {
            renderLowStockAlert(lowStock);
        }
    } catch (e) { console.error('Dashboard load error:', e); }

    function renderLowStockAlert(items) {
        const contentBody = document.getElementById('contentBody');
        const alertDiv = document.createElement('div');
        alertDiv.className = 'premium-card';
        alertDiv.style.marginBottom = '2rem';
        alertDiv.style.background = '#fef2f2';
        alertDiv.style.border = '1px solid #fecaca';
        alertDiv.style.padding = '1rem 1.5rem';
        alertDiv.style.display = 'flex';
        alertDiv.style.justifyContent = 'space-between';
        alertDiv.style.alignItems = 'center';
        
        alertDiv.innerHTML = `
            <div style="display:flex; align-items:center; gap:1rem;">
                <div style="width:40px; height:40px; background:#fee2e2; color:#ef4444; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
                    <i class="fas fa-triangle-exclamation"></i>
                </div>
                <div>
                    <h4 style="font-weight:700; color:#991b1b; margin:0; font-size:1rem;">Low Stock Warning</h4>
                    <p style="font-size:0.8rem; color:#b91c1c; margin:0;">${items.length} products have reached minimum stock levels.</p>
                </div>
            </div>
            <a href="inventory.html" class="btn" style="background:#ef4444; color:white; font-size:0.75rem; font-weight:700; text-decoration:none; padding:8px 16px;">Manage Inventory</a>
        `;
        contentBody.insertBefore(alertDiv, contentBody.children[1]); // Insert before stats grid
    }

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

    function initLocationPieChart(distribution = []) {
        const ctx = document.getElementById('locationPieChart');
        if (!ctx) return;
        
        const labels = distribution.map(d => d.city || 'Unknown');
        const counts = distribution.map(d => d.count);
        
        if (counts.length === 0) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['No Data'],
                    datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }
            });
            return;
        }

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, padding: 20 } }
                },
                cutout: '70%'
            }
        });
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
