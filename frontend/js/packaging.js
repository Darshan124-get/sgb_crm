const API_BASE = `${window.BASE_URL}/api`;
const tableBody = document.getElementById('packagingTableBody');
const searchInput = document.getElementById('orderSearch');
const toast = document.getElementById('toast');

let pendingOrders = [];

// Initialize Page
async function initPackaging() {
    await fetchPendingOrders();
}

// Fetch Orders
async function fetchPendingOrders() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/orders?status=draft`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        
        if (!response.ok) throw new Error('Failed to fetch orders');
        
        pendingOrders = await response.json();
        renderOrders(pendingOrders);
    } catch (err) {
        showToast('Error loading orders: ' + err.message, 'error');
    }
}

// Render Orders in Table
function renderOrders(orders) {
    if (orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No pending orders found.</td></tr>';
        return;
    }

    tableBody.innerHTML = orders.map(order => `
        <tr>
            <td class="order-id">#ORD-${order.order_id}</td>
            <td><strong>${order.customer_name}</strong></td>
            <td>${order.phone || 'N/A'}</td>

            <td>${renderItemList(order.items)}</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn-action primary" onclick="markAsPacked(${order.order_id})">
                    <i class="fa-solid fa-box-open"></i> Mark as Packed
                </button>
            </td>
        </tr>
    `).join('');

}

// Render Items List Helper
function renderItemList(items) {
    if (!items || items.length === 0) return 'No items';
    return `<div class="p-list">
        ${items.map(item => `
            <span class="p-badge">${item.product_name} x ${item.quantity}</span>
        `).join('')}
    </div>`;
}

// Mark Order as Packed
async function markAsPacked(orderId) {
    if (!confirm(`Are you sure you want to mark Order #${orderId} as packed?`)) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/packing`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                order_id: orderId,
                packed_by: 'System Admin', // In a real app, this would be the logged-in user
                packed_date: new Date().toISOString().split('T')[0]
            })
        });

        if (response.ok) {
            showToast(`Order #${orderId} marked as successfully packed!`, 'success');
            fetchPendingOrders(); // Refresh list
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Failed to update status');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}


// Search functionality
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = pendingOrders.filter(order => 
        (order.customer_name && order.customer_name.toLowerCase().includes(term)) || 
        (order.order_id && order.order_id.toString().includes(term)) ||
        (order.phone_number && order.phone_number.includes(term))
    );
    renderOrders(filtered);
});


// Toast Notification
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
