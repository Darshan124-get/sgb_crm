document.addEventListener('DOMContentLoaded', async () => {
    if (!window.requireAuth(['admin', 'billing'])) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');
    
    if (!invoiceId) {
        document.getElementById('pageContent').innerHTML = `
            <div class="invoice-v2-container" style="text-align:center; padding:5rem;">
                <i class="fas fa-exclamation-triangle" style="font-size:3rem; color:#ef4444; margin-bottom:1.5rem;"></i>
                <h2 style="font-weight:900; color:#1e293b;">Invoice ID Missing</h2>
                <p style="color:#64748b; margin-top:0.5rem;">We couldn't find the invoice you're looking for.</p>
                <button onclick="window.history.back()" class="premium-btn-v2" style="margin:2rem auto; background:#1e293b;">Go Back</button>
            </div>`;
        return;
    }

    await fetchInvoiceDetails(invoiceId);
});

async function fetchInvoiceDetails(id) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${window.API_URL}/billing/invoices/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
            renderInvoice(data);
        } else {
            document.getElementById('pageContent').innerHTML = `<div class="invoice-v2-container"><h2>Error: ${data.message}</h2></div>`;
        }
    } catch(err) {
        console.error(err);
    }
}

function renderInvoice(inv) {
    const content = document.getElementById('pageContent');
    const subtotal = parseFloat(inv.subtotal || 0);
    const cgst = parseFloat(inv.cgst || 0);
    const sgst = parseFloat(inv.sgst || 0);
    const igst = parseFloat(inv.igst || 0);
    const total = parseFloat(inv.total_amount || 0);

    content.innerHTML = `
        <div class="invoice-v2-container">
            <!-- Header Section -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4rem;">
                <div>
                    <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem;">
                        <div style="width:50px; height:50px; background:var(--primary-color); border-radius:12px; display:flex; align-items:center; justify-content:center; color:white; font-size:1.5rem; font-weight:900; box-shadow:0 8px 16px rgba(16,185,129,0.25);">S</div>
                        <h1 style="font-size:2rem; font-weight:900; color:#1e293b; letter-spacing:-0.04em; margin:0;">SGB AGRO</h1>
                    </div>
                    <p style="color:#64748b; font-weight:600; font-size:0.9rem; margin:0;">Premium Agricultural Solutions</p>
                    <p style="color:#94a3b8; font-size:0.8rem; margin-top:0.25rem;">Pune, Maharashtra | GSTIN: 27AAXCS1234F1Z5</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.75rem; font-weight:800; color:var(--primary-color); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.5rem;">Tax Invoice</div>
                    <h2 style="font-size:1.5rem; font-weight:900; color:#1e293b; margin:0;">#${inv.invoice_number}</h2>
                    <p style="color:#64748b; font-weight:600; font-size:0.85rem; margin-top:0.5rem;">Date: ${new Date(inv.invoice_date).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</p>
                </div>
            </div>

            <!-- Billing Details -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4rem; margin-bottom:4rem; padding:2rem; background:#f8fafc; border-radius:1rem; border:1px solid #f1f5f9;">
                <div>
                    <h4 style="font-size:0.7rem; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem;">Bill To</h4>
                    <p style="font-weight:900; color:#1e293b; font-size:1.15rem; margin-bottom:0.5rem;">${inv.billing_name}</p>
                    <p style="color:#475569; font-weight:500; font-size:0.9rem; line-height:1.5;">
                        ${inv.billing_address || inv.address}<br>
                        ${inv.city}, ${inv.state}<br>
                        <span style="font-weight:700; color:#1e293b;">Phone:</span> ${inv.phone}
                    </p>
                </div>
                <div>
                    <h4 style="font-size:0.7rem; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem;">Order Info</h4>
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                            <span style="color:#64748b; font-weight:600;">Reference ID</span>
                            <span style="font-weight:800; color:#1e293b;">${window.formatOrderId(inv.order_id, inv.created_at)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                            <span style="color:#64748b; font-weight:600;">Payment Status</span>
                            <span style="font-weight:800; color:#10b981;">PAID</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                            <span style="color:#64748b; font-weight:600;">Currency</span>
                            <span style="font-weight:800; color:#1e293b;">INR (₹)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:3rem;">
                <thead>
                    <tr style="border-bottom:2px solid #f1f5f9;">
                        <th style="padding:1rem 0; text-align:left; font-size:0.75rem; font-weight:900; color:#94a3b8; text-transform:uppercase;">Product Specification</th>
                        <th style="padding:1rem; text-align:center; font-size:0.75rem; font-weight:900; color:#94a3b8; text-transform:uppercase;">Quantity</th>
                        <th style="padding:1rem; text-align:right; font-size:0.75rem; font-weight:900; color:#94a3b8; text-transform:uppercase;">Unit Price</th>
                        <th style="padding:1rem 0; text-align:right; font-size:0.75rem; font-weight:900; color:#94a3b8; text-transform:uppercase;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${inv.items.map(item => `
                        <tr class="invoice-item-row" style="border-bottom:1px solid #f8fafc;">
                            <td style="padding:1.5rem 0;">
                                <div style="font-weight:800; color:#1e293b; font-size:1rem;">${item.product_name}</div>
                                <div style="font-size:0.75rem; color:#94a3b8; font-weight:600; margin-top:0.25rem;">SKU: ${item.sku}</div>
                            </td>
                            <td style="padding:1.5rem; text-align:center; font-weight:800; color:#1e293b;">${item.quantity}</td>
                            <td style="padding:1.5rem; text-align:right; font-weight:600; color:#475569;">₹${parseFloat(item.price).toLocaleString()}</td>
                            <td style="padding:1.5rem 0; text-align:right; font-weight:800; color:#1e293b;">₹${parseFloat(item.total).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- Summary Section -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="max-width:350px;">
                    <h4 style="font-size:0.7rem; font-weight:900; color:#94a3b8; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem;">Notes & Terms</h4>
                    <p style="font-size:0.75rem; color:#64748b; line-height:1.6; font-weight:500;">
                        1. Goods once sold will not be taken back.<br>
                        2. This is a computer-generated invoice and doesn't require a physical signature.<br>
                        3. All disputes are subject to Pune Jurisdiction.
                    </p>
                </div>
                <div style="width:320px; padding:2rem; background:#f8fafc; border-radius:1rem; border:1px solid #f1f5f9;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem;">
                        <span style="color:#64748b; font-weight:600;">Subtotal</span>
                        <span style="font-weight:800; color:#1e293b;">₹${subtotal.toLocaleString()}</span>
                    </div>
                    ${cgst > 0 ? `
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem;">
                            <span style="color:#64748b; font-weight:600;">CGST (9%)</span>
                            <span style="font-weight:800; color:#1e293b;">₹${cgst.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${sgst > 0 ? `
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem;">
                            <span style="color:#64748b; font-weight:600;">SGST (9%)</span>
                            <span style="font-weight:800; color:#1e293b;">₹${sgst.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    ${igst > 0 ? `
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem; font-size:0.9rem;">
                            <span style="color:#64748b; font-weight:600;">IGST (18%)</span>
                            <span style="font-weight:800; color:#1e293b;">₹${igst.toLocaleString()}</span>
                        </div>
                    ` : ''}
                    <div style="display:flex; justify-content:space-between; margin-top:1.5rem; padding-top:1.5rem; border-top:2px solid #e2e8f0;">
                        <span style="font-weight:900; font-size:1.1rem; color:#1e293b;">Total Amount</span>
                        <span style="font-weight:900; font-size:1.25rem; color:var(--primary-color);">₹${total.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style="margin-top:6rem; text-align:center;">
                <div style="color:#94a3b8; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:1rem;">Thank you for your business!</div>
                <div style="font-size:0.75rem; color:#cbd5e1;">Generated by SGB Agro ERP v3.0</div>
            </div>
        </div>

        <!-- Action Bar (Sticky) -->
        <div class="no-print" style="position:fixed; bottom:2rem; left:50%; transform:translateX(-50%); display:flex; gap:1rem; padding:1rem; background:rgba(30, 41, 59, 0.9); backdrop-filter:blur(12px); border-radius:2rem; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); z-index:1000;">
            <button onclick="window.print()" class="premium-btn-v2" style="padding:0.6rem 1.5rem; font-size:0.9rem;">
                <i class="fas fa-print"></i> Print Invoice
            </button>
            <button onclick="window.close() || window.history.back()" style="background:none; border:none; color:white; font-weight:600; padding:0 1rem; cursor:pointer; font-size:0.9rem; opacity:0.8;">Close</button>
        </div>
    `;
}
