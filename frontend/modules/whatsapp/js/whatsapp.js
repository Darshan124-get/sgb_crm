/**
 * WhatsApp Module Logic - SGB Agro CRM
 */

// Configuration
const API_BASE = `${window.API_URL}/whatsapp`;
const LEAD_API_BASE = `${window.API_URL}/leads`;
const USER_API_BASE = `${window.API_URL}/users`; // Assuming there's a users endpoint for sales people
// Auth Guard
if (typeof window.requireAuth === 'function') {
    if (!window.requireAuth(['admin', 'super-admin', 'sales', 'billing', 'whatsapp_manager'])) {
        // Redirect handled by requireAuth
    }
}

const AUTH_HEADER = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };

let activeCustomer = null;
let currentHistory = [];
let allCustomers = [];
let currentTab = 'all';
let salesUsers = [];
let activeCampaigns = [];
const activeUploads = new Map();

// DOM Elements
const appContainerEl = document.getElementById('app-container');
const customerListEl = document.getElementById('customer-list');
const chatWelcomeEl = document.getElementById('chat-welcome');
const chatWindowEl = document.getElementById('chat-window');
const messageContainerEl = document.getElementById('message-container');
const messageInputEl = document.getElementById('message-input');
const sendBtnEl = document.getElementById('send-btn');
const activeCustomerNameEl = document.getElementById('active-customer-name');
const activeCustomerPhoneEl = document.getElementById('active-customer-phone');
const activeAvatarEl = document.getElementById('active-avatar');
const attachBtnEl = document.getElementById('attach-btn');
const mediaInputEl = document.getElementById('media-input');
const mobileBackBtnEl = document.getElementById('mobile-back-btn');
const searchInputEl = document.getElementById('customer-search');

// Modal Elements
const resolveBtnEl = document.getElementById('resolve-btn');
const transferBtnEl = document.getElementById('transfer-btn');
const transferModal = document.getElementById('transfer-modal');
const closeTransferModalBtn = document.getElementById('close-transfer-modal');
const salesPersonListEl = document.getElementById('sales-person-list');
const salesSearchEl = document.getElementById('sales-search');
const confirmTransferBtnEl = document.getElementById('confirm-transfer-btn');

let selectedTransferUserId = null;

// Right Sidebar Elements
const detailsSidebarEl = document.getElementById('details-sidebar');
const detailsNameEl = document.getElementById('details-name');
const detailsPhoneEl = document.getElementById('details-phone');
const detailsAvatarEl = document.getElementById('details-avatar');
const displayLocationEl = document.getElementById('display-location');
const displayLanguageEl = document.getElementById('display-language');
const assignedToEl = document.getElementById('details-assigned-to');

// Edit Form Elements
const editContactBtn = document.getElementById('edit-contact-btn');
const contactDisplayEl = document.getElementById('contact-info-display');
const contactEditEl = document.getElementById('contact-info-edit');
const editNameInput = document.getElementById('edit-name');
const editCityInput = document.getElementById('edit-city');
const editDistrictInput = document.getElementById('edit-district');
const editStateInput = document.getElementById('edit-state');
const editPincodeInput = document.getElementById('edit-pincode');
const editLangInput = document.getElementById('edit-language');
const saveDetailsBtn = document.getElementById('save-details-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Header Actions (Already declared above)

/**
 * Navigate back to Lead Details page
 */
function goToLeadDetails() {
    if (!activeCustomer || !activeCustomer.lead_id) {
        window.showAlert('Error', 'No lead selected', 'error');
        return;
    }
    const user = window.getCurrentUser();
    const role = (user.role || '').toLowerCase();
    const basePath = (role === 'admin' || role === 'super-admin')
        ? `${window.ROOT_PATH}modules/admin/leads.html`
        : `${window.ROOT_PATH}modules/sales/leads.html`;
    window.location.href = `${basePath}?leadId=${activeCustomer.lead_id}`;
}

/**
 * Initialize
 */
document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard
    if (!window.requireAuth(['admin', 'sales', 'whatsapp_manager'])) return;

    loadCustomers();
    loadSalesUsers();
    loadCampaignsAndTabs();
    initResizers();

    // 3-dot menu toggle logic
    const menuBtn = document.getElementById('sidebar-menu-btn');
    const menuContent = document.getElementById('sidebar-menu-content');

    if (menuBtn && menuContent) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuContent.style.display = menuContent.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !menuContent.contains(e.target)) {
                menuContent.style.display = 'none';
            }
        });
    }

    // Refresh customer list every 30 seconds
    setInterval(loadCustomers, 30000);

    // Polling for new messages in active chat
    setInterval(() => {
        if (activeCustomer) {
            loadChatHistory(activeCustomer.phone, true);
        }
    }, 5000);

    // Search Filtering
    if (searchInputEl) {
        searchInputEl.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.customer-item').forEach(item => {
                const name = item.querySelector('h3').innerText.toLowerCase();
                const snippet = item.querySelector('.last-message-snippet').innerText.toLowerCase();
                if (name.includes(term) || snippet.includes(term)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // Tab Switching Logic (initial setup if container is not dynamically loaded yet, but loadCampaignsAndTabs handles it)
    const container = document.getElementById('sidebar-tabs-container');
    if (container) {
        container.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTab = tab.dataset.tab;
                renderCustomerList();
            });
        });
    }

    // Check for leadId in URL
    const urlParams = new URLSearchParams(window.location.search);
    const phone = urlParams.get('phone');
    if (phone) {
        window._pendingPhone = phone;
    }

    // Sidebar Toggles
    if (editContactBtn) {
        editContactBtn.onclick = () => {
            contactDisplayEl.classList.add('hidden');
            contactEditEl.classList.remove('hidden');
            populateEditForm();
        };
    }

    if (cancelEditBtn) {
        cancelEditBtn.onclick = () => {
            contactEditEl.classList.add('hidden');
            contactDisplayEl.classList.remove('hidden');
        };
    }

    if (saveDetailsBtn) {
        saveDetailsBtn.onclick = handleSaveDetails;
    }

    // Header Actions handled by event listeners at bottom of file
});

/**
 * Avatar Utilities
 */
function getAvatarStyle(phone) {
    if (!phone) return '#666';
    const colors = ['#00a884', '#128c7e', '#34b7f1', '#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5', '#039be5', '#00acc1', '#00897b'];
    const sum = phone.split('').reduce((a, b) => a + (parseInt(b) || 0), 0);
    return colors[sum % colors.length];
}

