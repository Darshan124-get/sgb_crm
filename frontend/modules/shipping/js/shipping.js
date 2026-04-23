document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin', 'shipping'])) return;
    const user = JSON.parse(localStorage.getItem('user') || window.getCurrentUser() || '{}');
    document.getElementById('profileName').textContent = user.name || 'Shipping Staff';
    fetchOrders();
    document.getElementById('shipForm').addEventListener('submit', handleShip);
});

const API          = window.API_URL;
const ORDERS_API   = `${API}/orders`;
const LOGISTICS_API= `${API}/logistics`;

let allOrders = [];

async function fetchOrders() {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('shipTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="padding:2rem;text-align:center;"><i class="fas fa-circle-notch fa-spin"></i></td></tr>';

    try {
        // Fetch packed orders (ready to ship)
        const res = await fetch(`${ORDERS_API}?status=packed`, { headers: { 'Authorization': `Bearer ${token}` } });
        allOrders = await res.json();
        document.getElementById('shipCount').textContent = `${allOrders.length} Ready to Ship`;
        renderOrders(allOrders);
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:#ef4444;">Failed to load orders.</td></tr>';
    }
}

function renderOrders(orders) {
    const tbody = document.getElementById('shipTableBody');
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:#94a3b8;">No orders ready to ship. 🎉</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:1rem 1.25rem;font-weight:700;color:#1e293b;">${window.formatOrderId(o.order_id, o.created_at)}</td>
            <td style="padding:1rem 1.25rem;font-weight:600;">${o.customer_name || o.firm_name || '—'}</td>
            <td style="padding:1rem 1.25rem;font-size:0.875rem;color:#64748b;">${o.phone || '—'}</td>
            <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;max-width:200px;">${o.address || o.city || '—'}</td>
            <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
            <td style="padding:1rem 1.25rem;">
                <button onclick="openShipModal(${o.order_id})" style="display:flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:#10b981;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:700;">
                    <i class="fas fa-truck-fast"></i> Ship Order
                </button>
            </td>
        </tr>`).join('');
}

function filterOrders() {
    const q = document.getElementById('shipSearch').value.toLowerCase();
    renderOrders(allOrders.filter(o =>
        (o.customer_name||'').toLowerCase().includes(q) ||
        (o.firm_name||'').toLowerCase().includes(q) ||
        String(o.order_id).includes(q)
    ));
}

function openShipModal(orderId) {
    document.getElementById('shipOrderId').value = orderId;
    const order = allOrders.find(ord => ord.order_id == orderId);
    document.getElementById('shipOrderLabel').textContent = window.formatOrderId(orderId, order ? order.created_at : null);
    document.getElementById('shipModal').style.display = 'flex';
}

function closeShipModal() {
    document.getElementById('shipModal').style.display = 'none';
    document.getElementById('shipForm').reset();
}

async function handleShip(e) {
    e.preventDefault();
    const token    = localStorage.getItem('token');
    const orderId  = document.getElementById('shipOrderId').value;
    const courier  = document.getElementById('courierName').value;
    const tracking = document.getElementById('trackingNumber').value;

    try {
        // POST to /api/logistics/shipping with correct field names matching controller
        const res = await fetch(`${LOGISTICS_API}/shipping`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id:     orderId,
                courier_name: courier,
                tracking_id:  tracking     // backend expects 'tracking_id' not 'tracking_number'
            })
        });

        if (res.ok) {
            const order = allOrders.find(ord => ord.order_id == orderId);
            showToast(`Order ${window.formatOrderId(orderId, order ? order.created_at : null)} shipped via ${courier}! ✅`);
            closeShipModal();
            fetchOrders();
        } else {
            const d = await res.json();
            showToast(`Error: ${d.message}`, true);
        }
    } catch(e) {
        showToast('Server error. Please try again.', true);
    }
}

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.background = isError ? '#ef4444' : '#1e293b';
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3500);
}
