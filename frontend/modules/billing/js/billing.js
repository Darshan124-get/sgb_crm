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


window.copyToClipboard = function(text) {
    if(!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if(window.showAlert) {
            window.showAlert('Copied', 'Text copied to clipboard!', 'success');
        } else {
            console.log('Copied to clipboard');
        }
    }).catch(err => console.error('Could not copy text: ', err));
};

window.formatFullAddress = function() {
    if(!currentOrder) return '';
    const d = currentOrder;
    let parts = [];
    if(d.village) parts.push(d.village);
    if(d.sub_district || d.taluk) parts.push(d.sub_district || d.taluk);
    if(d.district || d.city) parts.push(d.district || d.city);
    if(d.state) parts.push(d.state);
    
    let str = parts.join(', ');
    if(d.pincode) str += ' - ' + d.pincode;
    if(d.phone) str += ' | Ph: ' + d.phone;
    return str;
};

window.updateZohoBill = function(val) {
    if (!currentOrder) return;
    currentOrder.zoho_bill_number = val;
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

window.renderWorkstation = function() {
    const modalBody = document.getElementById('modalBody');
    const data = currentOrder;
    
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

    modalBody.innerHTML = `
        <div class="workstation-body" style="padding: 1.5rem; background: #f8fafc; max-height: 80vh; overflow-y: auto;">
            <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">
                    <h3 style="color: #1e293b; font-weight: 800; margin: 0;">
                        <i class="fas fa-clipboard-list" style="color: #3b82f6; margin-right: 0.5rem;"></i> Zoho Booking Reference
                    </h3>
                    <span style="font-size: 0.8rem; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 0.2rem 0.6rem; border-radius: 4px;">ORDER #${data.order_id}</span>
                </div>
                
                <div class="grid-2" style="gap: 2rem; margin-bottom: 2rem;">
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
                            <button onclick="copyToClipboard(formatFullAddress())" style="position: absolute; top: 1rem; right: 1rem; background: #e0e7ff; border: none; color: #3730a3; cursor: pointer; padding: 0.4rem 0.8rem; border-radius: 6px; font-weight: 700; font-size: 0.75rem;"><i class="fas fa-copy"></i> Copy All</button>
                            
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
                    <table class="edit-table" style="margin: 0; width: 100%;">
                        <thead style="background: #f8fafc;">
                            <tr>
                                <th style="padding: 1rem; text-align: left;">Product Name</th>
                                <th style="width: 120px; text-align: right; padding: 1rem;">Unit Price</th>
                                <th style="width: 80px; text-align: center; padding: 1rem;">Qty</th>
                                <th style="width: 120px; text-align: right; padding: 1rem;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.length > 0 ? data.items.map(item => `
                                <tr style="border-top: 1px solid #e2e8f0;">
                                    <td style="font-weight: 700; padding: 1rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                ${item.product_name}
                                                <div style="font-size:0.7rem; color:#64748b; font-weight: 600;">SKU: ${item.sku}</div>
                                            </div>
                                            <button onclick="copyToClipboard('${(item.product_name || '').replace(/'/g, "\\'")}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                                        </div>
                                    </td>
                                    <td style="text-align: right; font-weight: 600; padding: 1rem;">
                                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem;">
                                            ₹${item.price}
                                            <button onclick="copyToClipboard('${item.price}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                                        </div>
                                    </td>
                                    <td style="text-align: center; font-weight: 800; color: #0f172a; padding: 1rem;">
                                        <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem;">
                                            ${item.quantity}
                                            <button onclick="copyToClipboard('${item.quantity}')" style="background:none; border:none; color:#94a3b8; cursor:pointer;"><i class="fas fa-copy"></i></button>
                                        </div>
                                    </td>
                                    <td style="text-align: right; font-weight: 800; color: #0f172a; padding: 1rem;">₹${(item.price * item.quantity).toLocaleString()}</td>
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
    if (!confirm('Are you sure you want to mark this order as Billed and send it to packing?')) return;

    try {
        // Save any changes made (like discount) before finalizing
        const updateRes = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}`, {
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

        const res = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/invoice`, {
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
            const invData = await res.json();
            closeModal();
            showFinalizeCopyModal(invData.invoiceId);

            if (typeof switchTab === 'function') {
                // switchTab('invoices'); // User requested to disable auto-navigation
            }
            loadInvoices();
        } else {
            const err = await res.json();
            window.showAlert('Error', err.message || 'Failed to generate invoice', 'error');
        }
    } catch (err) {
        window.showAlert('Error', 'Invoice generation failed: ' + err.message, 'error');
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

        const productsStr = data.items.map((item, index) => `${index + 1}. ${item.product_name} (Qty: ${item.quantity}) - ₹${parseFloat(item.price * item.quantity).toLocaleString()}`).join('\n');
        
        const addressLine = [data.billing_village, data.billing_district, data.state].filter(Boolean).join(', ');
        const pincodeStr = data.billing_pincode ? ` - ${data.billing_pincode}` : '';

        const message = `
SGB AGRIVAAN - DISPATCH SUMMARY
--------------------------------------------------
[ CUSTOMER DETAILS ]
Name     : ${data.billing_name || 'N/A'}
Phone    : ${data.billing_phone || 'N/A'}
Address  : ${data.billing_address || 'N/A'}
           ${addressLine}${pincodeStr}

[ ORDER DETAILS ]
${productsStr}

[ FINANCIALS ]
Total Amount : ₹${parseFloat(data.total_amount || 0).toLocaleString()}
Advance Paid : ₹${parseFloat(data.advance_paid || 0).toLocaleString()}
Balance Due  : ₹${(parseFloat(data.total_amount || 0) - parseFloat(data.advance_paid || 0)).toLocaleString()}

[ LOGISTICS ]
Courier      : ${data.dispatch_through || 'N/A'}
Destination  : ${data.destination || 'N/A'}
--------------------------------------------------
System Generated Document
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
    
    // Hash routing
    const initialHash = window.location.hash.replace('#', '');
    const validTabs = ['dashboard', 'pending', 'in-review', 'invoices', 'history', 'payments', 'reports', 'customers', 'settings'];
    const initialTab = validTabs.includes(initialHash) ? initialHash : 'dashboard';
    
    switchTab(initialTab);
    
    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.replace('#', '');
        if (newHash && validTabs.includes(newHash)) {
            switchTab(newHash);
        }
    });

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
    const link = document.getElementById(`side-${tab}`) || document.getElementById(`nav-${tab}`);
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
        const res = await fetch(`${BILLING_API_URL}/invoices`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
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
                        <div style="font-weight: 800; color: #1e293b; font-size: 1.1rem;">${inv.order_customer || inv.billing_name || 'Guest'}</div>
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
                        <div class="history-item"><span class="history-label">Due Balance</span> <span style="font-weight: 800; color: #ef4444;">₹${due.toLocaleString()}</span></div>
                    </div>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    <button class="btn-copy" style="flex: 1;" onclick="copyFullBillData(${inv.invoice_id}, this)">
                        <i class="fa-solid fa-copy"></i> Copy Full Data
                    </button>
                    <button class="btn-copy" style="background: #3b82f6; color: white; flex: 0 0 45px; justify-content: center;" title="View Invoice" onclick="viewInvoice(${inv.invoice_id})">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-copy" style="background: #1e293b; color: white; flex: 0 0 45px; justify-content: center;" title="Print Invoice" onclick="printInvoice(${inv.invoice_id})">
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

        const productsStr = data.items.map((item, index) => `${index + 1}. ${item.product_name} (Qty: ${item.quantity}) - ₹${parseFloat(item.price * item.quantity).toLocaleString()}`).join('\n');
        
        const addressLine = [data.billing_village, data.billing_district, data.state].filter(Boolean).join(', ');
        const pincodeStr = data.billing_pincode ? ` - ${data.billing_pincode}` : '';

        const message = `
SGB AGRIVAAN - DISPATCH SUMMARY
--------------------------------------------------
[ CUSTOMER DETAILS ]
Name     : ${data.billing_name || 'N/A'}
Phone    : ${data.billing_phone || 'N/A'}
Address  : ${data.billing_address || 'N/A'}
           ${addressLine}${pincodeStr}

[ ORDER DETAILS ]
${productsStr}

[ FINANCIALS ]
Total Amount : ₹${parseFloat(data.total_amount || 0).toLocaleString()}
Advance Paid : ₹${parseFloat(data.advance_paid || 0).toLocaleString()}
Balance Due  : ₹${(parseFloat(data.total_amount || 0) - parseFloat(data.advance_paid || 0)).toLocaleString()}

[ LOGISTICS ]
Courier      : ${data.dispatch_through || 'N/A'}
Destination  : ${data.destination || 'N/A'}
--------------------------------------------------
System Generated Document
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

let revenueTrendChartInstance = null;
let statusDistributionChartInstance = null;
let monthlyRevenueChartInstance = null;
let sparklineChartInstances = {};

async function populateDashboardFilters(billingUsers) {
    // Populate Sales Executives
    try {
        const salesSelect = document.getElementById('dashSalesExecutive');
        if (salesSelect && salesSelect.options.length <= 1) {
            const res = await fetch(`/api/users/sales`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const salesExecs = await res.json();
                salesExecs.forEach(exec => {
                    const opt = document.createElement('option');
                    opt.value = exec.user_id;
                    opt.innerText = exec.name;
                    salesSelect.appendChild(opt);
                });
            }
        }
    } catch (err) {
        console.error('Failed to populate Sales Executive filter:', err);
    }

    // Populate Billing Users
    try {
        const billingSelect = document.getElementById('dashBillingUser');
        if (billingSelect && billingSelect.options.length <= 1 && billingUsers) {
            billingUsers.forEach(user => {
                const opt = document.createElement('option');
                opt.value = user.user_id;
                opt.innerText = user.name;
                billingSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Failed to populate Billing User filter:', err);
    }
}

function renderKpiCard(title, value, trend, iconClass, iconBg, iconColor, iconGlow, sparklineId) {
    const isNegative = trend.startsWith('-');
    const isZero = trend.startsWith('0');
    
    let cleanTrend = trend;
    if (trend.startsWith('+') || trend.startsWith('-')) {
        cleanTrend = trend.substring(1);
    }
    
    let trendArrow = '↑';
    let trendColor = '#10b981';
    if (isNegative) {
        trendArrow = '↓';
        trendColor = '#ef4444';
    } else if (isZero) {
        trendArrow = '→';
        trendColor = '#94a3b8';
    }

    return `
        <div class="stat-card" style="padding: 1.5rem; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between; height: 165px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; border-top: 4px solid ${iconColor}; background: white; transition: all 0.3s ease; position: relative; overflow: hidden;">
            <div style="display: flex; align-items: flex-start; gap: 1rem; z-index: 2;">
                <div style="width: 44px; height: 44px; border-radius: 10px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; box-shadow: 0 4px 10px ${iconGlow};">
                    <i class="${iconClass}"></i>
                </div>
                <div style="display: flex; flex-direction: column;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">${title}</div>
                    <div style="font-size: 2.25rem; font-weight: 700; color: #1e293b; font-family: 'Outfit'; margin-top: 0.25rem; line-height: 1.1;">${value}</div>
                </div>
            </div>
            <div style="display: flex; align-items: flex-end; justify-content: space-between; z-index: 2; margin-top: 0.5rem;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 0.95rem; font-weight: 700; color: ${trendColor}; display: inline-flex; align-items: center; gap: 0.15rem; font-family: 'Inter';">
                        ${trendArrow} ${cleanTrend}
                    </span>
                    <span style="color: #94a3b8; font-size: 0.725rem; font-weight: 500; margin-top: 1px; font-family: 'Inter';">vs yesterday</span>
                </div>
                <div style="width: 90px; height: 40px; position: relative; bottom: -2px;">
                    <canvas id="${sparklineId}" style="width: 90px; height: 40px;"></canvas>
                </div>
            </div>
        </div>
    `;
}

function initSparkline(canvasId, data, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (sparklineChartInstances[canvasId]) {
        sparklineChartInstances[canvasId].destroy();
    }

    sparklineChartInstances[canvasId] = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: data.map((_, i) => i),
            datasets: [{
                data: data,
                borderColor: color,
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function initRevenueTrendChart(trendData) {
    const ctx = document.getElementById('revenueTrendChart');
    if (!ctx) return;

    if (revenueTrendChartInstance) {
        revenueTrendChartInstance.destroy();
    }

    const timeframe = document.getElementById('trendTimeframe')?.value || 'daily';
    
    let labels = trendData.labels;
    let thisWeek = trendData.thisWeek;
    let lastWeek = trendData.lastWeek;

    if (timeframe === 'weekly') {
        labels = ['Week 1', 'Week 2'];
        const sum = arr => arr.reduce((a,b)=>a+b, 0);
        thisWeek = [sum(trendData.thisWeek.slice(0, 3)), sum(trendData.thisWeek.slice(3))];
        lastWeek = [sum(trendData.lastWeek.slice(0, 3)), sum(trendData.lastWeek.slice(3))];
    }

    revenueTrendChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'This Week (₹)',
                    data: thisWeek,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointHoverRadius: 6
                },
                {
                    label: 'Last Week (₹)',
                    data: lastWeek,
                    borderColor: '#94a3b8',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: '#94a3b8',
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Inter', weight: 600 }, boxWidth: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ₹${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } },
                y: { 
                    ticks: {
                        font: { family: 'Inter' },
                        callback: function(value) {
                            return '₹' + (value >= 1000 ? (value / 1000) + 'k' : value);
                        }
                    }
                }
            }
        }
    });
}

window.updateRevenueTrendChart = function() {
    loadDashboard();
};

function initStatusDistributionChart(dist) {
    const canvas = document.getElementById('statusDistributionChart');
    if (!canvas) return;

    if (statusDistributionChartInstance) {
        statusDistributionChartInstance.destroy();
    }

    document.getElementById('distributionTotal').innerText = dist.total;

    const legendDiv = document.getElementById('statusDistributionLegend');
    const items = [
        { label: 'Generated', val: dist.generated, color: '#3b82f6' },
        { label: 'Pending', val: dist.pending, color: '#f59e0b' },
        { label: 'Verified', val: dist.verified, color: '#10b981' },
        { label: 'Rejected', val: dist.rejected, color: '#ef4444' }
    ];
    
    const total = dist.total || 1;
    legendDiv.innerHTML = items.map(item => {
        const pct = Math.round((item.val / total) * 100);
        return `
            <div style="display:flex; align-items:center; gap: 0.35rem;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color};"></div>
                <div style="font-weight: 500; color: #64748b; flex: 1;">${item.label}</div>
                <div style="font-weight: 700; color: #1e293b;">${pct}% (${item.val})</div>
            </div>
        `;
    }).join('');

    statusDistributionChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Generated', 'Pending', 'Verified', 'Rejected'],
            datasets: [{
                data: [dist.generated, dist.pending, dist.verified, dist.rejected],
                backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            cutout: '72%',
            plugins: { legend: { display: false } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function initMonthlyRevenueChart(monthlyData) {
    const ctx = document.getElementById('monthlyRevenueChart');
    if (!ctx) return;

    if (monthlyRevenueChartInstance) {
        monthlyRevenueChartInstance.destroy();
    }

    const yearOption = document.getElementById('monthlyRevenueYear')?.value || 'this_year';
    const data = yearOption === 'this_year' ? monthlyData.thisYear : monthlyData.lastYear;
    const labelText = yearOption === 'this_year' ? 'This Year (₹)' : 'Last Year (₹)';

    const maxVal = Math.max(...data);

    const backgroundColors = data.map((val, idx) => {
        if (val === maxVal && val > 0) return '#4f46e5';
        return 'rgba(99, 102, 241, 0.25)';
    });

    const borderColors = data.map((val, idx) => {
        if (val === maxVal && val > 0) return '#4f46e5';
        return '#6366f1';
    });

    monthlyRevenueChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: labelText,
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Revenue: ₹${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } },
                y: {
                    ticks: {
                        font: { family: 'Inter' },
                        callback: function(value) {
                            if (value >= 100000) return '₹' + (value / 100000) + 'L';
                            if (value >= 1000) return '₹' + (value / 1000) + 'k';
                            return '₹' + value;
                        }
                    }
                }
            }
        }
    });
}

window.updateMonthlyRevenueChart = function() {
    loadDashboard();
};

window.refreshDashboard = function() {
    loadDashboard();
};

window.exportReport = function() {
    if (window.showAlert) {
        window.showAlert('Exporting...', 'Preparing your CSV report for download!', 'info');
    }
    const headers = ['Date Range', 'New Orders', 'Pending Orders', 'Billing Drafts', 'Bills Generated', 'Revenue Billed'];
    const row = [
        document.getElementById('dashDateRange')?.value || 'today',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(1) .stat-value')?.innerText || '0',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(2) .stat-value')?.innerText || '0',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(3) .stat-value')?.innerText || '0',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(4) .stat-value')?.innerText || '0',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(5) .stat-value')?.innerText || '0'
    ];
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + row.join(',');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `billing_dashboard_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

async function loadDashboard() {
    try {
        const dateRange = document.getElementById('dashDateRange')?.value || 'today';
        const billingUser = document.getElementById('dashBillingUser')?.value || '';
        const paymentStatus = document.getElementById('dashPaymentStatus')?.value || '';
        const customerType = document.getElementById('dashCustomerType')?.value || '';
        const salesExecutive = document.getElementById('dashSalesExecutive')?.value || '';

        const params = new URLSearchParams({
            dateRange,
            billingUser,
            paymentStatus,
            customerType,
            salesExecutive
        });

        const res = await fetch(`${BILLING_API_URL}/stats?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const stats = await res.json();

        await populateDashboardFilters(stats.billingUsers);

        const statsRow = document.getElementById('dashboardStatsRow');
        const kpis = stats.kpis;
        statsRow.innerHTML = `
            ${renderKpiCard('New Orders Today', kpis.newOrders.value, kpis.newOrders.trend, 'fa-solid fa-cart-shopping', 'rgba(59, 130, 246, 0.1)', '#3b82f6', 'rgba(59, 130, 246, 0.2)', 'sparklineNewOrders')}
            ${renderKpiCard('Pending Orders', kpis.pendingOrders.value, kpis.pendingOrders.trend, 'fa-solid fa-clipboard-list', 'rgba(245, 158, 11, 0.1)', '#f59e0b', 'rgba(245, 158, 11, 0.2)', 'sparklinePendingOrders')}
            ${renderKpiCard('Billing (Drafts)', kpis.billingDrafts.value, kpis.billingDrafts.trend, 'fa-solid fa-file-invoice', 'rgba(16, 185, 129, 0.1)', '#10b981', 'rgba(16, 185, 129, 0.2)', 'sparklineBillingDrafts')}
            ${renderKpiCard('Bills Generated Today', kpis.billsGenerated.value, kpis.billsGenerated.trend, 'fa-solid fa-file-invoice-dollar', 'rgba(139, 92, 246, 0.1)', '#8b5cf6', 'rgba(139, 92, 246, 0.2)', 'sparklineBillsGenerated')}
            ${renderKpiCard('Revenue Billed Today', '₹' + kpis.revenueBilled.value.toLocaleString(), kpis.revenueBilled.trend, 'fa-solid fa-indian-rupee-sign', 'rgba(99, 102, 241, 0.1)', '#6366f1', 'rgba(99, 102, 241, 0.2)', 'sparklineRevenue')}
        `;

        setTimeout(() => {
            initSparkline('sparklineNewOrders', kpis.newOrders.sparkline, '#3b82f6');
            initSparkline('sparklinePendingOrders', kpis.pendingOrders.sparkline, '#f59e0b');
            initSparkline('sparklineBillingDrafts', kpis.billingDrafts.sparkline, '#10b981');
            initSparkline('sparklineBillsGenerated', kpis.billsGenerated.sparkline, '#8b5cf6');
            initSparkline('sparklineRevenue', kpis.revenueBilled.sparkline, '#6366f1');
        }, 50);

        const bottomRow = document.getElementById('dashboardBottomStatsRow');
        const bkpis = stats.bottomKpis;
        
        const formatBillingTime = (seconds) => {
            if (!seconds) return '0s';
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            if (m > 0) return `${m}m ${s}s`;
            return `${s}s`;
        };

        const getTrendArrowInfo = (trendStr) => {
            const isNegative = trendStr.startsWith('-');
            const isZero = trendStr.startsWith('0');
            let clean = trendStr;
            if (trendStr.startsWith('+') || trendStr.startsWith('-')) {
                clean = trendStr.substring(1);
            }
            return {
                arrow: isNegative ? '↓' : (isZero ? '→' : '↑'),
                color: isNegative ? '#ef4444' : (isZero ? '#94a3b8' : '#10b981'),
                clean
            };
        };

        const tAverageInvoice = getTrendArrowInfo(bkpis.avgInvoiceValue.trend);
        const tAvgBillingTime = getTrendArrowInfo(bkpis.avgBillingTime.trend);
        const isTimeNeg = bkpis.avgBillingTime.trend.startsWith('-');
        const isTimeZero = bkpis.avgBillingTime.trend.startsWith('0');
        const tTimeColor = isTimeNeg ? '#10b981' : (isTimeZero ? '#94a3b8' : '#ef4444');
        const tTimeArrow = isTimeNeg ? '↓' : (isTimeZero ? '→' : '↑');
        const tTimeClean = isTimeNeg || bkpis.avgBillingTime.trend.startsWith('+') ? bkpis.avgBillingTime.trend.substring(1) : bkpis.avgBillingTime.trend;
        const tBillsPending = getTrendArrowInfo(bkpis.billsPending.trend);

        bottomRow.innerHTML = `
            <div class="stat-card" style="padding: 1.25rem; border-radius: 16px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; background: white; transition: all 0.3s ease; height: 110px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                    <i class="fa-solid fa-receipt"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">Average Invoice Value</div>
                    <div style="font-size: 1.65rem; font-weight: 800; color: #1e293b; font-family: 'Outfit'; margin: 2px 0; line-height: 1.2;">₹${Math.round(bkpis.avgInvoiceValue.value).toLocaleString()}</div>
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${tAverageInvoice.color}; display: inline-flex; align-items: center; gap: 0.15rem; font-family: 'Inter';">
                        ${tAverageInvoice.arrow} ${tAverageInvoice.clean} <span style="color: #94a3b8; font-weight: 500;">vs yesterday</span>
                    </span>
                </div>
            </div>

            <div class="stat-card" style="padding: 1.25rem; border-radius: 16px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; background: white; transition: all 0.3s ease; height: 110px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                    <i class="fa-solid fa-clock"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">Avg. Billing Time</div>
                    <div style="font-size: 1.65rem; font-weight: 800; color: #1e293b; font-family: 'Outfit'; margin: 2px 0; line-height: 1.2;">${formatBillingTime(bkpis.avgBillingTime.value)}</div>
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${tTimeColor}; display: inline-flex; align-items: center; gap: 0.15rem; font-family: 'Inter';">
                        ${tTimeArrow} ${tTimeClean} <span style="color: #94a3b8; font-weight: 500;">vs yesterday</span>
                    </span>
                </div>
            </div>

            <div class="stat-card" style="padding: 1.25rem; border-radius: 16px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; background: white; transition: all 0.3s ease; height: 110px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                    <i class="fa-solid fa-hourglass-half"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">Bills Pending</div>
                    <div style="font-size: 1.65rem; font-weight: 800; color: #1e293b; font-family: 'Outfit'; margin: 2px 0; line-height: 1.2;">${bkpis.billsPending.value}</div>
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${tBillsPending.color}; display: inline-flex; align-items: center; gap: 0.15rem; font-family: 'Inter';">
                        ${tBillsPending.arrow} ${tBillsPending.clean} <span style="color: #94a3b8; font-weight: 500;">vs yesterday</span>
                    </span>
                </div>
            </div>

            <div class="stat-card" style="padding: 1.25rem; border-radius: 16px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; background: white; transition: all 0.3s ease; height: 110px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(99, 102, 241, 0.1); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                    <i class="fa-solid fa-arrow-trend-up"></i>
                </div>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">Daily Target</span>
                        <span style="font-size: 0.75rem; font-weight: 700; color: #4f46e5; font-family: 'Inter';">${bkpis.dailyTarget.achievedPercent}% achieved</span>
                    </div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b; font-family: 'Outfit'; margin: 2px 0; line-height: 1.1;">₹${bkpis.dailyTarget.value.toLocaleString()}</div>
                    <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${bkpis.dailyTarget.achievedPercent}%; height: 100%; background: linear-gradient(90deg, #4f46e5 0%, #6366f1 100%); border-radius: 4px; transition: width 0.8s ease;"></div>
                    </div>
                </div>
            </div>
        `;

        initRevenueTrendChart(stats.revenueTrend);
        initStatusDistributionChart(stats.statusDistribution);
        initMonthlyRevenueChart(stats.monthlyRevenue);

        const activityDiv = document.getElementById('recentActivity');
        if (activityDiv) {
            const invRes = await fetch(`${BILLING_API_URL}/invoices`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const invoices = await invRes.json();
            activityDiv.innerHTML = invoices.slice(0, 5).map(inv => `
                <div style="display:flex; align-items:center; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;">
                    <div style="background: #f1f5f9; width: 32px; height: 32px; border-radius: 8px; display:flex; align-items:center; justify-content:center; color: var(--billing-primary);">
                        <i class="fas fa-file-invoice" style="font-size: 0.875rem;"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size: 0.875rem; font-weight: 600; color: #1e293b;">Invoice ${inv.invoice_number} generated</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${inv.billing_name || inv.order_customer || 'Customer'} | ₹${parseFloat(inv.total_amount).toLocaleString()}</div>
                    </div>
                    <div style="font-size: 0.7rem; color: #94a3b8;">${new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `).join('') || '<p style="text-align:center; padding: 2rem; color: #94a3b8;">No recent activity.</p>';
        }

        const alertsDiv = document.getElementById('systemAlerts');
        if (alertsDiv) {
            const alerts = [];
            if (bkpis.billsPending.value > 0) {
                alerts.push({ type: 'warning', text: `${bkpis.billsPending.value} payments awaiting verification.` });
            }
            if (stats.pendingBilling > 10) {
                alerts.push({ type: 'danger', text: `Billing backlog: ${stats.pendingBilling} orders pending.` });
            }
            alertsDiv.innerHTML = alerts.map(a => `
                <div style="background: rgba(255,255,255,0.1); padding: 0.75rem; border-radius: 12px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.75rem; border: 1px solid rgba(255,255,255,0.1);">
                    <i class="fas fa-circle-exclamation" style="color: ${a.type === 'danger' ? '#ef4444' : '#f59e0b'};"></i>
                    <span style="font-size: 0.875rem; font-weight: 500;">${a.text}</span>
                </div>
            `).join('') || '<p style="opacity: 0.7; font-size: 0.875rem; text-align:center;">✅ All systems in sync.</p>';
        }

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
    try {
        const data = {
            company_state: document.getElementById('setting_company_state').value,
            invoice_prefix: document.getElementById('setting_invoice_prefix').value,
            gst_rate: document.getElementById('setting_gst_rate').value,
            last_invoice_num: document.getElementById('setting_last_invoice_num').value
        };

        const res = await fetch(`${BILLING_API_URL}/settings`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert('Settings saved!');
            loadSettings();
        } else {
            alert('Failed to save settings.');
        }
    } catch (err) {
        alert('Error saving settings.');
    }
}

// ─── Auto Fill Logic ─────────────────────────────────────────

window.fetchPincodeDetails = async function(pincode) {
    if (!pincode || pincode.length !== 6) return;
    
    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await res.json();
        
        if (data && data[0] && data[0].Status === 'Success') {
            const postOffices = data[0].PostOffice;
            const state = postOffices[0].State;
            const district = postOffices[0].District;
            
            document.getElementById('billCustomerState').value = state;
            document.getElementById('billCustomerDistrict').value = district;
            
            const villageSelect = document.getElementById('billCustomerVillage');
            if (villageSelect) {
                villageSelect.innerHTML = postOffices.map(po => `<option value="${po.Name}">${po.Name}</option>`).join('');
                if (postOffices.length > 0) {
                    villageSelect.value = postOffices[0].Name; // Force selection
                }
            }
            
            if (typeof autoFormatAddress === 'function') autoFormatAddress();
        }
    } catch (e) {
        console.error('Failed to fetch pincode details', e);
    }
};

window.autoFormatAddress = function() {
    const village = document.getElementById('billCustomerVillage')?.value || '';
    const district = document.getElementById('billCustomerDistrict')?.value || '';
    const state = document.getElementById('billCustomerState')?.value || '';
    const pincode = document.getElementById('billCustomerPincode')?.value || '';
    const phone = document.getElementById('billCustomerPhone')?.value || '';
    
    const parts = [];
    if (village && village !== 'Select Village') parts.push(village);
    if (district) parts.push(district);
    if (state) parts.push(state);
    
    let addressStr = parts.join(', ');
    if (pincode) addressStr += ` - ${pincode}`;
    if (phone) addressStr += `\nPh: ${phone}`;
    
    const addressInput = document.getElementById('billCustomerAddress');
    if (addressInput) {
        addressInput.value = addressStr;
    }
};
