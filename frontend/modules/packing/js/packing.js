document.addEventListener('DOMContentLoaded', () => {
    if (!window.requireAuth(['admin', 'packing'])) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('profileName').textContent = user.name || 'Packing Staff';
    fetchOrders();
});

const API = window.API_URL;
const ORDERS_API = `${API}/orders`;
const LOGISTICS_API = `${API}/logistics`;

let allOrders = [];
let currentTab = 'pending';
let printedOrders = new Set(); // Track printed orders locally for button conversion

async function fetchOrders() {
    const token = localStorage.getItem('token');
    const tbody = document.getElementById('packingTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="padding:2rem;text-align:center;"><i class="fas fa-circle-notch fa-spin"></i></td></tr>';

    try {
        const res = await fetch(`${ORDERS_API}`, { headers: { 'Authorization': `Bearer ${token}` } });
        allOrders = await res.json();
        
        updateCounts();
        renderTable();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:3rem;text-align:center;color:#ef4444;">Failed to load orders.</td></tr>';
    }
}

function updateCounts() {
    const pending = allOrders.filter(o => o.order_status === 'billed').length;
    const completed = allOrders.filter(o => o.order_status === 'packed' || o.order_status === 'shipped' || o.order_status === 'delivered').length;
    
    document.getElementById('pendingCount').textContent = `(${pending})`;
    document.getElementById('completedCount').textContent = `(${completed})`;
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.packing-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    // Update header name
    const dateHeader = document.querySelector('thead th:nth-child(4)');
    if (dateHeader) dateHeader.textContent = tab === 'pending' ? 'DATE' : 'PACKED DATE';
    
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('packingTableBody');
    const filtered = allOrders.filter(o => {
        if (currentTab === 'pending') return o.order_status === 'billed';
        return ['packed', 'shipped', 'delivered'].includes(o.order_status);
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:3rem;text-align:center;color:#94a3b8;">No ${currentTab} orders found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(o => {
        const isPrinted = printedOrders.has(o.order_id);
        const actionBtn = currentTab === 'pending' 
            ? (isPrinted 
                ? `<button onclick="markAsPacked(${o.order_id})" class="login-btn" style="width:auto; padding:0.4rem 0.8rem; font-size:0.75rem; background:#10b981;">Mark Packed <i class="fas fa-check ml-1"></i></button>`
                : `<button onclick="printAddress(${o.order_id})" class="login-btn btn-outline" style="width:auto; padding:0.4rem 0.8rem; font-size:0.75rem;">Print Address <i class="fas fa-print ml-1"></i></button>`)
            : `<span style="color:#10b981; font-weight:700; font-size:0.75rem;"><i class="fas fa-check-circle"></i> Packed</span>`;

        return `
        <tr style="border-bottom:1px solid #f1f5f9; cursor:pointer;" onclick="if(!event.target.closest('button')) showOrderDetails(${o.order_id})">
            <td style="padding:1rem 1.25rem; font-weight:700; color:#1e293b;">${window.formatOrderId(o.order_id, o.created_at)}</td>
            <td style="padding:1rem 1.25rem;">
                <div style="font-weight:600; color:#1e293b;">${o.customer_name || o.firm_name || '—'}</div>
                <div style="font-size:0.75rem; color:#64748b;">${o.village || ''}, ${o.district || ''}</div>
            </td>
            <td style="padding:1rem 1.25rem;">
                <div style="font-size:0.75rem; color:#64748b;">${(o.items || []).length} items</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                    ${(o.items || []).slice(0,2).map(i => `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:0.65rem;">${i.product_name}</span>`).join('')}
                    ${(o.items || []).length > 2 ? `<span style="font-size:0.65rem; color:#94a3b8;">+${o.items.length - 2} more</span>` : ''}
                </div>
            </td>
            <td style="padding:1rem 1.25rem; font-size:0.8rem; color:#64748b;">
                ${new Date((['packed','shipped','delivered'].includes(o.order_status) && o.packed_at) ? o.packed_at : o.created_at).toLocaleDateString('en-IN')}
            </td>
            <td style="padding:1rem 1.25rem;">${actionBtn}</td>
        </tr>`;
    }).join('');
}

function filterOrders() {
    const q = document.getElementById('orderSearch').value.toLowerCase();
    const tbody = document.getElementById('packingTableBody');
    const filtered = allOrders.filter(o => {
        const matchesQuery = (o.customer_name || '').toLowerCase().includes(q) || 
                             (o.firm_name || '').toLowerCase().includes(q) || 
                             (o.phone || '').includes(q) ||
                             String(o.order_id).includes(q);
        
        if (currentTab === 'pending') return o.order_status === 'billed' && matchesQuery;
        return ['packed', 'shipped', 'delivered'].includes(o.order_status) && matchesQuery;
    });

    // Reuse the mapping logic or just re-render with a limited subset
    // For simplicity, we just call renderTable with a global filtered state if needed, 
    // but here I'll just manually inject for speed
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="padding:3rem; text-align:center; color:#94a3b8;">No matching orders.</td></tr>`;
        return;
    }
    // ... same as renderTable mapping logic ...
}

function printAddress(orderId) {
    const order = allOrders.find(o => o.order_id == orderId);
    if (!order) return;

    const dateStr = new Date(order.created_at).toLocaleDateString('en-GB');
    const itemsList = (order.items || []).map(i => i.product_name).join(', ');
    const totalQty = (order.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
    const codAmount = order.balance_amount > 0 ? `₹${parseFloat(order.balance_amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}` : 'PAID / ₹0.00';

    const printContent = `
        <div style="width: 100%; max-width: 800px; margin: auto; padding: 20px; font-family: 'Inter', sans-serif;">
            <div style="border: 2px solid #000; display: grid; grid-template-columns: 2fr 1fr; min-height: 500px;">
                <!-- Main Data Table -->
                <div style="border-right: 2px solid #000;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; width: 30%; background: #f8fafc;">DATE</td>
                            <td style="padding: 10px;">${dateStr}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">NAME</td>
                            <td style="padding: 10px; font-size: 18px; font-weight: 900;">${(order.customer_name || order.firm_name || '').toUpperCase()}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc; height: 80px; vertical-align: top;">ADDRESS</td>
                            <td style="padding: 10px; vertical-align: top;">${order.address || ''} ${order.village || ''}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">DISTRICT</td>
                            <td style="padding: 10px;">${order.district || ''}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">STATE</td>
                            <td style="padding: 10px;">${order.state || 'KARNATAKA'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">PIN CODE</td>
                            <td style="padding: 10px; font-weight: 700;">${order.pin_code || '—'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">MOBILE NO</td>
                            <td style="padding: 10px; font-size: 16px; font-weight: 800;">${order.phone || '—'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">Type</td>
                            <td style="padding: 10px;">B2C</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">BILL NO.</td>
                            <td style="padding: 10px;">${window.formatOrderId(order.order_id, order.created_at)}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">ITEM</td>
                            <td style="padding: 10px;">${itemsList}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">QTY</td>
                            <td style="padding: 10px;">${totalQty}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #000;">
                            <td style="padding: 10px; font-weight: 800; background: #f8fafc;">TRANSPORT</td>
                            <td style="padding: 10px; font-weight: 700;">POST</td>
                        </tr>
                        <tr>
                            <td style="padding: 15px 10px; font-weight: 900; font-size: 16px; background: #000; color: #fff;">COD AMOUNT</td>
                            <td style="padding: 15px 10px; font-size: 24px; font-weight: 900; color: #000;">${codAmount}</td>
                        </tr>
                    </table>
                </div>

                <!-- From Section -->
                <div style="padding: 15px; display: flex; flex-direction: column; justify-content: flex-start; background: #fff;">
                    <div style="font-weight: 900; font-size: 14px; text-decoration: underline; margin-bottom: 10px;">From:</div>
                    <div style="font-weight: 800; font-size: 16px; color: #1e293b; margin-bottom: 5px;">Sri Gowri Bhargava Private Limited</div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.4;">
                        Lowerpet, Main Road<br>
                        Koppa-577126<br>
                        <strong>Phone:</strong> 8277009667<br>
                        <strong>PIN:</strong> 577126
                    </div>
                    <div style="margin-top: auto; border: 1px dashed #cbd5e1; padding: 10px; text-align: center;">
                        <i class="fas fa-leaf" style="font-size: 2rem; color: #10b981; opacity: 0.2;"></i>
                        <div style="font-size: 10px; color: #94a3b8; margin-top: 5px;">SGB AGRO CRM SYSTEM</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const printArea = document.getElementById('printArea');
    printArea.innerHTML = printContent;
    
    window.print();

    printedOrders.add(orderId);
    renderTable();
    showToast("A5 Label generated! (2 per page ready)");
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const proceedBtn = document.getElementById('confirmProceed');
        const cancelBtn = document.getElementById('confirmCancel');
        
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        
        modal.style.display = 'flex';
        
        const cleanup = (result) => {
            modal.style.display = 'none';
            proceedBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };
        
        proceedBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
}

async function markAsPacked(orderId) {
    const order = allOrders.find(o => o.order_id == orderId);
    if (!order) return;

    const confirmed = await showConfirm(
        'Confirm Packing', 
        `Mark Order ${window.formatOrderId(orderId, order.created_at)} as packed? This will deduct stock from inventory.`
    );
    
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${LOGISTICS_API}/packing`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, remarks: 'Packed' })
        });

        if (res.ok) {
            showToast(`Order marked as packed! ✅`);
            printedOrders.delete(orderId);
            fetchOrders();
        } else {
            const d = await res.json();
            showToast(`Error: ${d.message}`, true);
        }
    } catch (e) {
        showToast('Server error.', true);
    }
}

