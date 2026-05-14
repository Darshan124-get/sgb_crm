let currentOrder = null;

window.openOrderBilling = async function (orderId) {
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
            <div class="workstation-content">
                <!-- SECTION 1: CUSTOMER INFO -->
                <div class="work-section">
                    <div class="grid-2">
                        <div>
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Customer Name <span style="color:red">*</span></label>
                            <input type="text" id="billCustomerName" class="form-input" style="height: 38px; font-weight: 700;" value="${data.customer_name || ''}">
                            
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin: 0.75rem 0 0.5rem 0;">Phone Number <span style="color:red">*</span></label>
                            <input type="text" id="billCustomerPhone" class="form-input" style="height: 38px;" value="${data.phone || ''}">
                        </div>
                        <div>
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Address <span style="color:red">*</span></label>
                            <textarea id="billCustomerAddress" class="form-input" style="height: 80px; resize: none; font-size: 0.85rem;">${data.address || ''}</textarea>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.4rem;">Village</label>
                                    <input type="text" id="billCustomerVillage" class="form-input" style="height: 38px;" value="${data.village || ''}">
                                </div>
                                <div>
                                    <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.4rem;">District</label>
                                    <input type="text" id="billCustomerDistrict" class="form-input" style="height: 38px;" value="${data.district || ''}">
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.4rem;">Pincode <span style="color:red">*</span></label>
                                    <input type="text" id="billCustomerPincode" class="form-input" style="height: 38px;" value="${data.pincode || ''}">
                                </div>
                                <div>
                                    <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.4rem;">State <span style="color:red">*</span></label>
                                    <input type="text" id="billCustomerState" class="form-input" style="height: 38px;" value="${data.state || ''}">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 1.5: SHIPPING & BILLING DETAILS -->
                <div class="work-section">
                    <div class="grid-3" style="gap: 1rem;">
                        <div>
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Courier Partner <span style="color:red">*</span></label>
                            <select id="dispatchThroughInput" class="form-input" style="height: 38px;">
                                <option value="">Select Courier</option>
                                <option value="Post" ${(data.dispatch_through || data.delivery_type) === 'Post' ? 'selected' : ''}>Post</option>
                                <option value="VRL" ${(data.dispatch_through || data.delivery_type) === 'VRL' ? 'selected' : ''}>VRL</option>
                                <option value="Other" ${!['Post', 'VRL'].includes(data.dispatch_through || data.delivery_type) && (data.dispatch_through || data.delivery_type) ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Discount (₹)</label>
                            <input type="number" id="discountInput" class="form-input" style="height: 38px; font-weight: 700;" value="${data.discount || 0}" onchange="recalculateAll()">
                        </div>
                        <div>
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Shipping (₹)</label>
                            <input type="number" id="shippingInput" class="form-input" style="height: 38px; font-weight: 700;" value="${data.shipping_charges || 0}" onchange="recalculateAll()">
                        </div>
                        <div>
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Destination</label>
                            <input type="text" id="destinationInput" class="form-input" style="height: 38px;" value="${data.destination || data.city || ''}">
                        </div>
                        <div>
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Extra Charges (₹)</label>
                            <input type="number" id="extraChargesInput" class="form-input" style="height: 38px; font-weight: 700;" value="${data.extra_charges || 0}" onchange="recalculateAll()">
                        </div>
                        <div>
                            <label style="display:block; font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem;">Delivery Note</label>
                            <input type="text" id="deliveryNoteInput" class="form-input" style="height: 38px;" value="${data.delivery_note || ''}">
                        </div>
                    </div>
                </div>

                <!-- SECTION 2 & 3: ORDER ITEMS -->
                <div class="work-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                        <h4 style="font-size: 0.75rem; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                            <i class="fas fa-box-open" style="margin-right: 0.5rem;"></i> SECTION 2 & 3: ORDER ITEMS
                        </h4>
                        <div style="position: relative; width: 320px;">
                            <i class="fas fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 0.8rem;"></i>
                            <input type="text" class="form-input" style="padding-left: 2.5rem; border-radius: 12px;" placeholder="Add Product..." oninput="searchProducts(this.value)">
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
                                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 600;">SKU: ${item.sku}</div>
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
                                    <td style="text-align: right; font-weight: 800; color: #1e293b;">₹${(item.price * item.quantity).toLocaleString()}</td>
                                    <td>
                                        <button class="btn-remove" onclick="removeItem(${index})"><i class="fas fa-trash-can"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>


            </div>

            <!-- STICKY SUMMARY BAR -->
            <div class="billing-summary-bar">
                <div style="display: flex; gap: 3rem;">
                    <div class="summary-item">
                        <span class="summary-label">Total Amount</span>
                        <span id="grandTotalLabel" class="summary-value">₹0.00</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Advance Amount</span>
                        <span id="verifiedPaidLabel" class="summary-value paid">₹0.00</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Due Amount</span>
                        <span id="balanceDueLabel" class="summary-value due">₹0.00</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <button class="btn-billing" style="width: auto; background: transparent; color: #64748b; border: 1px solid #e2e8f0;" onclick="saveOrderDraft()">
                        SAVE DRAFT
                    </button>
                    <button class="btn-bill" id="finalizeBtn" onclick="generateFinalInvoice()">
                        <i class="fas fa-receipt"></i> BILL ORDER
                    </button>
                    <button onclick="closeModal()" style="background:transparent; border:none; color: #94a3b8; font-size: 0.8rem; cursor:pointer; text-decoration: underline;">
                        Close
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
    const extra = parseFloat(document.getElementById('extraChargesInput').value || 0);

    // Tax Logic (Removed GST as per request - All items are inclusive)
    let grandTotal = subtotal - discount + shipping + extra;

    const taxDetails = document.getElementById('taxDetails');
    if (taxDetails) taxDetails.style.display = 'none';
    
    const grandTotalLabel = document.getElementById('grandTotalLabel');
    if (grandTotalLabel) grandTotalLabel.innerText = `₹${grandTotal.toLocaleString()}`;

    // Financial Summary
    const verifiedTotal = (currentOrder.payments || []).reduce((sum, p) => {
        if (p.payment_status === 'verified' || p.verified === 'yes') return sum + parseFloat(p.amount);
        return sum;
    }, 0);

    const balanceDue = Math.max(0, grandTotal - verifiedTotal);

    document.getElementById('verifiedPaidLabel').innerText = `₹${verifiedTotal.toLocaleString()}`;
    document.getElementById('balanceDueLabel').innerText = `₹${balanceDue.toLocaleString()}`;
    document.getElementById('balanceDueLabel').style.color = balanceDue > 0 ? '#f87171' : '#10b981';

    const finalizeBtn = document.getElementById('finalizeBtn');
    if (finalizeBtn) {
        if (balanceDue > 0) {
            finalizeBtn.innerHTML = `<i class="fas fa-receipt"></i> BILL ORDER (AWAITING ₹${balanceDue.toLocaleString()})`;
            finalizeBtn.style.opacity = "0.8";
        } else {
            finalizeBtn.innerHTML = `<i class="fas fa-receipt"></i> BILL ORDER`;
            finalizeBtn.style.opacity = "1";
        }
    }

    // Store in state
    currentOrder.discount = discount;
    currentOrder.shipping_charges = shipping;
    currentOrder.extra_charges = extra;
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
    let url = `${BILLING_API_URL}/payments/${id}/verify`;
    if (source === 'lead_advance') {
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
        hsn_code: p.hsn_code,
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
async function saveOrderDraft(options = { silent: false }) {
    try {
        const orderData = {
            customer_name: document.getElementById('billCustomerName').value,
            phone: document.getElementById('billCustomerPhone').value,
            address: document.getElementById('billCustomerAddress').value,
            village: document.getElementById('billCustomerVillage').value,
            district: document.getElementById('billCustomerDistrict').value,
            pincode: document.getElementById('billCustomerPincode').value,
            state: document.getElementById('billCustomerState').value,
            items: currentOrder.items,
            discount: parseFloat(document.getElementById('discountInput').value) || 0,
            shipping_charges: parseFloat(document.getElementById('shippingInput').value) || 0,
            extra_charges: parseFloat(document.getElementById('extraChargesInput').value) || 0,
            dispatch_through: document.getElementById('dispatchThroughInput').value
        };

        const orderRes = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!orderRes.ok) {
            const err = await orderRes.json();
            throw new Error(err.message || 'Failed to save order draft');
        }

        const invRes = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/invoice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                discount: orderData.discount,
                shipping_charges: orderData.shipping_charges,
                extra_charges: orderData.extra_charges,
                tax_type: 'NONE',
                status: 'draft',
                delivery_note: document.getElementById('deliveryNoteInput')?.value || '',
                dispatch_through: orderData.dispatch_through,
                destination: document.getElementById('destinationInput')?.value || '',
                payment_terms: document.getElementById('paymentTermsInput')?.value || ''
            })
        });

        if (invRes.ok) {
            if (!options.silent) alert('Draft Saved Successfully.');
            if (currentTab === 'pending') await loadPendingOrders();
            else if (currentTab === 'in-review') await loadInReviewOrders();
        } else {
            const err = await invRes.json();
            if (!options.silent) alert('Order saved, but invoice draft failed: ' + err.message);
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
    const customerName = document.getElementById('billCustomerName').value.trim();
    const phone = document.getElementById('billCustomerPhone').value.trim();
    const address = document.getElementById('billCustomerAddress').value.trim();
    const pincode = document.getElementById('billCustomerPincode').value.trim();
    const state = document.getElementById('billCustomerState').value.trim();
    const courier = document.getElementById('dispatchThroughInput').value;

    if (!customerName || !phone || !address || !pincode || !state || !courier) {
        window.showAlert("Mandatory Fields Missing", "Please ensure Name, Phone, Address, Pincode, State, and Courier Partner are all filled before finalizing.", "error");
        return;
    }

    if (!confirm("Are you sure you want to finalize this order and send it to packing?")) return;

    try {
        await saveOrderDraft({ silent: true });

        const res = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/invoice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'finalized'
            })
        });

        if (res.ok) {
            const invData = await res.json();
            // window.open(`invoice.html?id=${invData.invoiceId}`, '_blank'); // REMOVED AS PER REQUEST

            closeModal();
            showFinalizeCopyModal(invData.invoiceId);

            if (typeof switchTab === 'function') {
                switchTab('invoices');
            }
            loadInvoices();
        } else {
            const err = await res.json();
            window.showAlert("Error", err.message || "Failed to generate invoice", "error");
        }
    } catch (err) {
        window.showAlert("Error", "Invoice generation failed: " + err.message, "error");
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
                <td>${window.formatOrderId(inv.order_id, inv.created_at)}</td>
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
                <td>${window.formatOrderId(p.order_id, p.created_at)}</td>
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

/** Finalize & Copy Modal Logic **/
async function showFinalizeCopyModal(invoiceId) {
    const modal = document.getElementById('finalizeCopyModal');
    const dataBox = document.getElementById('finalizeCopyData');
    
    modal.style.display = 'flex';
    dataBox.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Preparing summary...</div>';

    try {
        const res = await fetch(`${BILLING_API_URL}/invoices/${invoiceId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch invoice details');
        
        const data = await res.json();
        
        if (!data || !data.items) throw new Error('Incomplete data received');

        const productsStr = data.items.map(item => `- ${item.product_name} x ${item.quantity} (₹${parseFloat(item.price).toLocaleString()})`).join('\n');
        
        const message = `
================================
📦 BILLING DATA SUMMARY
================================
👤 CUSTOMER: ${data.billing_name}
📞 PHONE: ${data.billing_phone}
📍 ADDRESS: ${data.billing_address}
🏡 VILLAGE: ${data.billing_village || 'N/A'}
🏙️ DISTRICT: ${data.billing_district || 'N/A'}
🗺️ STATE: ${data.state || 'N/A'}
🔢 PINCODE: ${data.billing_pincode || 'N/A'}

🛒 PRODUCTS:
${productsStr}

💰 TOTAL AMOUNT: ₹${parseFloat(data.total_amount).toLocaleString()}
💸 ADVANCES: ₹${parseFloat(data.advance_paid || 0).toLocaleString()}
📉 DUE AMOUNT: ₹${(parseFloat(data.total_amount) - parseFloat(data.advance_paid || 0)).toLocaleString()}
🚚 COURIER PARTNER: ${data.dispatch_through || 'N/A'}
📍 DESTINATION: ${data.destination || 'N/A'}
================================
Generated by SGB AGRIVAAN
`.trim();

        dataBox.innerText = message;
        // Store for copying
        window.lastBilledMessage = message;
        
    } catch (err) {
        console.error(err);
        dataBox.innerHTML = '<p style="color: #ef4444;">Failed to generate summary. Please check History tab.</p>';
    }
}

async function copyFinalizeData() {
    const btn = document.querySelector('.btn-finalize-copy.primary');
    const originalContent = btn.innerHTML;
    
    try {
        if (!window.lastBilledMessage) return;
        await navigator.clipboard.writeText(window.lastBilledMessage);
        
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied to Clipboard!';
        btn.style.background = '#10b981';
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.background = '';
        }, 2000);
    } catch (err) {
        alert('Failed to copy to clipboard');
    }
}

function closeFinalizeCopyModal() {
    document.getElementById('finalizeCopyModal').style.display = 'none';
}

function viewInvoice(invoiceId) {
    window.open(`invoice.html?id=${invoiceId}`, '_blank');
}

function printInvoice(invoiceId) {
    window.open(`invoice.html?id=${invoiceId}`, '_blank');
}

function setupSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.oninput = (e) => {
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

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    document.getElementById(tab).style.display = 'block';
    const link = document.getElementById(`side-${tab}`);
    if (link) link.classList.add('active');

    if (tab === 'pending') loadPendingOrders();
    if (tab === 'in-review') loadInReviewOrders();
    if (tab === 'history') loadBilledHistory();
    if (tab === 'payments') loadPayments();
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'invoices') loadInvoices();
    if (tab === 'reports') loadReports();
    if (tab === 'settings') loadSettings();
}

async function loadBilledHistory() {
    try {
        const res = await fetch(`${BILLING_API_URL}/invoices`);
        const invoices = await res.json();
        const list = document.getElementById('historyList');
        list.innerHTML = '';

        if (!invoices.length) {
            list.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 2rem;">No billed data found.</p>';
            return;
        }

        for (const inv of invoices) {
            const card = document.createElement('div');
            card.className = 'history-card';
            
            const date = new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const total = parseFloat(inv.total_amount || 0);
            const advances = parseFloat(inv.advance_paid || 0);
            const due = total - advances;
            
            card.innerHTML = `
                <div class="history-card-header">
                    <div>
                        <div style="font-weight: 800; color: #1e293b; font-size: 1.1rem;">${inv.order_customer || 'Guest'}</div>
                        <div style="color: #64748b; font-size: 0.75rem;">Inv #${inv.invoice_number} | ${date}</div>
                    </div>
                    <div class="status-badge" style="background: #dcfce7; color: #166534; font-size: 0.7rem; padding: 0.25rem 0.5rem; border-radius: 6px; font-weight: 800;">BILLED</div>
                </div>
                <div class="history-card-body">
                    <div class="history-item"><span class="history-label">Phone</span> <span style="font-weight: 700;">${inv.billing_phone || 'N/A'}</span></div>
                    <div class="history-item"><span class="history-label">Village</span> <span>${inv.village || inv.billing_village || 'N/A'}</span></div>
                    <div class="history-item"><span class="history-label">District</span> <span>${inv.district || inv.billing_district || 'N/A'}</span></div>
                    <div class="history-item"><span class="history-label">Pincode</span> <span>${inv.pincode || inv.billing_pincode || 'N/A'}</span></div>
                    <div class="history-item"><span class="history-label">Delivery</span> <span style="color: #6366f1; font-weight: 700;">${inv.delivery_type || 'N/A'}</span></div>
                    
                    <div style="margin: 1rem 0; padding-top: 1rem; border-top: 1px dashed #e2e8f0;">
                        <div class="history-item"><span class="history-label">Total Amount</span> <span style="font-weight: 800; color: #1e293b;">₹${total.toLocaleString()}</span></div>
                        <div class="history-item"><span class="history-label">Advances</span> <span style="color: #10b981; font-weight: 700;">₹${advances.toLocaleString()}</span></div>
                        <div class="history-item"><span class="history-label">Due Balance</span> <span style="color: #ef4444; font-weight: 800;">₹${due.toLocaleString()}</span></div>
                    </div>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn-copy" style="flex: 1;" onclick="copyFullBillData(${inv.invoice_id}, this)">
                        <i class="fa-solid fa-copy"></i> Copy Full Data
                    </button>
                    <button class="btn-copy" style="background: #1e293b; color: white; flex: 0 0 45px; justify-content: center;" title="Print Invoice" onclick="window.open('${window.BASE_URL}/api/billing/print-invoice/${inv.invoice_id}', '_blank')">
                        <i class="fa-solid fa-print"></i>
                    </button>
                </div>
            `;
            list.appendChild(card);
        }
    } catch (err) {
        console.error(err);
    }
}

async function copyFullBillData(invoiceId, btn) {
    try {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Copying...';
        
        const res = await fetch(`${BILLING_API_URL}/invoices/${invoiceId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!res.ok) throw new Error('Failed to fetch invoice details');

        const data = await res.json();
        
        if (!data || !data.items) throw new Error('No data found');

        const productsStr = data.items.map(item => `- ${item.product_name} x ${item.quantity} (₹${parseFloat(item.price).toLocaleString()})`).join('\n');
        
        const message = `
================================
📦 BILLING DATA SUMMARY
================================
👤 CUSTOMER: ${data.billing_name}
📞 PHONE: ${data.billing_phone}
📍 ADDRESS: ${data.billing_address}
🏡 VILLAGE: ${data.billing_village || 'N/A'}
🏙️ DISTRICT: ${data.billing_district || 'N/A'}
🗺️ STATE: ${data.state || 'N/A'}
🔢 PINCODE: ${data.billing_pincode || 'N/A'}

🛒 PRODUCTS:
${productsStr}

💰 TOTAL AMOUNT: ₹${parseFloat(data.total_amount).toLocaleString()}
💸 ADVANCES: ₹${parseFloat(data.advance_paid || 0).toLocaleString()}
📉 DUE AMOUNT: ₹${(parseFloat(data.total_amount) - parseFloat(data.advance_paid || 0)).toLocaleString()}
🚚 COURIER PARTNER: ${data.dispatch_through || 'N/A'}
📍 DESTINATION: ${data.destination || 'N/A'}
================================
Generated by SGB AGRIVAAN
`.trim();

        await navigator.clipboard.writeText(message);
        
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        btn.style.background = '#22c55e';
        btn.style.color = 'white';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.style.color = '';
        }, 2000);
    } catch (err) {
        console.error(err);
        btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error';
    }
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
                <div style="font-size: 0.7rem; color: #94a3b8;">${new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 3rem;"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${BILLING_API_URL}/pending`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        allPendingOrders = await res.json();

        // Wire up filters once
        document.querySelectorAll('.filter-input-v2').forEach(input => {
            input.onchange = () => applyPendingFilters();
        });

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
            <td style="font-weight: 700;">${window.formatOrderId(order.order_id, order.created_at)}</td>
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
                <td style="font-weight: 700;">${window.formatOrderId(order.order_id, order.created_at)}</td>
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