function getInitials(name) {
    if (!name || name === '?') return '?';
    const parts = name.split(' ').filter(n => n);
    if (parts.length === 0) return '?';
    return parts.map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function renderSidebarTabs() {
    const container = document.getElementById('sidebar-tabs-container');
    if (!container) return;

    const isResolved = (c) => ['converted', 'closed', 'lost'].includes(c.status);

    // Calculate unread count
    const unreadCount = (allCustomers || []).filter(c => {
        if (isResolved(c)) return false;
        return parseInt(c.unread_msg_count || 0) > 0;
    }).length;

    const isCampaignActive = activeCampaigns.some(camp => camp.tag_line === currentTab);
    const customLists = loadCustomLists();
    const isCustomListActive = customLists.some(list => list.id === currentTab) || currentTab === 'undefined' || currentTab === 'resolved';

    let html = `
        <div class="tab-item ${currentTab === 'all' ? 'active' : ''}" data-tab="all">All <span id="all-unread-count" style="margin-left: 4px;">${unreadCount}</span></div>
        <div class="tab-item ${currentTab === 'unviewed' ? 'active' : ''}" data-tab="unviewed">Unread <span id="unread-count" style="margin-left: 4px;">${unreadCount}</span></div>
        
        <select id="campaign-filter-select" class="tab-select ${isCampaignActive ? 'active' : ''}" style="
            flex: 0 0 auto;
            padding: 6px 12px;
            color: ${isCampaignActive ? '#008069' : 'var(--whatsapp-secondary)'};
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid ${isCampaignActive ? '#008069' : 'var(--whatsapp-border)'};
            border-radius: 20px;
            background: ${isCampaignActive ? 'rgba(0, 128, 105, 0.1)' : 'var(--whatsapp-header)'};
            outline: none;
            max-width: 150px;
            text-overflow: ellipsis;
        ">
            <option value="" style="background: var(--whatsapp-sidebar); color: var(--whatsapp-text);">Campaigns</option>
    `;

    activeCampaigns.forEach(camp => {
        const isSelected = currentTab === camp.tag_line;
        html += `<option value="${camp.tag_line}" ${isSelected ? 'selected' : ''} style="background: var(--whatsapp-sidebar); color: var(--whatsapp-text);">${camp.campaign_id}</option>`;
    });

    html += `
        </select>
        
        <!-- Custom Lists Dropdown Trigger -->
        <div id="list-dropdown-btn" class="tab-item ${isCustomListActive ? 'active' : ''}" style="
            padding: 6px 14px; 
            position: relative; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            border-color: ${isCustomListActive ? '#008069' : ''};
            color: ${isCustomListActive ? '#008069' : ''};
            background: ${isCustomListActive ? 'rgba(0, 128, 105, 0.1)' : ''};
        ">
            <i class="fas fa-chevron-down"></i>
        </div>
    `;

    container.innerHTML = html;

    // Render list contents inside the dropdown menu
    const dropdownMenu = document.getElementById('list-dropdown-menu');
    if (dropdownMenu) {
        let listMenuHtml = `
            <div class="list-menu-item" data-list-id="undefined" style="
                display: flex;
                align-items: center;
                padding: 10px 15px;
                color: ${currentTab === 'undefined' ? 'var(--whatsapp-green)' : 'var(--whatsapp-text)'};
                font-size: 0.85rem;
                cursor: pointer;
                transition: background 0.2s;
                font-weight: ${currentTab === 'undefined' ? '600' : 'normal'};
            " onmouseover="this.style.backgroundColor='var(--whatsapp-header)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Undefined</span>
            </div>
            <div class="list-menu-item" data-list-id="resolved" style="
                display: flex;
                align-items: center;
                padding: 10px 15px;
                color: ${currentTab === 'resolved' ? 'var(--whatsapp-green)' : 'var(--whatsapp-text)'};
                font-size: 0.85rem;
                cursor: pointer;
                transition: background 0.2s;
                font-weight: ${currentTab === 'resolved' ? '600' : 'normal'};
            " onmouseover="this.style.backgroundColor='var(--whatsapp-header)'" onmouseout="this.style.backgroundColor='transparent'">
                <span style="flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Resolved</span>
            </div>
            <div style="height: 1px; background: var(--whatsapp-border); margin: 6px 0;"></div>
        `;

        customLists.forEach(list => {
            const listUnreadCount = (allCustomers || []).filter(c => {
                if (isResolved(c)) return false;
                return list.phones.includes(c.phone) && parseInt(c.unread_msg_count || 0) > 0;
            }).length;

            const countBadge = listUnreadCount > 0
                ? `<span style="background-color: var(--whatsapp-green); color: white; border-radius: 50%; padding: 2px 6px; font-size: 0.65rem; font-weight: 700; margin-left: auto; line-height: 1;">${listUnreadCount}</span>`
                : '';

            listMenuHtml += `
                <div class="list-menu-item" data-list-id="${list.id}" style="
                    display: flex;
                    align-items: center;
                    padding: 10px 15px;
                    color: ${currentTab === list.id ? 'var(--whatsapp-green)' : 'var(--whatsapp-text)'};
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: background 0.2s;
                    font-weight: ${currentTab === list.id ? '600' : 'normal'};
                " onmouseover="this.style.backgroundColor='var(--whatsapp-header)'" onmouseout="this.style.backgroundColor='transparent'">
                    <span style="flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${list.name}</span>
                    ${countBadge}
                    <i class="fas fa-trash-alt delete-list-icon" data-list-id="${list.id}" style="margin-left: 10px; color: var(--whatsapp-secondary); font-size: 0.8rem; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--whatsapp-secondary)'"></i>
                </div>
            `;
        });

        if (customLists.length > 0) {
            listMenuHtml += `<div style="height: 1px; background: var(--whatsapp-border); margin: 6px 0;"></div>`;
        }

        listMenuHtml += `
            <div id="create-new-list-btn" style="
                display: flex;
                align-items: center;
                padding: 10px 15px;
                color: var(--whatsapp-green);
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                gap: 8px;
                transition: background 0.2s;
            " onmouseover="this.style.backgroundColor='var(--whatsapp-header)'" onmouseout="this.style.backgroundColor='transparent'">
                <i class="fas fa-plus"></i> New list
            </div>
        `;
        dropdownMenu.innerHTML = listMenuHtml;
    }

    // Dropdown toggle logic with dynamic positioning to prevent clipping
    const dropdownBtn = document.getElementById('list-dropdown-btn');
    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const show = dropdownMenu.style.display === 'none' || dropdownMenu.style.display === '';
            if (show) {
                dropdownMenu.style.display = 'block'; // Show first so offsetWidth is calculated correctly

                const btnRect = dropdownBtn.getBoundingClientRect();
                const sidebar = document.querySelector('.chat-sidebar');
                const sidebarRect = sidebar.getBoundingClientRect();

                // Align right edge of the dropdown with the right edge of the button
                let leftPos = btnRect.right - sidebarRect.left - dropdownMenu.offsetWidth;
                if (leftPos < 10) leftPos = 10; // Keep some padding on left if sidebar is extremely narrow

                dropdownMenu.style.left = leftPos + 'px';
                dropdownMenu.style.top = (btnRect.bottom - sidebarRect.top + 5) + 'px';
            } else {
                dropdownMenu.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.style.display = 'none';
            }
        });
    }

    // Bind dropdown click handlers
    if (dropdownMenu) {
        dropdownMenu.querySelectorAll('.list-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Ignore click if trash icon was clicked
                if (e.target.classList.contains('delete-list-icon') || e.target.parentElement.classList.contains('delete-list-icon')) {
                    e.stopPropagation();
                    const listId = e.target.dataset.listId || e.target.parentElement.dataset.listId;
                    if (confirm('Delete this list?')) {
                        const lists = loadCustomLists().filter(l => l.id !== listId);
                        saveCustomLists(lists);
                        if (currentTab === listId) currentTab = 'all';
                        renderSidebarTabs();
                        renderCustomerList();
                    }
                    return;
                }

                container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                const selectEl = document.getElementById('campaign-filter-select');
                if (selectEl) {
                    selectEl.value = "";
                    selectEl.classList.remove('active');
                    selectEl.style.color = 'var(--whatsapp-secondary)';
                    selectEl.style.borderColor = 'var(--whatsapp-border)';
                    selectEl.style.background = 'var(--whatsapp-header)';
                }

                dropdownBtn.classList.add('active');
                dropdownBtn.style.color = '#008069';
                dropdownBtn.style.borderColor = '#008069';
                dropdownBtn.style.background = 'rgba(0, 128, 105, 0.1)';

                currentTab = item.dataset.listId;
                renderCustomerList();
            });
        });

        const createBtn = document.getElementById('create-new-list-btn');
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.style.display = 'none';

                // Show Custom List Modal
                const modal = document.getElementById('custom-list-modal');
                if (modal) {
                    document.getElementById('new-list-name').value = '';
                    const selector = document.getElementById('contact-selector-container');
                    if (selector) selector.classList.add('hidden');
                    populateListContacts();
                    validateNewListForm();
                    modal.classList.remove('hidden');
                    modal.classList.add('active');
                    document.body.classList.add('modal-open');
                }
            });
        }
    }

    container.querySelectorAll('.tab-item:not(#list-dropdown-btn)').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            const selectEl = document.getElementById('campaign-filter-select');
            if (selectEl) {
                selectEl.value = "";
                selectEl.classList.remove('active');
                selectEl.style.color = 'var(--whatsapp-secondary)';
                selectEl.style.borderColor = 'var(--whatsapp-border)';
                selectEl.style.background = 'var(--whatsapp-header)';
            }
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderCustomerList();
        });
    });

    const selectEl = document.getElementById('campaign-filter-select');
    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                selectEl.classList.add('active');
                selectEl.style.color = '#008069';
                selectEl.style.borderColor = '#008069';
                selectEl.style.background = 'rgba(0, 128, 105, 0.1)';
                currentTab = val;
            } else {
                container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                const allTab = container.querySelector('[data-tab="all"]');
                if (allTab) allTab.classList.add('active');
                selectEl.classList.remove('active');
                selectEl.style.color = 'var(--whatsapp-secondary)';
                selectEl.style.borderColor = 'var(--whatsapp-border)';
                selectEl.style.background = 'var(--whatsapp-header)';
                currentTab = 'all';
            }
            renderCustomerList();
        });
    }
}

async function loadCampaignsAndTabs() {
    try {
        const response = await fetch(`${window.API_URL}/campaigns`, { headers: AUTH_HEADER });
        if (response.ok) {
            const allCampaigns = await response.json();
            activeCampaigns = allCampaigns.filter(c => c.status === 'active');
            renderSidebarTabs();
        }
    } catch (err) {
        console.error('Failed to load campaigns for tabs:', err);
    }
}

