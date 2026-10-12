/**
 * support-common.js
 * Common Utilities & Auth Handler for Customer Support Module
 */

(function () {
    // 1. Auth Guard
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../../index.html';
        return;
    }

    // 2. Authenticated Fetch Helper
    window.supportFetch = async function (endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${window.API_URL}/customer-support${endpoint}`;
        const headers = options.headers || {};
        
        // Don't set Content-Type if FormData (browser sets boundary automatically)
        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;

        try {
            const res = await fetch(url, { ...options, headers });
            if (res.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '../../index.html';
                return null;
            }
            return await res.json();
        } catch (err) {
            console.error('Fetch error:', err);
            window.showToast('Network error. Check connection.', 'error');
            throw err;
        }
    };

    // 3. Modern Toast System
    window.showToast = function (message, type = 'info') {
        const existing = document.getElementById('support-toast-el');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'support-toast-el';
        toast.className = `support-toast toast-${type}`;
        
        const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-bell');
        toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 4000);
    };

    // 4. Phone Calling Helper
    window.callCustomer = function (phone, customerName = 'Customer', caseId = null) {
        if (!phone) {
            window.showToast('No phone number provided', 'error');
            return;
        }

        // Clean phone digits
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        
        // Trigger device dialer
        window.location.href = `tel:${cleanPhone}`;

        // Prompt executive to log the call result
        setTimeout(() => {
            if (caseId) {
                if (confirm(`Did you finish your call with ${customerName} (${phone})? Click OK to record the call outcome.`)) {
                    window.location.href = `call_completion.html?case_id=${caseId}`;
                }
            }
        }, 1500);
    };

    // 5. Date Formatter
    window.formatDate = function (dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    };

    window.formatDateTime = function (dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    // 6. Badge Status Formatter
    window.renderStatusBadge = function (status) {
        const s = (status || '').toLowerCase();
        let label = s.replace(/_/g, ' ');
        let cls = 'badge-upcoming';

        if (s === 'delivered') { cls = 'badge-delivered'; label = 'Delivered'; }
        else if (s === 'pending_contact') { cls = 'badge-pending'; label = 'Pending Call'; }
        else if (s === 'contacted' || s === 'guidance_in_progress') { cls = 'badge-contacted'; label = 'In Progress'; }
        else if (s === 'completed') { cls = 'badge-completed'; label = 'Completed'; }
        else if (s === 'due') { cls = 'badge-due'; label = 'Due Now'; }
        else if (s === 'overdue') { cls = 'badge-overdue'; label = 'Overdue'; }
        else if (s === 'upcoming') { cls = 'badge-upcoming'; label = 'Upcoming'; }

        return `<span class="badge ${cls}">${label}</span>`;
    };

    // 8. Manual Support Case Creation Modal
    let selectedManualOrderId = null;

    window.openManualCaseModal = function () {
        let modal = document.getElementById('manualCaseModal');
        if (!modal) {
            injectManualCaseModal();
            modal = document.getElementById('manualCaseModal');
        } else {
            bindManualCaseModalEvents(modal);
        }

        if (!modal) {
            console.error('Customer Support: manualCaseModal could not be initialized');
            return;
        }

        // Reset inputs
        selectedManualOrderId = null;
        const form = document.getElementById('manualCaseForm');
        if (form) form.reset();

        const ordersBlock = document.getElementById('mcOrdersFoundBlock');
        if (ordersBlock) ordersBlock.style.display = 'none';

        const orderBadge = document.getElementById('mcSelectedOrderBadge');
        if (orderBadge) orderBadge.style.display = 'none';

        const dateInput = document.getElementById('mcDeliveryDate');
        if (dateInput) {
            try { dateInput.valueAsDate = new Date(); } catch (e) {}
        }

        // Show modal with full visibility override
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.style.visibility = 'visible';

        setTimeout(() => {
            const phoneInput = document.getElementById('mcPhone');
            if (phoneInput) phoneInput.focus();
        }, 50);
    };

    window.closeManualCaseModal = function () {
        const modal = document.getElementById('manualCaseModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.pointerEvents = 'none';
            modal.style.visibility = 'hidden';
        }
    };

    function injectManualCaseModal() {
        const modalHtml = `
        <div id="manualCaseModal" class="modal-overlay" style="display:none; position:fixed; inset:0; width:100vw; height:100vh; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); z-index:999999; align-items:center; justify-content:center; padding:1.5rem;">
            <div class="modal-box" style="background:white; border-radius:14px; max-width:620px; width:100%; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
                <div class="modal-header" style="padding:1.25rem 1.5rem; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
                    <div>
                        <h3 style="font-size:1.15rem; font-weight:800; color:#0f172a; margin:0; display:flex; align-items:center; gap:0.5rem;">
                            <i class="fas fa-user-plus" style="color:var(--support-primary);"></i> New Support Case / Customer Call
                        </h3>
                        <p style="font-size:0.8rem; color:#64748b; margin:0.25rem 0 0 0;">Enter customer phone to auto-lookup order or enter details manually.</p>
                    </div>
                    <button type="button" onclick="window.closeManualCaseModal()" style="border:none; background:transparent; font-size:1.2rem; color:#94a3b8; cursor:pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding:1.5rem; overflow-y:auto; flex:1;">
                    <form id="manualCaseForm">
                        <!-- Phone Lookup Bar -->
                        <div style="margin-bottom:1.25rem;">
                            <label style="display:block; font-size:0.85rem; font-weight:700; color:#1e293b; margin-bottom:0.4rem;">
                                Customer Mobile Number <span style="color:#ef4444;">*</span>
                            </label>
                            <div style="display:flex; gap:0.5rem;">
                                <input type="tel" id="mcPhone" required placeholder="e.g. 9876543210" style="flex:1; padding:0.65rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.9rem;">
                                <button type="button" id="btnLookupMc" class="btn btn-outline" style="white-space:nowrap;">
                                    <i class="fas fa-search"></i> Lookup
                                </button>
                            </div>
                        </div>

                        <!-- Existing Orders Found Block (Appears if matched) -->
                        <div id="mcOrdersFoundBlock" style="display:none; margin-bottom:1.25rem; background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:0.75rem 1rem;">
                            <div style="font-size:0.8rem; font-weight:700; color:#0369a1; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
                                <span><i class="fas fa-receipt"></i> Orders Found for this Customer</span>
                                <span id="mcOrdersCount" class="badge" style="background:#e0f2fe; color:#0369a1;"></span>
                            </div>
                            <div id="mcOrdersList" style="display:flex; flex-direction:column; gap:0.5rem; max-height:160px; overflow-y:auto;"></div>
                        </div>

                        <!-- Selected Order Alert Badge -->
                        <div id="mcSelectedOrderBadge" style="display:none; margin-bottom:1.25rem; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:0.6rem 0.85rem; font-size:0.85rem; color:#065f46; justify-content:space-between; align-items:center;">
                            <span><i class="fas fa-check-circle" style="color:#10b981;"></i> Linked to <strong>Order #<span id="mcSelectedOrderId"></span></strong></span>
                            <button type="button" id="btnUnlinkOrder" style="background:transparent; border:none; color:#ef4444; font-size:0.75rem; font-weight:700; cursor:pointer;">Unlink</button>
                        </div>

                        <!-- Customer Details -->
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                            <div>
                                <label style="display:block; font-size:0.85rem; font-weight:700; color:#1e293b; margin-bottom:0.4rem;">
                                    Customer Name <span style="color:#ef4444;">*</span>
                                </label>
                                <input type="text" id="mcName" required placeholder="Customer Full Name" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.875rem;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.85rem; font-weight:700; color:#1e293b; margin-bottom:0.4rem;">
                                    Manual Order # (Optional)
                                </label>
                                <input type="text" id="mcManualOrderNum" placeholder="e.g. ORD-1092 / Offline" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.875rem;">
                            </div>
                        </div>

                        <!-- Product Summary -->
                        <div style="margin-bottom:1rem;">
                            <label style="display:block; font-size:0.85rem; font-weight:700; color:#1e293b; margin-bottom:0.4rem;">
                                Product / Equipment Summary
                            </label>
                            <input type="text" id="mcProductSummary" placeholder="e.g. Biofloc Aeration Blower 2HP, Ring Diffusers" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.875rem;">
                        </div>

                        <!-- Delivery Date -->
                        <div style="margin-bottom:1rem;">
                            <label style="display:block; font-size:0.85rem; font-weight:700; color:#1e293b; margin-bottom:0.4rem;">
                                Delivery Date
                            </label>
                            <input type="date" id="mcDeliveryDate" style="width:100%; padding:0.65rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.875rem;">
                        </div>

                        <!-- Initial Notes -->
                        <div style="margin-bottom:0.5rem;">
                            <label style="display:block; font-size:0.85rem; font-weight:700; color:#1e293b; margin-bottom:0.4rem;">
                                Initial Notes / Remarks (Optional)
                            </label>
                            <textarea id="mcNotes" rows="2" placeholder="e.g. Customer called requesting installation assistance..." style="width:100%; padding:0.65rem 0.85rem; border:1px solid #cbd5e1; border-radius:8px; font-size:0.875rem; font-family:inherit;"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="padding:1rem 1.5rem; border-top:1px solid #e2e8f0; background:#f8fafc; display:flex; justify-content:space-between; align-items:center;">
                    <button type="button" class="btn btn-outline" onclick="window.closeManualCaseModal()">Cancel</button>
                    <div style="display:flex; gap:0.5rem;">
                        <button type="button" class="btn btn-outline" id="btnMcSaveOnly">
                            <i class="fas fa-check"></i> Create Case Only
                        </button>
                        <button type="button" class="btn btn-call" id="btnMcSaveAndCall">
                            <i class="fas fa-phone"></i> Create &amp; Call Customer
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        const modalEl = wrapper.firstElementChild;
        document.body.appendChild(modalEl);
        bindManualCaseModalEvents(modalEl);
    }

    function bindManualCaseModalEvents(modalEl) {
        if (!modalEl || modalEl.dataset.eventsBound === 'true') return;
        modalEl.dataset.eventsBound = 'true';

        // Click on backdrop closes modal
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) window.closeManualCaseModal();
        });

        // Bind Events
        const phoneInput = document.getElementById('mcPhone');
        const btnLookup = document.getElementById('btnLookupMc');
        if (btnLookup && phoneInput) {
            btnLookup.addEventListener('click', () => performCustomerLookup(phoneInput.value));
        }
        if (phoneInput) {
            phoneInput.addEventListener('blur', () => {
                if (phoneInput.value.trim().length >= 10) performCustomerLookup(phoneInput.value);
            });
            phoneInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performCustomerLookup(phoneInput.value);
                }
            });
        }

        const btnUnlink = document.getElementById('btnUnlinkOrder');
        if (btnUnlink) {
            btnUnlink.addEventListener('click', () => {
                selectedManualOrderId = null;
                const badge = document.getElementById('mcSelectedOrderBadge');
                if (badge) badge.style.display = 'none';
            });
        }

        const btnSaveOnly = document.getElementById('btnMcSaveOnly');
        if (btnSaveOnly) btnSaveOnly.addEventListener('click', () => submitManualCase(false));

        const btnSaveAndCall = document.getElementById('btnMcSaveAndCall');
        if (btnSaveAndCall) btnSaveAndCall.addEventListener('click', () => submitManualCase(true));
    }

    async function performCustomerLookup(phone) {
        if (!phone || phone.trim().length < 6) return;

        try {
            const data = await window.supportFetch(`/lookup-customer?phone=${encodeURIComponent(phone.trim())}`);
            if (!data || !data.success) return;

            const nameInput = document.getElementById('mcName');
            const ordersBlock = document.getElementById('mcOrdersFoundBlock');
            const ordersList = document.getElementById('mcOrdersList');
            const ordersCount = document.getElementById('mcOrdersCount');

            // Pre-fill name if empty
            if (data.lead && data.lead.name && !nameInput.value.trim()) {
                nameInput.value = data.lead.name;
            }
            if (data.orders && data.orders.length > 0 && !nameInput.value.trim()) {
                nameInput.value = data.orders[0].customer_name;
            }

            // Render orders list
            if (data.orders && data.orders.length > 0) {
                ordersCount.textContent = `${data.orders.length} order(s)`;
                ordersList.innerHTML = data.orders.map(o => {
                    const hasCase = !!o.existing_case_id;
                    return `
                        <div style="background:white; border:1px solid #cbd5e1; border-radius:6px; padding:0.5rem 0.75rem; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                            <div>
                                <strong style="color:#0f172a;">Order #${o.order_id}</strong>
                                <span style="color:#64748b;"> • ₹${o.total_amount || 0} • Status: ${o.order_status}</span>
                                <div style="color:#475569; font-size:0.75rem;">${o.items_summary || 'Standard Equipment'}</div>
                            </div>
                            <div>
                                ${hasCase ? `
                                    <span class="badge" style="background:#fef3c7; color:#92400e; font-size:0.7rem;">
                                        Case #${o.existing_case_number}
                                    </span>
                                ` : `
                                    <button type="button" class="btn btn-outline btn-sm" onclick="selectLookupOrder(${o.order_id}, '${escapeQuotes(o.items_summary || '')}', '${escapeQuotes(o.customer_name)}')">
                                        Select
                                    </button>
                                `}
                            </div>
                        </div>
                    `;
                }).join('');
                ordersBlock.style.display = 'block';
            } else {
                ordersBlock.style.display = 'none';
            }

        } catch (e) {
            console.warn('Customer lookup warn:', e);
        }
    }

    window.selectLookupOrder = function (orderId, productSummary, customerName) {
        selectedManualOrderId = orderId;
        document.getElementById('mcSelectedOrderId').textContent = orderId;
        document.getElementById('mcSelectedOrderBadge').style.display = 'flex';

        if (customerName) document.getElementById('mcName').value = customerName;
        if (productSummary) document.getElementById('mcProductSummary').value = productSummary;
        document.getElementById('mcManualOrderNum').value = `#${orderId}`;
    };

    function escapeQuotes(str) {
        return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    async function submitManualCase(andOpenCall) {
        const phone = document.getElementById('mcPhone').value.trim();
        const name = document.getElementById('mcName').value.trim();
        const manualOrderNum = document.getElementById('mcManualOrderNum').value.trim();
        const productSummary = document.getElementById('mcProductSummary').value.trim();
        const deliveryDate = document.getElementById('mcDeliveryDate').value;
        const notes = document.getElementById('mcNotes').value.trim();

        if (!phone) {
            window.showToast('Customer phone number is required', 'error');
            document.getElementById('mcPhone').focus();
            return;
        }
        if (!name) {
            window.showToast('Customer name is required', 'error');
            document.getElementById('mcName').focus();
            return;
        }

        const btnSave = andOpenCall ? document.getElementById('btnMcSaveAndCall') : document.getElementById('btnMcSaveOnly');
        const originalHtml = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await window.supportFetch('/cases', {
                method: 'POST',
                body: JSON.stringify({
                    customer_phone: phone,
                    customer_name: name,
                    order_id: selectedManualOrderId,
                    manual_order_number: manualOrderNum,
                    product_summary: productSummary,
                    delivery_date: deliveryDate,
                    notes: notes
                })
            });

            if (!res || !res.success) {
                throw new Error(res ? res.message : 'Failed to create case');
            }

            window.showToast(`Support Case #${res.case_number} created successfully!`, 'success');
            window.closeManualCaseModal();

            if (andOpenCall) {
                // Open call completion workflow right away!
                setTimeout(() => {
                    window.location.href = `call_completion.html?case_id=${res.case_id}`;
                }, 800);
            } else {
                // Refresh dashboard or orders delivered table if on that page
                if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
                if (typeof window.loadCases === 'function') window.loadCases();
                if (typeof window.loadDeliveredOrders === 'function') window.loadDeliveredOrders();
            }

        } catch (err) {
            window.showToast(err.message || 'Error creating manual case', 'error');
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalHtml;
        }
    }

    // 9. Notifications & Event Wire-Up
    window.initSupportNotifications = async function () {
        try {
            const notifBadge = document.getElementById('notifCountBadge') || document.getElementById('notifBadge');
            if (!notifBadge) return;
            const data = await window.supportFetch('/notifications');
            if (data && data.success && Array.isArray(data.notifications)) {
                const unread = data.notifications.filter(n => !n.is_read).length;
                notifBadge.textContent = unread;
                notifBadge.style.display = unread > 0 ? 'inline-flex' : 'none';
            }
        } catch (e) {
            // Silently handle
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (typeof window.initSupportNotifications === 'function') {
            window.initSupportNotifications();
        }

        // Auto-wire any buttons intended to trigger the manual case modal
        document.querySelectorAll('#btnOpenManualCase, #btnOpenManualCaseModal, [data-action="open-manual-case"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof window.openManualCaseModal === 'function') {
                    window.openManualCaseModal();
                }
            });
        });
    });

})();

