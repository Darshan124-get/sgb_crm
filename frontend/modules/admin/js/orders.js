let currentOrders = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin'])) return;
    const user = window.getCurrentUser();
    const profileEl = document.getElementById('profileName');
    if (profileEl) profileEl.textContent = user.name || 'Administrator';
    
    fetchOrders();

    // Event listeners for filters
    document.getElementById('statusFilter')?.addEventListener('change', fetchOrders);
    document.getElementById('sourceFilter')?.addEventListener('change', fetchOrders);
    
    // Drawer listeners
    document.getElementById('closeDrawer')?.addEventListener('click', closeSideDrawer);
    document.getElementById('drawerOverlay')?.addEventListener('click', closeSideDrawer);
});

async function fetchOrders() {
    const token  = localStorage.getItem('token');
    const status = document.getElementById('statusFilter')?.value || '';
    const source = document.getElementById('sourceFilter')?.value || '';
    const tbody  = document.getElementById('ordersTableBody');
    tbody.innerHTML = '<tr><td colspan="8" style="padding:2rem;text-align:center;"><i class="fas fa-circle-notch fa-spin"></i></td></tr>';

    try {
        let url = `${API_URL}/orders`;
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (source) params.append('source', source);
        
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        let orders = await res.json();

        // Client-side source filtering if backend doesn't support it yet
        if (source) {
            orders = orders.filter(o => o.order_source === source);
        }

        currentOrders = orders; // Save globally for drawer

        // Count by status
        ['draft','packed','billed','shipped'].forEach(s => {
            const el = document.getElementById(`count${s.charAt(0).toUpperCase()+s.slice(1)}`);
            if (el) el.textContent = orders.filter(o => o.order_status === s).length;
        });

        if (!orders.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="padding:3rem;text-align:center;color:#94a3b8;">No orders found.</td></tr>';
            return;
        }

        const statusColors = { 
            draft:'#64748b', 
            in_review:'#6366f1',
            packed:'#8b5cf6', 
            billed:'#f59e0b', 
            shipped:'#10b981',
            delivered:'#059669',
            cancelled:'#ef4444'
        };

        tbody.innerHTML = orders.map(o => `
            <tr onclick="event.target.tagName !== 'A' && openOrderDrawer(${o.order_id})" style="border-bottom:1px solid #f1f5f9; cursor:pointer;" class="order-row">
                <td style="padding:1rem 1.25rem;font-weight:700;color:#1e293b;">${window.formatOrderId(o.order_id, o.created_at)}</td>
                <td style="padding:1rem 1.25rem;">
                    <div style="font-weight:600;color:#1e293b;">${o.customer_name || '—'}</div>
                    <div style="font-size:0.75rem;color:#64748b;">${o.phone || '—'}</div>
                </td>
                <td style="padding:1rem 1.25rem;">
                    <span style="padding:2px 8px;border-radius:4px;font-size:0.65rem;font-weight:700;text-transform:uppercase;
                        ${o.order_source === 'lead' ? 'background:#dcfce7;color:#15803d;' : 'background:#e0f2fe;color:#0369a1;'}">
                        ${o.order_source || '—'}
                    </span>
                </td>
                <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">
                    ${(o.items||[]).map(i=>`${i.product_name || 'Item'} ×${i.quantity}`).join(', ') || '—'}
                </td>
                <td style="padding:1rem 1.25rem;font-weight:600;">₹${parseFloat(o.total_amount||0).toLocaleString()}</td>
                <td style="padding:1rem 1.25rem;">
                    <span style="padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:700;background:${(statusColors[o.order_status]||'#64748b')}20;color:${statusColors[o.order_status]||'#64748b'};"> 
                        ${o.order_status||'—'}
                    </span>
                </td>
                <td style="padding:1rem 1.25rem;font-size:0.8rem;color:#64748b;">${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                <td style="padding:1rem 1.25rem;" onclick="event.stopPropagation()">
                    <div style="display:flex;gap:0.5rem;">
                        <a href="../../modules/packing/packing.html" style="padding:4px 10px;background:#8b5cf620;color:#8b5cf6;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;" title="Pack">Pack</a>
                        <a href="../../modules/billing/billing.html" style="padding:4px 10px;background:#f59e0b20;color:#d97706;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;" title="Bill">Bill</a>
                        <a href="../../modules/shipping/shipping.html" style="padding:4px 10px;background:#10b98120;color:#059669;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;" title="Ship">Ship</a>
                    </div>
                </td>
            </tr>`).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" style="padding:3rem;text-align:center;color:#ef4444;">Failed to load orders.</td></tr>`;
    }
}

// ─── Order Drawer Logic ──────────────────────────────────────────

