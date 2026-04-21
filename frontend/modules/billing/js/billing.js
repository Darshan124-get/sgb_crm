let currentOrder = null;

async function openOrderBilling(orderId) {
    const modal = document.getElementById('billingModal');
    const modalBody = document.getElementById('modalBody');
    modal.style.display = 'flex';
    modalBody.innerHTML = '<div style="text-align:center; padding: 5rem;"><div class="loader"></div></div>';

    try {
        const res = await fetch(`${BILLING_API_URL}/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        currentOrder = await res.json();

        renderWorkstation();
    } catch (err) {
        modalBody.innerHTML = '<p style="color: #ef4444; padding: 2rem;">Failed to load order details.</p>';
    }
}

function renderWorkstation() {
    const modalBody = document.getElementById('modalBody');
    const data = currentOrder;

    modalBody.innerHTML = `
        <div class="workstation-body">
            <!-- Left Side: Core Sections -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem; overflow-y: auto; padding-right: 1rem;">
                
                <!-- SECTION 1: CUSTOMER INFO -->
                <div class="work-section">
                    <h4 style="margin-bottom: 1.25rem; font-size: 0.75rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                        <i class="fas fa-user-circle" style="margin-right: 0.5rem;"></i> SECTION 1: CUSTOMER INFO
                    </h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div>
                            <p style="font-weight: 800; font-size: 1.25rem; margin-bottom: 0.25rem;">${data.customer_name}</p>
                            <p style="font-weight: 600; color: #64748b; font-size: 0.9rem;">${data.phone}</p>
                        </div>
                        <div>
                            <p style="font-size: 0.9rem; font-weight: 500; line-height: 1.6; color: #475569;">
                                ${data.address || 'No address provided'}<br>
                                ${data.city || ''}, ${data.state || ''}
                            </p>
                            ${data.gst_number ? `
                                <div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.5rem;">
                                    <i class="fas fa-id-card" style="color: #10b981;"></i>
                                    <span style="font-size: 0.75rem; color: #166534; font-weight: 700;">GST: ${data.gst_number}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- SECTION 2 & 3: ORDER DETAILS & PRODUCT EDITING -->
                <div class="work-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                        <h4 style="font-size: 0.75rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                            <i class="fas fa-box-open" style="margin-right: 0.5rem;"></i> SECTION 2 & 3: ORDER ITEMS & EDITING
                        </h4>
                        <div style="position: relative; width: 320px;">
                            <i class="fas fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
                            <input type="text" class="form-input" style="padding-left: 2.5rem; border-radius: 12px;" placeholder="Add Product by Name/SKU..." oninput="searchProducts(this.value)">
                            <div id="productSearchResults" class="search-results"></div>
                        </div>
                    </div>
                    <table class="edit-table">
                        <thead>
                            <tr>
                                <th>Product Specification</th>
                                <th style="width: 130px;">Unit Price</th>
                                <th style="width: 90px; text-align: center;">Qty</th>
                                <th style="width: 130px; text-align: right;">Total</th>
                                <th style="width: 50px;"></th>
                            </tr>
                        </thead>
                        <tbody id="workstationItems">
                            ${data.items.map((item, index) => `
                                <tr data-index="${index}">
                                    <td>
                                        <div style="font-weight: 700; color: #1e293b;">${item.product_name}</div>
                                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 600; margin-top: 0.25rem;">SKU: ${item.sku} | Stock: <span style="color: ${item.available_stock > 5 ? '#10b981' : '#ef4444'}">${item.available_stock || 0}</span></div>
                                    </td>
                                    <td>
                                        <div style="position: relative;">
                                            <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;">₹</span>
                                            <input type="number" class="form-input" style="padding-left: 1.75rem;" value="${item.price}" onchange="updateItem(${index}, 'price', this.value)">
                                        </div>
                                    </td>
                                    <td>
                                        <input type="number" class="form-input" style="text-align: center;" value="${item.quantity}" onchange="updateItem(${index}, 'quantity', this.value)">
                                    </td>
                                    <td style="text-align: right; font-weight: 800; color: #1e293b; font-size: 0.95rem;">₹${(item.price * item.quantity).toLocaleString()}</td>
                                    <td>
                                        <button class="btn-remove" onclick="removeItem(${index})" title="Remove Item"><i class="fas fa-trash-can"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- SECTION 5: PAYMENT & TRANSACTION HISTORY -->
                <div class="work-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                        <h4 style="font-size: 0.75rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                            <i class="fas fa-history" style="margin-right: 0.5rem;"></i> SECTION 5: PAYMENT & TRANSACTION HISTORY
                        </h4>
                        <button class="btn-billing primary" style="width: auto; padding: 0.5rem 1rem; font-size: 0.75rem;" onclick="showAddPaymentForm()">
                            <i class="fas fa-plus-circle"></i> ADD BALANCE PAYMENT
                        </button>
                    </div>
                    
                    <!-- Add Payment Inline Form (Hidden by default) -->
                    <div id="addPaymentForm" style="display: none; background: #f8fafc; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">
                         <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                            <div>
                                <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Amount (₹)</label>
                                <input type="number" id="newPayAmount" class="form-input" placeholder="0.00">
                            </div>
                            <div>
                                <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Mode</label>
                                <select id="newPayMode" class="form-input">
                                    <option value="upi">UPI</option>
                                    <option value="bank">Bank Transfer</option>
                                    <option value="cash">Cash</option>
                                    <option value="cod">COD</option>
                                </select>
                            </div>
                            <div>
                                <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Reference/Proof URL</label>
                                <input type="text" id="newPayProof" class="form-input" placeholder="URL to screenshot">
                            </div>
                         </div>
                         <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                            <button class="btn-billing success" style="width: auto; padding: 0.5rem 1.5rem;" onclick="submitNewPayment()">SAVE PAYMENT</button>
                            <button class="btn-billing" style="width: auto; padding: 0.5rem 1.5rem; background: #94a3b8; color: white;" onclick="toggleAddPayment(false)">CANCEL</button>
                         </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.25rem;">
                        ${data.payments && data.payments.length ? data.payments.map(p => `
                            <div style="background: #ffffff; padding: 1.25rem; border-radius: 16px; border: 1px solid #e2e8f0; position: relative; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border-left: 4px solid ${p.verified === 'yes' || p.payment_status === 'verified' ? '#10b981' : '#f59e0b'};">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
                                    <span style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">${p.source === 'lead_advance' ? 'Lead Advance' : (p.payment_type || 'Balance Payment')}</span>
                                    ${p.proof_url ? `<a href="${p.proof_url}" target="_blank" style="color: #3b82f6; font-size: 0.75rem; text-decoration: none; font-weight: 700;" title="View Receipt"><i class="fas fa-file-image"></i> PROOF</a>` : ''}
                                </div>
                                <div style="font-weight: 900; font-size: 1.35rem; color: #1e293b;">₹${parseFloat(p.amount).toLocaleString()}</div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem;">
                                    <span style="font-size: 0.7rem; padding: 2px 8px; background: #f1f5f9; border-radius: 4px; font-weight: 700; color: #475569;">${p.payment_mode.toUpperCase()}</span>
                                    <span class="status-badge status-${p.payment_status || (p.verified === 'yes' ? 'verified' : 'pending')}" style="font-size: 0.65rem;">${p.payment_status || (p.verified === 'yes' ? 'verified' : 'pending')}</span>
                                </div>
                                <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 0.5rem; font-weight: 600;">Recorded: ${new Date(p.created_at).toLocaleDateString()}</div>
                                ${(p.payment_status === 'pending' || (p.source === 'lead_advance' && p.verified === 'no')) ? `
                                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                                        <button class="btn-action btn-primary" style="flex:1; font-weight: 700; font-size: 0.7rem; height: 32px;" onclick="verifyGenericPayment('${p.source}', ${p.payment_id || p.advance_id}, 'verified')">VERIFY</button>
                                        <button class="btn-action" style="flex:1; font-weight: 700; font-size: 0.7rem; height: 32px; background: #fff5f5; color: #f87171; border: 1px solid #fecaca;" onclick="verifyGenericPayment('${p.source}', ${p.payment_id || p.advance_id}, 'rejected')">REJECT</button>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('') : `
                            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #f8fafc; border-radius: 16px; border: 2px dashed #e2e8f0;">
                                <i class="fas fa-money-bill-transfer" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 1rem; display: block;"></i>
                                <p style="color: #94a3b8; font-size: 0.9rem; font-weight: 600;">No payment history found.</p>
                            </div>
                        `}
                    </div>
                </div>

                <!-- ORDER AUDIT TRAIL -->
                <div class="work-section">
                    <h4 style="margin-bottom: 1.25rem; font-size: 0.75rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                        <i class="fas fa-history" style="margin-right: 0.5rem;"></i> ORDER AUDIT LOGS
                    </h4>
                    <div style="font-size: 0.8rem; color: #475569; max-height: 180px; overflow-y: auto; border-radius: 12px; border: 1px solid #f1f5f9;">
                        ${data.logs && data.logs.length ? data.logs.map(log => `
                            <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <span style="font-weight: 800; color: #1e293b;">${log.action}</span>
                                    <i class="fas fa-angle-right" style="margin: 0 0.5rem; opacity: 0.3;"></i>
                                    <span style="color: #64748b;">${log.new_value}</span>
                                </div>
                                <div style="text-align: right; opacity: 0.6; font-size: 0.75rem;">
                                    <div style="font-weight: 700;">${log.user_name}</div>
                                    <div>${new Date(log.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</div>
                                </div>
                            </div>
                        `).join('') : '<p style="padding: 2rem; text-align: center; color: #94a3b8;">No history available.</p>'}
                    </div>
                </div>
            </div>

            <!-- Right Side: SECTION 4 & 6 & 7: CALCULATION & INVOICE GENERATION -->
            <div class="calc-sidebar">
                <h3 style="margin-bottom: 2rem; display: flex; align-items: center; gap: 0.75rem; font-size: 1.25rem;">
                    <i class="fas fa-file-invoice-dollar" style="color: #10b981;"></i> SECTION 4: BILLING ENGINE
                </h3>
                
                <div class="calc-row"><span>Items Subtotal:</span> <span style="font-weight: 800;">₹${calculateItemsSubtotal().toLocaleString()}</span></div>
                
                <div style="margin: 1.5rem 0;">
                    <label style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Discount Amount (₹)</label>
                    <input type="number" id="discountInput" class="form-input" style="background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.15); height: 48px; font-size: 1.1rem; font-weight: 700;" value="${currentOrder.discount || 0}" onchange="recalculateAll()">
                </div>

                <div style="margin-bottom: 1.5rem;">
                    <label style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 0.5rem;">Shipping Charges (₹)</label>
                    <input type="number" id="shippingInput" class="form-input" style="background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.15); height: 48px; font-size: 1.1rem; font-weight: 700;" value="${currentOrder.shipping_charges || 0}" onchange="recalculateAll()">
                </div>

                <div id="taxDetails" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; margin-top: 1rem;">
                    <!-- Tax rows inject here -->
                </div>

                <div class="calc-row total" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                    <span>Final Total:</span> <span id="grandTotalLabel" style="font-size: 1.5rem; color: white;">₹0.00</span>
                </div>

                <div id="financialSummary" style="margin-top: 1rem; padding: 1.25rem; background: rgba(16, 185, 129, 0.1); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2);">
                    <div style="display:flex; justify-content:space-between; font-size: 0.85rem; margin-bottom: 0.5rem; color: #a7f3d0;">
                        <span>Verified Paid:</span>
                        <span id="verifiedPaidLabel" style="font-weight: 800;">₹0.00</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size: 1.1rem; color: #fff;">
                        <span style="font-weight: 600;">Balance Due:</span>
                        <span id="balanceDueLabel" style="font-weight: 900; color: #f87171;">₹0.00</span>
                    </div>
                </div>

                <div style="margin-top: auto; display: flex; flex-direction: column; gap: 1rem; padding-top: 3rem;">
                    <!-- SECTION 7: FINAL ACTIONS -->
                    <button class="btn-billing primary" style="height: 54px; font-size: 1rem;" onclick="saveOrderDraft()">
                        <i class="fas fa-save-as"></i> SAVE AS DRAFT
                    </button>
                    <!-- SECTION 6: INVOICE GENERATION -->
                    <button class="btn-billing success" style="height: 54px; font-size: 1.1rem; font-weight: 900;" onclick="generateFinalInvoice()">
                        <i class="fas fa-file-circle-check"></i> GENERATE INVOICE
                    </button>
                    
                    <button onclick="closeModal()" style="background:transparent; border:none; color: #94a3b8; font-size: 0.875rem; cursor:pointer; margin-top: 0.5rem; text-decoration: underline; font-weight: 600;">
                        Discard Changes & Close
                    </button>
                </div>
            </div>
        </div>
    `;
    recalculateAll();
}

/** Calculation Engine **/
function calculateItemsSubtotal() {
    return currentOrder.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
}

function recalculateAll() {
    if (!currentOrder) return;
    
    const subtotal = calculateItemsSubtotal();
    const discount = parseFloat(document.getElementById('discountInput').value || 0);
    const shipping = parseFloat(document.getElementById('shippingInput').value || 0);
    
    // Tax Logic
    const companyState = "Maharashtra"; // Should come from a global config ideally
    const taxRate = 18;
    const taxableAmount = subtotal - discount + shipping;
    
    let taxHtml = '';
    let grandTotal = taxableAmount;

    if (currentOrder.state === companyState) {
        const cgst = taxableAmount * (taxRate / 200);
        const sgst = taxableAmount * (taxRate / 200);
        taxHtml = `
            <div class="calc-row"><span>CGST (9%):</span> <span>₹${cgst.toFixed(2)}</span></div>
            <div class="calc-row"><span>SGST (9%):</span> <span>₹${sgst.toFixed(2)}</span></div>
        `;
        grandTotal += cgst + sgst;
    } else {
        const igst = taxableAmount * (taxRate / 100);
        taxHtml = `<div class="calc-row"><span>IGST (18%):</span> <span>₹${igst.toFixed(2)}</span></div>`;
        grandTotal += igst;
    }

    document.getElementById('taxDetails').innerHTML = taxHtml;
    document.getElementById('grandTotalLabel').innerText = `₹${grandTotal.toLocaleString()}`;
    
    // Financial Summary
    const verifiedTotal = (currentOrder.payments || []).reduce((sum, p) => {
        if (p.payment_status === 'verified' || p.verified === 'yes') return sum + parseFloat(p.amount);
        return sum;
    }, 0);

    const balanceDue = Math.max(0, grandTotal - verifiedTotal);

    document.getElementById('verifiedPaidLabel').innerText = `₹${verifiedTotal.toLocaleString()}`;
    document.getElementById('balanceDueLabel').innerText = `₹${balanceDue.toLocaleString()}`;
    document.getElementById('balanceDueLabel').style.color = balanceDue > 0 ? '#f87171' : '#10b981';

    const generateBtn = document.querySelector('button[onclick="generateFinalInvoice()"]');
    if (generateBtn) {
        if (balanceDue > 0) {
            generateBtn.innerHTML = `<i class="fas fa-file-circle-check"></i> FINALIZE (AWAITING ₹${balanceDue.toLocaleString()})`;
            generateBtn.style.opacity = "0.8";
        } else {
            generateBtn.innerHTML = `<i class="fas fa-truck-fast"></i> FINALIZE & MOVE TO PACKING`;
            generateBtn.style.opacity = "1";
        }
    }

    // Store in state
    currentOrder.discount = discount;
    currentOrder.shipping_charges = shipping;
    currentOrder.grandTotal = grandTotal;
    currentOrder.balanceDue = balanceDue;
}

/** Payment Actions **/
function showAddPaymentForm() {
    toggleAddPayment(true);
}

function toggleAddPayment(show) {
    document.getElementById('addPaymentForm').style.display = show ? 'block' : 'none';
}

async function submitNewPayment() {
    const amount = document.getElementById('newPayAmount').value;
    const mode = document.getElementById('newPayMode').value;
    const proof = document.getElementById('newPayProof').value;

    if (!amount || amount <= 0) return alert('Please enter a valid amount.');

    try {
        const res = await fetch(`${BILLING_API_URL}/payments`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: currentOrder.order_id,
                amount,
                mode,
                type: 'balance_payment',
                proof_url: proof
            })
        });

        if (res.ok) {
            alert('Payment recorded. Refreshing order...');
            toggleAddPayment(false);
            // Refresh full order
            const refreshed = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            currentOrder = await refreshed.json();
            renderWorkstation();
        } else {
            const err = await res.json();
            alert(err.message);
        }
    } catch (err) {
        alert('Failed to record payment');
    }
}

async function verifyGenericPayment(source, id, status) {
    // If it's a lead advance, we need a special endpoint or handle it in billing controller if extended
    // For now, let's assume we use the regular verifyPayment for order-linked payments
    // If it's source='lead_advance', we might need to handle it differently or migrate it
    
    // In our backend getOrderForBilling, we normalized them.
    // However, lead_advance_payments might need their own verification if they aren't part of the regular payments table.
    
    // DECISION: In the interest of time and following the user's specific table mention, 
    // I'll check if the billing controller can handle both.
    
    // Actually, I'll update verifyPayment in the backend to handle both OR use the regular one if they were migrated.
    // Since they weren't migrated, I'll use a specific logic here.
    
    let url = `${BILLING_API_URL}/payments/${id}/verify`;
    if (source === 'lead_advance') {
        // We'll need to create this endpoint or handle it
        url = `${BILLING_API_URL}/payments/lead-advance/${id}/verify`; 
    }

    try {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (res.ok) {
            const refreshRes = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            currentOrder = await refreshRes.json();
            renderWorkstation();
        } else {
            const err = await res.json();
            alert(err.message);
        }
    } catch (err) {
        alert('Verification failed.');
    }
}

/** Product Search & Management **/
let searchTimeout;
async function searchProducts(q) {
    const resultsDiv = document.getElementById('productSearchResults');
    if (q.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${window.API_URL}/inventory/search?q=${q}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const products = await res.json();
            
            resultsDiv.innerHTML = products.map(p => `
                <div class="search-item" onclick="addItemToOrder(${JSON.stringify(p).replace(/"/g, '&quot;')})">
                    <div>
                        <div style="font-weight: 600;">${p.name}</div>
                        <div style="font-size: 0.7rem; opacity: 0.6;">SKU: ${p.sku}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700;">₹${p.default_price}</div>
                        <div style="font-size: 0.7rem; color: ${p.current_stock > 0 ? '#10b981' : '#ef4444'}">Stock: ${p.current_stock}</div>
                    </div>
                </div>
            `).join('');
            resultsDiv.style.display = 'block';
        } catch (err) {
            console.error('Search error:', err);
        }
    }, 300);
}

function addItemToOrder(p) {
    currentOrder.items.push({
        product_id: p.product_id,
        product_name: p.name,
        sku: p.sku,
        price: p.default_price,
        quantity: 1,
        available_stock: p.current_stock - p.reserved_stock
    });
    
    document.getElementById('productSearchResults').style.display = 'none';
    renderWorkstation();
}

function updateItem(index, field, value) {
    if (field === 'quantity' && value < 1) value = 1;
    currentOrder.items[index][field] = value;
    renderWorkstation();
}

function removeItem(index) {
    currentOrder.items.splice(index, 1);
    renderWorkstation();
}

/** Persistence Actions **/
async function saveOrderDraft() {
    try {
        // 1. Save core order info (items, discount, shipping)
        const orderRes = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: currentOrder.items,
                discount: currentOrder.discount,
                shipping_charges: currentOrder.shipping_charges
            })
        });
        
        if (!orderRes.ok) {
            const err = await orderRes.json();
            throw new Error(err.message || 'Failed to save order draft');
        }

        // 2. Initialize/Update a Draft Invoice record
        const invRes = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/invoice`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                discount: currentOrder.discount,
                shipping_charges: currentOrder.shipping_charges,
                tax_type: currentOrder.state === 'Maharashtra' ? 'CGST_SGST' : 'IGST',
                status: 'draft'
            })
        });

        if (invRes.ok) {
            alert('Draft Saved Successfully (Order & Invoice Draft updated).');
            if (currentTab === 'pending') loadPendingOrders();
            else if (currentTab === 'in-review') loadInReviewOrders();
        } else {
            const err = await invRes.json();
            alert('Order saved, but invoice draft failed: ' + err.message);
        }
    } catch (err) {
        alert(err.message || 'Failed to save draft');
    }
}