/**
 * Fetch and Render Customer List
 */
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`, { headers: AUTH_HEADER });
        if (response.status === 401) return window.doLogout();
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        allCustomers = await response.json();
        renderSidebarTabs(); // update unread count
        renderCustomerList();
    } catch (err) {
        console.error('Failed to load customers:', err);
        customerListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Connection error.</div>';
    }
}

/**
 * Render Customer List
 */
function renderCustomerList() {
    if (!Array.isArray(allCustomers) || allCustomers.length === 0) {
        customerListEl.innerHTML = '<div class="loading-spinner" style="font-size: 0.9rem; color: #8696a0;">No conversations yet.</div>';
        return;
    }

    let filtered = allCustomers.filter(customer => {
        const resolved = ['converted', 'closed', 'lost'].includes(customer.status);

        // Check if currentTab matches a custom list ID
        const customLists = loadCustomLists();
        const activeList = customLists.find(l => l.id === currentTab);
        if (activeList) {
            if (resolved) return false;
            return activeList.phones.includes(customer.phone);
        }

        if (currentTab === 'all') {
            return !resolved;
        } else if (currentTab === 'resolved') {
            return resolved;
        } else if (currentTab === 'unviewed') {
            if (resolved) return false;
            return parseInt(customer.unread_msg_count || 0) > 0;
        } else if (currentTab === 'undefined') {
            if (resolved) return false;
            if (!customer.first_message) return true;
            const normalizedFirst = customer.first_message.toLowerCase().trim();
            return !activeCampaigns.some(camp => {
                if (!camp.tag_line) return false;
                const tag = camp.tag_line.toLowerCase().trim();
                return normalizedFirst.includes(tag) || normalizedFirst === tag;
            });
        } else {
            if (resolved) return false;
            if (!customer.first_message || !currentTab) return false;
            const normalizedFirst = customer.first_message.toLowerCase().trim();
            const normalizedTab = currentTab.toLowerCase().trim();
            return normalizedFirst.includes(normalizedTab) || normalizedFirst === normalizedTab;
        }
    });

    // Sort so that unread messages come to the top, then sort by last_message_at DESC
    filtered.sort((a, b) => {
        const aUnread = parseInt(a.unread_msg_count || 0) > 0;
        const bUnread = parseInt(b.unread_msg_count || 0) > 0;
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;

        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
    });

    if (filtered.length === 0) {
        customerListEl.innerHTML = `<div style="padding: 40px 20px; text-align: center; color: #8696a0; font-size: 0.9rem;">No conversations in this tab.</div>`;
        return;
    }

    customerListEl.innerHTML = '';
    filtered.forEach(customer => {
        const displayName = customer.customer_name || customer.phone;
        const initials = getInitials(customer.customer_name);
        const color = getAvatarStyle(customer.phone);

        let lastTime = 'New';
        if (customer.last_message_at) {
            const date = new Date(customer.last_message_at);
            if (!isNaN(date.getTime())) {
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                if (date.toDateString() === today.toDateString()) {
                    lastTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else if (date.toDateString() === yesterday.toDateString()) {
                    lastTime = 'Yesterday';
                } else {
                    lastTime = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }
            }
        }

        const item = document.createElement('div');
        item.className = `customer-item ${activeCustomer && activeCustomer.phone === customer.phone ? 'active' : ''}`;
        item.dataset.phone = customer.phone;

        const lastMsg = customer.last_message || '';
        const scoreClass = (customer.score || 'cold').toLowerCase();
        const scoreLabel = customer.score ? customer.score.toUpperCase() : '';

        // 24h window remaining badge
        let windowBadge = '';
        const inboundTs = customer.last_inbound_at || customer.last_message_at;
        if (inboundTs) {
            const remaining = (24 * 60 * 60 * 1000) - (Date.now() - new Date(inboundTs).getTime());
            if (remaining > 0) {
                const hrs = Math.ceil(remaining / (60 * 60 * 1000));
                windowBadge = `<span class="window-badge window-open">${hrs}h</span>`;
            } else {
                windowBadge = `<span class="window-badge window-closed-badge">✕</span>`;
            }
        }

        const hasUnread = parseInt(customer.unread_msg_count || 0) > 0;
        const timeColor = hasUnread ? 'var(--whatsapp-green)' : 'var(--whatsapp-secondary)';
        const timeWeight = hasUnread ? 'font-weight: 600;' : '';

        item.innerHTML = `
            <div class="avatar-wrap">
                <div class="avatar" style="background-color: ${color}">${initials}</div>
                ${windowBadge}
            </div>
            <div class="customer-meta">
                <div class="customer-meta-header">
                    <h3>${displayName}</h3>
                    <div class="customer-time" style="color: ${timeColor}; ${timeWeight}">${lastTime}</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <p class="last-message-snippet" style="flex: 1; min-width: 0;">${lastMsg || customer.phone}</p>
                    ${hasUnread ? `<span class="unread-badge" style="background-color: var(--whatsapp-green); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1;">${customer.unread_msg_count}</span>` : ''}
                </div>
                <div class="customer-meta-footer">
                    ${scoreLabel ? `<span class="score-badge badge-${scoreClass}">${scoreLabel}</span>` : ''}
                    ${customer.assigned_name ? `<div class="assigned-badge"><i class="fas fa-user-check"></i> ${customer.assigned_name}</div>` : ''}
                </div>
            </div>
        `;
        item.onclick = () => selectCustomer(customer);
        customerListEl.appendChild(item);

        if (window._pendingPhone === customer.phone) {
            selectCustomer(customer);
            delete window._pendingPhone;
        }
    });
}

/**
 * Select a customer
 */
async function selectCustomer(customer) {
    closeAllContextMenus();
    clearReplyPreview();
    activeCustomer = customer;

    // UI Transitions
    chatWelcomeEl.classList.add('hidden');
    chatWindowEl.classList.remove('hidden');
    detailsSidebarEl.classList.remove('hidden');
    const resizerRight = document.getElementById('resizer-right');
    if (resizerRight) resizerRight.classList.remove('hidden');
    appContainerEl.classList.add('show-chat');

    // Reset edit state
    contactEditEl.classList.add('hidden');
    contactDisplayEl.classList.remove('hidden');

    // Header Info
    const displayName = customer.customer_name || customer.phone;
    activeCustomerNameEl.innerText = displayName;
    activeCustomerPhoneEl.innerText = customer.phone;
    activeAvatarEl.innerText = getInitials(customer.customer_name);
    activeAvatarEl.style.backgroundColor = getAvatarStyle(customer.phone);

    // Sidebar Details
    detailsNameEl.innerText = displayName;
    detailsPhoneEl.innerText = customer.phone;
    detailsAvatarEl.innerText = getInitials(customer.customer_name);
    detailsAvatarEl.style.backgroundColor = getAvatarStyle(customer.phone);

    const location = [customer.city, customer.district, customer.state].filter(s => s).join(', ') || '-';
    displayLocationEl.innerText = location;
    displayLanguageEl.innerText = customer.language || '-';
    assignedToEl.innerText = customer.assigned_name || 'Unassigned';

    // 24h Window Badge
    update24hWindow(customer);

    // Highlight active item
    document.querySelectorAll('.customer-item').forEach(el => {
        if (el.dataset.phone === customer.phone) el.classList.add('active');
        else el.classList.remove('active');
    });

    if (parseInt(customer.unread_msg_count || 0) > 0) {
        try {
            fetch(`${API_BASE}/customers/${customer.phone}/read`, { method: 'PUT', headers: AUTH_HEADER }).catch(console.error);
            customer.unread_msg_count = 0;
            renderSidebarTabs();
            renderCustomerList();
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    }

    await loadChatHistory(customer.phone);
}

// ── 24h Window Timer ──────────────────────────────────────────────────────────
let _windowTimerInterval = null;

function update24hWindow(customer) {
    const badge = document.getElementById('wa-window-badge');
    const openEl = document.getElementById('wa-window-open');
    const closedEl = document.getElementById('wa-window-closed');
    const countdown = document.getElementById('wa-window-countdown');
    const bar = document.getElementById('wa-window-bar');

    if (!badge) return;

    // Clear any previous timer
    if (_windowTimerInterval) { clearInterval(_windowTimerInterval); _windowTimerInterval = null; }

    const lastInbound = customer.last_inbound_at || customer.last_message_at;
    badge.style.display = 'block';

    if (!lastInbound) {
        // No messages yet — window is closed
        openEl.style.display = 'none';
        closedEl.style.display = 'block';
        return;
    }

    const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

    function tick() {
        const now = Date.now();
        const lastTime = new Date(lastInbound).getTime();
        const remaining = WINDOW_MS - (now - lastTime);

        if (remaining <= 0) {
            // Window closed
            clearInterval(_windowTimerInterval);
            openEl.style.display = 'none';
            closedEl.style.display = 'block';
            return;
        }

        // Window still open
        openEl.style.display = 'block';
        closedEl.style.display = 'none';

        // Format HH:MM:SS
        const totalSecs = Math.floor(remaining / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        if (countdown) countdown.textContent =
            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        // Progress bar — goes from 100% → 0% over 24h
        if (bar) {
            const pct = Math.max(0, (remaining / WINDOW_MS) * 100);
            bar.style.width = pct + '%';
            // Color shifts: green → yellow → red as time runs out
            if (pct > 50) bar.style.background = 'linear-gradient(90deg,#10b981,#34d399)';
            else if (pct > 20) bar.style.background = 'linear-gradient(90deg,#f59e0b,#fbbf24)';
            else bar.style.background = 'linear-gradient(90deg,#ef4444,#f87171)';
        }
    }

    tick(); // run immediately
    _windowTimerInterval = setInterval(tick, 1000);
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Populate Edit Form
 */
function populateEditForm() {
    if (!activeCustomer) return;
    editNameInput.value = activeCustomer.customer_name || '';
    editCityInput.value = activeCustomer.city || '';
    editDistrictInput.value = activeCustomer.district || '';
    editStateInput.value = activeCustomer.state || '';
    editPincodeInput.value = activeCustomer.pincode || '';
    editLangInput.value = activeCustomer.language || 'EN';

    // Check for edit-crop and edit-acreage if they exist (they might not be defined at the top yet, so query them)
    const cropInput = document.getElementById('edit-crop');
    const acreageInput = document.getElementById('edit-acreage');
    if (cropInput) cropInput.value = activeCustomer.current_crop || '';
    if (acreageInput) acreageInput.value = activeCustomer.acreage || '';
}

/**
 * Handle Save Details
 */
async function handleSaveDetails() {
    if (!activeCustomer) return;

    const cropInput = document.getElementById('edit-crop');
    const acreageInput = document.getElementById('edit-acreage');

    const payload = {
        customer_name: editNameInput.value.trim(),
        city: editCityInput.value.trim(),
        district: editDistrictInput.value.trim(),
        state: editStateInput.value.trim(),
        pincode: editPincodeInput.value.trim(),
        language: editLangInput.value,
        current_crop: cropInput ? cropInput.value.trim() : '',
        acreage: acreageInput ? (acreageInput.value ? parseFloat(acreageInput.value) : null) : null
    };

    try {
        const response = await fetch(`${LEAD_API_BASE}/${activeCustomer.lead_id}`, {
            method: 'PUT',
            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            window.showAlert('Success', 'Contact details updated', 'success');
            // Update local state
            Object.assign(activeCustomer, payload);
            selectCustomer(activeCustomer);
            loadCustomers(); // Refresh list to update names
        } else {
            window.showAlert('Error', 'Failed to update details', 'error');
        }
    } catch (err) {
        console.error('Update error:', err);
    }
}

/**
 * Handle Resolve
 */
async function handleResolve() {
    if (!activeCustomer) return;

    if (!confirm('Mark this conversation as Resolved? This will move it to the Closed tab.')) return;

    try {
        const response = await fetch(`${LEAD_API_BASE}/${activeCustomer.lead_id}`, {
            method: 'PUT',
            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'converted' }) // or 'closed'
        });

        if (response.ok) {
            window.showAlert('Success', 'Conversation marked as resolved', 'success');
            activeCustomer = null;
            chatWindowEl.classList.add('hidden');
            detailsSidebarEl.classList.add('hidden');
            const resizerRight = document.getElementById('resizer-right');
            if (resizerRight) resizerRight.classList.add('hidden');
            chatWelcomeEl.classList.remove('hidden');
            loadCustomers();
        }
    } catch (err) {
        console.error('Resolve error:', err);
    }
}

async function loadSalesUsers() {
    try {
        const response = await fetch(`${USER_API_BASE}/sales`, { headers: AUTH_HEADER });
        if (response.ok) {
            salesUsers = await response.json();
            renderSalesList();
        }
    } catch (err) {
        console.error('Failed to load sales users:', err);
    }
}

function renderSalesList(filter = '') {
    salesPersonListEl.innerHTML = '';
    const filteredUsers = salesUsers.filter(u =>
        u.name.toLowerCase().includes(filter.toLowerCase()) ||
        (u.phone && u.phone.includes(filter))
    );

    filteredUsers.forEach(user => {
        const item = document.createElement('div');
        item.className = `sales-person-item ${selectedTransferUserId === user.user_id ? 'selected' : ''}`;
        item.innerHTML = `
            <div class="radio-circle"></div>
            <div class="sales-avatar" style="background: ${getRandomColor(user.name)}">${getInitials(user.name)}</div>
            <div class="sales-info">
                <div class="sales-name">${user.name}</div>
                <div class="sales-phone">${user.phone || 'No phone'}</div>
            </div>
        `;
        item.onclick = () => {
            selectedTransferUserId = user.user_id;
            confirmTransferBtnEl.disabled = (activeCustomer && selectedTransferUserId === activeCustomer.assigned_to);
            renderSalesList(filter); // Re-render to show selection
        };
        salesPersonListEl.appendChild(item);
    });
}

function getRandomColor(name) {
    if (!name) return '#64748b';
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().substring(0, 2);
}

async function handleTransfer() {
    if (!activeCustomer || !selectedTransferUserId) return;

    confirmTransferBtnEl.disabled = true;
    confirmTransferBtnEl.innerText = 'Transferring...';

    try {
        const response = await fetch(`${LEAD_API_BASE}/${activeCustomer.lead_id}/transfer`, {
            method: 'POST',
            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: selectedTransferUserId })
        });

        if (response.ok) {
            window.showAlert('Success', 'Lead transferred successfully', 'success');
            transferModal.classList.remove('active');
            document.body.classList.remove('modal-open');

            // Update local active customer state so UI changes immediately
            const newOwner = salesUsers.find(u => u.user_id === selectedTransferUserId);
            if (newOwner) {
                activeCustomer.assigned_to = newOwner.user_id;
                activeCustomer.assigned_name = newOwner.name;
                selectCustomer(activeCustomer);
            }

            loadCustomers();
        } else {
            const err = await response.json();
            window.showAlert('Error', err.message || 'Transfer failed', 'error');
        }
    } catch (err) {
        console.error('Transfer error:', err);
    } finally {
        confirmTransferBtnEl.disabled = false;
        confirmTransferBtnEl.innerText = 'Transfer';
    }
}

/**
 * Load Chat History
 */
async function loadChatHistory(phone, isPolling = false) {
    try {
        const response = await fetch(`${API_BASE}/history/${phone}?t=${Date.now()}`, { headers: AUTH_HEADER });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const history = await response.json();
        if (isPolling && JSON.stringify(history) === JSON.stringify(currentHistory)) return;
        currentHistory = history;
        renderMessages(history);
    } catch (err) {
        console.error('Failed to load history:', err);
    }
}

// Global State
let selectedFile = null;

// UI Elements
const mediaPreviewModal = document.getElementById('media-preview-modal');
const previewImg = document.getElementById('preview-img');
const previewFileName = document.getElementById('preview-file-name');
const previewCaption = document.getElementById('preview-caption');
const sendMediaBtn = document.getElementById('send-media-btn');
const closePreviewBtn = document.getElementById('close-preview-btn');

document.addEventListener('DOMContentLoaded', () => {
    // Media Preview Events
    closePreviewBtn.onclick = () => {
        mediaPreviewModal.classList.remove('active');
        document.body.classList.remove('modal-open');
        selectedFile = null;
    };

    sendMediaBtn.onclick = handleSendMedia;

    // mediaInputEl onchange is bound in initEventListeners
});

async function handleSendMedia() {
    if (!selectedFile || !activeCustomer) return;

    // Capture variables needed for background upload
    const file = selectedFile;
    const phone = activeCustomer.phone;
    const caption = previewCaption.value.trim();
    const mimeType = file.type;
    const fileName = file.name;

    // 1. Immediately close the modal to prevent blocking the UI
    mediaPreviewModal.classList.remove('active');
    document.body.classList.remove('modal-open');
    selectedFile = null;

    // 2. Optimistic UI update - Add uploading message to the chat
    const msgId = 'upload-' + Date.now();
    const msgEl = document.createElement('div');
    msgEl.className = `message message-outgoing`;
    msgEl.id = msgId;

    let mediaPreview = '';
    if (mimeType.startsWith('image/')) {
        mediaPreview = `<img src="${URL.createObjectURL(file)}" alt="Uploading..." style="opacity: 0.6; border-radius: 8px;">`;
    } else if (mimeType.startsWith('video/')) {
        mediaPreview = `<video src="${URL.createObjectURL(file)}" style="opacity: 0.6; max-width: 100%; border-radius: 8px;"></video>`;
    } else {
        mediaPreview = `<div style="padding: 10px; background: rgba(0,0,0,0.1); border-radius: 8px;"><i class="fas fa-file"></i> ${fileName}</div>`;
    }

    msgEl.innerHTML = `
        <div class="message-media" style="position: relative;">
            ${mediaPreview}
            <div class="upload-overlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; background: rgba(0,0,0,0.6); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; z-index: 10; font-size: 0.9rem; font-weight: bold;">
                <span class="upload-percent">0%</span>
            </div>
            ${caption ? `<div class="message-content" style="opacity: 0.7;">${caption}</div>` : ''}
        </div>
        <div class="message-time">Uploading...</div>
    `;

    if (activeCustomer && activeCustomer.phone === phone && messageContainerEl) {
        messageContainerEl.appendChild(msgEl);
        messageContainerEl.scrollTop = messageContainerEl.scrollHeight;
    }

    // Save to global state so it persists across chat switching
    activeUploads.set(msgId, {
        phone: phone,
        element: msgEl
    });

    // 3. Process and Upload in background with Progress Tracking
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/send`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                const percentEl = msgEl.querySelector('.upload-percent');
                if (percentEl) {
                    percentEl.innerText = `${percentComplete}%`;
                }
            }
        };

        xhr.onload = () => {
            activeUploads.delete(msgId); // Remove from global tracking
            if (xhr.status >= 200 && xhr.status < 300) {
                // If they are still in the same chat, reload history to get the real message
                if (activeCustomer && activeCustomer.phone === phone) {
                    loadChatHistory(phone);
                }
            } else {
                handleUploadError();
            }
        };

        xhr.onerror = () => {
            activeUploads.delete(msgId);
            handleUploadError();
        };

        function handleUploadError() {
            console.error('Media upload error');
            const overlay = msgEl.querySelector('.upload-overlay');
            if (overlay) overlay.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #ef4444; font-size: 1.2rem;"></i>';
            const timeEl = msgEl.querySelector('.message-time');
            if (timeEl) timeEl.innerText = 'Failed';

            // Re-append to DOM if it was detached but we are still on the same chat
            if (activeCustomer && activeCustomer.phone === phone && messageContainerEl && !document.getElementById(msgId)) {
                messageContainerEl.appendChild(msgEl);
                messageContainerEl.scrollTop = messageContainerEl.scrollHeight;
            }
        }

        xhr.send(JSON.stringify({
            phone: phone,
            mediaData: reader.result,
            mimeType: mimeType,
            message: caption || fileName
        }));
    };
}

