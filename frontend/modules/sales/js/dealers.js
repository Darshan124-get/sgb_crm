const API = 'http://localhost:5000/api/dealers';
const token = () => localStorage.getItem('token');
let allDealers = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['sales','admin'])) return;
    
    // Setup Sidebar
    if (typeof initSidebar === 'function') initSidebar('dealers');

    fetchDealers();
});

async function fetchDealers() {
    try {
        const res = await fetch(API, { headers: { 'Authorization': `Bearer ${token()}` } });
        allDealers = await res.json();
        renderDealers(allDealers);
    } catch(e) { 
        document.getElementById('dealerTableBody').innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;color:red;">Failed to load dealers.</td></tr>';
    }
}

function renderDealers(dealers) {
    const tbody = document.getElementById('dealerTableBody');
    if (!dealers.length) { tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:#94a3b8;">No dealers found.</td></tr>'; return; }
    tbody.innerHTML = dealers.map(d => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:1rem 1.25rem;">
                <div style="font-weight:700;color:#1e293b;">${d.dealer_name}</div>
                <div style="font-size:0.75rem;color:#64748b;">${d.email || ''}</div>
            </td>
            <td style="padding:1rem 1.25rem;">${d.contact_person || '—'}</td>
            <td style="padding:1rem 1.25rem;">${d.phone}</td>
            <td style="padding:1rem 1.25rem;">${d.city || '—'}</td>
            <td style="padding:1rem 1.25rem;">
                <span style="padding:0.2rem 0.6rem;border-radius:20px;font-size:0.7rem;font-weight:600;text-transform:uppercase;background:${d.status === 'active' ? '#dcfce7' : '#fee2e2'};color:${d.status === 'active' ? '#166534' : '#991b1b'};">
                    ${d.status || 'active'}
                </span>
            </td>
            <td style="padding:1rem 1.25rem;">
                <button onclick="window.location.href='../admin/dealer-details.html?id=${d.dealer_id}'" style="padding:4px 10px;background:#f0fdf4;color:#16a34a;border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;font-weight:600;">View Profile</button>
            </td>
        </tr>`).join('');
}