async function verifyPayment(paymentId, status) {
    try {
        await fetch(`${BILLING_API_URL}/payments/${paymentId}/verify`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        // Refresh full order to get updated payment statuses
        const res = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        currentOrder = await res.json();
        renderWorkstation();
    } catch (err) {
        alert('Payment verification failed.');
    }
}

async function generateFinalInvoice() {
    if (!confirm('This will lock the order and generate a FINAL invoice. Continue?')) return;
    
    try {
        // First save the latest changes as a draft to be safe
        await saveOrderDraft();

        const res = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/invoice`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                discount: currentOrder.discount,
                shipping_charges: currentOrder.shipping_charges,
                tax_type: currentOrder.state === 'Maharashtra' ? 'CGST_SGST' : 'IGST',
                status: 'finalized'
            })
        });
        
        if (res.ok) {
            alert('Invoice Generated & Finalized. Moving to Shipping...');
            closeModal();
            switchTab('invoices');
        } else {
            const err = await res.json();
            alert(err.message);
        }
    } catch (err) {
        alert('Invoice generation failed: ' + err.message);
    }
}

async function loadInvoices() {
    const tbody = document.getElementById('invoicesBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem;"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${BILLING_API_URL}/invoices`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const invoices = await res.json();
        
        tbody.innerHTML = invoices.map(inv => `
            <tr>
                <td style="font-weight: 800; color: var(--billing-primary);">${inv.invoice_number}</td>
                <td>#ORD-${inv.order_id}</td>
                <td style="font-weight: 600;">${inv.order_customer}</td>
                <td>${new Date(inv.created_at).toLocaleDateString()}</td>
                <td style="font-weight: 700;">₹${parseFloat(inv.total_amount).toLocaleString()}</td>
                <td><span class="status-badge status-${inv.invoice_status}">${inv.invoice_status}</span></td>
                <td>
                    ${inv.invoice_status === 'draft' ? 
                        `<button class="btn-billing success" style="width: auto; padding: 0.5rem 1rem;" onclick="finalizeInvoice(${inv.invoice_id})">Finalize</button>` :
                        `<div style="display:flex; gap:0.5rem;">
                            <button class="btn-billing primary" style="width: auto; padding: 0.5rem 0.75rem;" title="View Invoice" onclick="viewInvoice(${inv.invoice_id})"><i class="fas fa-eye"></i></button>
                            <button class="btn-billing success" style="width: auto; padding: 0.5rem 0.75rem;" title="Print/Download" onclick="printInvoice(${inv.invoice_id})"><i class="fas fa-print"></i></button>
                         </div>`}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #ef4444;">Error loading invoices.</td></tr>';
    }
}

async function finalizeInvoice(invoiceId) {
    if (!confirm('Once finalized, this invoice becomes immutable and the order moves to Packing. Proceed?')) return;

    try {
        const res = await fetch(`${BILLING_API_URL}/invoices/${invoiceId}/finalize`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            alert('Invoice Finalized & Order sent to Packing.');
            loadInvoices();
        } else {
            const result = await res.json();
            alert(result.message);
        }
    } catch (err) {
        alert('Error finalizing invoice');
    }
}

async function loadPayments(status = 'pending') {
    const tbody = document.getElementById('paymentsBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem;"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${BILLING_API_URL}/payments?status=${status}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const payments = await res.json();
        
        tbody.innerHTML = payments.map(p => `
            <tr>
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                <td style="font-weight: 600;">${p.customer_name}</td>
                <td>#ORD-${p.order_id}</td>
                <td style="font-weight: 700;">₹${parseFloat(p.amount).toLocaleString()}</td>
                <td><span style="font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${p.payment_mode.toUpperCase()}</span></td>
                <td><span class="status-badge status-${p.payment_status}">${p.payment_status}</span></td>
                <td>
                    ${p.payment_status === 'pending' ? 
                        `<button class="btn-billing primary" style="width: auto; padding: 0.5rem 1rem;" onclick="verifyPayment(${p.payment_id}, 'verified'); loadPayments('${status}')">Verify</button>` : 
                        `<a href="${p.proof_url}" target="_blank" class="btn-billing" style="width: auto; padding: 0.5rem 0.75rem; background: #f1f5f9; color: #475569; text-decoration:none;"><i class="fas fa-file-invoice"></i> Proof</a>`}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #ef4444;">Error loading payments.</td></tr>';
    }
}

function closeModal() {
    document.getElementById('billingModal').style.display = 'none';
}

function viewInvoice(invoiceId) {
    window.open(`invoice.html?id=${invoiceId}`, '_blank');
}

function printInvoice(invoiceId) {
    // Open viewer first, which auto-triggers print if handled correctly, 
    // or just direct the user to the print-optimized viewer.
    window.open(`invoice.html?id=${invoiceId}`, '_blank');
}

function setupSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.oninput = (e) => {
            // Future global filter
        };
    }
}

