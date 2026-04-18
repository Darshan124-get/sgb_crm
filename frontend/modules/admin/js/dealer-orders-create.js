// ============================================================
// dealer-orders-create.js — Manual Dealer Order Creation
// ============================================================

let availableProducts = [];
let availableDealers = [];
let selectedItems = [];

async function openCreateOrderModal() {
    const token = localStorage.getItem('token');
    
    // Show loading state in modal
    window.showModal({
        title: 'Create Dealer Order',
        content: '<div style="padding:2rem; text-align:center;"><i class="fas fa-circle-notch fa-spin fa-2x"></i><p style="margin-top:1rem; color:#64748b;">Loading dealers and products...</p></div>',
        hideFooter: true
    });

    try {
        const [dealersRes, productsRes] = await Promise.all([
            fetch(`${window.API_URL}/dealers`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${window.API_URL}/products`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        availableDealers = await dealersRes.json();
        availableProducts = await productsRes.json();
        selectedItems = [];

        renderCreateOrderForm();
    } catch (err) {
        console.error('Failed to load data for order creation:', err);
        window.showModal({
            title: 'Error',
            content: '<p style="color:#ef4444; padding:1rem;">Failed to load dealers or products. Please check your connection.</p>'
        });
    }
}

function renderCreateOrderForm() {
    const dealerOptions = availableDealers.map(d => `<option value="${d.dealer_id}">${d.firm_name || d.dealer_name} (${d.phone})</option>`).join('');
    
    const content = `
        <form id="createOrderForm" style="display:flex; flex-direction:column; gap:1.5rem; padding:0.5rem;">
            <!-- Dealer Selection -->
            <div class="premium-card" style="padding:1.25rem; border:1px solid #e2e8f0; background:#f8fafc;">
                <label class="premium-label">Select Dealer <span style="color:#ef4444;">*</span></label>
                <select id="orderDealerId" class="form-control-premium" required onchange="onDealerSelect(this.value)">
                    <option value="">-- Search or Select Dealer --</option>
                    ${dealerOptions}
                </select>
                <div id="dealerAddressPreview" style="margin-top:0.75rem; font-size:0.8rem; color:#64748b; display:none;">
                    <i class="fas fa-location-dot"></i> <span id="dealerAddrText"></span>
                </div>
            </div>

            <!-- Items Table -->
            <div class="premium-card" style="padding:0; border:1px solid #e2e8f0; overflow:hidden;">
                <div style="padding:1rem 1.25rem; background:#f1f5f9; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="font-size:0.875rem; font-weight:700; color:#475569; text-transform:uppercase;">Order Items</h3>
                    <button type="button" class="btn" onclick="addItemRow()" style="height:28px; font-size:0.75rem; background:var(--primary-color); color:white; padding:0 0.75rem;">
                        <i class="fas fa-plus"></i> Add Item
                    </button>
                </div>
                <table style="width:100%; border-collapse:collapse;">
                    <thead style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                        <tr>
                            <th style="padding:0.75rem 1.25rem; text-align:left; font-size:0.7rem; color:#64748b;">Product</th>
                            <th style="padding:0.75rem 1.25rem; text-align:left; font-size:0.7rem; color:#64748b; width:120px;">Price</th>
                            <th style="padding:0.75rem 1.25rem; text-align:left; font-size:0.7rem; color:#64748b; width:100px;">Qty</th>
                            <th style="padding:0.75rem 1.25rem; text-align:right; font-size:0.7rem; color:#64748b; width:120px;">Total</th>
                            <th style="padding:0.75rem 1.25rem; width:40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="orderItemsBody">
                        <!-- Item rows go here -->
                    </tbody>
                </table>
                <div id="noItemsMsg" style="padding:2rem; text-align:center; color:#94a3b8; font-size:0.875rem;">
                    No items added yet. Click "Add Item" to begin.
                </div>
            </div>

            <!-- Summary & Payment -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
                <div class="premium-card" style="padding:1.25rem; border:1px solid #e2e8f0;">
                    <label class="premium-label">Shipping Details (Editable)</label>
                    <textarea id="orderAddress" class="form-control-premium" rows="2" placeholder="Delivery Address"></textarea>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-top:0.75rem;">
                        <input type="text" id="orderCity" class="form-control-premium" placeholder="City">
                        <input type="text" id="orderState" class="form-control-premium" placeholder="State">
                    </div>
                </div>
                <div class="premium-card" style="padding:1.25rem; border:1px solid #e2e8f0; background:#f0f9ff;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-weight:600; color:#0369a1;">
                        <span>Grand Total</span>
                        <span id="orderGrandTotal">₹0</span>
                    </div>
                    <div style="margin-bottom:1rem;">
                        <label class="premium-label" style="color:#0369a1;">Advance Paid (Optional)</label>
                        <input type="number" id="orderAdvance" class="form-control-premium" value="0" min="0" oninput="calculateOrderTotals()">
                    </div>
                    <div style="display:flex; justify-content:space-between; font-weight:800; border-top:1px dashed #bae6fd; pt-0.5rem; margin-top:0.5rem; font-size:1.1rem; color:#0369a1;">
                        <span>Balance Due</span>
                        <span id="orderBalance">₹0</span>
                    </div>
                </div>
            </div>

            <div>
                <label class="premium-label">Internal Notes / Instructions</label>
                <textarea id="orderNotes" class="form-control-premium" rows="2" placeholder="e.g. Needs specialized packing, call before delivery"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem; border-top:1px solid #f1f5f9; padding-top:1.25rem;">
                <button type="button" class="btn btn-outline" onclick="window.hideModal()">Cancel</button>
                <button type="submit" class="btn" style="background:var(--primary-color); color:white; padding:0 3rem; font-weight:800;">Create Order</button>
            </div>
        </form>
    `;

    window.showModal({
        title: 'Create Dealer Order',
        content,
        hideFooter: true
    });

    // Handle Form Submit
    document.getElementById('createOrderForm').onsubmit = handleOrderSubmit;
}

function onDealerSelect(dealerId) {
    const dealer = availableDealers.find(d => d.dealer_id == dealerId);
    if (dealer) {
        document.getElementById('dealerAddressPreview').style.display = 'block';
        document.getElementById('dealerAddrText').textContent = `${dealer.address}, ${dealer.city}, ${dealer.state}`;
        document.getElementById('orderAddress').value = dealer.address || '';
        document.getElementById('orderCity').value = dealer.city || '';
        document.getElementById('orderState').value = dealer.state || '';
    } else {
        document.getElementById('dealerAddressPreview').style.display = 'none';
    }
}

function addItemRow() {
    document.getElementById('noItemsMsg').style.display = 'none';
    const tbody = document.getElementById('orderItemsBody');
    const rowId = Date.now();
    
    const productOptions = availableProducts.map(p => `
        <option value="${p.product_id}" data-price="${p.dealer_price || p.selling_price}">${p.name} (Stock: ${p.current_stock})</option>
    `).join('');

    const row = document.createElement('tr');
    row.id = `item-row-${rowId}`;
    row.innerHTML = `
        <td style="padding:0.75rem 1.25rem;">
            <select class="form-control-premium item-product" style="padding:0.25rem 0.5rem; font-size:0.8rem;" onchange="onProductSelect(${rowId}, this.value)" required>
                <option value="">Select Product...</option>
                ${productOptions}
            </select>
        </td>
        <td style="padding:0.75rem 1.25rem;">
            <input type="number" class="form-control-premium item-price" style="padding:0.25rem 0.5rem; font-size:0.8rem;" value="0" min="0" oninput="calculateOrderTotals()" required>
        </td>
        <td style="padding:0.75rem 1.25rem;">
            <input type="number" class="form-control-premium item-qty" style="padding:0.25rem 0.5rem; font-size:0.8rem;" value="1" min="1" oninput="calculateOrderTotals()" required>
        </td>
        <td style="padding:0.75rem 1.25rem; text-align:right; font-weight:700; color:#1e293b; font-size:0.875rem;" class="item-total">
            ₹0
        </td>
        <td style="padding:0.75rem 1.25rem; text-align:center;">
            <button type="button" onclick="removeItemRow(${rowId})" style="border:none; background:none; color:#94a3b8; cursor:pointer;" title="Remove">
                <i class="fas fa-times-circle"></i>
            </button>
        </td>
    `;
    tbody.appendChild(row);
}

function onProductSelect(rowId, productId) {
    const row = document.getElementById(`item-row-${rowId}`);
    const productSelect = row.querySelector('.item-product');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const price = selectedOption.getAttribute('data-price') || 0;
    
    row.querySelector('.item-price').value = price;
    calculateOrderTotals();
}

function removeItemRow(rowId) {
    const row = document.getElementById(`item-row-${rowId}`);
    row.remove();
    calculateOrderTotals();
    
    const tbody = document.getElementById('orderItemsBody');
    if (tbody.children.length === 0) {
        document.getElementById('noItemsMsg').style.display = 'block';
    }
}

function calculateOrderTotals() {
    let grandTotal = 0;
    const rows = document.querySelectorAll('#orderItemsBody tr');
    
    rows.forEach(row => {
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const qty = parseInt(row.querySelector('.item-qty').value) || 0;
        const rowTotal = price * qty;
        grandTotal += rowTotal;
        row.querySelector('.item-total').textContent = `₹${rowTotal.toLocaleString()}`;
    });

    const advance = parseFloat(document.getElementById('orderAdvance').value) || 0;
    const balance = grandTotal - advance;

    document.getElementById('orderGrandTotal').textContent = `₹${grandTotal.toLocaleString()}`;
    document.getElementById('orderBalance').textContent = `₹${balance.toLocaleString()}`;
}

async function handleOrderSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const dealer_id = document.getElementById('orderDealerId').value;
    const advance_amount = document.getElementById('orderAdvance').value;
    const address = document.getElementById('orderAddress').value;
    const city = document.getElementById('orderCity').value;
    const state = document.getElementById('orderState').value;
    const notes = document.getElementById('orderNotes').value;

    const items = [];
    const rows = document.querySelectorAll('#orderItemsBody tr');
    
    if (rows.length === 0) {
        alert('Please add at least one item to the order.');
        return;
    }

    rows.forEach(row => {
        items.push({
            product_id: row.querySelector('.item-product').value,
            price: row.querySelector('.item-price').value,
            quantity: row.querySelector('.item-qty').value
        });
    });

    const orderData = {
        dealer_id,
        items,
        advance_amount,
        address,
        city,
        state,
        notes
    };

    try {
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Creating...';

        const res = await fetch(`${window.API_URL}/orders/dealer`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (res.ok) {
            window.hideModal();
            if (typeof fetchOrders === 'function') fetchOrders();
            alert('Order created successfully!');
        } else {
            const err = await res.json();
            alert('Error: ' + (err.message || 'Failed to create order.'));
            btn.disabled = false;
            btn.textContent = 'Create Order';
        }
    } catch (err) {
        console.error('Order Submission Error:', err);
        alert('Network error. Is the server running?');
    }
}
