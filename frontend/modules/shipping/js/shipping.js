let allOrders = [];
let currentTab = 'pending';
let currentSubTab = 'post';
let searchQuery = '';
let trackingUrls = {
    post: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx',
    vrl: 'https://www.vrlgroup.in/track_consignment.aspx'
};

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    const user = window.getCurrentUser();
    const perms = user ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions) : [];
    const isSuper = user && (user.role === 'admin' || user.role === 'super-admin');

    if (!user || (!isSuper && !perms.includes('shipping_shipping'))) {
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

    // Fetch Settings for Tracking URLs
    await fetchSettings();

    // Initialize Page
    const hash = window.location.hash.replace('#', '');
    if (['completed', 'in_transit', 'pay_check'].includes(hash)) {
        switchTab(hash);
    } else {
        switchTab('pending');
    }

    fetchOrders();

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.replace('#', '');
        if (['completed', 'pending', 'in_transit', 'pay_check'].includes(newHash)) {
            switchTab(newHash);
        }
    });
});

async function fetchSettings() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.post_tracking_url) trackingUrls.post = data.post_tracking_url;
            if (data.vrl_tracking_url) trackingUrls.vrl = data.vrl_tracking_url;
        }
    } catch (err) {
        console.error('Failed to load tracking settings:', err);
    }
}

let isEditing = false;

document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        isEditing = true;
    }
});

document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        isEditing = false;
    }
});

setInterval(() => {
    if (!isEditing) {
        fetchOrders(true);
    }
}, 15000); // 15 seconds auto-refresh

function transformOrders(rawOrders) {
    const processed = [];
    rawOrders.forEach(o => {
        const isPost = (o.delivery_type || '').toLowerCase().includes('post');
        if (isPost) {
            o.items.forEach(item => {
                const qty = item.quantity || 1;
                for (let u = 1; u <= qty; u++) {
                    // Check if this specific unit is packed
                    const isPacked = (o.packing_records || []).some(
                        pr => pr.product_id === item.product_id && pr.unit_no === u && pr.status === 'packed'
                    );

                    // Check if shipped
                    const shipment = (o.shipments || []).find(
                        s => s.product_id === item.product_id && s.unit_no === u
                    );

                    // Determine virtual status
                    let virtualStatus = 'billed';
                    if (isPacked) {
                        virtualStatus = 'packed';
                        if (shipment) {
                            virtualStatus = shipment.shipment_status || 'shipped';
                        }
                    }

                    processed.push({
                        ...o,
                        virtual_id: `${o.order_id}_${item.product_id}_${u}`,
                        product_id: item.product_id,
                        unit_no: u,
                        items: [{ ...item, quantity: 1 }],
                        order_status: virtualStatus,
                        packed_at: isPacked ? ((o.packing_records || []).find(pr => pr.product_id === item.product_id && pr.unit_no === u) || {}).packed_at : null,

                        shipment_id: shipment ? shipment.shipment_id : null,
                        courier_name: shipment ? shipment.courier_name : null,
                        tracking_id: shipment ? shipment.tracking_id : null,
                        shipment_status: shipment ? shipment.shipment_status : null,
                        delivery_date: shipment ? shipment.delivery_date : null,
                        check_received_date: shipment ? shipment.check_received_date : null,

                        unit_label: `(${item.product_name} - Qty 1 [${u}/${qty}])`
                    });
                }
            });
        } else {
            processed.push(o);
        }
    });
    return processed;
}

