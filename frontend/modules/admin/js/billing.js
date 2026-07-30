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

window.formatFullAddress = function(data) {
    if(!data) return '';
    let parts = [];
    if(data.village) parts.push(data.village);
    if(data.sub_district || data.taluk) parts.push(data.sub_district || data.taluk);
    if(data.district || data.city) parts.push(data.district || data.city);
    if(data.state) parts.push(data.state);
    
    let str = parts.join(', ');
    if(data.pincode) str += ' - ' + data.pincode;
    if(data.phone) str += ' | Ph: ' + data.phone;
    return str;
};

window.copyToClipboard = function(text) {
    if(!text) return;
    navigator.clipboard.writeText(text).then(() => {
        // optionally show a toast
    }).catch(err => console.error('Could not copy text: ', err));
};
window.updateDiscount = function(val) {
    if (!currentOrder) return;
    currentOrder.discount = parseFloat(val) || 0;
    
    const subtotal = currentOrder.items.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.quantity, 10)), 0);
    const grandTotal = subtotal - (parseFloat(currentOrder.discount) || 0) + (parseFloat(currentOrder.shipping_charges) || 0) + (parseFloat(currentOrder.extra_charges) || 0);
    const verifiedTotal = (currentOrder.payments || []).reduce((sum, p) => {
        if (p.payment_status === 'verified' || p.verified === 'yes') return sum + parseFloat(p.amount);
        return sum;
    }, 0);
    const advancePaid = Math.max(verifiedTotal, parseFloat(currentOrder.advance_amount) || 0);
    const balanceDue = Math.max(0, grandTotal - advancePaid);
    
    currentOrder.grandTotal = grandTotal;
    currentOrder.balanceDue = balanceDue;

    const displayGrand = document.getElementById('displayGrandTotal');
    if (displayGrand) displayGrand.textContent = '₹' + grandTotal.toLocaleString();
    
    const displayDue = document.getElementById('displayBalanceDue');
    if (displayDue) {
        displayDue.textContent = '₹' + balanceDue.toLocaleString();
        displayDue.style.color = balanceDue > 0 ? '#ef4444' : '#10b981';
    }
};
window.updateZohoBill = function(val) {
    if (!currentOrder) return;
    currentOrder.zoho_bill_number = val;
};

