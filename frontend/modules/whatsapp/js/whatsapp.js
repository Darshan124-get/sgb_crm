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
const chatHistoryCache = new Map();
const activeHistoryFetches = new Set();
let scrollUnreadCount = 0;

// Session Storage Persistence Helpers
function saveCacheToSession() {
    try {
        const cacheObj = {};
        chatHistoryCache.forEach((value, key) => {
            cacheObj[key] = value;
        });
        sessionStorage.setItem('wa_chat_history_cache', JSON.stringify(cacheObj));
    } catch (e) {
        console.error('Failed to save chat cache to sessionStorage:', e);
    }
}

function loadCacheFromSession() {
    try {
        const cachedData = sessionStorage.getItem('wa_chat_history_cache');
        if (cachedData) {
            const cacheObj = JSON.parse(cachedData);
            for (const key in cacheObj) {
                chatHistoryCache.set(key, cacheObj[key]);
            }
        }
    } catch (e) {
        console.error('Failed to load chat cache from sessionStorage:', e);
    }
}

// Background sequential preloading of chat histories with progress bar
async function preloadAllChatHistories(customers) {
    const loadingScreen = document.getElementById('whatsapp-loading-screen');
    const loadingBar = document.getElementById('whatsapp-loading-bar');
    const loadingText = document.getElementById('whatsapp-loading-text');

    if (loadingBar) loadingBar.style.width = '100%';
    if (loadingText) loadingText.innerText = 'Ready!';
    setTimeout(fadeOutLoadingScreen, 200);
}

