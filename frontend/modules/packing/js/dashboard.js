document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin', 'packing'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('profileName').textContent = user.name || 'Packing Staff';
    
    fetchDashboardStats();
});

const API = window.API_URL;
const ORDERS_API = `${API}/orders`;
const LOGISTICS_API = `${API}/logistics`;

let packingTrendsChart = null;
let packingStatusChart = null;

async function fetchDashboardStats() {
    const token = localStorage.getItem('token');
    
    try {
        // Fetch stats from logistics/stats endpoint (assuming it exists or we use orders)
        // For now, let's derive from orders
        const res = await fetch(`${ORDERS_API}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const allOrders = await res.json();
        
        const pending = allOrders.filter(o => o.order_status === 'billed').length;
        const completed = allOrders.filter(o => o.order_status === 'packed' || o.order_status === 'shipped' || o.order_status === 'delivered').length;
        
        // Today's packed
        const todayStr = new Date().toISOString().split('T')[0];
        const todayPacked = allOrders.filter(o => o.order_status === 'packed' && o.updated_at.startsWith(todayStr)).length;
        
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-completed').textContent = completed;
        document.getElementById('stat-today').textContent = todayPacked;
        
        renderCharts(allOrders);
        renderRecentPacking(allOrders.filter(o => o.order_status === 'packed').slice(0, 5));
        
    } catch (e) {
        console.error('Failed to load dashboard stats', e);
    }
}

function renderCharts(orders) {
    const ctxTrends = document.getElementById('packingTrendsChart').getContext('2d');
    const ctxStatus = document.getElementById('packingStatusChart').getContext('2d');
    
    // Last 7 days trends
    const days = [];
    const counts = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        counts.push(orders.filter(o => o.order_status === 'packed' && o.updated_at.startsWith(dStr)).length);
    }
    
    if (packingTrendsChart) packingTrendsChart.destroy();
    packingTrendsChart = new Chart(ctxTrends, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Orders Packed',
                data: counts,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
    
    // Status distribution
    const statusCounts = {
        'Pending': orders.filter(o => o.order_status === 'billed').length,
        'Packed': orders.filter(o => o.order_status === 'packed').length,
        'Shipped/Beyond': orders.filter(o => ['shipped', 'delivered'].includes(o.order_status)).length
    };
    
    if (packingStatusChart) packingStatusChart.destroy();
    packingStatusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#fef3c7', '#8b5cf6', '#dcfce7'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function renderRecentPacking(orders) {
    const tbody = document.getElementById('recentPackingTable');
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:2rem; text-align:center; color:#94a3b8;">No recently packed orders.</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(o => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:1rem 1.25rem; font-weight:700; color:#1e293b;">${window.formatOrderId(o.order_id, o.created_at)}</td>
            <td style="padding:1rem 1.25rem;">${o.customer_name || o.firm_name || '—'}</td>
            <td style="padding:1rem 1.25rem; font-size:0.875rem; color:#64748b;">${new Date(o.updated_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td style="padding:1rem 1.25rem;"><span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700;">Packed</span></td>
        </tr>
    `).join('');
}