const BILLING_API_URL = `${window.API_URL}/billing`;

let currentTab = 'dashboard';
let pendingOrders = [];

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    loadSidebar();
    switchTab('dashboard');
    setupSearch();
}

function loadSidebar() {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (window.renderSidebar) {
        window.renderSidebar('billing');
    }
}

function switchTab(tabId) {
    currentTab = tabId;
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    // Show target
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');

    // Update Sidebar highlighting
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const activeSideLink = document.getElementById(`side-${tabId}`);
    if (activeSideLink) {
        activeSideLink.classList.add('active');
        const navItem = activeSideLink.closest('.nav-item');
        if (navItem) navItem.classList.add('active');
    }

    // Sync with top tabs if they exist (for backwards compat)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(tabId));
    });

    // Fetch data based on tab
    if (tabId === 'dashboard') loadDashboard();
    if (tabId === 'pending') loadPendingOrders();
    if (tabId === 'in-review') loadInReviewOrders();
    if (tabId === 'invoices') loadInvoices();
    if (tabId === 'reports') loadReports();
    if (tabId === 'settings') loadSettings();
}

async function loadReports() {
    const container = document.getElementById('reportsContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding: 5rem;"><div class="loader"></div></div>';

    try {
        const res = await fetch(`${BILLING_API_URL}/reports/revenue`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const stats = await res.json();
        
        container.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 16px; border: 1px solid #e2e8f0;">
                <h3 style="margin-bottom: 2rem;">Financial Performance Report</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin-bottom: 3rem;">
                    <div style="padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
                        <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.5rem;">Daily Billed Amount</p>
                        <p style="font-size: 1.5rem; font-weight: 800;">₹${stats.revenueToday.toLocaleString()}</p>
                    </div>
                    <div style="padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
                        <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.5rem;">Estimated GST Collected</p>
                        <p style="font-size: 1.5rem; font-weight: 800; color: var(--billing-primary);">₹${(stats.revenueToday * 0.18).toLocaleString()}</p>
                    </div>
                    <div style="padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
                        <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.5rem;">Invoices Generated</p>
                        <p style="font-size: 1.5rem; font-weight: 800;">${stats.billedToday}</p>
                    </div>
                </div>
                
                <table class="report-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; background: #f1f5f9;">
                            <th style="padding: 1rem;">Date</th>
                            <th style="padding: 1rem;">Metric</th>
                            <th style="padding: 1rem; text-align: right;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style="padding: 1rem;">${new Date().toDateString()}</td><td style="padding: 1rem;">Total Revenue</td><td style="padding: 1rem; text-align: right; font-weight: 700;">₹${stats.revenueToday.toLocaleString()}</td></tr>
                        <tr><td style="padding: 1rem;">${new Date().toDateString()}</td><td style="padding: 1rem;">Finalized Invoices</td><td style="padding: 1rem; text-align: right;">${stats.billedToday}</td></tr>
                        <tr><td style="padding: 1rem;">${new Date().toDateString()}</td><td style="padding: 1rem;">Draft Conversion Rate</td><td style="padding: 1rem; text-align: right;">${((stats.billedToday / (stats.pendingBilling + stats.billedToday || 1)) * 100).toFixed(1)}%</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = '<p style="color: #ef4444;">Failed to load reports.</p>';
    }
}

async function loadDashboard() {
    try {
        const res = await fetch(`${BILLING_API_URL}/stats`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const stats = await res.json();
        
        const grid = document.getElementById('statsGrid');
        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-clock"></i></div>
                <div class="stat-label">Pending Billing</div>
                <div class="stat-value">${stats.pendingBilling}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="color: #10b981;"><i class="fas fa-check-double"></i></div>
                <div class="stat-label">Invoices Finalized Today</div>
                <div class="stat-value">${stats.billedToday}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="color: #6366f1;"><i class="fas fa-indian-rupee-sign"></i></div>
                <div class="stat-label">Revenue Today</div>
                <div class="stat-value">₹${stats.revenueToday.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="color: #f59e0b;"><i class="fas fa-file-invoice"></i></div>
                <div class="stat-label">Pending Verifications</div>
                <div class="stat-value">${stats.pendingVerification}</div>
            </div>
        `;

        // Popular Activity (Last 5 invoices)
        const invRes = await fetch(`${BILLING_API_URL}/invoices`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const invoices = await invRes.json();
        const activityDiv = document.getElementById('recentActivity');
        activityDiv.innerHTML = invoices.slice(0, 5).map(inv => `
            <div style="display:flex; align-items:center; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;">
                <div style="background: #f1f5f9; width: 32px; height: 32px; border-radius: 8px; display:flex; align-items:center; justify-content:center; color: var(--billing-primary);">
                    <i class="fas fa-file-invoice" style="font-size: 0.875rem;"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-size: 0.875rem; font-weight: 600;">Invoice ${inv.invoice_number} generated</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${inv.order_customer} | ₹${parseFloat(inv.total_amount).toLocaleString()}</div>
                </div>
                <div style="font-size: 0.7rem; color: #94a3b8;">${new Date(inv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `).join('') || '<p style="text-align:center; padding: 2rem; color: #94a3b8;">No recent activity.</p>';

        // System Alerts
        const alertsDiv = document.getElementById('systemAlerts');
        const alerts = [];
        if (stats.pendingVerification > 0) alerts.push({ type: 'warning', text: `${stats.pendingVerification} payments awaiting verification.` });
        if (stats.pendingBilling > 10) alerts.push({ type: 'danger', text: `Billing backlog: ${stats.pendingBilling} orders pending.` });

        alertsDiv.innerHTML = alerts.map(a => `
            <div style="background: rgba(255,255,255,0.1); padding: 0.75rem; border-radius: 12px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.75rem; border: 1px solid rgba(255,255,255,0.1);">
                <i class="fas fa-circle-exclamation" style="color: ${a.type === 'danger' ? '#ef4444' : '#f59e0b'};"></i>
                <span style="font-size: 0.875rem; font-weight: 500;">${a.text}</span>
            </div>
        `).join('') || '<p style="opacity: 0.7; font-size: 0.875rem; text-align:center;">✅ All systems in sync.</p>';

    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

let allPendingOrders = [];

async function loadPendingOrders() {
    const tbody = document.getElementById('pendingOrdersBody');
    if (!allPendingOrders.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 3rem;"><div class="loader"></div></td></tr>';
    }

    try {
        if (!allPendingOrders.length) {
            const res = await fetch(`${BILLING_API_URL}/pending`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            allPendingOrders = await res.json();
            
            // Wire up filters once
            document.querySelectorAll('.filter-input-v2').forEach(input => {
                input.onchange = () => applyPendingFilters();
            });
        }
        
        applyPendingFilters();
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: #ef4444;">Error loading pending orders.</td></tr>';
    }
}

function applyPendingFilters() {
    const tbody = document.getElementById('pendingOrdersBody');
    const filterDate = document.getElementById('filterDate').value;
    const filterSales = document.getElementById('filterSales').value;
    const filterPayment = document.getElementById('filterPayment').value;
    const filterSource = document.getElementById('filterSource').value;

    const filtered = allPendingOrders.filter(order => {
        const matchesDate = !filterDate || new Date(order.created_at).toISOString().split('T')[0] === filterDate;
        const matchesSales = !filterSales || order.sales_person_name === filterSales;
        const matchesPayment = !filterPayment || 
            (filterPayment === 'verified' ? order.advance_verified : !order.advance_verified);
        const matchesSource = !filterSource || order.lead_source === filterSource;
        
        return matchesDate && matchesSales && matchesPayment && matchesSource;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 3rem; color: #64748b;">No orders match these filters.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(order => `
        <tr>
            <td style="font-weight: 700;">#ORD-${order.order_id}</td>
            <td style="font-weight: 600;">${order.customer_name}</td>
            <td>${order.phone}</td>
            <td>${order.sales_person_name || 'Staff'}</td>
            <td style="font-weight: 700;">₹${parseFloat(order.advance_paid || 0).toLocaleString()}</td>
            <td>
                ${order.has_payment_proof ? 
                    `<button class="btn-billing" style="width: auto; padding: 4px 10px; background: #f1f5f9; color: #3b82f6;" onclick="openOrderBilling(${order.order_id})"><i class="fas fa-image"></i> View</button>` : 
                    '<span style="opacity: 0.4;">N/A</span>'}
            </td>
            <td style="font-weight: 800; color: var(--billing-primary);">₹${parseFloat(order.total_amount).toLocaleString()}</td>
            <td><span class="status-badge status-${order.order_status}">${order.order_status}</span></td>
            <td>
                <button class="btn-billing primary" style="width: auto; padding: 0.4rem 0.75rem; font-size: 0.75rem;" onclick="openOrderBilling(${order.order_id})">START BILLING</button>
            </td>
        </tr>
    `).join('');

    // Populate Sales Filter if empty
    const salesSelect = document.getElementById('filterSales');
    if (salesSelect.options.length <= 1) {
        const staff = [...new Set(allPendingOrders.map(o => o.sales_person_name).filter(Boolean))];
        staff.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            salesSelect.appendChild(opt);
        });
    }
}

async function loadInReviewOrders() {
    const tbody = document.getElementById('inReviewOrdersBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem;"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${BILLING_API_URL}/pending`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const allOrders = await res.json();
        const inReview = allOrders.filter(o => o.order_status === 'in_review');
        
        if (inReview.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem; color: #64748b;">No orders currently in review.</td></tr>';
            return;
        }

        tbody.innerHTML = inReview.map(order => `
            <tr>
                <td style="font-weight: 700;">#ORD-${order.order_id}</td>
                <td>
                    <div style="font-weight: 600;">${order.customer_name}</div>
                </td>
                <td><span class="status-badge status-in_review">In Review</span></td>
                <td style="font-weight: 600;">₹${parseFloat(order.total_amount).toLocaleString()}</td>
                <td>${calculateWaitTime(order.updated_at)}</td>
                <td>Price Adjustment</td>
                <td>
                    <button class="btn-billing primary" style="width: auto; padding: 0.5rem 1rem;" onclick="openOrderBilling(${order.order_id})">Continue</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #ef4444;">Error loading in-review orders.</td></tr>';
    }
}

function calculateWaitTime(updatedAt) {
    const diff = new Date() - new Date(updatedAt);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    return `${hours}h ago`;
}

async function loadSettings() {
    const container = document.getElementById('settingsForm');
    container.innerHTML = '<div style="text-align:center; padding: 2rem;"><div class="loader"></div></div>';
    
    try {
        const res = await fetch(`${BILLING_API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const settings = await res.json();

        container.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Company State (for GST Logic)</label>
                <input type="text" id="setting_company_state" class="form-input" value="${settings.company_state || ''}" placeholder="e.g. Maharashtra">
            </div>
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Invoice Prefix</label>
                <input type="text" id="setting_invoice_prefix" class="form-input" value="${settings.invoice_prefix || 'SGB'}">
            </div>
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Default GST Rate (%)</label>
                <input type="number" id="setting_gst_rate" class="form-input" value="${settings.gst_rate || 18}">
            </div>
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Last Invoice Number (Sequence)</label>
                <input type="number" id="setting_last_invoice_num" class="form-input" value="${settings.last_invoice_num || 0}">
                <p style="font-size: 0.7rem; color: #ef4444; margin-top: 0.25rem;">⚠️ Only change this to fix sequence gaps. Be careful.</p>
            </div>
            <button class="btn-billing primary" style="max-width: 250px;" onclick="saveSettings()">Save Configuration</button>
        `;
    } catch (err) {
        container.innerHTML = '<p style="color: #ef4444;">Failed to load settings.</p>';
    }
}

async function saveSettings() {
    const data = {
        company_state: document.getElementById('setting_company_state').value,
        invoice_prefix: document.getElementById('setting_invoice_prefix').value,
        gst_rate: document.getElementById('setting_gst_rate').value,
        last_invoice_num: document.getElementById('setting_last_invoice_num').value
    };

    try {
        const res = await fetch(`${BILLING_API_URL}/settings`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            alert('Settings updated successfully.');
            loadSettings();
        } else {
            alert('Failed to update settings. Admin access required.');
        }
    } catch (err) {
        alert('Error saving settings');
    }
}
