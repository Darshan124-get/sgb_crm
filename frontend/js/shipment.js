const API_BASE = `${window.BASE_URL}/api`;
const tableBody = document.getElementById('shipmentTableBody');
const searchInput = document.getElementById('shipSearch');
const shipModal = document.getElementById('shipModal');
const shipForm = document.getElementById('shipForm');
const toast = document.getElementById('toast');

let packedOrders = [];

// Initialize Page
async function initShipment() {
    await fetchPackedOrders();
}

// Fetch Packed Orders
async function fetchPackedOrders() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/orders?status=packed`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        
        if (!response.ok) throw new Error('Failed to fetch orders');
        
        packedOrders = await response.json();
        renderOrders(packedOrders);
    } catch (err) {
        showToast('Error loading orders: ' + err.message, 'error');
    }
}

// Render Orders in Table
function renderOrders(orders) {
    if (orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No packed orders ready for shipment.</td></tr>';
        return;
    }

    tableBody.innerHTML = orders.map(order => `
        <tr>
            <td class="order-id">#ORD-${order.order_id}</td>
            <td><strong>${order.customer_name}</strong></td>
            <td>${order.phone || 'N/A'}</td>

            <td>${order.shipping_address || 'N/A'}</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn-action primary" onclick="openShipModal(${order.order_id})">
                    <i class="fa-solid fa-truck-fast"></i> Ship Order
                </button>
            </td>
        </tr>
    `).join('');

}

// Open Modal
function openShipModal(orderId) {
    document.getElementById('shipOrderId').value = orderId;
    shipModal.style.display = 'flex';
}

// Handle Form Submission
shipForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const order_id = document.getElementById('shipOrderId').value;
    const courier = document.getElementById('courierName').value;
    const tracking_number = document.getElementById('trackingId').value;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/shipments`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                order_id,
                courier,
                tracking_number,
                shipped_date: new Date().toISOString().split('T')[0]
            })
        });

        if (response.ok) {
            showToast(`Order #${order_id} has been successfully shipped!`, 'success');
            shipModal.style.display = 'none';
            shipForm.reset();
            fetchPackedOrders(); // Refresh list
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Failed to update status');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
});


// Search functionality
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = packedOrders.filter(order => 
        order.customer_name.toLowerCase().includes(term) || 
        order.order_id.toString().includes(term)
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
