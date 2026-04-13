document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin', 'packing'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('profileName').textContent = user.name || 'Packing Staff';
    fetchOrders();
});

const API = window.API_URL;
const ORDERS_API    = `${API}/orders`;
const LOGISTICS_API = `${API}/logistics`;

let allOrders = [];

async function fetchOrders() {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('packagingTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;"><i class="fas fa-circle-notch fa-spin"></i></td></tr>';

    try {
        const res    = await fetch(`${ORDERS_API}?status=draft`, { headers: { 'Authorization': `Bearer ${token}` } });
        allOrders    = await res.json();
        document.getElementById('pendingCount').textContent = `${allOrders.length} Pending`;
        renderOrders(allOrders);
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:#ef4444;">Failed to load orders.</td></tr>';
    }
}

function renderOrders(orders) {
    const tbody = document.getElementById('packagingTableBody');
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:#94a3b8;">No pending orders to pack. 🎉</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:1rem 1.25rem;font-weight:700;color:#1e293b;">#ORD-${o.order_id}</td>
            <td style="padding:1rem 1.25rem;font-weight:600;">${o.customer_name || o.firm_name || '—'}</td>
            <td style="padding:1rem 1.25rem;font-size:0.875rem;color:#64748b;">${o.phone || '—'}</td>
            <td style="padding:1rem 1.25rem;">
                <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    ${(o.items||[]).map(i=>`<span style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:0.75rem;color:#374151;">${i.product_name} ×${i.quantity}</span>`).join('')}
                </div>
            </td>
            <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
            <td style="padding:1rem 1.25rem;">
                <button onclick="markAsPacked(${o.order_id})" style="display:flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:#8b5cf6;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:700;">
                    <i class="fas fa-box-open"></i> Mark Packed
                </button>
            </td>
        </tr>`).join('');
}

function filterOrders() {
    const q = document.getElementById('orderSearch').value.toLowerCase();
    renderOrders(allOrders.filter(o =>
        (o.customer_name||'').toLowerCase().includes(q) ||
        (o.firm_name||'').toLowerCase().includes(q) ||
        String(o.order_id).includes(q)
    ));
}

async function markAsPacked(orderId) {
    if (!confirm(`Mark Order #${orderId} as packed?`)) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${LOGISTICS_API}/packing`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, remarks: 'Packed' })
        });
        if (res.ok) { showToast(`Order #${orderId} packed successfully! ✅`); fetchOrders(); }
        else { const d = await res.json(); showToast(`Error: ${d.message}`, true); }
    } catch(e) { showToast('Server error.', true); }
}

function showToast(msg, isError=false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.background = isError ? '#ef4444' : '#1e293b';
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
}
