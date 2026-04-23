let currentStatus = 'draft';
let currentOrder = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.requireAuth === 'function') {
        if (!window.requireAuth(['admin', 'billing'])) return;
    }
    
    initModule();
});

async function initModule() {
    if (window.renderSidebar) window.renderSidebar('billing');
    if (window.renderTopbar) window.renderTopbar();
    
    loadStats();
    loadOrders('draft');
}

// ─── Stats Loading ───────────────────────────────────────────
async function loadStats() {
    try {
        const res = await fetch(`${window.API_URL}/billing/stats`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const stats = await res.json();
        
        document.getElementById('statPending').innerText = stats.pendingBilling || 0;
        document.getElementById('statReview').innerText = stats.inReview || 0;
        document.getElementById('statBilled').innerText = stats.billedToday || 0;
        document.getElementById('statRevenue').innerText = `₹${(stats.revenueToday || 0).toLocaleString()}`;
    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

// ─── Order Loading ───────────────────────────────────────────
async function loadOrders(status) {
    currentStatus = status;
    const tbody = document.getElementById('ordersTableBody');
    const loader = document.getElementById('tableLoader');
    
    tbody.innerHTML = '';
    loader.style.display = 'block';
    
    const titles = {
        'draft': 'Orders Awaiting Billing',
        'in-review': 'Orders In Review',
        'billed': 'Successfully Billed Orders',
        'cancelled': 'Cancelled Orders'
    };
    document.getElementById('tableTitle').innerText = titles[status] || 'Orders';

    try {
        // We use the new unified endpoint added in the controller
        const url = `${window.API_URL}/billing/orders?status=${status}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        const data = await res.json();
        loader.style.display = 'none';

        // ROBUSTNESS FIX: Check if data is array
        const orders = Array.isArray(data) ? data : (data.orders || []);
        
        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:#94a3b8;">No orders found in this category.</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(o => `
            <tr>
                <td style="font-weight: 800; color: #3b82f6;">${window.formatOrderId(o.order_id, o.created_at)}</td>
                <td style="color: #64748b;">${new Date(o.created_at).toLocaleDateString()}</td>
                <td style="font-weight: 700;">${o.customer_name}</td>
                <td><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${o.item_count || 0} Items</span></td>
                <td>
                    <span class="status-badge" style="background: ${o.total_paid >= o.total_amount ? '#dcfce7' : '#fff7ed'}; color: ${o.total_paid >= o.total_amount ? '#15803d' : '#9a3412'};">
                        ${o.total_paid >= o.total_amount ? 'Fully Paid' : 'Partial/Pending'}
                    </span>
                </td>
                <td style="font-weight: 800;">₹${parseFloat(o.total_amount || 0).toLocaleString()}</td>
                <td>
                    <div style="display:flex; gap:0.5rem;">
                        ${status !== 'billed' ? 
                            `<button class="action-btn" onclick="openWorkstation(${o.order_id})"><i class="fas fa-file-invoice-dollar"></i> Process</button>` :
                            `<button class="action-btn" onclick="viewInvoice(${o.invoice_id})"><i class="fas fa-eye"></i> View Invoice</button>`
                        }
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        loader.style.display = 'none';
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #ef4444; padding:2rem;">Failed to load data. Please refresh.</td></tr>`;
    }
}

function switchTab(status) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(status));
    });
    loadOrders(status);
}