// Warn before leaving if there are active uploads
window.addEventListener('beforeunload', (e) => {
    if (activeUploads.size > 0) {
        const msg = 'You have media uploads in progress. If you leave this page, they will be cancelled.';
        e.returnValue = msg;
        return msg;
    }
});

async function deleteMessage(chatId) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
        const response = await fetch(`${API_BASE}/message/${chatId}`, {
            method: 'DELETE',
            headers: AUTH_HEADER
        });

        if (response.ok) {
            const msgEl = document.getElementById(`msg-${chatId}`);
            if (msgEl) {
                msgEl.style.transform = 'scale(0.8)';
                msgEl.style.opacity = '0';
                setTimeout(() => msgEl.remove(), 300);
            }
        } else {
            const data = await response.json();
            alert('Failed to delete message: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('Delete error:', err);
        alert('Error deleting message');
    }
}

// Fullscreen Image Functions
window.openFullscreen = function (url) {
    const modal = document.getElementById('fullscreenModal');
    const modalImg = document.getElementById('fullscreenImage');
    if (modal && modalImg) {
        modalImg.src = url;
        modal.style.display = 'flex';
    }
}

window.closeFullscreen = function () {
    const modal = document.getElementById('fullscreenModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close fullscreen on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFullscreen();
});

let replyingToMessage = null;
let forwardingMessageId = null;

window.scrollToMessage = function (chatId) {
    const el = document.getElementById(`msg-${chatId}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-flash');
        setTimeout(() => {
            el.classList.remove('highlight-flash');
        }, 2000);
    } else {
        window.showAlert('Info', 'Message not loaded in view history', 'info');
    }
};

window.replyToMessage = function (chatId) {
    closeAllContextMenus();
    const msg = currentHistory.find(m => m.chat_id === chatId);
    if (!msg) return;

    replyingToMessage = msg;
    const container = document.getElementById('reply-preview-container');
    const senderEl = document.getElementById('reply-preview-sender');
    const bodyEl = document.getElementById('reply-preview-body');

    if (container && senderEl && bodyEl) {
        const senderName = msg.direction === 'incoming' ? 'Customer' : (msg.sender_name || 'Agent');
        let previewText = msg.body;
        if (!previewText) {
            if (msg.mime_type && msg.mime_type.startsWith('image')) previewText = '📷 Photo';
            else if (msg.mime_type && msg.mime_type.startsWith('video')) previewText = '🎥 Video';
            else if (msg.mime_type && msg.mime_type.startsWith('audio')) previewText = '🎵 Audio';
            else if (msg.mime_type) previewText = '📎 Document';
            else previewText = 'Attachment';
        }
        senderEl.innerText = senderName;
        bodyEl.innerText = previewText;
        container.style.display = 'flex';
        container.classList.remove('hidden');

        if (messageInputEl) messageInputEl.focus();
    }
};

window.clearReplyPreview = function () {
    replyingToMessage = null;
    const container = document.getElementById('reply-preview-container');
    if (container) {
        container.style.display = 'none';
        container.classList.add('hidden');
    }
};

window.copyMessageText = function (chatId) {
    closeAllContextMenus();
    const msg = currentHistory.find(m => m.chat_id === chatId);
    if (!msg || !msg.body) {
        window.showAlert('Error', 'No text to copy', 'error');
        return;
    }

    navigator.clipboard.writeText(msg.body).then(() => {
        window.showAlert('Copied', 'Message text copied to clipboard', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        window.showAlert('Error', 'Failed to copy text', 'error');
    });
};

window.downloadMessageMedia = async function (chatId, mimeType) {
    closeAllContextMenus();
    try {
        const url = `${API_BASE}/media/${chatId}?token=${localStorage.getItem('token')}`;
        const extension = mimeType ? mimeType.split('/')[1] : 'bin';
        const filename = `whatsapp-media-${chatId}.${extension}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Download request failed');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error('Download failed:', err);
        window.open(`${API_BASE}/media/${chatId}?token=${localStorage.getItem('token')}`, '_blank');
    }
};

