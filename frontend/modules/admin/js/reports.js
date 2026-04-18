// ============================================================
// reports.js — Business Analytics & Sales Reports
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const el = document.getElementById('profileName');
    if (el) el.textContent = user.name || 'Administrator';
    
    fetchReports();
});

async function fetchReports() {
    const pc = document.getElementById('pageContent');
    const token = localStorage.getItem('token');
    
    try {
        const res = await fetch(`${window.API_URL}/orders/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        renderReports(data);
    } catch (err) {
        pc.innerHTML = `<div style="padding:4rem; text-align:center; color:#ef4444;"><h3>Failed to load reports</h3><p>${err.message}</p></div>`;
    }
}

function renderReports(data) {
    const pc = document.getElementById('pageContent');
    
    const dealerRows = data.dealerSales.map(d => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:1rem; font-weight:700; color:#1e293b;">${d.firm_name || d.dealer_name}</td>
            <td style="padding:1rem; text-align:center;">${d.order_count}</td>
            <td style="padding:1rem; text-align:right; font-weight:800; color:var(--primary-color);">₹${parseFloat(d.total_sales).toLocaleString()}</td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="padding:2rem;text-align:center;color:#94a3b8;">No data available</td></tr>';

    const regionRows = data.regionSales.map(r => `
        <div style="background:white; padding:1.25rem; border-radius:12px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <p style="font-weight:800; color:#1e293b; font-size:1rem;">${r.state || 'Unknown'}</p>
                <p style="font-size:0.75rem; color:#64748b;">${r.order_count} Orders</p>
            </div>
            <p style="font-weight:800; font-size:1.1rem; color:#0f172a;">₹${parseFloat(r.total_sales).toLocaleString()}</p>
        </div>
    `).join('') || '<p>No regional data found.</p>';

    const categorySummary = data.categorySales.map(c => `
         <div style="flex:1; min-width:180px; background:linear-gradient(135deg, #ffffff, #f8fafc); padding:1.25rem; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
            <p style="font-size:0.7rem; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.05em;">${c.category_name}</p>
            <p style="font-size:1.25rem; font-weight:900; color:#1e293b; margin-top:0.25rem;">₹${parseFloat(c.total_sales).toLocaleString()}</p>
            <div style="margin-top:0.75rem; font-size:0.75rem; color:#10b981; font-weight:700;">
                <i class="fas fa-boxes"></i> ${c.total_qty} units sold
            </div>
         </div>
    `).join('');

    pc.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
            <div>
                <h1 style="font-size:1.75rem; font-weight:900; color:#0f172a; letter-spacing:-0.02em;">Business Intelligence</h1>
                <p style="color:#64748b; font-size:0.875rem;">Real-time sales performance across dealers and regions.</p>
            </div>
            <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-file-export"></i> Export Report</button>
        </div>

        <!-- Metric Cards -->
        <div style="display:flex; gap:1.25rem; flex-wrap:wrap; margin-bottom:2.5rem;">
            ${categorySummary}
        </div>

        <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:2rem;">
            <!-- Top Dealers Card -->
            <div class="premium-card" style="padding:0; border:1px solid #e2e8f0; overflow:hidden;">
                <div style="padding:1.25rem; border-bottom:1px solid #f1f5f9; background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:0.875rem; font-weight:800; color:#1e293b; text-transform:uppercase;">Top Performing Dealers (by Sales)</h3>
                    <i class="fas fa-trophy" style="color:#f59e0b;"></i>
                </div>
                <table style="width:100%; border-collapse:collapse;">
                    <thead style="background:#f1f5f9;">
                        <tr>
                            <th style="padding:0.75rem 1rem; text-align:left; font-size:0.7rem; color:#64748b;">DEALER NAME</th>
                            <th style="padding:0.75rem 1rem; text-align:center; font-size:0.7rem; color:#64748b;">ORDERS</th>
                            <th style="padding:0.75rem 1rem; text-align:right; font-size:0.7rem; color:#64748b;">REVENUE</th>
                        </tr>
                    </thead>
                    <tbody>${dealerRows}</tbody>
                </table>
            </div>

            <!-- Regional Sales Card -->
            <div>
                <h3 style="font-size:0.875rem; font-weight:800; color:#1e293b; text-transform:uppercase; margin-bottom:1.25rem; display:flex; align-items:center; gap:0.5rem;">
                    <i class="fas fa-map-location-dot" style="color:#3b82f6;"></i> Regional Breakdown
                </h3>
                <div style="display:flex; flex-direction:column; gap:1rem;">
                    ${regionRows}
                </div>
            </div>
        </div>
    `;
}
