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
                <td style="padding:1rem 1.25rem;color:#64748b;font-size:0.875rem;">${o.phone || '—'}</td>
                <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">${(o.items||[]).map(i=>`${i.product_name} ×${i.quantity}`).join(', ') || '—'}</td>
                <td style="padding:1rem 1.25rem;font-weight:600;">₹${parseFloat(o.total_amount||0).toLocaleString()}</td>
                <td style="padding:1rem 1.25rem;"><span style="padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:700;background:${(statusColors[o.order_status]||'#64748b')}20;color:${statusColors[o.order_status]||'#64748b'};"> ${o.order_status||'—'}</span></td>
                <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                <td style="padding:1rem 1.25rem;">
                    <div style="display:flex;gap:0.4rem;">
                        <button onclick="viewOrderDetails(${o.order_id})" style="padding:4px 10px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;" title="View Data">Details</button>
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

async function viewOrderDetails(orderId) {
    const token = localStorage.getItem('token');
    window.showModal({ title: 'Order Details', content: '<div style="padding:2rem;text-align:center;"><i class="fas fa-spin fa-spinner"></i></div>', hideFooter: true });
    
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const o = await res.json();
        
        const content = `
            <div style="display:flex; flex-direction:column; gap:1.5rem;">
                <!-- Header Info -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; background:#f8fafc; padding:1.25rem; border-radius:12px; border:1px solid #e2e8f0;">
                    <div>
                        <p style="font-size:0.65rem; color:#64748b; font-weight:700; text-transform:uppercase;">Order ID</p>
                        <p style="font-weight:800; font-size:1.25rem; color:#1e293b;">#ORD-${o.order_id}</p>
                        <p style="font-size:0.65rem; color:#64748b; font-weight:700; text-transform:uppercase; margin-top:1rem;">Customer / Dealer</p>
                        <p style="font-weight:700;">${o.customer_name}</p>
                        <p style="font-size:0.875rem; color:#64748b;">${o.phone}</p>
                    </div>
                    <div>
                        <p style="font-size:0.65rem; color:#64748b; font-weight:700; text-transform:uppercase;">Status</p>
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
                             <span style="padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:800; background:#8b5cf620; color:#8b5cf6;">${o.order_status.toUpperCase()}</span>
                        </div>
                        <p style="font-size:0.65rem; color:#64748b; font-weight:700; text-transform:uppercase; margin-top:1rem;">Delivery Address</p>
                        <p style="font-size:0.875rem; line-height:1.4; color:#334155;">${o.address}, ${o.city}, ${o.state}</p>
                    </div>
                </div>

                <!-- Items Table -->
                <div class="premium-card" style="padding:0; border:1px solid #e2e8f0; overflow:hidden;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead style="background:#f1f5f9;">
                            <tr>
                                <th style="padding:1rem; text-align:left; font-size:0.75rem; color:#64748b;">Product</th>
                                <th style="padding:1rem; text-align:center; font-size:0.75rem; color:#64748b;">Qty</th>
                                <th style="padding:1rem; text-align:right; font-size:0.75rem; color:#64748b;">Price</th>
                                <th style="padding:1rem; text-align:right; font-size:0.75rem; color:#64748b;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${o.items.map(i => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:1rem; font-weight:600;">${i.product_name}</td>
                                    <td style="padding:1rem; text-align:center;">${i.quantity}</td>
                                    <td style="padding:1rem; text-align:right;">₹${parseFloat(i.price).toLocaleString()}</td>
                                    <td style="padding:1rem; text-align:right; font-weight:700;">₹${parseFloat(i.total_price).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot style="background:#f8fafc; font-weight:800;">
                            <tr>
                                <td colspan="3" style="padding:1rem; text-align:right; color:#64748b;">Grand Total</td>
                                <td style="padding:1rem; text-align:right; color:var(--primary-color);">₹${parseFloat(o.total_amount).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Notes -->
                ${o.notes ? `
                    <div style="background:#fffbeb; padding:1.25rem; border-radius:12px; border:1px solid #fef3c7;">
                        <p style="font-size:0.65rem; color:#d97706; font-weight:700; text-transform:uppercase; margin-bottom:0.5rem;">Order Notes</p>
                        <p style="font-size:0.875rem; color:#92400e; font-style:italic;">"${o.notes}"</p>
                    </div>
                ` : ''}

                <!-- Actions -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:1.25rem; border-top:1px solid #f1f5f9;">
                    <div>
                        ${(o.order_status === 'draft' || o.order_status === 'billed' || o.order_status === 'packed') ? `
                            <button onclick="cancelOrder(${o.order_id})" style="padding:0.6rem 1.25rem; background:#fee2e2; color:#dc2626; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
                                <i class="fas fa-ban"></i> Cancel Order
                            </button>
                        ` : ''}
                    </div>
                    <div style="display:flex; gap:0.75rem;">
                        <button onclick="window.hideModal()" class="btn btn-outline">Close</button>
                        <button onclick="window.print()" class="btn" style="background:#0f172a; color:white;"><i class="fas fa-print"></i> Print Invoice</button>
                    </div>
                </div>
            </div>
        `;
        window.showModal({ title: 'Order Management', content, hideFooter: true });
    } catch (e) {
        console.error(e);
        alert('Error loading order details');
        window.hideModal();
    }
}

async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order? This will restore the stock to inventory and cannot be undone.')) return;
    
    try {
        const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ status: 'cancelled' })
        });
        
        if (res.ok) {
            alert('Order cancelled and stock restored.');
            window.hideModal();
            fetchOrders();
        } else {
            const err = await res.json();
            alert('Cancel failed: ' + (err.message || 'Unknown error'));
        }
    } catch (e) {
        alert('Connectivity error');
    }
}

window.viewOrderDetails = viewOrderDetails;
window.cancelOrder = cancelOrder;
window.fetchOrders = fetchOrders;
