const API = 'http://localhost:5000/api/dealers';
const token = () => localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;

    // Setup Sidebar
    if (typeof initSidebar === 'function') initSidebar('dealers');

    const urlParams = new URLSearchParams(window.location.search);
    const dealerId = urlParams.get('id');

    if (dealerId) {
        fetchDealerDetails(dealerId);
    } else {
        alert('No Dealer ID provided');
        window.location.href = 'dealers.html';
    }
});

async function fetchDealerDetails(id) {
    try {
        const res = await fetch(`${API}/${id}`, {
            headers: { 'Authorization': `Bearer ${token()}` }
        });
        const data = await res.json();
        if (res.ok) {
            renderDetails(data);
        } else {
            alert(data.message || 'Error fetching details');
        }
    } catch (err) {
        console.error(err);
        alert('Server connection error');
    }
}

function renderDetails(d) {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    // Header & Status
    document.getElementById('d-name').textContent = d.dealer_name;
    document.getElementById('d-location').textContent = `${d.city || '-'}, ${d.state || '-'}`;
    document.getElementById('d-status-badge').innerHTML = `
        <span style="padding:0.4rem 1rem;border-radius:30px;font-size:0.875rem;font-weight:700;text-transform:uppercase;background:${d.status === 'active' ? '#dcfce7' : '#fee2e2'};color:${d.status === 'active' ? '#166534' : '#b91c1c'};">
            ${d.status || 'active'}
        </span>
    `;

    // Stats
    document.getElementById('s-orders').textContent = d.stats.total_orders || 0;
    document.getElementById('s-business').textContent = `₹${(d.stats.total_business || 0).toLocaleString('en-IN')}`;
    document.getElementById('s-balance').textContent = `₹${(d.stats.total_balance || 0).toLocaleString('en-IN')}`;

    // Contact Info
    document.getElementById('d-phone').textContent = d.phone;
    document.getElementById('d-alt-phone').textContent = d.alternate_number || 'Not provided';
    document.getElementById('d-email').textContent = d.email || 'Not provided';
    document.getElementById('d-contact').textContent = d.contact_person || 'Not provided';
    document.getElementById('d-address').textContent = d.address || 'Not provided';

    // Orders Table
    const orderList = document.getElementById('orderList');
    if (!d.recent_orders || d.recent_orders.length === 0) {
        orderList.innerHTML = '<tr><td colspan="4" style="padding:2rem;text-align:center;color:#64748b;">No orders found for this dealer.</td></tr>';
    } else {
        orderList.innerHTML = d.recent_orders.map(o => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:0.75rem;font-weight:600;color:#3b82f6;">#${o.order_id}</td>
                <td style="padding:0.75rem;color:#64748b;font-size:0.875rem;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                <td style="padding:0.75rem;">
                    <span style="font-size:0.75rem;font-weight:600;color:${getStatusColor(o.order_status)};">${o.order_status.toUpperCase()}</span>
                </td>
                <td style="padding:0.75rem;text-align:right;font-weight:700;">₹${parseFloat(o.total_amount).toLocaleString('en-IN')}</td>
            </tr>
        `).join('');
    }
}

function getStatusColor(status) {
    const colors = {
        'draft': '#64748b',
        'billed': '#3b82f6',
        'packed': '#f59e0b',
        'shipped': '#8b5cf6',
        'delivered': '#16a34a',
        'cancelled': '#ef4444'
    };
    return colors[status] || '#000';
}