window.forwardMessage = function (chatId) {
    closeAllContextMenus();
    forwardingMessageId = chatId;
    
    // Bind listeners
    if (typeof window.initForwardAndReplyEvents === 'function') {
        window.initForwardAndReplyEvents();
    }

    const modal = document.getElementById('forward-modal');
    if (modal) {
        const searchInput = document.getElementById('forward-contact-search');
        if (searchInput) searchInput.value = '';
        
        populateForwardContacts();
        
        modal.classList.remove('hidden');
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
};

window.populateForwardContacts = function (filter = '') {
    const container = document.getElementById('forward-contacts-container');
    if (!container) return;
    container.innerHTML = '';

    const searchFiltered = allCustomers.filter(c => {
        const name = (c.customer_name || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        const term = filter.toLowerCase();
        return name.includes(term) || phone.includes(term);
    });

    if (searchFiltered.length === 0) {
        container.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--whatsapp-secondary); font-size: 0.9rem;">No contacts found</div>';
        return;
    }

    searchFiltered.forEach(c => {
        const displayName = c.customer_name || c.phone;
        const initials = getInitials(c.customer_name);
        const avatarBg = getAvatarStyle(c.phone);

        const contactItem = document.createElement('div');
        contactItem.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 8px 12px; cursor: pointer; border-radius: 6px; transition: background 0.2s;';
        contactItem.onmouseover = function() { this.style.backgroundColor = 'var(--whatsapp-header)'; };
        contactItem.onmouseout = function() { this.style.backgroundColor = 'transparent'; };

        contactItem.innerHTML = `
            <input type="checkbox" class="forward-checkbox" data-phone="${c.phone}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--whatsapp-green);">
            <div class="avatar" style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; background-color: ${avatarBg}; font-size: 0.85rem;">${initials}</div>
            <div style="flex: 1; overflow: hidden;">
                <div style="font-weight: 600; font-size: 0.9rem; color: var(--whatsapp-text); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${displayName}</div>
                <div style="font-size: 0.75rem; color: var(--whatsapp-secondary);">${c.phone}</div>
            </div>
        `;

        contactItem.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = contactItem.querySelector('.forward-checkbox');
                if (cb) {
                    cb.checked = !cb.checked;
                    updateForwardButtonState();
                }
            } else {
                updateForwardButtonState();
            }
        };

        container.appendChild(contactItem);
    });

    updateForwardButtonState();
};

window.updateForwardButtonState = function () {
    const btn = document.getElementById('confirm-forward-btn');
    if (!btn) return;
    
    const checkboxes = document.querySelectorAll('.forward-checkbox:checked');
    btn.disabled = checkboxes.length === 0;
    btn.style.cursor = checkboxes.length === 0 ? 'not-allowed' : 'pointer';
    btn.style.opacity = checkboxes.length === 0 ? '0.6' : '1';
};

