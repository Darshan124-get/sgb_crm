document.addEventListener('DOMContentLoaded', async () => {
    const user = window.getCurrentUser();
    if (!user || (user.role !== 'shipping' && user.role !== 'shipment')) {
        window.location.href = '../../index.html';
        return;
    }

    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        setTimeout(() => {
            const activeLink = document.getElementById('nav-shipping-dashboard');
            if (activeLink) activeLink.classList.add('active');
        }, 100);
    }

    let trendChart = null;
    let carrierChart = null;

    async function fetchDashboardStats() {
        const range = document.getElementById('rangeSelector')?.value || '7days';
        try {
            const response = await fetch(`${window.API_URL}/logistics/dashboard-stats?range=${range}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await response.json();
            
            if (response.ok) {
                document.getElementById('pendingShipCount').textContent = data.pendingCount;
                document.getElementById('todayShippedCount').textContent = data.todayCount;
                document.getElementById('inTransitCount').textContent = data.transitCount;

                initCharts(data.trends, data.carriers);
            }
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        }
    }

    function initCharts(trends, carrierDistribution) {
        // --- Trend Chart ---
        const trendCtx = document.getElementById('shippingTrendChart');
        if (trendCtx) {
            if (trendChart) trendChart.destroy();
            
            const ctx = trendCtx.getContext('2d');
            const trendGradient = ctx.createLinearGradient(0, 0, 0, 300);
            trendGradient.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
            trendGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

            const labels = trends.map(t => t.label);
            const data = trends.map(t => t.count);

            trendChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels.length ? labels : ['No Data'],
                    datasets: [{
                        label: 'Dispatches',
                        data: data.length ? data : [0],
                        borderColor: '#8b5cf6',
                        backgroundColor: trendGradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#8b5cf6',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            grid: { borderDash: [5, 5], color: '#f1f5f9' }, 
                            ticks: { 
                                color: '#94a3b8',
                                stepSize: 1,
                                precision: 0
                            } 
                        },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    }
                }
            });
        }

        // --- Carrier Chart ---
        const carrierCanvas = document.getElementById('carrierChart');
        if (carrierCanvas) {
            if (carrierChart) carrierChart.destroy();

            const labels = carrierDistribution.map(c => c.label || 'Unknown');
            const data = carrierDistribution.map(c => c.value);

            carrierChart = new Chart(carrierCanvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels.length ? labels : ['No Data'],
                    datasets: [{
                        data: data.length ? data : [1],
                        backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
                        borderWidth: 0,
                        hoverOffset: 15
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { 
                                usePointStyle: true, 
                                padding: 20, 
                                font: { family: 'Inter', weight: 600, size: 12 },
                                color: '#64748b'
                            }
                        }
                    }
                }
            });
        }
    }

    // Range selector listener
    document.getElementById('rangeSelector')?.addEventListener('change', fetchDashboardStats);

    // Initial load
    fetchDashboardStats();
});