// ─── Workstation Functions ───────────────────────────────────
async function openWorkstation(orderId) {
    const modal = document.getElementById('billingModal');
    const container = document.getElementById('modalWorkstationBody');
    
    modal.style.display = 'flex';
    container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 5rem;"><div class="loader"></div></div>';
    document.getElementById('modalOrderTitle').innerText = `Order ${window.formatOrderId(orderId, currentOrder ? currentOrder.created_at : null)}`;

    try {
        const res = await fetch(`${window.API_URL}/billing/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        currentOrder = await res.json();
        renderWorkstation();
    } catch (err) {
        container.innerHTML = '<p style="color:#ef4444; text-align:center; padding:2rem;">Failed to load workstation.</p>';
    }
}

function renderWorkstation() {
    const container = document.getElementById('modalWorkstationBody');
    const o = currentOrder;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <!-- Customer & Order Context -->
            <div class="work-section">
                <span class="section-tag"><i class="fas fa-user"></i> SECTION 1: CUSTOMER & ORDER INFO</span>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                        <p style="font-weight: 800; font-size: 1.25rem; margin: 0;">${o.customer_name}</p>
                        <p style="color: #64748b; font-weight: 600; margin-top: 0.25rem;">${o.phone}</p>
                        <p style="font-size: 0.85rem; line-height: 1.6; margin-top: 1rem; color: #475569;">
                            ${o.address || 'No address provided'}<br>${o.city || ''}, ${o.state || ''}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Reference Code</p>
                        <p style="font-weight: 800; font-size: 1.1rem; color: #1e293b;">${o.order_code || window.formatOrderId(o.order_id, o.created_at)}</p>
                        <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;">Status: <span class="status-badge status-${o.status}">${o.status}</span></p>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div class="work-section">
                <span class="section-tag"><i class="fas fa-box"></i> SECTION 2 & 3: ITEMS & EDITING</span>
                <table class="billing-table" style="font-size: 0.85rem;">
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th>Product Name</th>
                            <th>Unit Price</th>
                            <th style="width: 100px;">Qty</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${o.items.map((item, idx) => `
                            <tr>
                                <td style="font-weight: 700;">${item.product_name}</td>
                                <td>₹${parseFloat(item.price).toLocaleString()}</td>
                                <td><input type="number" class="form-input" style="width: 60px; padding: 0.25rem;" value="${item.quantity}" onchange="updateItemQuantity(${idx}, this.value)"></td>
                                <td style="text-align: right; font-weight: 800;">₹${(item.price * item.quantity).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Payment History -->
            <div class="work-section">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <span class="section-tag"><i class="fas fa-credit-card"></i> SECTION 5: PAYMENT VERIFICATION</span>
                    <button class="action-btn" style="font-size: 0.7rem; padding: 0.25rem 0.75rem;" onclick="addPaymentUI()"><i class="fas fa-plus"></i> Manual Payment</button>
                </div>
                <div id="paymentList" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    ${o.payments.map(p => `
                        <div style="padding: 1rem; border: 1px solid #e2e8f0; border-radius: 12px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <p style="font-weight: 800; margin:0;">₹${parseFloat(p.amount).toLocaleString()}</p>
                                <p style="font-size: 0.7rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${p.payment_mode}</p>
                            </div>
                            <div style="text-align: right;">
                                <span class="status-badge status-${p.payment_status || 'pending'}">${p.payment_status || 'pending'}</span>
                                ${p.payment_status === 'pending' ? `<button onclick="verifyPayment(${p.payment_id})" style="display:block; margin-top: 0.5rem; background: #10b981; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer;">Verify</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Sidebar Engine -->
        <div class="calc-sidebar">
            <h3 style="margin: 0 0 2rem 0; font-size: 1.25rem; font-family: 'Outfit';">Billing Engine</h3>
            
            <div style="display: flex; flex-direction: column; gap: 1.25rem; flex: 1;">
                <div style="display:flex; justify-content:space-between;">
                    <span>Items Subtotal</span>
                    <span>₹${calculateSubtotal().toLocaleString()}</span>
                </div>
                
                <div>
                    <label style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Discount (₹)</label>
                    <input type="number" id="discountInput" class="form-input" style="background: rgba(255,255,255,0.1); color: white; border: none; margin-top: 0.5rem;" value="${o.discount || 0}" onchange="recalculate()">
                </div>

                <div>
                    <label style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Shipping (₹)</label>
                    <input type="number" id="shippingInput" class="form-input" style="background: rgba(255,255,255,0.1); color: white; border: none; margin-top: 0.5rem;" value="${o.shipping_charges || 0}" onchange="recalculate()">
                </div>

                <div id="taxDetails" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
                    <!-- Injected by recalculate -->
                </div>

                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem; display: flex; justify-content: space-between; font-weight: 800; font-size: 1.5rem;">
                    <span>Grand Total</span>
                    <span id="grandTotalLabel">₹0</span>
                </div>

                <div style="background: rgba(16, 185, 129, 0.1); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2); margin-top: 1rem;">
                    <div style="display:flex; justify-content:space-between; font-size: 0.85rem; color: #a7f3d0;">
                        <span>Verified Paid:</span>
                        <span id="verifiedPaidLabel">₹0</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top: 0.5rem; font-weight: 800;">
                        <span>Balance Due:</span>
                        <span id="balanceDueLabel" style="color: #fca5a5;">₹0</span>
                    </div>
                </div>
            </div>

            <div style="margin-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem;">
                <button class="action-btn" style="background: var(--billing-primary); color: white; height: 50px; font-weight: 800; border: none;" onclick="generateInvoice()">FINALIZE & BILL</button>
                <button class="action-btn" style="background: transparent; color: white; border-color: rgba(255,255,255,0.2);" onclick="closeModal()">CANCEL</button>
            </div>
        </div>
    `;
    recalculate();
}

function calculateSubtotal() {
    return currentOrder.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
}

function recalculate() {
    if (!currentOrder) return;
    
    const subtotal = calculateSubtotal();
    const discount = parseFloat(document.getElementById('discountInput').value || 0);
    const shipping = parseFloat(document.getElementById('shippingInput').value || 0);
    
    const taxable = subtotal - discount + shipping;
    const taxRate = 18; // Default 18% GST
    
    // Simple Tax logic for now
    let taxHtml = '';
    let grandTotal = taxable;

    if (currentOrder.state === 'Maharashtra') {
        const cgst = taxable * (taxRate / 200);
        const sgst = taxable * (taxRate / 200);
        taxHtml = `
            <div style="display:flex; justify-content:space-between; font-size: 0.85rem; opacity: 0.8; margin-bottom: 0.5rem;"><span>CGST (9%)</span><span>₹${cgst.toFixed(2)}</span></div>
            <div style="display:flex; justify-content:space-between; font-size: 0.85rem; opacity: 0.8;"><span>SGST (9%)</span><span>₹${sgst.toFixed(2)}</span></div>
        `;
        grandTotal += (cgst + sgst);
    } else {
        const igst = taxable * (taxRate / 100);
        taxHtml = `<div style="display:flex; justify-content:space-between; font-size: 0.85rem; opacity: 0.8;"><span>IGST (18%)</span><span>₹${igst.toFixed(2)}</span></div>`;
        grandTotal += igst;
    }

    const verifiedTotal = currentOrder.payments
        .filter(p => p.payment_status === 'verified' || p.verified === 'yes')
        .reduce((acc, p) => acc + parseFloat(p.amount), 0);

    const balanceDue = Math.max(0, grandTotal - verifiedTotal);

    document.getElementById('taxDetails').innerHTML = taxHtml;
    document.getElementById('grandTotalLabel').innerText = `₹${Math.round(grandTotal).toLocaleString()}`;
    document.getElementById('verifiedPaidLabel').innerText = `₹${verifiedTotal.toLocaleString()}`;
    document.getElementById('balanceDueLabel').innerText = `₹${Math.round(balanceDue).toLocaleString()}`;
    document.getElementById('balanceDueLabel').style.color = balanceDue > 0 ? '#fca5a5' : '#a7f3d0';

    // Store temporary totals
    currentOrder.computedTotals = { subtotal, discount, shipping, grandTotal, verifiedTotal, balanceDue };
}

async function verifyPayment(paymentId) {
    if (!confirm('Verify this payment?')) return;
    try {
        const res = await fetch(`${window.API_URL}/billing/payments/${paymentId}/verify`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'verified' })
        });
        if (res.ok) {
            alert('Payment Verified');
            openWorkstation(currentOrder.order_id); // Reload workstation
        }
    } catch (err) { alert('Failed to verify'); }
}

async function generateInvoice() {
    if (currentOrder.computedTotals.balanceDue > 0) {
        if (!confirm(`Warning: There is a balance of ₹${currentOrder.computedTotals.balanceDue.toLocaleString()} remaining. Finalize anyway?`)) return;
    }

    try {
        const res = await fetch(`${window.API_URL}/billing/orders/${currentOrder.order_id}/invoice`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                discount: currentOrder.computedTotals.discount,
                shipping_charges: currentOrder.computedTotals.shipping,
                status: 'finalized'
            })
        });

        if (res.ok) {
            const data = await res.json();
            alert(`Invoice ${data.invoice_number} generated successfully!`);
            closeModal();
            loadOrders('billed');
            loadStats();
        } else {
            const err = await res.json();
            alert(`Error: ${err.message}`);
        }
    } catch (err) { alert('Failed to generate invoice'); }
}

function viewInvoice(invoiceId) {
    window.open(`invoice.html?id=${invoiceId}`, '_blank');
}

function closeModal() {
    document.getElementById('billingModal').style.display = 'none';
}

function updateItemQuantity(idx, val) {
    currentOrder.items[idx].quantity = parseInt(val) || 1;
    recalculate();
}