window.closeForwardModal = function () {
    const modal = document.getElementById('forward-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
    forwardingMessageId = null;
};

window.showContextMenu = function (event, chatId) {
    event.preventDefault();
    event.stopPropagation();

    closeAllContextMenus();

    const msg = currentHistory.find(m => m.chat_id === chatId);
    if (!msg) return;

    const menu = document.createElement('div');
    menu.className = 'whatsapp-context-menu';
    menu.id = 'whatsapp-msg-context-menu';

    const effectiveMimeType = msg.mime_type || (msg.message_type === 'image' ? 'image/jpeg' : (msg.message_type === 'video' ? 'video/mp4' : (msg.message_type === 'audio' ? 'audio/mpeg' : (msg.message_type === 'document' ? 'application/octet-stream' : null))));
    const isMedia = !!effectiveMimeType;

    menu.innerHTML = `
        <div class="context-menu-item" onclick="replyToMessage(${chatId})">
            <i class="fas fa-reply"></i> Reply
        </div>
        <div class="context-menu-item" onclick="copyMessageText(${chatId})">
            <i class="fas fa-copy"></i> Copy
        </div>
        ${isMedia ? `
        <div class="context-menu-item" onclick="downloadMessageMedia(${chatId}, '${effectiveMimeType || ''}')">
            <i class="fas fa-download"></i> Download
        </div>
        ` : ''}
        <div class="context-menu-item" onclick="forwardMessage(${chatId})">
            <i class="fas fa-share"></i> Forward
        </div>
        <div class="context-menu-item delete-item" onclick="deleteMessage(${chatId})">
            <i class="fas fa-trash-alt"></i> Delete
        </div>
    `;

    document.body.appendChild(menu);

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 180;
    
    let left = rect.left;
    if (left + menuWidth > window.innerWidth) {
        left = rect.right - menuWidth;
    }
    let top = rect.bottom + window.scrollY + 5;
    if (top + menuHeight > window.innerHeight + window.scrollY) {
        top = rect.top + window.scrollY - menuHeight - 5;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    menu.onclick = (e) => e.stopPropagation();

    setTimeout(() => {
        document.addEventListener('click', closeAllContextMenus);
    }, 0);
};

window.closeAllContextMenus = function () {
    const existingMenu = document.getElementById('whatsapp-msg-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    document.removeEventListener('click', closeAllContextMenus);
};

window.initForwardAndReplyEvents = function () {
    const closeBtn = document.getElementById('close-forward-modal-btn');
    const cancelBtn = document.getElementById('cancel-forward-btn');
    const searchInput = document.getElementById('forward-contact-search');
    const confirmBtn = document.getElementById('confirm-forward-btn');
    const closeReplyBtn = document.getElementById('reply-preview-close');

    if (closeBtn) closeBtn.onclick = closeForwardModal;
    if (cancelBtn) cancelBtn.onclick = closeForwardModal;
    if (closeReplyBtn) closeReplyBtn.onclick = clearReplyPreview;

    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        newSearchInput.addEventListener('input', (e) => {
            populateForwardContacts(e.target.value);
        });
    }

    if (confirmBtn) {
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        newConfirmBtn.onclick = async () => {
            const checkboxes = document.querySelectorAll('.forward-checkbox:checked');
            if (checkboxes.length === 0 || !forwardingMessageId) return;

            const msgToForward = currentHistory.find(m => m.chat_id === forwardingMessageId);
            if (!msgToForward) {
                closeForwardModal();
                return;
            }

            newConfirmBtn.disabled = true;
            newConfirmBtn.innerText = 'Forwarding...';

            const phones = Array.from(checkboxes).map(cb => cb.dataset.phone);
            let successCount = 0;

            const effectiveMimeType = msgToForward.mime_type || (msgToForward.message_type === 'image' ? 'image/jpeg' : (msgToForward.message_type === 'video' ? 'video/mp4' : (msgToForward.message_type === 'audio' ? 'audio/mpeg' : (msgToForward.message_type === 'document' ? 'application/octet-stream' : null))));
            const mediaUrl = msgToForward.media_url || (effectiveMimeType ? `${API_BASE}/media/${msgToForward.chat_id}?token=${localStorage.getItem('token')}` : null);

            for (const phone of phones) {
                try {
                    const payload = {
                        phone: phone,
                        is_forwarded: 1
                    };
                    if (mediaUrl) {
                        payload.mediaData = mediaUrl;
                        payload.mimeType = effectiveMimeType;
                        payload.message = msgToForward.body || '';
                    } else {
                        payload.message = msgToForward.body || '';
                    }

                    const res = await fetch(`${API_BASE}/send`, {
                        method: 'POST',
                        headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) successCount++;
                } catch (err) {
                    console.error(`Forward to ${phone} failed:`, err);
                }
            }

            window.showAlert('Forwarded', `Message forwarded to ${successCount} contact(s).`, 'success');
            closeForwardModal();

            if (activeCustomer && phones.includes(activeCustomer.phone)) {
                loadChatHistory(activeCustomer.phone);
            }
        };
    }
};

function renderMessages(history) {
    if (!messageContainerEl) return;
    messageContainerEl.innerHTML = '';

    let lastDateStr = null;

    history.forEach(msg => {
        const msgDate = new Date(msg.timestamp);

        // --- Date Divider Logic ---
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateLabel = '';
        if (msgDate.toDateString() === today.toDateString()) {
            dateLabel = 'TODAY';
        } else if (msgDate.toDateString() === yesterday.toDateString()) {
            dateLabel = 'YESTERDAY';
        } else {
            dateLabel = msgDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        if (dateLabel !== lastDateStr) {
            const dateDivider = document.createElement('div');
            dateDivider.style.display = 'flex';
            dateDivider.style.justifyContent = 'center';
            dateDivider.style.margin = '15px 0';
            dateDivider.innerHTML = `<span style="background: var(--whatsapp-bg); color: var(--whatsapp-secondary); padding: 5px 12px; border-radius: 8px; font-size: 0.8rem; text-transform: uppercase;">${dateLabel}</span>`;
            messageContainerEl.appendChild(dateDivider);
            lastDateStr = dateLabel;
        }
        // ------------------------

        const msgEl = document.createElement('div');
        msgEl.className = `message message-${msg.direction}`;
        msgEl.id = `msg-${msg.chat_id}`;

        let replyHtml = '';
        if (msg.reply_to_chat_id) {
            const repliedMsg = history.find(m => m.chat_id === msg.reply_to_chat_id);
            if (repliedMsg) {
                const senderName = repliedMsg.direction === 'incoming' ? 'Customer' : (repliedMsg.sender_name || 'Agent');
                let textPreview = repliedMsg.body;
                if (!textPreview) {
                    if (repliedMsg.mime_type && repliedMsg.mime_type.startsWith('image')) textPreview = '📷 Photo';
                    else if (repliedMsg.mime_type && repliedMsg.mime_type.startsWith('video')) textPreview = '🎥 Video';
                    else if (repliedMsg.mime_type && repliedMsg.mime_type.startsWith('audio')) textPreview = '🎵 Audio';
                    else if (repliedMsg.mime_type) textPreview = '📎 Document';
                    else textPreview = 'Attachment';
                }
                replyHtml = `
                    <div class="message-reply-preview" onclick="scrollToMessage(${msg.reply_to_chat_id})">
                        <div class="reply-sender">${senderName}</div>
                        <div class="reply-body">${textPreview}</div>
                    </div>
                `;
            }
        }

        let forwardedHtml = '';
        if (msg.is_forwarded) {
            forwardedHtml = `
                <div class="message-forwarded">
                    <i class="fas fa-share"></i> Forwarded
                </div>
            `;
        }

        let contentHtml = '';

        // Add Down-Arrow Context Menu Action
        const actionsHtml = `<div class="message-actions" onclick="showContextMenu(event, ${msg.chat_id})" title="Message Options">
            <i class="fas fa-chevron-down"></i>
        </div>`;

        const effectiveMimeType = msg.mime_type || (msg.message_type === 'image' ? 'image/jpeg' : (msg.message_type === 'video' ? 'video/mp4' : (msg.message_type === 'audio' ? 'audio/mpeg' : (msg.message_type === 'document' ? 'application/octet-stream' : null))));

        if (effectiveMimeType) {
            let proxyUrl = `${API_BASE}/media/${msg.chat_id}?token=${localStorage.getItem('token')}`;
            let mediaUrl = msg.media_url || proxyUrl;

            if (effectiveMimeType.startsWith('image')) {
                msgEl.classList.add('has-media');
                contentHtml = `
                    <div class="message-media" onclick="openFullscreen('${mediaUrl}')">
                        <img src="${mediaUrl}" alt="Attachment" 
                             crossorigin="anonymous"
                             onerror="if(this.src !== '${proxyUrl}') { console.log('Supabase load failed, falling back to proxy'); this.src='${proxyUrl}'; } else { this.src='https://placehold.co/200?text=Image+Not+Available'; }">
                        ${msg.body && msg.body !== 'Sent a image' && !msg.body.includes('http') ? `<div class="message-content">${msg.body}</div>` : ''}
                    </div>`;
            } else if (effectiveMimeType.startsWith('video')) {
                msgEl.classList.add('has-media');
                contentHtml = `
                    <div class="message-media">
                        <video controls style="max-width: 100%; border-radius: 8px;">
                            <source src="${mediaUrl}" type="${effectiveMimeType === 'video' ? 'video/mp4' : effectiveMimeType}">
                            Your browser does not support the video tag.
                        </video>
                        ${msg.body && !msg.body.includes('http') ? `<div class="message-content">${msg.body}</div>` : ''}
                    </div>`;
            } else if (effectiveMimeType.startsWith('audio')) {
                contentHtml = `
                    <div class="message-media" style="padding: 10px; background: #202c33; border-radius: 8px;">
                        <audio controls style="width: 100%;">
                            <source src="${mediaUrl}" type="${effectiveMimeType === 'audio' ? 'audio/mpeg' : effectiveMimeType}">
                        </audio>
                    </div>`;
            } else {
                contentHtml = `
                    <div class="message-media">
                        <a href="${mediaUrl}" target="_blank" class="file-attachment">
                            <i class="fas fa-file"></i>
                            <span>${msg.body || 'Attachment'}</span>
                        </a>
                    </div>`;
            }
        } else {
            contentHtml = `<div class="message-content">${msg.body || '(Empty message)'}</div>`;
        }

        let tickHtml = '';
        if (msg.direction === 'outgoing') {
            if (msg.status === 'sent') {
                tickHtml = `<i class="fas fa-check" style="margin-left: 5px; font-size: 0.75rem; color: #8696a0;"></i>`;
            } else if (msg.status === 'delivered') {
                tickHtml = `<i class="fas fa-check-double" style="margin-left: 5px; font-size: 0.75rem; color: #8696a0;"></i>`;
            } else if (msg.status === 'read') {
                tickHtml = `<i class="fas fa-check-double" style="margin-left: 5px; font-size: 0.75rem; color: #53bdeb;"></i>`;
            } else if (msg.status === 'failed') {
                tickHtml = `<i class="fas fa-exclamation-circle" style="margin-left: 5px; font-size: 0.75rem; color: #ef4444;"></i>`;
            } else {
                tickHtml = `<i class="fas fa-check" style="margin-left: 5px; font-size: 0.75rem; color: #8696a0;"></i>`;
            }
        }

        msgEl.innerHTML = `
            ${actionsHtml}
            ${msg.direction === 'outgoing' && msg.sender_name ? `<div class="message-sender">${msg.sender_name}</div>` : ''}
            ${forwardedHtml}
            ${replyHtml}
            ${contentHtml}
            <div class="message-time">
                ${msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                ${tickHtml}
            </div>
        `;

        messageContainerEl.appendChild(msgEl);
    });

    // Re-append active uploads for this phone
    if (activeCustomer) {
        activeUploads.forEach((upload, msgId) => {
            if (upload.phone === activeCustomer.phone) {
                messageContainerEl.appendChild(upload.element);
            }
        });
    }

    messageContainerEl.scrollTop = messageContainerEl.scrollHeight;
}

async function handleSend() {
    const text = messageInputEl.value.trim();
    if (!text || !activeCustomer) return;
    messageInputEl.value = '';
    messageInputEl.style.height = 'auto';

    const originalIcon = sendBtnEl.innerHTML;
    sendBtnEl.disabled = true;
    sendBtnEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';

    try {
        const payload = { phone: activeCustomer.phone, message: text };
        if (replyingToMessage) {
            payload.reply_to_chat_id = replyingToMessage.chat_id;
        }

        const response = await fetch(`${API_BASE}/send`, {
            method: 'POST',
            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            clearReplyPreview();
            loadChatHistory(activeCustomer.phone);
        } else {
            window.showAlert('Error', 'Failed to send message', 'error');
        }
    } catch (err) {
        console.error('Send error:', err);
    } finally {
        sendBtnEl.disabled = false;
        sendBtnEl.innerHTML = originalIcon;
    }
}

// Media Selection Handler
function handleMediaSelect(e) {
    const file = e.target.files[0];
    if (!file || !activeCustomer) return;

    selectedFile = file;

    if (file.type.startsWith('image/')) {
        previewImg.src = URL.createObjectURL(file);
        document.getElementById('image-preview-container').classList.remove('hidden');
        document.getElementById('file-preview-container').classList.add('hidden');
    } else {
        previewFileName.innerText = file.name;
        document.getElementById('image-preview-container').classList.add('hidden');
        document.getElementById('file-preview-container').classList.remove('hidden');
    }
    previewCaption.value = '';
    mediaPreviewModal.classList.remove('hidden');
    mediaPreviewModal.classList.add('active');
    document.body.classList.add('modal-open');

    // Reset file input so same file can be selected again
    e.target.value = '';
}

// Event Listeners Initialization
function initEventListeners() {
    sendBtnEl.onclick = handleSend;
    attachBtnEl.onclick = () => mediaInputEl.click();
    mediaInputEl.onchange = handleMediaSelect;
    mobileBackBtnEl.onclick = () => appContainerEl.classList.remove('show-chat');
    messageInputEl.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    messageInputEl.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight < 100 ? this.scrollHeight : 100) + 'px';
    });

    // Transfer Modal
    if (transferBtnEl) {
        transferBtnEl.onclick = () => {
            transferModal.classList.remove('hidden'); // legacy cleanup
            transferModal.classList.add('active');
            document.body.classList.add('modal-open');
            selectedTransferUserId = activeCustomer ? activeCustomer.assigned_to : null;
            confirmTransferBtnEl.disabled = true; // initially disabled as it matches current assignee
            salesSearchEl.value = '';
            loadSalesUsers();
        };
    }

    if (closeTransferModalBtn) {
        closeTransferModalBtn.onclick = () => {
            transferModal.classList.remove('active');
            document.body.classList.remove('modal-open');
        };
    }
    if (salesSearchEl) salesSearchEl.oninput = (e) => renderSalesList(e.target.value);
    if (confirmTransferBtnEl) confirmTransferBtnEl.onclick = handleTransfer;
    if (resolveBtnEl) resolveBtnEl.onclick = handleResolve;

    // Media Preview
    if (closePreviewBtn) {
        closePreviewBtn.onclick = () => {
            mediaPreviewModal.classList.remove('active');
            document.body.classList.remove('modal-open');
            selectedFile = null;
        };
    }
    if (sendMediaBtn) sendMediaBtn.onclick = handleSendMedia;
}

// Initialize on load
initEventListeners();

// ==========================================
// Quick Replies Implementation
// ==========================================
const qrManagerModal = document.getElementById('qr-manager-modal');
const closeQrManagerBtn = document.getElementById('close-qr-manager-btn');
const qrListView = document.getElementById('qr-list-view');
const qrEditView = document.getElementById('qr-edit-view');
const qrManagerList = document.getElementById('qr-manager-list');
const qrAddNewBtn = document.getElementById('qr-add-new-btn');
const qrSaveBtn = document.getElementById('qr-save-btn');
const qrCancelEditBtn = document.getElementById('qr-cancel-edit-btn');
const qrDeleteBtn = document.getElementById('qr-delete-btn');
const qrEditIndex = document.getElementById('qr-edit-index');
const qrEditShortcut = document.getElementById('qr-edit-shortcut');
const qrEditMessage = document.getElementById('qr-edit-message');
const menuQuickReplies = document.getElementById('menu-quick-replies');
const qrEditMedia = document.getElementById('qr-edit-media');
const qrEditMediaBtn = document.getElementById('qr-edit-media-btn');
const qrEditMediaName = document.getElementById('qr-edit-media-name');
const qrEditMediaRemove = document.getElementById('qr-edit-media-remove');
let qrSelectedFiles = [];

const quickRepliesPopover = document.getElementById('quick-replies-popover');
const qrPopoverList = document.getElementById('qr-popover-list');
const qrPopoverEditBtn = document.getElementById('qr-popover-edit-btn');

let quickReplies = [];

async function loadQuickReplies() {
    try {
        const response = await fetch(`${API_BASE}/quick-replies`, {
            headers: AUTH_HEADER
        });
        if (response.ok) {
            quickReplies = await response.json();
        }
    } catch (err) {
        console.error('Failed to load quick replies', err);
    }
}
loadQuickReplies();

async function saveQuickReplyAPI(qr) {
    try {
        const response = await fetch(`${API_BASE}/quick-replies`, {
            method: 'POST',
            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify(qr)
        });
        if (response.ok) {
            await loadQuickReplies();
            showQrList();
        } else {
            window.showAlert('Error', 'Failed to save quick reply', 'error');
        }
    } catch (err) {
        console.error('Failed to save quick reply', err);
        window.showAlert('Error', 'Failed to save quick reply', 'error');
    }
}

async function deleteQuickReplyAPI(id) {
    try {
        const response = await fetch(`${API_BASE}/quick-replies/${id}`, {
            method: 'DELETE',
            headers: AUTH_HEADER
        });
        if (response.ok) {
            await loadQuickReplies();
            showQrList();
        } else {
            window.showAlert('Error', 'Failed to delete quick reply', 'error');
        }
    } catch (err) {
        console.error('Failed to delete quick reply', err);
        window.showAlert('Error', 'Failed to delete quick reply', 'error');
    }
}

function openQrManager() {
    if (qrManagerModal) {
        qrManagerModal.classList.remove('hidden');
        qrManagerModal.classList.add('active');
        document.body.classList.add('modal-open');
        showQrList();
    }
}

function closeQrManager() {
    if (qrManagerModal) {
        qrManagerModal.classList.remove('active');
        qrManagerModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}

function renderQrManagerList() {
    if (!qrManagerList) return;
    qrManagerList.innerHTML = '';
    quickReplies.forEach((qr, index) => {
        const item = document.createElement('div');
        item.style.padding = '15px 20px';
        item.style.borderBottom = '1px solid var(--whatsapp-border)';
        item.style.cursor = 'pointer';
        item.style.position = 'relative';
        item.innerHTML = `
            <div style="font-weight: 600; font-size: 1rem; margin-bottom: 5px;">/${qr.shortcut}</div>
            <div style="color: var(--whatsapp-secondary); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 20px;">
                ${qr.media_url && qr.media_url !== '[]' ? '<i class="fas fa-paperclip" style="margin-right: 5px;"></i>' : ''}${qr.message || 'Media Reply'}
            </div>
            
            <div class="qr-item-menu-btn" style="position: absolute; right: 20px; top: 15px; padding: 5px; color: var(--whatsapp-secondary);">
                <i class="fas fa-ellipsis-v"></i>
            </div>
            
            <div class="qr-item-dropdown" style="display: none; position: absolute; right: 20px; top: 40px; background: #233138; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.5); z-index: 10; min-width: 100px;">
                <div class="qr-item-delete" style="padding: 12px 15px; color: #f15c6d; font-size: 0.9rem;">Delete</div>
            </div>
        `;

        const menuBtn = item.querySelector('.qr-item-menu-btn');
        const dropdown = item.querySelector('.qr-item-dropdown');
        const deleteBtn = item.querySelector('.qr-item-delete');

        menuBtn.onclick = (e) => {
            e.stopPropagation(); // prevent edit modal from opening

            // Hide all other dropdowns
            document.querySelectorAll('.qr-item-dropdown').forEach(d => {
                if (d !== dropdown) d.style.display = 'none';
            });

            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };

        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this quick reply?')) {
                deleteQuickReplyAPI(qr.id);
            }
        };

        // Click anywhere else to edit
        item.onclick = () => showQrEdit(index);

        qrManagerList.appendChild(item);
    });

    // Close dropdowns if clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.qr-item-menu-btn')) {
            document.querySelectorAll('.qr-item-dropdown').forEach(d => d.style.display = 'none');
        }
    });
}