window.fetchOrders = async function (silent = false) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        // We fetch all orders and filter them on the frontend for responsiveness
        const response = await fetch(`${window.API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch');

        const raw = await response.json();
        allOrders = transformOrders(raw);
        console.log('Fetched orders:', allOrders.length);

        updateCounts();
        renderTable();
    } catch (error) {
        console.error('Fetch error:', error);
        if (!silent) showToast("Error connecting to server", "error");
    }
}

function updateCounts() {
    const pending = allOrders.filter(o => ['billed', 'packed'].includes(o.order_status)).length;

    const inTransit = allOrders.filter(o => {
        if (!o.shipment_id) return false;
        if (o.shipment_status === 'returned') return false;
        return o.shipment_status !== 'delivered';
    }).length;

    const payCheck = allOrders.filter(o => {
        if (!o.shipment_id) return false;
        const dt = (o.courier_name || o.delivery_type || '').toLowerCase();
        return dt.includes('post') && o.shipment_status === 'delivered' && !o.check_received_date;
    }).length;

    const completed = allOrders.filter(o => {
        if (!o.shipment_id) return false;
        if (o.shipment_status === 'returned') return true;
        if (o.shipment_status === 'delivered') {
            const dt = (o.courier_name || o.delivery_type || '').toLowerCase();
            if (dt.includes('post')) {
                return !!o.check_received_date;
            }
            return true;
        }
        return false;
    }).length;

    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('inTransitCount').textContent = inTransit;
    document.getElementById('payCheckCount').textContent = payCheck;
    document.getElementById('completedCount').textContent = completed;
}

window.switchTab = function (tab) {
    currentTab = tab;

    // UI Update
    document.querySelectorAll('.shipping-tabs > .shipping-tab').forEach(el => el.classList.remove('active'));
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');

    const inTransitSubTabs = document.getElementById('inTransitSubTabs');
    if (tab === 'in_transit') {
        inTransitSubTabs.style.display = 'flex';
        // Auto select correct sub-tab based on currentSubTab
        switchSubTab(currentSubTab);
    } else {
        inTransitSubTabs.style.display = 'none';
        renderTable();
    }
}

window.switchSubTab = function (sub) {
    currentSubTab = sub;
    document.querySelectorAll('#inTransitSubTabs .shipping-tab').forEach(el => el.classList.remove('active'));
    const tabEl = document.getElementById(`subtab-${sub}`);
    if (tabEl) tabEl.classList.add('active');
    renderTable();
}

window.handleSearch = function () {
    searchQuery = document.getElementById('searchInput').value.trim();
    renderTable();
};

function renderTable() {
    const thead = document.getElementById('tableHeader');
    const tbody = document.getElementById('shippingTableBody');
    const emptyState = document.getElementById('emptyState');

    let filtered = [];

    // Headers setup
    if (currentTab === 'pending') {
        thead.innerHTML = `<tr>
            <th>Order ID</th><th>Bill No.</th><th>Customer Name</th><th>Mobile No.</th>
            <th>Item</th><th>Qty</th><th>Order Date</th><th>Ship Type</th>
            <th>Status</th><th>Tracking ID</th><th>Action</th>
        </tr>`;
        filtered = allOrders.filter(o => ['billed', 'packed'].includes(o.order_status));
    } else if (currentTab === 'in_transit') {
        if (currentSubTab === 'post') {
            thead.innerHTML = `<tr>
                <th>Bill Date</th><th>Order ID</th><th>Bill Number</th>
                <th>Customer Details</th><th>Tracking ID</th><th>COD Amount</th><th>Item</th><th>Qty</th><th>Address</th>
                <th>Delivery Date</th><th>Status</th><th>Action</th>
            </tr>`;
            filtered = allOrders.filter(o => {
                if (!o.shipment_id) return false;
                const dt = (o.courier_name || o.delivery_type || '').toLowerCase();
                return dt.includes('post') && o.shipment_status !== 'delivered' && o.shipment_status !== 'returned';
            });
        } else if (currentSubTab === 'vrl') {
            thead.innerHTML = `<tr>
                <th>Bill Date</th><th>Customer Details</th><th>Bill Number</th>
                <th>COD Amount</th><th>Item</th><th>Qty</th>
                <th>Delivery Date</th><th>Status</th><th>Action</th>
            </tr>`;
            filtered = allOrders.filter(o => {
                if (!o.shipment_id) return false;
                const dt = (o.courier_name || o.delivery_type || '').toLowerCase();
                return dt.includes('vrl') && o.shipment_status !== 'delivered' && o.shipment_status !== 'returned';
            });
        } else {
            // Other transport
            thead.innerHTML = `<tr>
                <th>Bill Date</th><th>Customer Details</th><th>Bill Number</th>
                <th>Item</th><th>Qty</th>
                <th>Delivery Date</th><th>Status</th><th>Action</th>
            </tr>`;
            filtered = allOrders.filter(o => {
                if (!o.shipment_id) return false;
                const dt = (o.courier_name || o.delivery_type || '').toLowerCase();
                return !dt.includes('post') && !dt.includes('vrl') && o.shipment_status !== 'delivered' && o.shipment_status !== 'returned';
            });
        }
    } else if (currentTab === 'pay_check') {
        thead.innerHTML = `<tr>
            <th>Bill Date</th><th>Order ID</th><th>Bill Number</th><th>Delivery Date</th>
            <th>Check Received Date</th><th>Tracking ID</th><th>COD Amount</th><th>Item</th><th>Qty</th><th>Action</th>
        </tr>`;
        filtered = allOrders.filter(o => {
            if (!o.shipment_id) return false;
            const dt = (o.courier_name || o.delivery_type || '').toLowerCase();
            return dt.includes('post') && o.shipment_status === 'delivered' && !o.check_received_date;
        });
    } else if (currentTab === 'completed') {
        thead.innerHTML = `<tr>
            <th>Order ID</th><th>Bill No.</th><th colspan="2">Customer Name</th>
            <th colspan="3">Items</th><th colspan="3">Tracking Details</th><th>Status</th>
        </tr>`;
        filtered = allOrders.filter(o => {
            if (!o.shipment_id) return false;
            if (o.shipment_status === 'returned') return true;
            if (o.shipment_status === 'delivered') {
                const dt = (o.courier_name || o.delivery_type || '').toLowerCase();
                if (dt.includes('post')) {
                    return !!o.check_received_date;
                }
                return true;
            }
            return false;
        });
    }

    if (searchQuery) {
        const sq = searchQuery.toLowerCase();
        filtered = filtered.filter(o => {
            const billNo = (o.zoho_bill_number || o.invoice_no || 'BILL' + o.order_id).toLowerCase();
            const customer = (o.customer_name || o.firm_name || '').toLowerCase();
            const track = (o.tracking_id || '').toLowerCase();
            const orderIdStr = String(o.order_id);
            const phone = (o.phone || '').toLowerCase();
            return billNo.includes(sq) || customer.includes(sq) || track.includes(sq) || orderIdStr.includes(sq) || phone.includes(sq);
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = filtered.map(o => {
        const qty = (o.items || []).reduce((sum, i) => sum + i.quantity, 0);
        const itemStr = (o.items && o.items.length > 0) ? o.items[0].product_name : 'N/A';
        const dateStr = new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const billNo = o.zoho_bill_number || o.invoice_no || 'BILL' + o.order_id;

        let totalAmt = (parseFloat(o.total_amount) || 0) - (parseFloat(o.advance_amount) || 0); // Balance (COD)
        if (totalAmt < 0) totalAmt = 0;
        const totalAmtStr = totalAmt.toFixed(2);

        const customerName = o.customer_name || o.firm_name || 'Walking Customer';
        const phone = o.phone || '—';
        const fullAddress = [o.address, o.city, o.district, o.state, o.pincode].filter(Boolean).join(', ');

        if (currentTab === 'pending') {
            return `
            <tr onclick="if(!event.target.closest('button') && !event.target.closest('select') && !event.target.closest('input')) showOrderDetails(${o.order_id}, ${o.virtual_id ? o.product_id : null}, ${o.virtual_id ? o.unit_no : null})">
                <td style="white-space: nowrap; font-weight: 600;">
                    ${o.order_id}
                    <div style="font-size: 0.75rem; color: #8b5cf6; font-weight: 600; margin-top: 2px;">${o.unit_label || ''}</div>
                </td>
                <td style="white-space: nowrap; color: #475569; font-weight: 700;">${billNo}</td>
                <td style="font-weight: 600; color: #1e293b;">${o.customer_name || o.firm_name || 'Walking Customer'}</td>
                <td style="color: #475569; white-space: nowrap;">${o.phone || '—'}</td>
                <td style="color: #475569; font-size: 0.85rem;">${itemStr}</td>
                <td style="font-weight: 600; color: #1e293b; text-align: center;">${qty}</td>
                <td style="color: #475569; font-size: 0.85rem; white-space: nowrap;">${dateStr}</td>
                <td>
                    <div style="font-weight: 600; color: #475569; font-size: 0.85rem; padding: 0.4rem; white-space: nowrap;">
                        ${o.delivery_type || 'Other'}
                    </div>
                </td>
                <td>
                    <span class="status-pill" style="background: ${o.order_status === 'packed' ? '#fff7ed' : '#f1f5f9'}; color: ${o.order_status === 'packed' ? '#f59e0b' : '#64748b'}; border: 1px solid ${o.order_status === 'packed' ? '#ffedd5' : '#e2e8f0'};">
                        ${o.order_status.charAt(0).toUpperCase() + o.order_status.slice(1)}
                    </span>
                </td>
                <td>
                    <input type="text" id="trackId_${o.virtual_id || o.order_id}" class="form-input" style="padding: 0.4rem; font-size: 0.8rem; border-radius: 6px; min-width: 120px;" placeholder="Enter ID" ${o.order_status === 'billed' ? 'disabled' : ''}>
                </td>
                <td style="white-space: nowrap;">
                    ${o.order_status === 'packed' ? `
                        <button class="action-btn btn-ship" onclick="submitInlineShip(${o.order_id}, ${o.virtual_id ? o.product_id : null}, ${o.virtual_id ? o.unit_no : null}, '${o.virtual_id || ''}')" style="padding: 0.4rem 1rem; font-size: 0.8rem;">Ship</button>
                    ` : `
                        <button class="action-btn" onclick="markAsPacked(${o.order_id}, ${o.virtual_id ? o.product_id : null}, ${o.virtual_id ? o.unit_no : null})" style="background: white; border: 1px solid #e2e8f0; color: #475569; padding: 0.4rem 1rem; font-size: 0.8rem;">Pack</button>
                    `}
                </td>
            </tr>
            `;
        } else if (currentTab === 'in_transit') {
            const shipStatus = o.shipment_status || 'in_transit';
            let statusSelect = `
                <select onchange="updateShipmentStatus(${o.shipment_id}, this.value, '${currentSubTab}')" style="padding:4px; border-radius:4px; border:1px solid #ccc; font-size:0.8rem;">
                    <option value="in_transit" ${shipStatus === 'in_transit' ? 'selected' : ''}>In Transit</option>
                    <option value="reached_destination" ${shipStatus === 'reached_destination' ? 'selected' : ''}>Reached Destination</option>
                    <option value="delivered" ${shipStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="returned" ${shipStatus === 'returned' ? 'selected' : ''}>Returned</option>
                </select>
            `;

            if (currentSubTab === 'post') {
                return `
                <tr>
                    <td style="font-size:0.85rem;">${dateStr}</td>
                    <td style="font-weight:600;">
                        ${o.order_id}
                        <div style="font-size:0.75rem; color:#8b5cf6; font-weight:600; margin-top:2px;">${o.unit_label || ''}</div>
                    </td>
                    <td style="font-weight:700; color:#475569;">${billNo}</td>
                    <td>
                        <div style="font-weight:600; color:#1e293b;">${customerName}</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${phone}</div>
                    </td>
                    <td style="font-weight:600; color:#8b5cf6;">${o.tracking_id || '-'}</td>
                    <td style="font-weight:600; color:#10b981;">₹${totalAmtStr}</td>
                    <td style="font-size:0.85rem;">${itemStr}</td>
                    <td style="font-weight:600; text-align:center;">${qty}</td>
                    <td style="font-size:0.75rem; color:#475569; max-width:200px; line-height:1.4;" title="${fullAddress}">${fullAddress || '-'}</td>
                    <td>
                        <input type="date" id="delDate_${o.shipment_id}" value="${o.delivery_date ? o.delivery_date.split('T')[0] : ''}" style="padding:4px; border-radius:4px; border:1px solid #ccc; font-size:0.8rem;" onchange="if(this.value) updateShipmentStatus(${o.shipment_id}, 'delivered', '${currentSubTab}')" />
                    </td>
                    <td>${statusSelect}</td>
                    <td>
                        <button class="action-btn btn-ship" onclick="trackShipment('post', '${o.tracking_id}')" style="padding:0.4rem 1rem; font-size:0.8rem;">Track</button>
                    </td>
                </tr>
                `;
            } else if (currentSubTab === 'vrl') {
                return `
                <tr>
                    <td style="font-size:0.85rem;">${dateStr}</td>
                    <td>
                        <div style="font-weight:600; color:#1e293b;">${customerName}</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${phone}</div>
                    </td>
                    <td style="font-weight:700; color:#475569;">${billNo}</td>
                    <td style="font-weight:600; color:#10b981;">₹${totalAmtStr}</td>
                    <td style="font-size:0.85rem;">${itemStr}</td>
                    <td style="font-weight:600; text-align:center;">${qty}</td>
                    <td>
                        <input type="date" id="delDate_${o.shipment_id}" value="${o.delivery_date ? o.delivery_date.split('T')[0] : ''}" style="padding:4px; border-radius:4px; border:1px solid #ccc; font-size:0.8rem;" onchange="if(this.value) updateShipmentStatus(${o.shipment_id}, 'delivered', '${currentSubTab}')" />
                    </td>
                    <td>${statusSelect}</td>
                    <td>
                        <button class="action-btn btn-ship" onclick="trackShipment('vrl', '${o.tracking_id}')" style="padding:0.4rem 1rem; font-size:0.8rem;">Track</button>
                    </td>
                </tr>
                `;
            } else {
                return `
                <tr>
                    <td style="font-size:0.85rem;">${dateStr}</td>
                    <td>
                        <div style="font-weight:600; color:#1e293b;">${customerName}</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">${phone}</div>
                    </td>
                    <td style="font-weight:700; color:#475569;">${billNo}</td>
                    <td style="font-size:0.85rem;">${itemStr}</td>
                    <td style="font-weight:600; text-align:center;">${qty}</td>
                    <td>
                        <input type="date" id="delDate_${o.shipment_id}" value="${o.delivery_date ? o.delivery_date.split('T')[0] : ''}" style="padding:4px; border-radius:4px; border:1px solid #ccc; font-size:0.8rem;" onchange="if(this.value) updateShipmentStatus(${o.shipment_id}, 'delivered', '${currentSubTab}')" />
                    </td>
                    <td>${statusSelect}</td>
                    <td>
                        <button class="action-btn" style="padding:0.4rem 1rem; font-size:0.8rem; background:#10b981; color:white; border:none; border-radius:6px;" onclick="markCompleted(${o.shipment_id})">Mark Completed</button>
                    </td>
                </tr>
                `;
            }
        } else if (currentTab === 'pay_check') {
            return `
            <tr>
                <td style="font-size:0.85rem;">${dateStr}</td>
                <td style="font-weight:600;">
                    ${o.order_id}
                    <div style="font-size:0.75rem; color:#8b5cf6; font-weight:600; margin-top:2px;">${o.unit_label || ''}</div>
                </td>
                <td style="font-weight:700; color:#475569;">${billNo}</td>
                <td style="font-size:0.85rem;">${o.delivery_date ? new Date(o.delivery_date).toLocaleDateString() : '-'}</td>
                <td>
                    <input type="date" id="checkDate_${o.shipment_id}" style="padding:4px; border-radius:4px; border:1px solid #ccc;" onchange="if(this.value) saveCheckDate(${o.shipment_id})" />
                </td>
                <td style="font-weight:600; color:#8b5cf6;">${o.tracking_id || '-'}</td>
                <td style="font-weight:600; color:#10b981;">₹${totalAmtStr}</td>
                <td style="font-size:0.85rem;">${itemStr}</td>
                <td style="font-weight:600; text-align:center;">${qty}</td>
                <td>
                    <button class="action-btn" style="padding:0.4rem 1rem; font-size:0.8rem; background:#8b5cf6; color:white; border:none; border-radius:6px;" onclick="saveCheckDate(${o.shipment_id})">Save Check</button>
                </td>
            </tr>
            `;
        } else if (currentTab === 'completed') {
            return `
            <tr onclick="if(!event.target.closest('button')) showOrderDetails(${o.order_id}, ${o.virtual_id ? o.product_id : null}, ${o.virtual_id ? o.unit_no : null})">
                <td style="white-space: nowrap; font-weight: 600;">
                    ${o.order_id}
                    <div style="font-size:0.75rem; color:#8b5cf6; font-weight:600; margin-top:2px;">${o.unit_label || ''}</div>
                </td>
                <td style="white-space: nowrap; color: #475569; font-weight: 700;">${billNo}</td>
                <td colspan="2" style="font-weight: 600; color: #1e293b;">${o.customer_name || o.firm_name || 'Walking Customer'}</td>
                <td colspan="3">
                    <div class="items-list">
                        ${(o.items || []).slice(0, 2).map(item => `<span class="item-tag">${item.product_name} x${item.quantity}</span>`).join('')}
                        ${(o.items || []).length > 2 ? `<span class="item-tag">+${o.items.length - 2} more</span>` : ''}
                    </div>
                </td>
                <td colspan="3">
                    <div style="font-size: 0.85rem; color: #475569;">${o.tracking_id || 'No Tracking'}</div>
                </td>
                <td>
                    <div class="status-pill status-shipped">
                        <i class="fas fa-check"></i> ${o.shipment_status === 'returned' ? 'Returned' : 'Delivered'}
                    </div>
                </td>
            </tr>
            `;
        }
    }).join('');
}

window.trackShipment = async function (type, trackingId) {
    if (!trackingId || trackingId === 'undefined' || trackingId === '-') {
        showToast('No Tracking ID available', 'error');
        return;
    }

    // 1. Copy tracking ID to clipboard
    try {
        await navigator.clipboard.writeText(trackingId);
        showToast('Tracking ID copied to clipboard! Paste it on the tracking page.', 'success');
    } catch (err) {
        console.warn('Failed to copy to clipboard', err);
    }

    // 2. Open the URL after a tiny delay so the user sees the toast
    setTimeout(() => {
        let url = type === 'post' ? trackingUrls.post : trackingUrls.vrl;
        // Append tracking ID if it's India Post, regardless of the URL domain
        if (type === 'post') {
            if (url.includes('?')) {
                url += `&articlenumber=${trackingId}`;
            } else {
                url += `?articlenumber=${trackingId}`;
            }
        }
        window.open(url, '_blank');
    }, 800);
}

function showDatePickerModal(title, defaultDate = '') {
    return new Promise((resolve) => {
        const oldModal = document.getElementById('customDatePickerModal');
        if (oldModal) oldModal.remove();

        const modalDiv = document.createElement('div');
        modalDiv.id = 'customDatePickerModal';
        modalDiv.style.position = 'fixed';
        modalDiv.style.inset = '0';
        modalDiv.style.background = 'rgba(15, 23, 42, 0.7)';
        modalDiv.style.backdropFilter = 'blur(4px)';
        modalDiv.style.display = 'flex';
        modalDiv.style.alignItems = 'center';
        modalDiv.style.justifyContent = 'center';
        modalDiv.style.zIndex = '99999';

        const contentDiv = document.createElement('div');
        contentDiv.style.background = 'white';
        contentDiv.style.padding = '2rem';
        contentDiv.style.borderRadius = '20px';
        contentDiv.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
        contentDiv.style.width = '90%';
        contentDiv.style.maxWidth = '400px';
        contentDiv.style.display = 'flex';
        contentDiv.style.flexDirection = 'column';
        contentDiv.style.gap = '1.5rem';

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.fontSize = '1.1rem';
        titleEl.style.fontWeight = '800';
        titleEl.style.color = '#1e293b';
        titleEl.style.margin = '0';

        const inputEl = document.createElement('input');
        inputEl.type = 'date';
        inputEl.value = defaultDate || new Date().toISOString().split('T')[0];
        inputEl.style.width = '100%';
        inputEl.style.padding = '0.75rem 1rem';
        inputEl.style.border = '2px solid #e2e8f0';
        inputEl.style.borderRadius = '12px';
        inputEl.style.fontSize = '1rem';
        inputEl.style.outline = 'none';
        inputEl.style.fontFamily = 'inherit';

        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.justifyContent = 'flex-end';
        btnContainer.style.gap = '0.75rem';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.padding = '0.6rem 1.2rem';
        cancelBtn.style.border = '1px solid #e2e8f0';
        cancelBtn.style.background = 'white';
        cancelBtn.style.color = '#64748b';
        cancelBtn.style.borderRadius = '10px';
        cancelBtn.style.fontWeight = '700';
        cancelBtn.style.cursor = 'pointer';
        cancelBtn.onclick = () => {
            modalDiv.remove();
            resolve(null);
        };

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        okBtn.style.padding = '0.6rem 1.5rem';
        okBtn.style.border = 'none';
        okBtn.style.background = '#8b5cf6';
        okBtn.style.color = 'white';
        okBtn.style.borderRadius = '10px';
        okBtn.style.fontWeight = '700';
        okBtn.style.cursor = 'pointer';
        okBtn.onclick = () => {
            const val = inputEl.value;
            modalDiv.remove();
            resolve(val);
        };

        btnContainer.appendChild(cancelBtn);
        btnContainer.appendChild(okBtn);
        contentDiv.appendChild(titleEl);
        contentDiv.appendChild(inputEl);
        contentDiv.appendChild(btnContainer);
        modalDiv.appendChild(contentDiv);
        document.body.appendChild(modalDiv);
    });
}

window.updateShipmentStatus = async function (shipmentId, status, type) {
    const deliveryDateEl = document.getElementById(`delDate_${shipmentId}`);
    let delivery_date = null;
    if (deliveryDateEl && deliveryDateEl.value) {
        delivery_date = deliveryDateEl.value;
    }

    if (status === 'delivered' && !delivery_date) {
        const input = await showDatePickerModal("Select Delivery Date:");
        if (!input) {
            renderTable();
            return;
        }
        delivery_date = input;
    }
    if (status === 'returned' && !delivery_date) {
        const input = await showDatePickerModal("Select Return Date:");
        if (!input) {
            renderTable();
            return;
        }
        delivery_date = input;
    }

    try {
        const response = await fetch(`${window.API_URL}/logistics/shipments/${shipmentId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status, delivery_date })
        });

        if (response.ok) {
            showToast('Status updated successfully');
            fetchOrders();
        } else {
            const err = await response.json();
            showToast(err.message || 'Failed to update status', 'error');
            renderTable(); // Revert
        }
    } catch (e) {
        showToast('Connection error', 'error');
    }
}

