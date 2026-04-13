const API_URL = `${window.BASE_URL}/api/dealers`;
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    fetchDealers();

    const dealerForm = document.getElementById('dealerForm');
    if (dealerForm) {
        dealerForm.addEventListener('submit', handleFormSubmit);
    }
});

async function fetchDealers() {
    try {
        const response = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dealers = await response.json();
        renderDealers(dealers);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

function renderDealers(dealers) {
    const tableBody = document.getElementById('dealerTableBody');
    tableBody.innerHTML = dealers.map(d => `
        <tr>
            <td>
                <div style="font-weight: 600;">${d.firm_name}</div>
            </td>
            <td>${d.owner_name || '-'}</td>
            <td>${d.phone_number}</td>
            <td>${d.city || '-'}</td>
            <td style="color: #64748b; font-size: 0.875rem;">${new Date(d.created_at).toLocaleDateString()}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-primary" style="padding: 0.4rem; font-size: 0.75rem;" onclick='openOrderModal(${JSON.stringify(d).replace(/'/g, "&apos;")})' title="Create Order">
                        <i class="fa-solid fa-cart-shopping"></i> Order
                    </button>
                    <button class="btn-secondary" style="padding: 0.4rem;" onclick='editDealer(${JSON.stringify(d).replace(/'/g, "&apos;")})' title="Edit Dealer">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button class="btn-secondary" style="padding: 0.4rem; color: #ef4444;" onclick="deleteDealer(${d.dealer_id})" title="Delete Dealer">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}


function openModal(isEdit = false) {
    document.getElementById('dealerModal').style.display = 'flex';
    if (!isEdit) {
        document.getElementById('dealerForm').reset();
        document.getElementById('modalTitle').textContent = 'Add New Dealer';
        document.getElementById('edit-id').value = '';
    }
}

function closeModal() {
    document.getElementById('dealerModal').style.display = 'none';
    document.getElementById('orderModal').style.display = 'none';
}

function openOrderModal(d = null) {
    document.getElementById('orderModal').style.display = 'flex';
    document.getElementById('orderForm').reset();
    
    if (d) {
        // Pre-selected from row
        document.getElementById('dealer-select-group').style.display = 'none';
        document.getElementById('selected-dealer-info').style.display = 'block';
        document.getElementById('order-dealer-id').innerHTML = `<option value="${d.id}" selected>${d.dealer_name}</option>`;
        document.getElementById('order-dealer-name-display').textContent = d.dealer_name;
    } else {
        // Global selection
        document.getElementById('dealer-select-group').style.display = 'block';
        document.getElementById('selected-dealer-info').style.display = 'none';
        loadDealersForOrder();
    }
    loadProductsForOrder();
}

function editDealer(d) {
    openModal(true);
    document.getElementById('modalTitle').textContent = 'Edit Dealer';
    document.getElementById('edit-id').value = d.id;
    document.getElementById('dealer_name').value = d.dealer_name;
    document.getElementById('contact_person').value = d.contact_person || '';
    document.getElementById('phone').value = d.phone;
    document.getElementById('location').value = d.location || '';
}

async function loadDealersForOrder() {
    const dealerSelect = document.getElementById('order-dealer-id');
    try {
        const response = await fetch(`${BASE_URL}/api/dealers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const dealers = await response.json();
        dealerSelect.innerHTML = '<option value="">Select a dealer...</option>' + 
            dealers.map(d => `<option value="${d.dealer_id}">${d.firm_name}</option>`).join('');

    } catch (err) {
        console.error('Error loading dealers:', err);
    }
}

async function loadProductsForOrder() {
    const productSelect = document.getElementById('order-product-id');
    try {
        const response = await fetch(`${BASE_URL}/api/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const products = await response.json();
        productSelect.innerHTML = '<option value="">Select a product...</option>' + 
            products.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} (₹${p.price})</option>`).join('');
    } catch (err) {
        console.error('Error loading products:', err);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    const id = document.getElementById('edit-id').value;
    const data = {
        firm_name: document.getElementById('firm_name').value,
        owner_name: document.getElementById('owner_name').value,
        phone_number: document.getElementById('phone_number').value,
        city: document.getElementById('city').value
    };


    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeModal();
            fetchDealers();
        } else {
            const err = await response.json();
            alert('Error: ' + err.message);
        }
    } catch (err) {
        alert('Server connection error.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save Dealer';
    }
}

async function handleOrderSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('orderSaveBtn');
    saveBtn.disabled = true;
    saveBtn.innerText = 'Creating Order...';

    const dealer_id = document.getElementById('order-dealer-id').value;
    const product_id = document.getElementById('order-product-id').value;
    const quantity = document.getElementById('order-quantity').value;
    const advance_amount = document.getElementById('order-advance').value;

    const productSelect = document.getElementById('order-product-id');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const price = selectedOption.getAttribute('data-price');

    const data = {
        dealer_id,
        items: [{
            product_id,
            quantity,
            price: price || 0
        }],
        advance_amount
    };

    try {
        const response = await fetch(`${BASE_URL}/api/orders/dealer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            closeModal();
            alert('Order created successfully!');
        } else {
            const err = await response.json();
            alert('Error creating order: ' + err.message);
        }
    } catch (err) {
        alert('Server connection error.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Create Order';
    }
}

// Global scope attachment for the new form
document.addEventListener('DOMContentLoaded', () => {
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
    }
});

async function deleteDealer(id) {
    if (!confirm('Are you sure you want to delete this dealer?')) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            fetchDealers();
        } else {
            alert('Error deleting dealer');
        }
    } catch (err) {
        alert('Server connection error.');
    }
}