function renderWorkstation() {
    const container = document.getElementById('modalWorkstationBody');
    const data = currentOrder;
    
    // Switch modal-body from grid layout to block layout
    container.style.display = 'block';
    container.style.padding = '0';
    
    const subtotal = data.items.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.quantity, 10)), 0);
    const grandTotal = subtotal - (parseFloat(data.discount) || 0) + (parseFloat(data.shipping_charges) || 0) + (parseFloat(data.extra_charges) || 0);
    const verifiedTotal = (data.payments || []).reduce((sum, p) => {
        if (p.payment_status === 'verified' || p.verified === 'yes') return sum + parseFloat(p.amount);
        return sum;
    }, 0);
    const advancePaid = Math.max(verifiedTotal, parseFloat(data.advance_amount) || 0);
    const balanceDue = Math.max(0, grandTotal - advancePaid);
    
    data.grandTotal = grandTotal;
    data.balanceDue = balanceDue;
    data.advance_amount = advancePaid;

    container.innerHTML = `
        <div class="workstation-body" style="padding: 1.5rem; background: #f8fafc; max-height: 80vh; overflow-y: auto;">
            <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">
                    <h3 style="color: #1e293b; font-weight: 800; margin: 0;">
                        <i class="fas fa-clipboard-list" style="color: #3b82f6; margin-right: 0.5rem;"></i> Zoho Booking Reference
                    </h3>
                    <span style="font-size: 0.8rem; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 0.2rem 0.6rem; border-radius: 4px;">ORDER #${data.order_id}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <div style="margin-bottom: 1rem;">
                            <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Customer Name</label>
                            <div style="display: flex; align-items: center; justify-content: space-between; background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 8px; margin-top: 0.25rem;">
                                <span style="font-weight: 700; color: #0f172a; font-size: 1.1rem;">${data.customer_name || 'N/A'}</span>
                                <button onclick="copyToClipboard('${(data.customer_name || '').replace(/'/g, "\\'")}')" style="background: none; border: none; color: #3b82f6; cursor: pointer; padding: 0.5rem;"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Phone Number</label>
                            <div style="display: flex; align-items: center; justify-content: space-between; background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 8px; margin-top: 0.25rem;">
                                <span style="font-weight: 700; color: #0f172a; font-size: 1.1rem;">${data.phone || 'N/A'}</span>
                                <button onclick="copyToClipboard('${data.phone || ''}')" style="background: none; border: none; color: #3b82f6; cursor: pointer; padding: 0.5rem;"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>

                        <div style="margin-bottom: 1rem;">
                            <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Delivery Type</label>
                            <div style="display: flex; align-items: center; justify-content: space-between; background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 8px; margin-top: 0.25rem;">
                                <span style="font-weight: 700; color: #0f172a; font-size: 1.1rem;">${data.dispatch_through || data.delivery_type || 'N/A'}</span>
                                <button onclick="copyToClipboard('${(data.dispatch_through || data.delivery_type || '').replace(/'/g, "\\'")}')" style="background: none; border: none; color: #3b82f6; cursor: pointer; padding: 0.5rem;"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Complete Address</label>
                        <div style="background: #f1f5f9; padding: 1.25rem; border-radius: 8px; margin-top: 0.25rem; position: relative; line-height: 1.8;">
                            <button onclick="copyToClipboard(formatFullAddress(currentOrder))" style="position: absolute; top: 1rem; right: 1rem; background: #e0e7ff; border: none; color: #3730a3; cursor: pointer; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 700; font-size: 0.75rem;"><i class="fas fa-copy"></i> Copy All</button>
                            
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div><strong style="color:#475569; display:inline-block; width: 90px;">Village:</strong> <span style="font-weight: 600; color:#0f172a;">${data.village || 'N/A'}</span></div>
                                <button onclick="copyToClipboard('${(data.village || '').replace(/'/g, "\\'")}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div><strong style="color:#475569; display:inline-block; width: 90px;">Sub-District:</strong> <span style="font-weight: 600; color:#0f172a;">${data.sub_district || data.taluk || 'N/A'}</span></div>
                                <button onclick="copyToClipboard('${(data.sub_district || data.taluk || '').replace(/'/g, "\\'")}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div><strong style="color:#475569; display:inline-block; width: 90px;">District:</strong> <span style="font-weight: 600; color:#0f172a;">${data.district || data.city || 'N/A'}</span></div>
                                <button onclick="copyToClipboard('${(data.district || data.city || '').replace(/'/g, "\\'")}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div><strong style="color:#475569; display:inline-block; width: 90px;">State:</strong> <span style="font-weight: 600; color:#0f172a;">${data.state || 'N/A'}</span></div>
                                <button onclick="copyToClipboard('${(data.state || '').replace(/'/g, "\\'")}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div><strong style="color:#475569; display:inline-block; width: 90px;">PIN Code:</strong> <span style="font-weight: 600; color:#0f172a;">${data.pincode || 'N/A'}</span></div>
                                <button onclick="copyToClipboard('${data.pincode || ''}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div><strong style="color:#475569; display:inline-block; width: 90px;">Phone:</strong> <span style="font-weight: 600; color:#0f172a;">${data.phone || 'N/A'}</span></div>
                                <button onclick="copyToClipboard('${data.phone || ''}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <h3 style="margin-bottom: 1rem; color: #1e293b; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <span><i class="fas fa-box" style="color: #10b981; margin-right: 0.5rem;"></i> Product Details</span>
                </h3>

                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 1.5rem;">
                    <table style="border-collapse: collapse; margin: 0; width: 100%;">
                        <thead style="background: #f8fafc;">
                            <tr>
                                <th style="padding: 1rem; text-align: left; font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Product Name</th>
                                <th style="width: 120px; text-align: right; padding: 1rem; font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Unit Price</th>
                                <th style="width: 80px; text-align: center; padding: 1rem; font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Qty</th>
                                <th style="width: 120px; text-align: right; padding: 1rem; font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.length > 0 ? data.items.map(item => `
                                <tr style="border-top: 1px solid #e2e8f0;">
                                    <td style="font-weight: 700; padding: 1rem; font-size: 0.85rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                ${item.product_name}
                                                <div style="font-size:0.7rem; color:#64748b; font-weight: 600;">SKU: ${item.sku || 'N/A'}</div>
                                            </div>
                                            <button onclick="copyToClipboard('${(item.product_name || '').replace(/'/g, "\\'")}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                                        </div>
                                    </td>
                                    <td style="text-align: right; font-weight: 600; padding: 1rem; font-size: 0.85rem;">
                                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem;">
                                            ₹${item.price}
                                            <button onclick="copyToClipboard('${item.price}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                                        </div>
                                    </td>
                                    <td style="text-align: center; font-weight: 800; color: #0f172a; padding: 1rem; font-size: 0.85rem;">
                                        <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem;">
                                            ${item.quantity}
                                            <button onclick="copyToClipboard('${item.quantity}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                                        </div>
                                    </td>
                                    <td style="text-align: right; font-weight: 800; color: #0f172a; padding: 1rem; font-size: 0.85rem;">₹${(item.price * item.quantity).toLocaleString()}</td>
                                </tr>
                            `).join('') : `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #64748b;">No items found.</td></tr>`}
                        </tbody>
                    </table>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 3rem; background: #f8fafc; padding: 1.5rem 2rem; border-radius: 8px; border: 1px solid #e2e8f0; align-items: center;">
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Zoho Bill No.</div>
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;">
                            <input type="text" id="editableZohoBill" value="${data.zoho_bill_number || ''}" oninput="updateZohoBill(this.value)" placeholder="Enter bill no." style="width: 140px; padding: 0.25rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 800; font-size: 1.1rem; text-align: right; color: #3b82f6;">
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Discount</div>
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;">
                            <span style="font-weight: 800; color: #0f172a;">₹</span>
                            <input type="number" id="editableDiscount" value="${data.discount || 0}" oninput="updateDiscount(this.value)" style="width: 100px; padding: 0.25rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px; font-weight: 800; font-size: 1.1rem; text-align: right; color: #ef4444;">
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Amount</div>
                        <div id="displayGrandTotal" style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">₹${grandTotal.toLocaleString()}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Advance Paid</div>
                        <div style="font-size: 1.25rem; font-weight: 800; color: #10b981;">₹${advancePaid.toLocaleString()}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Due Amount</div>
                        <div id="displayBalanceDue" style="font-size: 1.5rem; font-weight: 900; color: ${balanceDue > 0 ? '#ef4444' : '#10b981'};">₹${balanceDue.toLocaleString()}</div>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem;">
                    <button onclick="closeModal()" style="padding: 0.75rem 2rem; background: white; color: #64748b; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; cursor: pointer;">Cancel</button>
                    <button onclick="generateFinalInvoice()" style="padding: 0.75rem 2.5rem; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 6px -1px rgb(59 130 246 / 0.3);">
                        <i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i> MARK AS BILLED
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function generateFinalInvoice() {
    if (!confirm('Are you sure you want to mark this order as Billed and send it to packing?')) return;

    try {
        // Save any changes made (like discount) before finalizing
        const updateRes = await fetch(`${window.API_URL}/billing/orders/${currentOrder.order_id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentOrder)
        });

        if (!updateRes.ok) {
            const err = await updateRes.json();
            alert('Failed to save changes: ' + err.message);
            return;
        }

        const res = await fetch(`${window.API_URL}/billing/orders/${currentOrder.order_id}/invoice`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'finalized',
                discount: currentOrder.discount,
                shipping_charges: currentOrder.shipping_charges,
                extra_charges: currentOrder.extra_charges
            })
        });

        if (res.ok) {
            const data = await res.json();
            closeModal();
            showFinalizeCopyModal(data.invoiceId || data.invoice_id);
            
            loadOrders('billed');
            loadStats();
        } else {
            const err = await res.json();
            alert(`Error: ${err.message}`);
        }
    } catch (err) { alert('Failed to generate invoice'); }
}

function showFinalizeCopyModal(invoiceId) {
    const d = currentOrder;
    let itemsText = d.items.map(i => `${i.product_name} (Qty: ${i.quantity})`).join('\n');
    let copyText = `ORDER FINALIZED: #${d.order_code || window.formatOrderId(d.order_id, d.created_at)}
Customer: ${d.customer_name} | Ph: ${d.phone}
Address: ${window.formatFullAddress(d)}

ITEMS:
${itemsText}

TOTAL: ₹${(d.grandTotal || 0).toLocaleString()}
ADVANCE: ₹${(d.advance_amount || 0).toLocaleString()}
DUE: ₹${(d.balanceDue || 0).toLocaleString()}`;

    if (invoiceId) {
        copyText += `\n\nInvoice Generated.`;
    }

    document.getElementById('finalizeCopyData').innerText = copyText;
    document.getElementById('finalizeCopyModal').style.display = 'flex';
}

function copyFinalizeData() {
    const text = document.getElementById('finalizeCopyData').innerText;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.btn-finalize-copy.primary');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => btn.innerHTML = orig, 2000);
    });
}

function closeFinalizeCopyModal() {
    document.getElementById('finalizeCopyModal').style.display = 'none';
}

function viewInvoice(invoiceId) {
    window.open(`invoice.html?id=${invoiceId}`, '_blank');
}

function closeModal() {
    document.getElementById('billingModal').style.display = 'none';
}