window.markCompleted = async function (shipmentId) {
    // For non-post non-vrl, marking completed means delivered
    await updateShipmentStatus(shipmentId, 'delivered', 'other');
}

window.saveCheckDate = async function (shipmentId) {
    const checkDateEl = document.getElementById(`checkDate_${shipmentId}`);
    if (!checkDateEl || !checkDateEl.value) {
        showToast('Please enter a Check Received Date', 'error');
        return;
    }
    const check_received_date = checkDateEl.value;

    try {
        const response = await fetch(`${window.API_URL}/logistics/shipments/${shipmentId}/check_received`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ check_received_date })
        });

        if (response.ok) {
            showToast('Check Received Date saved! Order Completed.');
            fetchOrders();
        } else {
            const err = await response.json();
            showToast(err.message || 'Failed to update', 'error');
        }
    } catch (e) {
        showToast('Connection error', 'error');
    }
}

window.submitInlineShip = async function (orderId, productId, unitNo, virtualId) {
    const trackingInputId = virtualId ? `trackId_${virtualId}` : `trackId_${orderId}`;
    const tracking = document.getElementById(trackingInputId).value;

    const order = allOrders.find(o => o.order_id == orderId && (!productId || (o.product_id == productId && o.unit_no == unitNo)));
    let courier = order ? (order.delivery_type || 'Other') : 'Other';
    const dt = courier.toLowerCase();
    if (dt.includes('post')) courier = 'India Post';
    else if (dt.includes('vrl')) courier = 'VRL';

    if (!tracking) {
        showToast("Please enter Tracking ID", "error");
        return;
    }

    try {
        const response = await fetch(`${window.API_URL}/logistics/ship`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                order_id: orderId,
                courier_name: courier,
                tracking_id: tracking,
                product_id: productId,
                unit_no: unitNo
            })
        });

        if (response.ok) {
            showToast("Order dispatched successfully!", "success");

            // AUTOMATED WHATSAPP NOTIFICATION
            if (order && order.phone) {
                const productNames = (order.items || []).map(i => i.product_name).join(', ');
                const orderDate = new Date(order.created_at).toLocaleDateString('en-GB');
                const formattedId = window.formatOrderId(orderId, order.created_at);

                let trackingUrl = "";
                if (courier === 'India Post') {
                    const separator = trackingUrls.post.includes('?') ? '&' : '?';
                    trackingUrl = `\n\n*Track here:* ${trackingUrls.post}${separator}articlenumber=${tracking}`;
                } else if (courier === 'VRL') {
                    trackingUrl = `\n\n*Track here:* ${trackingUrls.vrl}`;
                }

                const labelSuffix = order.unit_label ? ` ${order.unit_label}` : "";
                const waMessage = `*Dispatch Notification - SGB Agro Industries*\n\nDear *${order.customer_name || order.firm_name}*,\nYour package for order *${formattedId}*${labelSuffix} has been dispatched successfully! 🚚\n\n*Order Details:*\n📦 Product: ${productNames}\n🗓️ Ordered on: ${orderDate}\n🚛 Logistics: ${courier}\n🆔 Tracking ID: *${tracking}*${trackingUrl}\n\nThank you for choosing *SGB Agro Industries*. Have a great day! 🌱`;

                fetch(`${window.API_URL}/whatsapp/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ phone: order.phone, message: waMessage })
                }).catch(e => console.error('WA Notify Error:', e));
            }

            fetchOrders();
        } else {
            const err = await response.json();
            showToast(err.message || "Failed to dispatch order", "error");
        }
    } catch (error) {
        showToast("Connection error", "error");
    }
};

window.markAsPacked = async function (orderId, productId, unitNo) {
    try {
        let response;
        if (productId) {
            response = await fetch(`${window.API_URL}/logistics/packing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ order_id: orderId, remarks: 'Packed', product_id: productId, unit_no: unitNo })
            });
        } else {
            response = await fetch(`${window.API_URL}/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ order_status: 'packed' })
            });
        }

        if (response.ok) {
            showToast("Order marked as packed!", "success");
            fetchOrders();
        } else {
            const err = await response.json();
            showToast(err.message || "Failed to update order", "error");
        }
    } catch (error) {
        showToast("Connection error", "error");
    }
};

window.showOrderDetails = function (orderId, productId, unitNo) {
    const order = allOrders.find(o => o.order_id == orderId && (!productId || (o.product_id == productId && o.unit_no == unitNo)));
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
                    <div style="font-size:0.85rem; color:#8b5cf6; font-weight:600; margin-top:2px;">${order.unit_label || ''}</div>
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
                        ${order.delivery_date ? `
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                            <span style="color: #64748b;">Delivery Date:</span>
                            <span style="color: #3b82f6; font-weight: 600;">${new Date(order.delivery_date).toLocaleDateString()}</span>
                        </div>
                        ` : ''}
                        ${(order.delivery_type || '').toLowerCase().includes('post') && order.check_received_date ? `
                        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                            <span style="color: #64748b;">Check Date:</span>
                            <span style="color: #8b5cf6; font-weight: 600;">${new Date(order.check_received_date).toLocaleDateString()}</span>
                        </div>
                        ` : ''}
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
                <button class="action-btn btn-ship" style="width: 100%; padding: 1.25rem; margin-top: 2rem; border-radius: 16px; font-size: 1rem;" onclick="submitInlineShip(${order.order_id}, ${order.virtual_id ? order.product_id : null}, ${order.virtual_id ? order.unit_no : null}, '${order.virtual_id || ''}')">
                    <i class="fas fa-truck"></i> Proceed to Dispatch
                </button>
            ` : ''}
        </div>
    `;
    modal.style.display = 'flex';
};

window.closeModal = function () {
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
