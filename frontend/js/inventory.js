const API_URL = `${window.BASE_URL}/api/products`;
const token = localStorage.getItem('token');

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    fetchProducts().then(products => {
        const urlParams = new URLSearchParams(window.location.search);
        const targetProductId = urlParams.get('productId');
        if (targetProductId && products) {
            const product = products.find(p => p.id == targetProductId);
            if (product) {
                viewProduct(product);
            }
        }
    });
    if (productForm) {
        productForm.addEventListener('submit', handleFormSubmit);
    }
});

// Fetch and Render Products
async function fetchProducts() {
    try {
        const response = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const products = await response.json();
        renderProducts(products);
        return products;
    } catch (err) {
        console.error('Fetch error:', err);
        return [];
    }
}

function renderProducts(products) {
    const tableBody = document.getElementById('productTableBody');
    tableBody.innerHTML = products.map(p => `
        <tr>
            <td>
                <div class="product-info">
                    <img src="https://via.placeholder.com/48" class="product-thumb">
                    <div>
                        <div style="font-weight: 600;">${p.name}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${p.category || 'General'}</div>
                    </div>
                </div>
            </td>
            <td>${p.sku || '-'}</td>
            <td class="price-tag">₹${parseFloat(p.selling_price).toLocaleString()}</td>
            <td style="color: #64748b; font-size: 0.875rem;">${new Date(p.created_at).toLocaleDateString()}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-secondary" style="padding: 0.4rem; color: #3b82f6;" onclick="viewProduct(${JSON.stringify(p).replace(/"/g, '&quot;')})" title="View Details">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                    <button class="btn-secondary" style="padding: 0.4rem;" onclick="editProduct(${JSON.stringify(p).replace(/"/g, '&quot;')})" title="Edit Product">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button class="btn-secondary" style="padding: 0.4rem; color: #ef4444;" onclick="deleteProduct(${p.product_id})" title="Delete Product">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}


// Modal Controls
function openModal(isEdit = false) {
    document.getElementById('productModal').style.display = 'flex';
    if (!isEdit) {
        document.getElementById('productForm').reset();
        document.getElementById('modalTitle').textContent = 'Add New Product';
        document.getElementById('edit-id').value = '';
        clearPreview();
    }
}

function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}

// View Logic
function viewProduct(p) {
    document.getElementById('viewModal').style.display = 'flex';
    document.getElementById('view-image').src = p.image_data || 'https://via.placeholder.com/400';
    document.getElementById('view-name').textContent = p.name;
    document.getElementById('view-description').textContent = p.description || 'No description available.';
    document.getElementById('view-model').textContent = p.model || '-';
    document.getElementById('view-price').textContent = `₹${parseFloat(p.price).toLocaleString()}`;
}

function closeViewModal() {
    document.getElementById('viewModal').style.display = 'none';
}

// Image Preview Logic
function previewImage(input) {
    const preview = document.getElementById('image-preview');
    const placeholder = document.getElementById('uploadPlaceholder');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function clearPreview() {
    const preview = document.getElementById('image-preview');
    const placeholder = document.getElementById('uploadPlaceholder');
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'block';
}

// Submission
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    const formData = {
        name: document.getElementById('name').value,
        category: document.getElementById('category').value,
        sku: document.getElementById('sku').value,
        selling_price: document.getElementById('selling_price').value,
        dealer_price: document.getElementById('dealer_price').value,
        description: document.getElementById('description').value
    };


    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            window.showAlert("Success", id ? 'Product updated!' : 'Product added!', "success");
            closeModal();
            fetchProducts();
        } else {
            window.showAlert("Error", 'Failed to save product', "error");
        }
    } catch (err) {
        console.error('Save error:', err);
    }
}

// Actions
function editProduct(p) {
    openModal(true);
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('edit-id').value = p.product_id;
    document.getElementById('name').value = p.name;
    if (document.getElementById('category')) document.getElementById('category').value = p.category || '';
    if (document.getElementById('sku')) document.getElementById('sku').value = p.sku || '';
    if (document.getElementById('selling_price')) document.getElementById('selling_price').value = p.selling_price;
    if (document.getElementById('dealer_price')) document.getElementById('dealer_price').value = p.dealer_price;
    document.getElementById('description').value = p.description || '';
}


async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) fetchProducts();
    } catch (err) {
        console.error('Delete error:', err);
    }
}

// Search
function filterProducts() {
    const query = document.getElementById('productSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#productTableBody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}
