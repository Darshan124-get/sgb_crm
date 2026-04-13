document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    const user = window.getCurrentUser();
    const profileEl = document.getElementById('profileName');
    if (profileEl) profileEl.textContent = user.name || 'Administrator';
    fetchOrders();
});

const API_URL = window.API_URL;

async function fetchOrders() {
    const token  = localStorage.getItem('token');
    const status = document.getElementById('statusFilter')?.value || '';
    const tbody  = document.getElementById('ordersTableBody');
    tbody.innerHTML = '<tr><td colspan="7" style="padding:2rem;text-align:center;"><i class="fas fa-circle-notch fa-spin"></i></td></tr>';

    try {
        const url = status ? `${API_URL}/orders?status=${status}` : `${API_URL}/orders`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const orders = await res.json();

        // Count by status — backend field is 'order_status'
        ['draft','packed','billed','shipped'].forEach(s => {
            const el = document.getElementById(`count${s.charAt(0).toUpperCase()+s.slice(1)}`);
            if (el) el.textContent = orders.filter(o => o.order_status === s).length;
        });

        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding:3rem;text-align:center;color:#94a3b8;">No orders found.</td></tr>';
            return;
        }

        const statusColors = { draft:'#64748b', packed:'#8b5cf6', billed:'#f59e0b', shipped:'#10b981' };
        tbody.innerHTML = orders.map(o => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:1rem 1.25rem;font-weight:700;color:#1e293b;">#ORD-${o.order_id}</td>
                <td style="padding:1rem 1.25rem;">${o.firm_name || o.customer_name || '—'}</td>
                <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">${(o.items||[]).map(i=>`${i.product_name} ×${i.quantity}`).join(', ') || '—'}</td>
                <td style="padding:1rem 1.25rem;font-weight:600;">₹${parseFloat(o.total_amount||0).toLocaleString()}</td>
                <td style="padding:1rem 1.25rem;"><span style="padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:700;background:${(statusColors[o.order_status]||'#64748b')}20;color:${statusColors[o.order_status]||'#64748b'};"> ${o.order_status||'—'}</span></td>
                <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                <td style="padding:1rem 1.25rem;">
                    <div style="display:flex;gap:0.5rem;">
                        <a href="../../modules/packing/packing.html" style="padding:4px 10px;background:#8b5cf620;color:#8b5cf6;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;" title="Pack">Pack</a>
                        <a href="../../modules/billing/billing.html" style="padding:4px 10px;background:#f59e0b20;color:#d97706;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;" title="Bill">Bill</a>
                        <a href="../../modules/shipping/shipping.html" style="padding:4px 10px;background:#10b98120;color:#059669;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;" title="Ship">Ship</a>
                    </div>
                </td>
            </tr>`).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:3rem;text-align:center;color:#ef4444;">Failed to load orders.</td></tr>`;
    }
}