function fadeOutLoadingScreen() {
    const loadingScreen = document.getElementById('whatsapp-loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

async function loadChatHistoryInBackground(phone) {
    if (chatHistoryCache.has(phone) || activeHistoryFetches.has(phone)) return;
    activeHistoryFetches.add(phone);
    try {
        const response = await fetch(`${API_BASE}/history/${phone}?t=${Date.now()}`, { headers: AUTH_HEADER });
        if (response.ok) {
            const history = await response.json();
            chatHistoryCache.set(phone, history);
            saveCacheToSession();
            
            // If the user selected this chat while it was preloading, render it
            if (activeCustomer && activeCustomer.phone === phone && (!currentHistory || currentHistory.length === 0)) {
                currentHistory = history;
                renderMessages(history);
            }
        }
    } catch (err) {
        console.error('Background preloading failed for:', phone, err);
    } finally {
        activeHistoryFetches.delete(phone);
    }
}

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
    // Restore cache from browser session storage
    loadCacheFromSession();

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

    // Refresh customer list every 10 seconds if page is visible
    setInterval(() => {
        if (!document.hidden) {
            loadCustomers();
        }
    }, 10000);

    // Polling for new messages in active chat every 10 seconds if page is visible
    setInterval(() => {
        if (!document.hidden && activeCustomer) {
            loadChatHistory(activeCustomer.phone, true);
        }
    }, 10000);

    // Search Filtering
    if (searchInputEl) {
        searchInputEl.addEventListener('input', () => {
            renderCustomerList();
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

    const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : {};
    const currentUserId = currentUser.id || currentUser.user_id;
    const role = (currentUser.role || '').toLowerCase();
    const isAdminOrManager = role.includes('admin') || role.includes('whatsapp_manager') || role.includes('manager');

    // Total active customers count
    const totalCount = (allCustomers || []).length;

    // Calculate unread count
    const unreadCount = (allCustomers || []).filter(c => {
        return parseInt(c.unread_msg_count || 0) > 0;
    }).length;

    // Calculate handoff count
    const handoffCustomers = (allCustomers || []).filter(c => 
        c.status === 'human_needed' || 
        c.lead_status === 'human_needed' || 
        c.session_status === 'paused_for_human'
    );
    const myHandoffs = handoffCustomers.filter(c => String(c.assigned_to) === String(currentUserId));
    const handoffCount = isAdminOrManager ? handoffCustomers.length : myHandoffs.length;

    const isCampaignActive = activeCampaigns.some(camp => camp.tag_line === currentTab);
    const customLists = loadCustomLists();
    const isCustomListActive = customLists.some(list => list.id === currentTab) || currentTab === 'undefined' || currentTab === 'resolved';
    const isHandoffActive = currentTab === 'handoff' || currentTab === 'my_handoff';

    let html = `
        <div class="tab-item ${currentTab === 'all' ? 'active' : ''}" data-tab="all">All <span id="all-unread-count" style="margin-left: 4px;">${totalCount}</span></div>
        <div class="tab-item ${currentTab === 'unviewed' ? 'active' : ''}" data-tab="unviewed">Unread <span id="unread-count" style="margin-left: 4px;">${unreadCount}</span></div>
        <div class="tab-item ${isHandoffActive ? 'active' : ''}" data-tab="${isAdminOrManager ? 'handoff' : 'my_handoff'}" id="tab-handoff-pill" style="${isHandoffActive ? 'color: #ef4444; border-color: #ef4444; background: #fef2f2;' : 'color: #ef4444; border-color: #fca5a5;'} font-weight: 700;">
            Handoff <span id="handoff-pill-count" style="margin-left: 4px; font-weight: 800;">${handoffCount}</span>
        </div>
        
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

function updateHandoffCounts() {
    if (!Array.isArray(allCustomers)) return;
    const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : {};
    const currentUserId = currentUser.id || currentUser.user_id;
    const role = (currentUser.role || '').toLowerCase();
    const isAdminOrManager = role.includes('admin') || role === 'whatsapp_manager';

    const btnTopHandoff = document.getElementById('btn-top-handoff');
    if (btnTopHandoff) {
        btnTopHandoff.style.display = isAdminOrManager ? 'inline-flex' : 'none';
    }

    const btnTopMyHandoff = document.getElementById('btn-top-my-handoff');
    if (btnTopMyHandoff) {
        btnTopMyHandoff.style.display = isAdminOrManager ? 'none' : 'inline-flex';
    }

    const handoffCustomers = allCustomers.filter(c => 
        c.status === 'human_needed' || 
        c.lead_status === 'human_needed' || 
        c.session_status === 'paused_for_human' ||
        c.needs_human === 1 ||
        c.needs_human === true
    );

    const myHandoffs = handoffCustomers.filter(c => String(c.assigned_to) === String(currentUserId));

    const topHandoffEl = document.getElementById('top-handoff-count');
    if (topHandoffEl) topHandoffEl.textContent = handoffCustomers.length;

    const topMyHandoffEl = document.getElementById('top-my-handoff-count');
    if (topMyHandoffEl) topMyHandoffEl.textContent = myHandoffs.length;

    const handoffPillEl = document.getElementById('handoff-pill-count');
    if (handoffPillEl) handoffPillEl.textContent = handoffCustomers.length;
}

window.switchToHandoffTab = function(tabType) {
    const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : {};
    const role = (currentUser.role || '').toLowerCase();
    const isAdminOrManager = role.includes('admin') || role === 'whatsapp_manager';

    currentTab = tabType || (isAdminOrManager ? 'handoff' : 'my_handoff');
    
    // Style active top buttons
    const btnTopHandoff = document.getElementById('btn-top-handoff');
    const btnTopMyHandoff = document.getElementById('btn-top-my-handoff');
    if (btnTopHandoff) {
        btnTopHandoff.style.borderColor = currentTab === 'handoff' ? '#ef4444' : '#cbd5e1';
        btnTopHandoff.style.background = currentTab === 'handoff' ? '#fef2f2' : '#ffffff';
    }
    if (btnTopMyHandoff) {
        btnTopMyHandoff.style.borderColor = currentTab === 'my_handoff' ? '#ef4444' : '#cbd5e1';
        btnTopMyHandoff.style.background = currentTab === 'my_handoff' ? '#fef2f2' : '#ffffff';
    }

    // Highlight sidebar tab pill if container exists
    const container = document.getElementById('sidebar-tabs-container');
    if (container) {
        container.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        const pillEl = document.getElementById('tab-handoff-pill');
        if (pillEl) pillEl.classList.add('active');
    }

    renderCustomerList();
};

window.resolveHandoffChat = async function(phoneParam) {
    const phone = phoneParam || (activeCustomer ? activeCustomer.phone : null);
    if (!phone) return;

    try {
        const response = await fetch(`${window.API_URL}/chatbot/sessions/resolve-handoff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ phone: phone })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to resolve handoff');

        // Update activeCustomer and matching customer in allCustomers list
        const customer = allCustomers.find(c => c.phone === phone);
        if (customer) {
            customer.status = customer.status === 'human_needed' ? 'assigned' : customer.status;
            customer.lead_status = customer.lead_status === 'human_needed' ? 'assigned' : customer.lead_status;
            customer.session_status = null;
            customer.needs_human = false;
        }
        if (activeCustomer && activeCustomer.phone === phone) {
            activeCustomer.status = activeCustomer.status === 'human_needed' ? 'assigned' : activeCustomer.status;
            activeCustomer.lead_status = activeCustomer.lead_status === 'human_needed' ? 'assigned' : activeCustomer.lead_status;
            activeCustomer.session_status = null;
            activeCustomer.needs_human = false;

            const bannerEl = document.getElementById('handoff-action-banner');
            if (bannerEl) bannerEl.classList.add('hidden');
        }

        // Instantly update handoff counts in top bar and sidebar tabs
        updateHandoffCounts();

        if (typeof window.showAlert === 'function') {
            window.showAlert('Handoff Resolved', 'Conversation started! Chat moved to standard conversations list.', 'success');
        }

        // Re-render customer list (removes from handoff tab, shows in All tab)
        renderCustomerList();
    } catch (err) {
        console.error('Failed to resolve handoff:', err);
        if (typeof window.showAlert === 'function') {
            window.showAlert('Error', err.message || 'Failed to resolve handoff', 'error');
        }
    }
};

window.retriggerBotFromBanner = async function() {
    if (!activeCustomer || !activeCustomer.phone) return;
    if (typeof window.retriggerBotFlow === 'function') {
        await window.retriggerBotFlow(activeCustomer.phone);
        const bannerEl = document.getElementById('handoff-action-banner');
        if (bannerEl) bannerEl.classList.add('hidden');
        if (activeCustomer) {
            activeCustomer.session_status = 'active';
            activeCustomer.status = activeCustomer.status === 'human_needed' ? 'assigned' : activeCustomer.status;
            activeCustomer.needs_human = false;
        }
        updateHandoffCounts();
        renderCustomerList();
    }
};

/**
 * Fetch and Render Customer List
 */
let currentCustomersJson = '';

async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`, { headers: AUTH_HEADER });
        if (response.status === 401) return window.doLogout();
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data = await response.json();
        const dataJson = JSON.stringify(data);
        if (dataJson === currentCustomersJson) {
            // Even if data is unchanged, still check for pending phone selection on initial load
            if (window._pendingPhone) {
                const customer = data.find(c => c.phone === window._pendingPhone);
                if (customer) {
                    selectCustomer(customer);
                }
                delete window._pendingPhone;
            }
            updateHandoffCounts();
            return;
        }
        currentCustomersJson = dataJson;

        allCustomers = data;
        updateHandoffCounts();
        renderSidebarTabs(); // update unread count
        renderCustomerList();

        // Trigger background preloading of chat histories ONLY ONCE on initial load
        if (!window._hasPreloadedHistories) {
            window._hasPreloadedHistories = true;
            preloadAllChatHistories(allCustomers);
        }

        // Check if there is a pending phone to select on load/refresh
        if (window._pendingPhone) {
            const customer = allCustomers.find(c => c.phone === window._pendingPhone);
            if (customer) {
                selectCustomer(customer);
            }
            delete window._pendingPhone;
        }
    } catch (err) {
        console.error('Failed to load customers:', err);
        customerListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Connection error.</div>';
        fadeOutLoadingScreen();
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

    const searchTerm = searchInputEl ? searchInputEl.value.toLowerCase().trim() : '';

    let filtered = allCustomers.filter(customer => {
        const resolved = ['converted', 'closed', 'lost'].includes(customer.status);

        // Check if currentTab matches a custom list ID
        let matchesTab = false;
        const customLists = loadCustomLists();
        const activeList = customLists.find(l => l.id === currentTab);
        if (activeList) {
            matchesTab = !resolved && activeList.phones.includes(customer.phone);
        } else if (currentTab === 'all') {
            matchesTab = true;
        } else if (currentTab === 'resolved') {
            matchesTab = resolved;
        } else if (currentTab === 'unviewed') {
            matchesTab = parseInt(customer.unread_msg_count || 0) > 0 || (activeCustomer && activeCustomer.phone === customer.phone);
        } else if (currentTab === 'handoff' || currentTab === 'my_handoff') {
            const isHumanNeeded = customer.status === 'human_needed' || customer.lead_status === 'human_needed' || customer.session_status === 'paused_for_human';
            if (currentTab === 'my_handoff') {
                const currentUser = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : {};
                const currentUserId = currentUser.id || currentUser.user_id;
                matchesTab = isHumanNeeded && String(customer.assigned_to) === String(currentUserId);
            } else {
                matchesTab = isHumanNeeded;
            }
        } else if (currentTab === 'undefined') {
            if (resolved) {
                matchesTab = false;
            } else if (!customer.first_message) {
                matchesTab = true;
            } else {
                const normalizedFirst = customer.first_message.toLowerCase().trim();
                matchesTab = !activeCampaigns.some(camp => {
                    if (!camp.tag_line) return false;
                    const tag = camp.tag_line.toLowerCase().trim();
                    return normalizedFirst.includes(tag) || normalizedFirst === tag;
                });
            }
        } else {
            if (resolved) {
                matchesTab = false;
            } else if (!customer.first_message || !currentTab) {
                matchesTab = false;
            } else {
                const normalizedFirst = customer.first_message.toLowerCase().trim();
                const normalizedTab = currentTab.toLowerCase().trim();
                matchesTab = normalizedFirst.includes(normalizedTab) || normalizedFirst === normalizedTab;
            }
        }

        if (!matchesTab) return false;

        // Apply search filter if search term is provided
        if (searchTerm) {
            const name = (customer.customer_name || '').toLowerCase();
            const phone = (customer.phone || '').toLowerCase();
            const lastMsg = (customer.last_message || '').toLowerCase();
            return name.includes(searchTerm) || phone.includes(searchTerm) || lastMsg.includes(searchTerm);
        }

        return true;
    });

    // Sort by search relevance first, then by last_message_at DESC
    filtered.sort((a, b) => {
        if (searchTerm) {
            const aName = (a.customer_name || '').toLowerCase();
            const aPhone = (a.phone || '').toLowerCase();
            const bName = (b.customer_name || '').toLowerCase();
            const bPhone = (b.phone || '').toLowerCase();

            const aMatchNamePhone = aName.includes(searchTerm) || aPhone.includes(searchTerm);
            const bMatchNamePhone = bName.includes(searchTerm) || bPhone.includes(searchTerm);

            // Priority 1: Direct name or phone number matches come first
            if (aMatchNamePhone && !bMatchNamePhone) return -1;
            if (!aMatchNamePhone && bMatchNamePhone) return 1;

            // Priority 1.5: If both match name/phone, prioritize starting matches
            if (aMatchNamePhone && bMatchNamePhone) {
                const aStarts = aName.startsWith(searchTerm) || aPhone.startsWith(searchTerm);
                const bStarts = bName.startsWith(searchTerm) || bPhone.startsWith(searchTerm);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
            }
        }

        // Secondary / Default: Sort strictly by last_message_at DESC
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
        let tickHtml = '';
        if (customer.last_message_sender_type === 'admin') {
            const status = (customer.last_message_status || 'sent').toLowerCase();
            if (status === 'read') {
                tickHtml = `<i class="fa-solid fa-check-double" style="color: #53bdeb; font-size: 0.85rem; margin-right: 4px;" title="Read"></i>`;
            } else if (status === 'delivered') {
                tickHtml = `<i class="fa-solid fa-check-double" style="color: #94a3b8; font-size: 0.85rem; margin-right: 4px;" title="Delivered"></i>`;
            } else {
                tickHtml = `<i class="fa-solid fa-check" style="color: #94a3b8; font-size: 0.85rem; margin-right: 4px;" title="Sent"></i>`;
            }
        }
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

        const isHumanNeeded = customer.status === 'human_needed' || customer.lead_status === 'human_needed' || customer.session_status === 'paused_for_human';
        let handoffBadgeHtml = '';
        if (isHumanNeeded) {
            let waitingStr = '';
            const pausedTs = customer.paused_at || customer.updated_at;
            if (pausedTs) {
                const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(pausedTs).getTime()) / 60000));
                waitingStr = diffMinutes > 0 ? `${diffMinutes} min` : 'Just now';
            }
            handoffBadgeHtml = `<span class="score-badge" style="background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; font-weight: 800; padding: 2px 6px;">Needs Human ${waitingStr ? '• Waiting ' + waitingStr : ''}</span>`;
        }

        item.innerHTML = `
            <div class="avatar-wrap">
                <div class="avatar" style="background-color: ${color}">${initials}</div>
                ${windowBadge}
            </div>
            <div class="customer-meta">
                <div class="customer-meta-header">
                    <h3>${displayName}</h3>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <div class="customer-time" style="color: ${timeColor}; ${timeWeight}">${lastTime}</div>
                        <div class="chat-menu-trigger" onclick="event.stopPropagation(); window.showCustomerContextMenu(event, '${customer.phone}')">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <p class="last-message-snippet" style="flex: 1; min-width: 0;">${tickHtml}${lastMsg || customer.phone}</p>
                    ${hasUnread ? `<span class="unread-badge" style="background-color: var(--whatsapp-green); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1;">${customer.unread_msg_count}</span>` : ''}
                </div>
                <div class="customer-meta-footer">
                    ${handoffBadgeHtml}
                    ${scoreLabel ? `<span class="score-badge badge-${scoreClass}">${scoreLabel}</span>` : ''}
                    ${customer.assigned_name ? `<div class="assigned-badge"><i class="fas fa-user-check"></i> ${customer.assigned_name}</div>` : ''}
                </div>
            </div>
        `;
        item.oncontextmenu = (e) => {
            e.preventDefault();
            window.showCustomerContextMenu(e, customer.phone);
        };
        item.onclick = () => selectCustomer(customer);
        customerListEl.appendChild(item);
    });
}

/**
 * Select a customer
 */
async function selectCustomer(customer) {
    closeAllContextMenus();
    clearReplyPreview();
    activeCustomer = customer;

    // Reset scroll button state when changing chats
    scrollUnreadCount = 0;
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
    const scrollUnreadBadge = document.getElementById('scroll-unread-badge');
    if (scrollToBottomBtn) scrollToBottomBtn.classList.remove('show');
    if (scrollUnreadBadge) {
        scrollUnreadBadge.textContent = '0';
        scrollUnreadBadge.classList.add('hidden');
    }

    // Use cached history for instant display if available
    const cached = chatHistoryCache.get(customer.phone);
    if (cached) {
        currentHistory = cached;
        renderMessages(cached);
    } else {
        currentHistory = [];
        if (messageContainerEl) {
            messageContainerEl.innerHTML = '<div class="loading-spinner" style="padding: 20px; text-align: center; color: var(--whatsapp-secondary);">Loading messages...</div>';
        }
    }

    // Update URL query parameters without reloading
    const newUrl = `${window.location.pathname}?phone=${customer.phone}`;
    window.history.replaceState(null, '', newUrl);

    // UI Transitions
    chatWelcomeEl.classList.add('hidden');
    chatWindowEl.classList.remove('hidden');
    
    const resizerRight = document.getElementById('resizer-right');
    if (window._detailsCollapsed) {
        detailsSidebarEl.classList.add('hidden');
        if (resizerRight) resizerRight.classList.add('hidden');
    } else {
        detailsSidebarEl.classList.remove('hidden');
        if (resizerRight) resizerRight.classList.remove('hidden');
    }
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

    // Handoff Action Banner
    const isHumanNeeded = customer.status === 'human_needed' || customer.lead_status === 'human_needed' || customer.session_status === 'paused_for_human' || customer.needs_human === 1 || customer.needs_human === true;
    const handoffBanner = document.getElementById('handoff-action-banner');
    const handoffBannerText = document.getElementById('handoff-banner-text');
    if (handoffBanner) {
        if (isHumanNeeded) {
            let waitingStr = '';
            const pausedTs = customer.paused_at || customer.updated_at;
            if (pausedTs) {
                const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(pausedTs).getTime()) / 60000));
                waitingStr = diffMinutes > 0 ? `${diffMinutes} min` : 'Just now';
            }
            if (handoffBannerText) {
                handoffBannerText.textContent = `🚨 Customer requested Human Handoff ${waitingStr ? '• Waiting ' + waitingStr : ''}`;
            }
            handoffBanner.classList.remove('hidden');
        } else {
            handoffBanner.classList.add('hidden');
        }
    }

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
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    }
    renderCustomerList();

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
    if (activeHistoryFetches.has(phone)) return;
    activeHistoryFetches.add(phone);
    try {
        const response = await fetch(`${API_BASE}/history/${phone}?t=${Date.now()}`, { headers: AUTH_HEADER });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const history = await response.json();
        
        // Save to cache for future transitions
        chatHistoryCache.set(phone, history);
        saveCacheToSession();

        // Update UI only if this is still the active customer chat
        if (activeCustomer && activeCustomer.phone === phone) {
            // Avoid re-rendering if history hasn't changed (for both polling and manual switching)
            if (JSON.stringify(history) === JSON.stringify(currentHistory)) return;
            currentHistory = history;
            renderMessages(history);
        }
    } catch (err) {
        console.error('Failed to load history:', err);
    } finally {
        activeHistoryFetches.delete(phone);
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

    // Allow sending media when pressing Enter inside the caption input
    previewCaption.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSendMedia();
        }
    };

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
    const isVisual = mimeType.startsWith('image/') || mimeType.startsWith('video/');

    if (mimeType.startsWith('image/')) {
        mediaPreview = `<img src="${URL.createObjectURL(file)}" alt="Uploading..." style="opacity: 0.6; border-radius: 8px; display: block; max-width: 100%;">`;
    } else if (mimeType.startsWith('video/')) {
        mediaPreview = `<video src="${URL.createObjectURL(file)}" style="opacity: 0.6; max-width: 100%; border-radius: 8px; display: block;"></video>`;
    } else {
        mediaPreview = `<div style="padding: 12px; background: rgba(0,0,0,0.05); border-radius: 8px; display: flex; align-items: center; gap: 10px; font-weight: 500;"><i class="fas fa-file-alt" style="font-size: 1.5rem; color: #128C7E;"></i> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${fileName}</span></div>`;
    }

    let overlayHTML = '';
    if (isVisual) {
        overlayHTML = `
            <div class="upload-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.55); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; backdrop-filter: blur(2px); transition: all 0.3s ease; border-radius: 8px;">
                <div class="progress-container" style="position: relative; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">
                    <svg width="60" height="60" style="transform: rotate(-90deg);">
                        <circle cx="30" cy="30" r="26" stroke="rgba(255,255,255,0.2)" stroke-width="4" fill="transparent" />
                        <circle class="progress-ring-circle" cx="30" cy="30" r="26" stroke="#25D366" stroke-width="4" fill="transparent" 
                                stroke-dasharray="163.36" stroke-dashoffset="163.36" style="transition: stroke-dashoffset 0.1s ease; stroke-linecap: round;" />
                    </svg>
                    <span class="upload-percent" style="position: absolute; color: white; font-size: 0.85rem; font-weight: 600; font-family: sans-serif;">0%</span>
                </div>
                <div class="upload-status" style="margin-top: 8px; color: rgba(255,255,255,0.9); font-size: 0.8rem; font-weight: 500; letter-spacing: 0.5px;">Uploading...</div>
            </div>
        `;
    } else {
        overlayHTML = `
            <div class="upload-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: space-between; padding: 0 15px; z-index: 10; transition: all 0.3s ease; border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 10px; color: white; font-size: 0.85rem; width: 100%;">
                    <div class="progress-container" style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg width="32" height="32" style="transform: rotate(-90deg);">
                            <circle cx="16" cy="16" r="13" stroke="rgba(255,255,255,0.2)" stroke-width="3" fill="transparent" />
                            <circle class="progress-ring-circle" cx="16" cy="16" r="13" stroke="#25D366" stroke-width="3" fill="transparent" 
                                    stroke-dasharray="81.68" stroke-dashoffset="81.68" style="transition: stroke-dashoffset 0.1s ease; stroke-linecap: round;" />
                        </svg>
                        <span class="upload-percent" style="position: absolute; color: white; font-size: 0.65rem; font-weight: 600; font-family: sans-serif;">0%</span>
                    </div>
                    <span class="upload-status" style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Uploading...</span>
                </div>
            </div>
        `;
    }

    msgEl.innerHTML = `
        <div class="message-media" style="position: relative; overflow: hidden; border-radius: 8px;">
            ${mediaPreview}
            ${overlayHTML}
            ${caption ? `<div class="message-content" style="opacity: 0.7; padding: 8px 12px; background: rgba(0,0,0,0.02); border-top: 1px solid rgba(0,0,0,0.05);">${caption}</div>` : ''}
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
                const ringCircle = msgEl.querySelector('.progress-ring-circle');
                const statusEl = msgEl.querySelector('.upload-status');
                
                if (ringCircle) {
                    const circumference = isVisual ? 163.36 : 81.68;
                    const offset = circumference - (percentComplete / 100) * circumference;
                    ringCircle.style.strokeDashoffset = offset;
                }
                
                if (percentEl) {
                    percentEl.innerText = `${percentComplete}%`;
                }

                if (statusEl) {
                    if (percentComplete === 100) {
                        statusEl.innerText = 'Processing...';
                    } else {
                        statusEl.innerText = 'Uploading...';
                    }
                }
            }
        };

        xhr.onload = () => {
            activeUploads.delete(msgId); // Remove from global tracking
            if (xhr.status >= 200 && xhr.status < 300) {
                const overlay = msgEl.querySelector('.upload-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 300);
                }
                const timeEl = msgEl.querySelector('.message-time');
                if (timeEl) timeEl.innerText = 'Sent';

                // If they are still in the same chat, reload history to get the real message
                if (activeCustomer && activeCustomer.phone === phone) {
                    setTimeout(() => {
                        loadChatHistory(phone);
                        currentCustomersJson = '';
                        loadCustomers();
                    }, 500);
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
            if (overlay) {
                if (isVisual) {
                    overlay.innerHTML = `
                        <div style="background: rgba(239, 68, 68, 0.15); padding: 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid #ef4444; width: 48px; height: 48px;">
                            <i class="fas fa-exclamation-triangle" style="color: #ef4444; font-size: 1.4rem;"></i>
                        </div>
                        <div style="margin-top: 8px; color: #ef4444; font-size: 0.8rem; font-weight: 600;">Upload Failed</div>
                    `;
                } else {
                    overlay.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px; color: #ef4444; font-size: 0.85rem; font-weight: 600;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Upload Failed</span>
                        </div>
                    `;
                }
            }
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

    const effectiveMimeType = msg.mime_type || (msg.message_type === 'image' ? 'image/jpeg' : (msg.message_type === 'video' ? 'video/mp4' : ((msg.message_type === 'audio' || msg.message_type === 'voice') ? 'audio/mpeg' : (msg.message_type === 'document' ? 'application/octet-stream' : null))));
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
    const existingMsgMenu = document.getElementById('whatsapp-msg-context-menu');
    if (existingMsgMenu) {
        existingMsgMenu.remove();
    }
    const existingCustMenu = document.getElementById('whatsapp-customer-context-menu');
    if (existingCustMenu) {
        existingCustMenu.remove();
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

            const effectiveMimeType = msgToForward.mime_type || (msgToForward.message_type === 'image' ? 'image/jpeg' : (msgToForward.message_type === 'video' ? 'video/mp4' : ((msgToForward.message_type === 'audio' || msgToForward.message_type === 'voice') ? 'audio/mpeg' : (msgToForward.message_type === 'document' ? 'application/octet-stream' : null))));
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

    const existingMessageCount = messageContainerEl.querySelectorAll('.message').length;

    // Determine if we should scroll to bottom after rendering
    const isAtBottom = messageContainerEl.scrollHeight - messageContainerEl.scrollTop - messageContainerEl.clientHeight < 150;
    const isFirstLoad = messageContainerEl.querySelector('.loading-spinner') !== null || messageContainerEl.innerHTML === '';

    // If new messages arrived while user was scrolled up, increment unread badge
    if (history.length > existingMessageCount && !isAtBottom && !isFirstLoad) {
        const diff = history.length - existingMessageCount;
        scrollUnreadCount += diff;
        const scrollUnreadBadge = document.getElementById('scroll-unread-badge');
        if (scrollUnreadBadge) {
            scrollUnreadBadge.textContent = scrollUnreadCount;
            scrollUnreadBadge.classList.remove('hidden');
        }
    }

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

        const effectiveMimeType = msg.mime_type || (msg.message_type === 'image' ? 'image/jpeg' : (msg.message_type === 'video' ? 'video/mp4' : ((msg.message_type === 'audio' || msg.message_type === 'voice') ? 'audio/mpeg' : (msg.message_type === 'document' ? 'application/octet-stream' : null))));

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
                    <div class="message-media" style="padding: 10px; background: #202c33; border-radius: 8px; min-width: 280px; width: 100%;">
                        <audio controls style="width: 100%; display: block; outline: none;">
                            <source src="${mediaUrl}" type="${effectiveMimeType === 'audio' || effectiveMimeType === 'voice' ? 'audio/mpeg' : effectiveMimeType}">
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
            const formattedText = (msg.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
            contentHtml = `<div class="message-content" style="white-space: pre-wrap; word-break: break-word; line-height: 1.45;">${formattedText || '(Empty message)'}</div>`;
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

        let senderTagHtml = '';
        if (msg.direction === 'outgoing') {
            const isBot = msg.sender_name === 'Chatbot' || msg.is_bot === true || msg.is_bot === 1;
            if (isBot) {
                senderTagHtml = `<div class="message-sender" style="font-size: 0.72rem; font-weight: 700; color: #3b82f6; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;"><i class="fas fa-robot" style="font-size: 0.75rem;"></i> Chatbot</div>`;
            } else if (msg.sender_name && msg.sender_name !== 'Staff') {
                senderTagHtml = `<div class="message-sender" style="font-size: 0.72rem; font-weight: 700; color: #008069; margin-bottom: 3px;">${msg.sender_name}</div>`;
            }
        }

        msgEl.innerHTML = `
            ${actionsHtml}
            ${senderTagHtml}
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

    if (isFirstLoad || isAtBottom) {
        messageContainerEl.scrollTop = messageContainerEl.scrollHeight;
    }
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

            // Clear handoff state locally if customer was in handoff
            if (activeCustomer) {
                const wasHandoff = activeCustomer.status === 'human_needed' || activeCustomer.lead_status === 'human_needed' || activeCustomer.session_status === 'paused_for_human' || activeCustomer.needs_human;
                if (wasHandoff) {
                    activeCustomer.status = activeCustomer.status === 'human_needed' ? 'assigned' : activeCustomer.status;
                    activeCustomer.lead_status = activeCustomer.lead_status === 'human_needed' ? 'assigned' : activeCustomer.lead_status;
                    activeCustomer.session_status = null;
                    activeCustomer.needs_human = false;

                    const matchingInList = allCustomers.find(c => c.phone === activeCustomer.phone);
                    if (matchingInList) {
                        matchingInList.status = activeCustomer.status;
                        matchingInList.lead_status = activeCustomer.lead_status;
                        matchingInList.session_status = null;
                        matchingInList.needs_human = false;
                    }

                    const bannerEl = document.getElementById('handoff-action-banner');
                    if (bannerEl) bannerEl.classList.add('hidden');

                    updateHandoffCounts();
                }
            }

            loadChatHistory(activeCustomer.phone);
            currentCustomersJson = '';
            loadCustomers();
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

function handleMediaSelect(e) {
    const file = e.target.files[0];
    if (!file || !activeCustomer) return;

    // Enforce Meta file size limits
    const fileSizeMB = file.size / (1024 * 1024);
    let maxLimit = 16; // default 16MB for audio/video
    let typeLabel = 'File';
    
    if (file.type.startsWith('image/')) {
        maxLimit = 5;
        typeLabel = 'Image';
    } else if (file.type.startsWith('audio/')) {
        maxLimit = 16;
        typeLabel = 'Audio';
    } else if (file.type.startsWith('video/')) {
        maxLimit = 16;
        typeLabel = 'Video';
    } else {
        maxLimit = 100; // documents
        typeLabel = 'Document';
    }

    if (fileSizeMB > maxLimit) {
        window.showAlert('Error', `${typeLabel} is too large. Max limit is ${maxLimit}MB.`, 'error');
        e.target.value = '';
        return;
    }

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
    
    // Auto-focus caption input for immediate typing or sending
    setTimeout(() => {
        previewCaption.focus();
    }, 50);

    // Reset file input so same file can be selected again
    e.target.value = '';
}

// Event Listeners Initialization
function initEventListeners() {
    sendBtnEl.onclick = handleSend;
    attachBtnEl.onclick = () => mediaInputEl.click();
    mediaInputEl.onchange = handleMediaSelect;
    mobileBackBtnEl.onclick = () => {
        appContainerEl.classList.remove('show-chat');
        activeCustomer = null;
        renderCustomerList();
    };
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
        item.style.borderBottom = '1px solid var(--whatsapp-border)';
        item.onmouseover = () => item.style.backgroundColor = 'var(--whatsapp-border)';
        item.onmouseout = () => item.style.backgroundColor = 'transparent';
        item.innerHTML = `
            <div style="font-weight: 600; color: var(--whatsapp-text); font-size: 0.95rem;">/${qr.shortcut}</div>
            <div style="color: var(--whatsapp-secondary); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px;">
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
            // Check file sizes against Meta limitations
            for (const file of files) {
                const fileSizeMB = file.size / (1024 * 1024);
                let maxLimit = 16;
                let typeLabel = 'File';
                
                if (file.type.startsWith('image/')) {
                    maxLimit = 5;
                    typeLabel = 'Image';
                } else if (file.type.startsWith('audio/')) {
                    maxLimit = 16;
                    typeLabel = 'Audio';
                } else if (file.type.startsWith('video/')) {
                    maxLimit = 16;
                    typeLabel = 'Video';
                } else {
                    maxLimit = 100;
                    typeLabel = 'Document';
                }

                if (fileSizeMB > maxLimit) {
                    window.showAlert('Error', `"${file.name}" (${typeLabel}) is too large. Max limit is ${maxLimit}MB.`, 'error');
                    qrEditMedia.value = '';
                    qrSelectedFiles = [];
                    qrEditMediaName.innerText = '';
                    qrEditMediaRemove.classList.add('hidden');
                    return;
                }
            }
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

// Scroll-to-bottom event listeners
if (messageContainerEl) {
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
    const scrollUnreadBadge = document.getElementById('scroll-unread-badge');

    messageContainerEl.addEventListener('scroll', () => {
        const threshold = 300; // Show if scrolled up by more than 300px
        const distanceToBottom = messageContainerEl.scrollHeight - messageContainerEl.scrollTop - messageContainerEl.clientHeight;
        
        if (distanceToBottom > threshold) {
            if (scrollToBottomBtn) scrollToBottomBtn.classList.add('show');
        } else {
            if (scrollToBottomBtn) scrollToBottomBtn.classList.remove('show');
            if (distanceToBottom < 50) {
                scrollUnreadCount = 0;
                if (scrollUnreadBadge) {
                    scrollUnreadBadge.textContent = '0';
                    scrollUnreadBadge.classList.add('hidden');
                }
            }
        }
    });

    if (scrollToBottomBtn) {
        scrollToBottomBtn.addEventListener('click', () => {
            messageContainerEl.scrollTo({
                top: messageContainerEl.scrollHeight,
                behavior: 'smooth'
            });
            scrollUnreadCount = 0;
            if (scrollUnreadBadge) {
                scrollUnreadBadge.textContent = '0';
                scrollUnreadBadge.classList.add('hidden');
            }
        });
    }
}

// Customer List Right-click & Dropdown Context Menu logic
window.showCustomerContextMenu = function (event, customerPhone) {
    event.preventDefault();
    closeAllContextMenus();

    const menu = document.createElement('div');
    menu.className = 'whatsapp-context-menu';
    menu.id = 'whatsapp-customer-context-menu';

    menu.innerHTML = `
        <div class="context-menu-item" onclick="markCustomerAsUnread('${customerPhone}')">
            <i class="fas fa-envelope" style="margin-right: 8px;"></i> Mark as unread
        </div>
    `;

    document.body.appendChild(menu);

    // Position the menu
    const menuWidth = 160;
    const menuHeight = 45;
    let left = event.pageX;
    let top = event.pageY;

    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
    }
    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.display = 'block';

    // Prevent propagation so document listener doesn't immediately close it
    event.stopPropagation();

    setTimeout(() => {
        document.addEventListener('click', closeAllContextMenus);
    }, 10);
};

window.markCustomerAsUnread = async function (phone) {
    try {
        const response = await fetch(`${API_BASE}/customers/${phone}/unread`, {
            method: 'PUT',
            headers: AUTH_HEADER
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        // Update local memory and re-render sidebar view
        const customer = allCustomers.find(c => c.phone === phone);
        if (customer) {
            customer.unread_msg_count = 1;
            renderSidebarTabs();
            renderCustomerList();
        }
    } catch (err) {
        console.error('Failed to mark as unread:', err);
    }
};

// Sidebar Toggle States & Handlers
window._sidebarLeftCollapsed = false;
window._detailsCollapsed = true;

window.toggleLeftSidebar = function () {
    const sidebarLeft = document.querySelector('.chat-sidebar');
    const resizerLeft = document.getElementById('resizer-left');
    
    if (sidebarLeft) {
        const isCollapsed = sidebarLeft.classList.toggle('hidden');
        if (resizerLeft) {
            if (isCollapsed) resizerLeft.classList.add('hidden');
            else resizerLeft.classList.remove('hidden');
        }
        window._sidebarLeftCollapsed = isCollapsed;
    }
};

window.toggleRightSidebar = function () {
    const sidebarRight = document.getElementById('details-sidebar');
    const resizerRight = document.getElementById('resizer-right');
    
    if (sidebarRight) {
        const isCollapsed = sidebarRight.classList.toggle('hidden');
        if (resizerRight) {
            if (isCollapsed) resizerRight.classList.add('hidden');
            else resizerRight.classList.remove('hidden');
        }
        window._detailsCollapsed = isCollapsed;
    }
};