function showQrList() {
    renderQrManagerList();
    qrListView.classList.remove('hidden');
    qrEditView.classList.add('hidden');
}

function showQrEdit(index = -1) {
    qrListView.classList.add('hidden');
    qrEditView.classList.remove('hidden');
    qrEditIndex.value = index;
    qrSelectedFiles = [];
    if (qrEditMedia) qrEditMedia.value = '';
    if (qrEditMediaName) qrEditMediaName.innerText = '';
    if (qrEditMediaRemove) qrEditMediaRemove.classList.add('hidden');
    if (index >= 0) {
        // use the id from db if exists, otherwise index
        qrEditShortcut.dataset.id = quickReplies[index].id || '';
        qrEditShortcut.value = quickReplies[index].shortcut;
        qrEditMessage.value = quickReplies[index].message;
        qrDeleteBtn.classList.remove('hidden');
        if (quickReplies[index].media_url && quickReplies[index].media_url !== '[]') {
            let names = [];
            try {
                let urls = JSON.parse(quickReplies[index].media_url);
                if (Array.isArray(urls)) {
                    names = urls.map(url => url.split('/').pop());
                } else {
                    names = [quickReplies[index].media_url.split('/').pop()];
                }
            } catch (e) {
                names = [quickReplies[index].media_url.split('/').pop()];
            }
            if (qrEditMediaName) qrEditMediaName.innerText = names.join(', ') || 'Attached Media';
            if (qrEditMediaRemove) qrEditMediaRemove.classList.remove('hidden');
        }
    } else {
        qrEditShortcut.dataset.id = '';
        qrEditShortcut.value = '';
        qrEditMessage.value = '';
        qrDeleteBtn.classList.add('hidden');
    }
}

function saveQrEdit() {
    const shortcut = qrEditShortcut.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const message = qrEditMessage.value.trim();
    if (!shortcut) {
        window.showAlert('Error', 'Shortcut is required', 'error');
        return;
    }
    if (!message && qrSelectedFiles.length === 0 && !qrEditMediaName.innerText) {
        window.showAlert('Error', 'Message or media is required', 'error');
        return;
    }

    if (qrSaveBtn) {
        qrSaveBtn.disabled = true;
        qrSaveBtn.innerText = 'SAVING...';
    }

    const id = qrEditShortcut.dataset.id;

    const performSave = (mediaData, mimeType) => {
        saveQuickReplyAPI({ id: id || undefined, shortcut, message, mediaData, mimeType }).finally(() => {
            if (qrSaveBtn) {
                qrSaveBtn.disabled = false;
                qrSaveBtn.innerText = 'SAVE';
            }
        });
    };

    if (qrSelectedFiles.length > 0) {
        const promises = qrSelectedFiles.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve({ data: reader.result, type: file.type });
            });
        });

        Promise.all(promises).then(results => {
            const mediaData = results.map(r => r.data);
            const mimeType = results.map(r => r.type);
            performSave(mediaData, mimeType);
        });
    } else if (!qrEditMediaName.innerText) {
        // If they removed existing media, send empty arrays
        performSave([], []);
    } else {
        // If they didn't attach new files and didn't remove existing, keep existing media in DB
        performSave();
    }
}

function deleteQrEdit() {
    const id = qrEditShortcut.dataset.id;
    if (id) {
        deleteQuickReplyAPI(id);
    } else {
        showQrList();
    }
}

function filterAndShowPopover(searchTerm) {
    const term = searchTerm.toLowerCase();
    const matches = quickReplies.filter(qr => qr.shortcut.toLowerCase().includes(term));

    if (matches.length === 0) {
        quickRepliesPopover.style.display = 'none';
        return;
    }

    qrPopoverList.innerHTML = '';
    matches.forEach(qr => {
        const item = document.createElement('div');
        item.style.padding = '12px 20px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        item.onmouseover = () => item.style.backgroundColor = '#2a3942';
        item.onmouseout = () => item.style.backgroundColor = 'transparent';
        item.innerHTML = `
            <div style="font-weight: 600; color: #e9edef; font-size: 0.95rem;">/${qr.shortcut}</div>
            <div style="color: #8696a0; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px;">
                ${qr.media_url && qr.media_url !== '[]' ? '<i class="fas fa-paperclip" style="margin-right: 5px;"></i>' : ''}${qr.message || 'Media Reply'}
            </div>
        `;
        item.onclick = async () => {
            if (qr.media_url && qr.media_url !== '[]') {
                quickRepliesPopover.style.display = 'none';
                messageInputEl.value = '';
                if (!activeCustomer) return;

                try {
                    let urls = [];
                    let types = [];
                    try {
                        urls = JSON.parse(qr.media_url);
                        types = JSON.parse(qr.media_type);
                        if (!Array.isArray(urls)) {
                            urls = [qr.media_url];
                            types = [qr.media_type];
                        }
                    } catch (e) {
                        urls = [qr.media_url];
                        types = [qr.media_type];
                    }

                    // Send text message if any
                    if (qr.message) {
                        await fetch(`${API_BASE}/send`, {
                            method: 'POST',
                            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                phone: activeCustomer.phone,
                                message: qr.message
                            })
                        });
                    }

                    // Send media messages individually
                    for (let i = 0; i < urls.length; i++) {
                        await fetch(`${API_BASE}/send`, {
                            method: 'POST',
                            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                phone: activeCustomer.phone,
                                message: '', // Caption
                                mediaData: urls[i],
                                mimeType: types[i]
                            })
                        });
                    }

                    loadChatHistory(activeCustomer.phone);
                } catch (err) {
                    console.error('Send QR media error:', err);
                    window.showAlert('Error', 'Failed to send quick reply media', 'error');
                }
            } else {
                messageInputEl.value = qr.message;
                quickRepliesPopover.style.display = 'none';
                messageInputEl.focus();
            }
        };
        qrPopoverList.appendChild(item);
    });
    quickRepliesPopover.style.display = 'block';
}

