document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin', 'billing'])) return;
    const user = window.getCurrentUser();
    document.getElementById('profileName').textContent = user.name || 'Billing Staff';

    fetchOrders();
});

const API = `${window.API_URL}/orders`;
let allOrders = [];

async function fetchOrders() {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('billingTableBody');
    tbody.innerHTML = '<tr><td colspan="7" style="padding:2rem;text-align:center;"><i class="fas fa-circle-notch fa-spin"></i></td></tr>';

    try {
        const res = await fetch(`${API}?status=packed`, { headers: { 'Authorization': `Bearer ${token}` } });

        allOrders = await res.json();
        document.getElementById('billCount').textContent = `${allOrders.length} Pending Bills`;
        renderOrders(allOrders);
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:3rem;text-align:center;color:#ef4444;">Failed to load.</td></tr>';
    }
}

function renderOrders(orders) {
    const tbody = document.getElementById('billingTableBody');
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:3rem;text-align:center;color:#94a3b8;">No packed orders awaiting billing. 🎉</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => {
        const total   = parseFloat(o.total_amount || 0);
        const advance = parseFloat(o.advance_amount || 0);
        const balance = total - advance;
        return `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:1rem 1.25rem;font-weight:700;color:#1e293b;">#ORD-${o.order_id}</td>
            <td style="padding:1rem 1.25rem;font-weight:600;">${o.firm_name || o.customer_name || '—'}</td>
            <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">
                ${(o.items||[]).map(i=>`${i.product_name} ×${i.quantity}`).join('<br>') || '—'}
            </td>
            <td style="padding:1rem 1.25rem;font-weight:700;">₹${total.toLocaleString()}</td>
            <td style="padding:1rem 1.25rem;color:#10b981;font-weight:600;">₹${advance.toLocaleString()}</td>
            <td style="padding:1rem 1.25rem;color:${balance > 0 ? '#ef4444' : '#10b981'};font-weight:700;">₹${balance.toLocaleString()}</td>
            <td style="padding:1rem 1.25rem;">
                <button onclick="generateInvoice(${o.order_id})" style="display:flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;background:#f59e0b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:700;">
                    <i class="fas fa-file-invoice"></i> Generate Invoice
                </button>
            </td>
        </tr>`;
    }).join('');
}

function filterOrders() {
    const q = document.getElementById('billSearch').value.toLowerCase();
    renderOrders(allOrders.filter(o =>
        (o.firm_name||'').toLowerCase().includes(q) ||
        (o.customer_name||'').toLowerCase().includes(q) ||
        String(o.order_id).includes(q)
    ));
}

async function generateInvoice(orderId) {
    if (!confirm(`Generate invoice and mark Order #${orderId} as billed?`)) return;
    const token = localStorage.getItem('token');
    try {
        // Use the existing status update route to mark as billed
        const res = await fetch(`${window.API_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'billed' })
        });
        if (res.ok) {
            showToast(`Order #${orderId} marked as billed ✅. Ready for shipping.`);
            fetchOrders();
        } else {
            const d = await res.json();
            showToast(`Error: ${d.message}`, true);
        }
    } catch(e) {
        showToast('Server error.', true);
    }
}


function showToast(msg, isError=false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.background = isError ? '#ef4444' : '#1e293b';
    t.style.display = 'block';
    setTimeout(() => { t.style.display='none'; }, 3500);
}
