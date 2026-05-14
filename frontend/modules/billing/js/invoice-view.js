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
    } catch (err) {
        console.error(err);
    }
}

function renderInvoice(inv) {
    const content = document.getElementById('pageContent');
    const settings = inv.settings || {};
    const items = inv.items || [];

    const subtotal = parseFloat(inv.subtotal || 0);
    const cgst = parseFloat(inv.cgst || 0);
    const sgst = parseFloat(inv.sgst || 0);
    const igst = parseFloat(inv.igst || 0);
    const total = parseFloat(inv.total_amount || 0);
    const roundOff = (total - (subtotal + cgst + sgst + igst)).toFixed(2);

    content.innerHTML = `
        <div class="invoice-classic">
            <!-- Title Bar -->
            <div class="invoice-title-bar">Tax Invoice</div>

            <!-- Header Section -->
            <div class="invoice-grid-header">
                <div class="company-section col-span-1 border-r border-b">
                    <h2 class="company-name">${settings.company_name || 'SRI GOWRI BHARGAV PRIVATE LIMITED'}</h2>
                    <p class="company-address">${settings.company_address || ''}</p>
                    <p>GSTIN/UIN: <strong>${settings.company_gst_number || ''}</strong></p>
                    <p>State Name: <strong>${settings.company_state || ''}</strong>, Code: <strong>${settings.company_state_code || ''}</strong></p>
                    <p>Contact: ${settings.company_contact || ''}</p>
                    <p>E-Mail: ${settings.company_email || ''}</p>
                </div>
                <div class="invoice-meta col-span-1 border-b">
                    <div class="meta-row border-b">
                        <div class="meta-cell border-r">
                            <span class="label">Invoice No.</span>
                            <span class="value">${inv.invoice_number}</span>
                        </div>
                        <div class="meta-cell">
                            <span class="label">Dated</span>
                            <span class="value">${new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                    </div>
                    <div class="meta-row border-b">
                        <div class="meta-cell border-r">
                            <span class="label">Delivery Note</span>
                            <span class="value">${inv.delivery_note || ''}</span>
                        </div>
                        <div class="meta-cell">
                            <span class="label">Mode/Terms of Payment</span>
                            <span class="value">${inv.payment_terms || ''}</span>
                        </div>
                    </div>
                    <div class="meta-row border-b">
                        <div class="meta-cell border-r">
                            <span class="label">Reference No. & Date.</span>
                            <span class="value"></span>
                        </div>
                        <div class="meta-cell">
                            <span class="label">Other References</span>
                            <span class="value"></span>
                        </div>
                    </div>
                    <div class="meta-row">
                        <div class="meta-cell border-r">
                            <span class="label">Dispatched through</span>
                            <span class="value">${inv.dispatch_through || ''}</span>
                        </div>
                        <div class="meta-cell">
                            <span class="label">Destination</span>
                            <span class="value">${inv.destination || ''}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Consignee / Buyer Section -->
            <div class="invoice-grid-header">
                <div class="address-section col-span-1 border-r border-b">
                    <span class="label-small">Consignee (Ship to)</span>
                    <h3 class="customer-name">${inv.shipping_name || inv.customer_name}</h3>
                    <p class="customer-address">
                        ${inv.shipping_address || inv.address}<br>
                        ${inv.shipping_village || inv.village ? (inv.shipping_village || inv.village) + ', ' : ''}
                        ${inv.shipping_district || inv.district ? (inv.shipping_district || inv.district) + ', ' : ''}
                        ${inv.shipping_city || inv.city}, ${inv.shipping_state || inv.state} - ${inv.shipping_pincode || inv.pincode || ''}<br>
                        State Name: <strong>${inv.shipping_state || inv.state}</strong>
                    </p>
                </div>
                <div class="address-section col-span-1 border-b">
                    <span class="label-small">Buyer (Bill to)</span>
                    <h3 class="customer-name">${inv.customer_name}</h3>
                    <p class="customer-address">
                        ${inv.address}<br>
                        ${inv.village ? inv.village + ', ' : ''}
                        ${inv.district ? inv.district + ', ' : ''}
                        ${inv.city}, ${inv.state} - ${inv.pincode || ''}<br>
                        State Name: <strong>${inv.state}</strong>
                    </p>
                    <p>GSTIN/UIN: <strong>${inv.gst_number || ''}</strong></p>
                </div>
            </div>

            <!-- Items Table -->
            <table class="items-table">
                <thead>
                    <tr>
                        <th width="5%">SI No.</th>
                        <th width="45%">Description of Goods</th>
                        <th width="10%">HSN/SAC</th>
                        <th width="10%">Quantity</th>
                        <th width="10%">Rate</th>
                        <th width="5%">per</th>
                        <th width="15%" style="text-align:right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, idx) => `
                        <tr>
                            <td style="text-align:center;">${idx + 1}</td>
                            <td>
                                <strong>${item.product_name}</strong>
                                <div class="item-extra">SKU: ${item.sku}</div>
                            </td>
                            <td style="text-align:center;">${item.hsn_code || ''}</td>
                            <td style="text-align:center;"><strong>${item.quantity}</strong></td>
                            <td style="text-align:right;">${parseFloat(item.price).toFixed(2)}</td>
                            <td style="text-align:center;">${item.unit || 'Nos'}</td>
                            <td style="text-align:right;"><strong>${parseFloat(item.total).toFixed(2)}</strong></td>
                        </tr>
                    `).join('')}
                    
                    <!-- Empty rows to fill space -->
                    ${Array(Math.max(0, 8 - items.length)).fill(0).map(() => `
                        <tr class="empty-row">
                            <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="subtotal-row">
                        <td></td>
                        <td style="text-align:right;">Total</td>
                        <td></td>
                        <td style="text-align:center;"><strong>${items.reduce((sum, i) => sum + i.quantity, 0)}</strong></td>
                        <td></td>
                        <td></td>
                        <td style="text-align:right;"><strong>${subtotal.toFixed(2)}</strong></td>
                    </tr>
                    ${cgst > 0 ? `
                        <tr class="tax-row">
                            <td></td>
                            <td style="text-align:right;">CGST</td>
                            <td></td><td></td><td></td><td></td>
                            <td style="text-align:right;">${cgst.toFixed(2)}</td>
                        </tr>
                    ` : ''}
                    ${sgst > 0 ? `
                        <tr class="tax-row">
                            <td></td>
                            <td style="text-align:right;">SGST</td>
                            <td></td><td></td><td></td><td></td>
                            <td style="text-align:right;">${sgst.toFixed(2)}</td>
                        </tr>
                    ` : ''}
                    ${igst > 0 ? `
                        <tr class="tax-row">
                            <td></td>
                            <td style="text-align:right;">IGST</td>
                            <td></td><td></td><td></td><td></td>
                            <td style="text-align:right;">${igst.toFixed(2)}</td>
                        </tr>
                    ` : ''}
                    ${parseFloat(roundOff) !== 0 ? `
                        <tr class="tax-row">
                            <td></td>
                            <td style="text-align:right;">Round Off</td>
                            <td></td><td></td><td></td><td></td>
                            <td style="text-align:right;">${roundOff}</td>
                        </tr>
                    ` : ''}
                    <tr class="grand-total-row">
                        <td></td>
                        <td style="text-align:right;">Total</td>
                        <td></td><td></td><td></td><td></td>
                        <td style="text-align:right;"><strong>₹ ${total.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>

            <!-- Amount in Words -->
            <div class="words-section border-b">
                <span class="label-small">Amount Chargeable (in words)</span>
                <p class="words-value"><strong>${inv.amount_in_words || ''}</strong></p>
            </div>

            <!-- Tax Breakdown Table -->
            <table class="tax-breakdown-table border-b">
                <thead>
                    <tr>
                        <th rowspan="2">HSN/SAC</th>
                        <th rowspan="2">Taxable Value</th>
                        <th colspan="2">Central Tax</th>
                        <th colspan="2">State Tax</th>
                        <th rowspan="2">Total Tax Amount</th>
                    </tr>
                    <tr>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Rate</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Grouping items by HSN for tax breakdown -->
                    ${Object.entries(items.reduce((acc, item) => {
        const hsn = item.hsn_code || 'N/A';
        if (!acc[hsn]) acc[hsn] = { taxable: 0, cgst: 0, sgst: 0 };
        acc[hsn].taxable += parseFloat(item.total);
        acc[hsn].cgst += parseFloat(item.total) * (cgst / subtotal);
        acc[hsn].sgst += parseFloat(item.total) * (sgst / subtotal);
        return acc;
    }, {})).map(([hsn, vals]) => `
                        <tr>
                            <td>${hsn}</td>
                            <td style="text-align:right;">${vals.taxable.toFixed(2)}</td>
                            <td style="text-align:center;">2.5%</td>
                            <td style="text-align:right;">${vals.cgst.toFixed(2)}</td>
                            <td style="text-align:center;">2.5%</td>
                            <td style="text-align:right;">${vals.sgst.toFixed(2)}</td>
                            <td style="text-align:right;">${(vals.cgst + vals.sgst).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td style="text-align:right;"><strong>Total</strong></td>
                        <td style="text-align:right;"><strong>${subtotal.toFixed(2)}</strong></td>
                        <td></td>
                        <td style="text-align:right;"><strong>${cgst.toFixed(2)}</strong></td>
                        <td></td>
                        <td style="text-align:right;"><strong>${sgst.toFixed(2)}</strong></td>
                        <td style="text-align:right;"><strong>${(cgst + sgst).toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>

            <div class="tax-words border-b">
                Tax Amount (in words) : <strong>${numberToWordsInWords(cgst + sgst)}</strong>
            </div>

            <!-- Footer Section -->
            <div class="invoice-footer">
                <div class="footer-left border-r">
                    <p class="declaration">
                        <strong>Declaration:</strong><br>
                        We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                    </p>
                    <div class="bank-details">
                        <span class="label-small">Company's Bank Details</span>
                        <p>Bank Name: <strong>${settings.bank_name || ''}</strong></p>
                        <p>A/c No.: <strong>${settings.bank_account_no || ''}</strong></p>
                        <p>Branch & IFS Code: <strong>${settings.bank_ifsc || ''}</strong></p>
                    </div>
                </div>
                <div class="footer-right">
                    <p style="text-align:center; font-size: 0.7rem;">for <strong>${settings.company_name || ''}</strong></p>
                    <br><br><br>
                    <p style="text-align:center;">Authorised Signatory</p>
                </div>
            </div>
        </div>

        <div class="no-print action-bar-v3">
            <button onclick="window.print()" class="print-btn"><i class="fas fa-print"></i> Print</button>
            <button onclick="window.close()" class="close-btn">Close</button>
        </div>
    `;
}

// Helper for tax amount in words (simplified for now)
function numberToWordsInWords(num) {
    // We can reuse the backend logic or a similar JS implementation
    return "INR " + num.toFixed(2) + " Only";
}