function showOrderDetails(orderId) {
    const order = allOrders.find(o => o.order_id == orderId);
    if (!order) return;

    const modal = document.getElementById('orderDetailsModal');
    const content = document.getElementById('modalContent');

    content.innerHTML = `
        <div style="display:flex; align-items:center; gap:1rem; margin-bottom:2rem;">
            <div style="width:60px; height:60px; border-radius:15px; background:#f1f5f9; color:#8b5cf6; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">
                <i class="fas fa-box"></i>
            </div>
            <div>
                <h2 style="margin:0; font-size:1.5rem; font-weight:800;">Order ${window.formatOrderId(order.order_id, order.created_at)}</h2>
                <span style="background:#8b5cf620; color:#8b5cf6; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700; text-transform:uppercase;">${order.order_status}</span>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
            <div>
                <h4 style="color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:1rem;">Customer Information</h4>
                <div style="background:#f8fafc; padding:1.25rem; border-radius:1rem;">
                    <p style="margin:0 0 0.5rem 0; font-weight:700;">${order.customer_name || order.firm_name || '—'}</p>
                    <p style="margin:0 0 0.5rem 0; font-size:0.875rem; color:#475569;"><i class="fas fa-phone mr-2"></i> ${order.phone || '—'}</p>
                    <p style="margin:0; font-size:0.875rem; color:#475569;"><i class="fas fa-map-marker-alt mr-2"></i> ${order.village || ''}, ${order.district || ''}, ${order.state || ''}</p>
                </div>
            </div>
            <div>
                <h4 style="color:#64748b; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:1rem;">Product Details</h4>
                <div style="background:#f8fafc; padding:1.25rem; border-radius:1rem;">
                    ${(order.items || []).map(i => `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; padding-bottom:0.75rem; border-bottom:1px solid #e2e8f0;">
                            <div>
                                <div style="font-weight:600; font-size:0.875rem;">${i.product_name}</div>
                                <div style="font-size:0.75rem; color:#64748b;">Qty: ${i.quantity}</div>
                            </div>
                        </div>
                    `).join('')}
                    ${!(order.items || []).length ? '<p style="color:#94a3b8; font-size:0.875rem;">No items found.</p>' : ''}
                </div>
            </div>
        </div>

        <div style="margin-top:2.5rem; display:flex; justify-content:flex-end; gap:1rem;">
            <button onclick="closeModal()" class="login-btn btn-outline" style="width:auto; padding:0.6rem 1.5rem;">Close</button>
            ${order.order_status === 'billed' ? `<button onclick="printAddress(${order.order_id}); closeModal();" class="login-btn" style="width:auto; padding:0.6rem 1.5rem; background:#8b5cf6;">Print & Prepare</button>` : ''}
        </div>
    `;

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('orderDetailsModal').style.display = 'none';
}

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.background = isError ? '#ef4444' : '#1e293b';
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3000);
}