// Bind QR Events
if (menuQuickReplies) {
    menuQuickReplies.onclick = (e) => {
        e.preventDefault();
        const sidebarMenu = document.getElementById('sidebar-menu-content');
        if (sidebarMenu) sidebarMenu.style.display = 'none';
        openQrManager();
    };
}
if (closeQrManagerBtn) closeQrManagerBtn.onclick = closeQrManager;
if (qrAddNewBtn) qrAddNewBtn.onclick = () => showQrEdit(-1);
if (qrCancelEditBtn) qrCancelEditBtn.onclick = showQrList;
if (qrSaveBtn) qrSaveBtn.onclick = saveQrEdit;
if (qrDeleteBtn) qrDeleteBtn.onclick = deleteQrEdit;
if (qrPopoverEditBtn) qrPopoverEditBtn.onclick = openQrManager;

if (qrEditMediaBtn) {
    qrEditMediaBtn.onclick = (e) => {
        e.preventDefault();
        qrEditMedia.click();
    };
}
if (qrEditMedia) {
    qrEditMedia.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            qrSelectedFiles = files;
            qrEditMediaName.innerText = files.map(f => f.name).join(', ');
            qrEditMediaRemove.classList.remove('hidden');
        }
    };
}
if (qrEditMediaRemove) {
    qrEditMediaRemove.onclick = (e) => {
        e.preventDefault();
        qrSelectedFiles = [];
        qrEditMedia.value = '';
        qrEditMediaName.innerText = '';
        qrEditMediaRemove.classList.add('hidden');
    };
}

// Trigger popover when typing '/'
if (messageInputEl) {
    messageInputEl.addEventListener('input', (e) => {
        const val = e.target.value;
        const lastWord = val.split(/\s+/).pop();
        if (lastWord.startsWith('/')) {
            filterAndShowPopover(lastWord.substring(1));
        } else {
            quickRepliesPopover.style.display = 'none';
        }
    });

    messageInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            quickRepliesPopover.style.display = 'none';
        } else if (e.key === 'Enter' && !e.shiftKey && quickRepliesPopover.style.display === 'block') {
            const firstItem = qrPopoverList.firstElementChild;
            if (firstItem) {
                e.preventDefault();
                e.stopPropagation();
                firstItem.click();
            }
        }
    }, true);
}

function initResizers() {
    const resizerLeft = document.getElementById('resizer-left');
    const resizerRight = document.getElementById('resizer-right');
    const sidebarLeft = document.querySelector('.chat-sidebar');
    const sidebarRight = document.getElementById('details-sidebar');
    const appContainer = document.getElementById('app-container');

    if (!resizerLeft || !sidebarLeft || !appContainer) return;

    // Load initial saved widths if any
    const savedLeftWidth = localStorage.getItem('whatsapp_sidebar_left_width');
    if (savedLeftWidth) {
        sidebarLeft.style.width = savedLeftWidth + 'px';
    }
    const savedRightWidth = localStorage.getItem('whatsapp_sidebar_right_width');
    if (savedRightWidth && sidebarRight) {
        sidebarRight.style.width = savedRightWidth + 'px';
    }

    // Left Resizer
    resizerLeft.addEventListener('mousedown', initDragLeft);

    function initDragLeft(e) {
        e.preventDefault();
        document.addEventListener('mousemove', dragLeft);
        document.addEventListener('mouseup', stopDragLeft);
        resizerLeft.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
    }

    function dragLeft(e) {
        const containerRect = appContainer.getBoundingClientRect();
        let newWidth = e.clientX - containerRect.left;
        if (newWidth < 240) newWidth = 240;
        if (newWidth > 600) newWidth = 600;
        sidebarLeft.style.width = newWidth + 'px';
    }

    function stopDragLeft() {
        document.removeEventListener('mousemove', dragLeft);
        document.removeEventListener('mouseup', stopDragLeft);
        resizerLeft.classList.remove('dragging');
        document.body.style.cursor = '';
        localStorage.setItem('whatsapp_sidebar_left_width', sidebarLeft.getBoundingClientRect().width);
    }

    // Right Resizer
    if (resizerRight && sidebarRight) {
        resizerRight.addEventListener('mousedown', initDragRight);

        function initDragRight(e) {
            e.preventDefault();
            document.addEventListener('mousemove', dragRight);
            document.addEventListener('mouseup', stopDragRight);
            resizerRight.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
        }

        function dragRight(e) {
            const containerRect = appContainer.getBoundingClientRect();
            let newWidth = containerRect.right - e.clientX;
            if (newWidth < 240) newWidth = 240;
            if (newWidth > 600) newWidth = 600;
            sidebarRight.style.width = newWidth + 'px';
        }

        function stopDragRight() {
            document.removeEventListener('mousemove', dragRight);
            document.removeEventListener('mouseup', stopDragRight);
            resizerRight.classList.remove('dragging');
            document.body.style.cursor = '';
            localStorage.setItem('whatsapp_sidebar_right_width', sidebarRight.getBoundingClientRect().width);
        }
    }
}

// ── Custom Chat Filtering Lists ────────────────────────────────────────────────────────
function loadCustomLists() {
    try {
        const stored = localStorage.getItem('whatsapp_custom_lists');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Failed to load custom lists:', e);
        return [];
    }
}

function saveCustomLists(lists) {
    try {
        localStorage.setItem('whatsapp_custom_lists', JSON.stringify(lists));
    } catch (e) {
        console.error('Failed to save custom lists:', e);
    }
}

function populateListContacts() {
    const container = document.getElementById('list-contacts-container');
    if (!container) return;

    let html = '';
    const activeCustomers = (allCustomers || []).filter(c => !['converted', 'closed', 'lost'].includes(c.status));

    if (activeCustomers.length === 0) {
        container.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--whatsapp-secondary); font-size: 0.85rem;">No active contacts found.</div>';
        return;
    }

    activeCustomers.forEach(c => {
        const name = c.customer_name || c.phone;
        html += `
            <label class="contact-checkbox-item" style="display: flex; align-items: center; gap: 10px; padding: 8px 5px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <input type="checkbox" value="${c.phone}" class="list-contact-check" style="cursor: pointer; width: 16px; height: 16px;">
                <span style="font-size: 0.9rem; color: var(--whatsapp-text);">${name} <small style="color: var(--whatsapp-secondary); margin-left: 5px;">(${c.phone})</small></span>
            </label>
        `;
    });

    container.innerHTML = html;

    // Bind change listener to checkboxes for validation
    container.querySelectorAll('.list-contact-check').forEach(cb => {
        cb.addEventListener('change', validateNewListForm);
    });

    const searchInput = document.getElementById('list-contact-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            container.querySelectorAll('.contact-checkbox-item').forEach(item => {
                const text = item.innerText.toLowerCase();
                if (text.includes(term)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
}

function validateNewListForm() {
    const name = document.getElementById('new-list-name').value.trim();
    const checkedCount = document.querySelectorAll('.list-contact-check:checked').length;
    const saveBtn = document.getElementById('save-list-modal-btn');

    if (name && checkedCount > 0) {
        saveBtn.disabled = false;
        saveBtn.style.background = 'var(--whatsapp-green)';
        saveBtn.style.color = 'white';
        saveBtn.style.cursor = 'pointer';
    } else {
        saveBtn.disabled = true;
        saveBtn.style.background = '#2a3942';
        saveBtn.style.color = '#8696a0';
        saveBtn.style.cursor = 'not-allowed';
    }
}

// Bind custom list modal event listeners immediately as script loads
const modal = document.getElementById('custom-list-modal');
const closeBtn = document.getElementById('close-list-modal-btn');
const cancelBtn = document.getElementById('cancel-list-modal-btn');
const saveBtn = document.getElementById('save-list-modal-btn');
const nameInput = document.getElementById('new-list-name');
const addPeopleTrigger = document.getElementById('add-people-trigger');
const selectorContainer = document.getElementById('contact-selector-container');

if (modal && closeBtn && saveBtn && nameInput) {
    const hideModal = () => {
        modal.classList.remove('active');
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    };

    closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);

    nameInput.addEventListener('input', validateNewListForm);

    if (addPeopleTrigger && selectorContainer) {
        addPeopleTrigger.addEventListener('click', () => {
            selectorContainer.classList.toggle('hidden');
        });
    }

    saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) return;

        const checkedBoxes = document.querySelectorAll('.list-contact-check:checked');
        const phones = Array.from(checkedBoxes).map(cb => cb.value);
        if (phones.length === 0) return;

        const lists = loadCustomLists();
        const newList = {
            id: 'list_' + Date.now(),
            name: name,
            phones: phones
        };
        lists.push(newList);
        saveCustomLists(lists);

        hideModal();

        // Auto-select the newly created list and update views
        currentTab = newList.id;
        renderSidebarTabs();
        renderCustomerList();
    });
}

// Toggle three-dot sidebar menu
const sidebarMenuBtn = document.getElementById('sidebar-menu-btn');
const sidebarMenuContent = document.getElementById('sidebar-menu-content');
if (sidebarMenuBtn && sidebarMenuContent) {
    sidebarMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const show = sidebarMenuContent.style.display === 'none' || sidebarMenuContent.style.display === '';
        sidebarMenuContent.style.display = show ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
        if (!sidebarMenuBtn.contains(e.target)) {
            sidebarMenuContent.style.display = 'none';
        }
    });
}