function openOrderDrawer(orderId) {
    const order = currentOrders.find(o => o.order_id === orderId);
    if (!order) return;

    const drawer = document.getElementById('sideDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const content = document.getElementById('drawerContent');

    document.getElementById('drawerOrderId').textContent = `Order ${window.formatOrderId(order.order_id, order.created_at)}`;
    
    const sourceHtml = `
        <span style="padding:2px 8px;border-radius:4px;font-size:0.65rem;font-weight:700;text-transform:uppercase;
            ${order.order_source === 'lead' ? 'background:#dcfce7;color:#15803d;' : 'background:#e0f2fe;color:#0369a1;'}">
            ${order.order_source || '—'} Source
        </span>
    `;
    document.getElementById('drawerOrderSource').innerHTML = sourceHtml;

    drawer.classList.add('active');
    overlay.classList.add('active');

    content.innerHTML = `
        <div class="drawer-section">
            <label class="section-label"><i class="fas fa-user"></i> Customer Info</label>
            <div class="info-grid">
                <div class="info-item">
                    <label>Name</label>
                    <p>${order.customer_name || '—'}</p>
                </div>
                <div class="info-item">
                    <label>Phone</label>
                    <p>${order.phone || '—'}</p>
                </div>
                <div class="info-item" style="grid-column: span 2;">
                    <label>Address</label>
                    <p>${order.address || '—'}, ${order.city || ''}, ${order.state || ''}</p>
                </div>
            </div>
        </div>

        <div class="drawer-section">
            <label class="section-label"><i class="fas fa-box"></i> Order Items</label>
            <div style="background:#f8fafc; border-radius:12px; padding:1rem; margin-top:0.5rem;">
                <table style="width:100%; font-size:0.875rem;">
                    <thead>
                        <tr style="color:#64748b; border-bottom:1px solid #e2e8f0;">
                            <th style="padding:0.5rem; text-align:left;">Item</th>
                            <th style="padding:0.5rem; text-align:center;">Qty</th>
                            <th style="padding:0.5rem; text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(order.items || []).map(i => `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:0.5rem;">${i.product_name || 'Unknown Product'}</td>
                                <td style="padding:0.5rem; text-align:center;">${i.quantity}</td>
                                <td style="padding:0.5rem; text-align:right; font-weight:600;">₹${parseFloat(i.total || 0).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                        ${!order.items?.length ? '<tr><td colspan="3" style="padding:1rem; text-align:center; color:#94a3b8;">No items recorded</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="drawer-section">
            <label class="section-label"><i class="fas fa-receipt"></i> Financial Summary</label>
            <div style="display:flex; flex-direction:column; gap:0.75rem; padding:1.25rem; background:#f0fdf4; border-radius:12px; border:1px solid #dcfce7;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#166534; font-weight:600;">Total Amount</span>
                    <span style="font-size:1.1rem; font-weight:800; color:#15803d;">₹${parseFloat(order.total_amount || 0).toLocaleString()}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#166534; font-weight:500;">Advance Paid</span>
                    <span style="font-weight:700; color:#166534;">₹${parseFloat(order.advance_amount || 0).toLocaleString()}</span>
                </div>
                <div style="margin-top:0.5rem; padding-top:0.75rem; border-top:1px dashed #bbf7d0; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#15803d; font-weight:800;">Balance Due</span>
                    <span style="font-size:1.25rem; font-weight:900; color:#15803d;">₹${parseFloat(order.balance_amount || 0).toLocaleString()}</span>
                </div>
            </div>
        </div>

        <div class="drawer-section">
            <label class="section-label"><i class="fas fa-tasks"></i> Update Status</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-top:0.5rem;">
                <button class="btn-wa-toggle" style="background:#f1f5f9; border-color:#e2e8f0; color:#475569;" onclick="updateOrderStatus(${order.order_id}, 'draft')">Draft</button>
                <button class="btn-wa-toggle" style="background:#f59e0b20; border-color:#f59e0b40; color:#d97706;" onclick="updateOrderStatus(${order.order_id}, 'billed')">Billed</button>
                <button class="btn-wa-toggle" style="background:#8b5cf620; border-color:#8b5cf640; color:#7c3aed;" onclick="updateOrderStatus(${order.order_id}, 'packed')">Packed</button>
                <button class="btn-wa-toggle" style="background:#10b98120; border-color:#10b98140; color:#059669;" onclick="updateOrderStatus(${order.order_id}, 'shipped')">Shipped</button>
            </div>
            <p style="font-size:0.7rem; color:#94a3b8; margin-top:0.75rem; text-align:center;">Current status: <strong style="text-transform:uppercase; color:#64748b;">${order.order_status}</strong></p>
        </div>
    `;
}

async function updateOrderStatus(orderId, newStatus) {
    if (!confirm(`Update order status to ${newStatus.toUpperCase()}?`)) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            if (window.showAlert) window.showAlert("Success", `Order status updated to ${newStatus}`, "success");
            else alert(`Order status updated to ${newStatus}`);
            
            fetchOrders(); // Refresh table
            closeSideDrawer();
        } else {
            const err = await response.json();
            throw new Error(err.message || 'Failed to update status');
        }
    } catch (err) {
        if (window.showAlert) window.showAlert("Error", err.message, "error");
        else alert('Error: ' + err.message);
    }
}

function closeSideDrawer() {
    document.getElementById('sideDrawer')?.classList.remove('active');
    document.getElementById('drawerOverlay')?.classList.remove('active');
}

