let allOrders = [];
let currentTab = 'pending';

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    const user = window.getCurrentUser();
    if (!user || (user.role !== 'shipping' && user.role !== 'shipment')) {
        window.location.href = '../../index.html';
        return;
    }

    // Sidebar Active State
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        setTimeout(() => {
            const activeLink = document.getElementById('nav-shipping-list');
            if (activeLink) activeLink.classList.add('active');
        }, 100);
    }

    // Initialize Page
    fetchOrders();
});

async function fetchOrders() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        // We fetch all orders and filter them on the frontend for responsiveness
        const response = await fetch(`${window.API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch');
        
        allOrders = await response.json();
        console.log('Fetched orders:', allOrders.length);
        
        updateCounts();
        renderTable();
    } catch (error) {
        console.error('Fetch error:', error);
        showToast("Error connecting to server", "error");
    }
}

function updateCounts() {
    const pending = allOrders.filter(o => o.order_status === 'packed').length;
    const completed = allOrders.filter(o => ['shipped', 'delivered'].includes(o.order_status)).length;
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('completedCount').textContent = completed;
}

function switchTab(tab) {
    currentTab = tab;
    
    // UI Update
    document.querySelectorAll('.shipping-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('shippingTableBody');
    const emptyState = document.getElementById('emptyState');
    
    const filtered = allOrders.filter(o => {
        if (currentTab === 'pending') return o.order_status === 'packed';
        return ['shipped', 'delivered'].includes(o.order_status);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    tbody.innerHTML = filtered.map(o => `
        <tr onclick="if(!event.target.closest('button')) showOrderDetails(${o.order_id})">
            <td>
                <span class="order-id">${window.formatOrderId(o.order_id, o.created_at)}</span>
            </td>
            <td>
                <div class="customer-info">
                    <h4>${o.customer_name || o.firm_name || 'Walking Customer'}</h4>
                    <p><i class="fas fa-location-dot" style="font-size:0.7rem;"></i> ${o.city || ''} ${o.district ? ', ' + o.district : ''} ${o.pincode ? '(' + o.pincode + ')' : ''}, ${o.state || ''}</p>
                </div>
            </td>
            <td>
                <div class="items-list">
                    ${(o.items || []).slice(0, 2).map(item => `<span class="item-tag">${item.product_name} x${item.quantity}</span>`).join('')}
                    ${(o.items || []).length > 2 ? `<span class="item-tag">+${o.items.length - 2} more</span>` : ''}
                </div>
            </td>
            <td>
                <div style="font-size: 0.85rem; color: #475569; font-weight: 600;">
                    ${new Date(o.packed_at || o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </div>
            </td>
            <td>
                ${currentTab === 'pending' ? `
                    <button class="action-btn btn-ship" onclick="event.stopPropagation(); openShipModal(${o.order_id})">
                        <i class="fas fa-truck-fast"></i> Dispatch
                    </button>
                ` : `
                    <div class="status-pill status-shipped">
                        <i class="fas fa-check"></i> ${o.order_status}
                    </div>
                `}
            </td>
        </tr>
    `).join('');
}

window.openShipModal = function(orderId) {
    document.getElementById('shipOrderId').value = orderId;
    
    // Autofill Logistics Partner based on Delivery Type
    const order = allOrders.find(o => o.order_id == orderId);
    if (order && order.delivery_type) {
        const courierSelect = document.getElementById('courierName');
        const dt = order.delivery_type.toLowerCase();
        
        if (dt.includes('post office')) {
            courierSelect.value = 'India Post';
        } else if (dt.includes('vrl')) {
            courierSelect.value = 'VRL';
        } else if (dt.includes('third party')) {
            courierSelect.value = 'DTDC'; // Default for third party
        }
    }

    document.getElementById('shipModal').style.display = 'flex';
};

window.closeShipModal = function() {
    document.getElementById('shipModal').style.display = 'none';
    document.getElementById('shipForm').reset();
};

window.handleShipSubmit = async function(e) {
    e.preventDefault();
    const orderId = document.getElementById('shipOrderId').value;
    const courier = document.getElementById('courierName').value;
    const tracking = document.getElementById('trackingId').value;
    
    if (!courier || !tracking) {
        showToast("Please fill all required fields", "error");
        return;
    }

    try {
        const response = await fetch(`${window.API_URL}/logistics/ship`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ order_id: orderId, courier_name: courier, tracking_id: tracking })
        });

        if (response.ok) {
            showToast("Order dispatched successfully!", "success");
            
            // AUTOMATED WHATSAPP NOTIFICATION
            const order = allOrders.find(o => o.order_id == orderId);
            if (order && order.phone) {
                const productNames = (order.items || []).map(i => i.product_name).join(', ');
                const orderDate = new Date(order.created_at).toLocaleDateString('en-GB');
                const formattedId = window.formatOrderId(orderId, order.created_at);
                
                let trackingUrl = "";
                if (courier === 'India Post') {
                    trackingUrl = `\n\n*Track here:* https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?articlenumber=${tracking}`;
                } else if (courier === 'VRL') {
                    trackingUrl = `\n\n*Track here:* https://www.vrlgroup.in/vrl_consignment_track.aspx`;
                }

                const waMessage = `*Dispatch Notification - SGB Agro Industries*\n\nDear *${order.customer_name || order.firm_name}*,\nYour order *${formattedId}* has been dispatched successfully! 🚚\n\n*Order Details:*\n📦 Product: ${productNames}\n🗓️ Ordered on: ${orderDate}\n🚛 Logistics: ${courier}\n🆔 Tracking ID: *${tracking}*${trackingUrl}\n\nThank you for choosing *SGB Agro Industries*. Have a great day! 🌱`;

                // Fire and forget (don't block the UI if notification fails)
                fetch(`${window.API_URL}/whatsapp/send`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}` 
                    },
                    body: JSON.stringify({ 
                        phone: order.phone, 
                        message: waMessage 
                    })
                }).then(res => {
                    if (res.ok) console.log('WhatsApp notification sent');
                    else console.error('WhatsApp notification failed');
                }).catch(e => console.error('WA Notify Error:', e));
            }

            closeShipModal();
            fetchOrders(); // Refresh data
        } else {
            const err = await response.json();
            showToast(err.message || "Failed to dispatch order", "error");
        }
    } catch (error) {
        showToast("Connection error", "error");
    }
};

window.showOrderDetails = function(orderId) {
    const order = allOrders.find(o => o.order_id == orderId);
    if (!order) return;

    const modal = document.getElementById('orderDetailsModal');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
        <div style="padding: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem;">
                <div style="width: 50px; height: 50px; border-radius: 12px; background: #ede9fe; color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                    <i class="fas fa-file-invoice"></i>
                </div>
                <div>
                    <h2 style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">Order Details</h2>
                    <p style="font-size: 0.85rem; color: #64748b;">${window.formatOrderId(orderId, order.created_at)}</p>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2.5rem;">
                <div>
                    <h4 style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Customer Details</h4>
                    <p style="font-weight: 700; color: #1e293b; font-size: 1.05rem; margin-bottom: 0.25rem;">${order.customer_name || order.firm_name}</p>
                    <p style="font-size: 0.9rem; color: #475569; line-height: 1.5;">${order.address || ''}<br>${order.city || ''} ${order.district ? ', ' + order.district : ''} ${order.pincode ? '(' + order.pincode + ')' : ''}<br>${order.state || ''}</p>
                    <p style="margin-top: 0.5rem; color: #8b5cf6; font-weight: 600; font-size: 0.9rem;"><i class="fas fa-phone"></i> ${order.phone || '—'}</p>
                </div>
                <div>
                    <h4 style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Status & Timeline</h4>
                    <div class="status-pill status-packed" style="display: inline-block; margin-bottom: 1rem;">${order.order_status}</div>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                            <span style="color: #64748b;">Ordered:</span>
                            <span style="color: #1e293b; font-weight: 600;">${new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                            <span style="color: #64748b;">Packed:</span>
                            <span style="color: #10b981; font-weight: 600;">${order.packed_at ? new Date(order.packed_at).toLocaleDateString() : '—'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                            <span style="color: #64748b;">Delivery Type:</span>
                            <span style="color: #f59e0b; font-weight: 700;">${order.delivery_type || 'General'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style="background: #f8fafc; border-radius: 16px; padding: 1.5rem;">
                <h4 style="font-size: 0.7rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Packed Items List</h4>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    ${(order.items || []).map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: #8b5cf6;"></div>
                                <span style="font-weight: 600; color: #1e293b; font-size: 0.95rem;">${item.product_name}</span>
                            </div>
                            <span style="background: white; border: 1px solid #e2e8f0; padding: 4px 12px; border-radius: 8px; font-weight: 700; color: #8b5cf6; font-size: 0.85rem;">x${item.quantity}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            ${order.order_status === 'packed' ? `
                <button class="action-btn btn-ship" style="width: 100%; padding: 1.25rem; margin-top: 2rem; border-radius: 16px; font-size: 1rem;" onclick="openShipModal(${order.order_id})">
                    <i class="fas fa-truck"></i> Proceed to Dispatch
                </button>
            ` : ''}
        </div>
    `;
    modal.style.display = 'flex';
};

window.closeModal = function() {
    document.getElementById('orderDetailsModal').style.display = 'none';
};

function showToast(msg, type = "success") {
    const t = document.getElementById('toast');
    if (!t) return;
    
    t.textContent = msg;
    t.style.borderLeftColor = type === "success" ? "#10b981" : "#ef4444";
    t.style.display = 'block';
    
    setTimeout(() => {
        t.style.display = 'none';
    }, 4000);
}

window.fetchOrders = fetchOrders;
window.switchTab = switchTab;
