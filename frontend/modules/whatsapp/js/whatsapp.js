/**
 * WhatsApp Module Logic - SGB Agro CRM
 */

// Configuration
const API_BASE = `${window.API_URL}/whatsapp`;
const LEAD_API_BASE = `${window.API_URL}/leads`;
const USER_API_BASE = `${window.API_URL}/users`; // Assuming there's a users endpoint for sales people
// Auth Guard
if (typeof window.requireAuth === 'function') {
    if (!window.requireAuth(['admin', 'super-admin', 'sales', 'billing'])) {
        // Redirect handled by requireAuth
    }
}

const AUTH_HEADER = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };

let activeCustomer = null;
let currentHistory = [];
let allCustomers = [];
let currentTab = 'open';
let salesUsers = [];

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
 * Initialize
 */
document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard
    if (!window.requireAuth(['admin', 'sales'])) return;

    loadCustomers();
    loadSalesUsers();
    
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

    // Tab Switching Logic
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderCustomerList();
        });
    });

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

/**
 * Fetch and Render Customer List
 */
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`, { headers: AUTH_HEADER });
        if (response.status === 401) return window.doLogout();
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        allCustomers = await response.json();
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

    const user = window.getCurrentUser();
    const userId = user.id;
    const userRole = (user.role || '').toLowerCase();

    let filtered = allCustomers.filter(customer => {
        const status = (customer.status || '').toLowerCase();
        const assignedTo = customer.assigned_to;

        if (currentTab === 'closed') {
            return ['converted', 'lost', 'not_interested'].includes(status);
        } else if (currentTab === 'assigned') {
            return assignedTo === userId && !['converted', 'lost', 'not_interested'].includes(status);
        } else {
            if (userRole === 'admin') return !['converted', 'lost', 'not_interested'].includes(status);
            return (assignedTo === null || assignedTo === undefined) && !['converted', 'lost', 'not_interested'].includes(status);
        }
    });

    if (filtered.length === 0) {
        customerListEl.innerHTML = `<div style="padding: 40px 20px; text-align: center; color: #8696a0; font-size: 0.9rem;">No ${currentTab} conversations.</div>`;
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
            if (!isNaN(date.getTime())) lastTime = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        
        const item = document.createElement('div');
        item.className = `customer-item ${activeCustomer && activeCustomer.phone === customer.phone ? 'active' : ''}`;
        item.dataset.phone = customer.phone;
        
        const lastMsg = customer.last_message || '';
        const scoreClass = (customer.score || 'cold').toLowerCase();
        const scoreLabel = customer.score ? customer.score.toUpperCase() : '';

        item.innerHTML = `
            <div class="avatar" style="background-color: ${color}">${initials}</div>
            <div class="customer-meta">
                <div class="customer-meta-header">
                    <h3>${displayName}</h3>
                    <div class="customer-time">${lastTime}</div>
                </div>
                <p class="last-message-snippet">${lastMsg || customer.phone}</p>
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
    activeCustomer = customer;
    
    // UI Transitions
    chatWelcomeEl.classList.add('hidden');
    chatWindowEl.classList.remove('hidden');
    detailsSidebarEl.classList.remove('hidden');
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
    
    const location = [customer.village_city, customer.district, customer.state].filter(s => s).join(', ') || '-';
    displayLocationEl.innerText = location;
    displayLanguageEl.innerText = customer.language || '-';
    assignedToEl.innerText = customer.assigned_name || 'Unassigned';

    // Highlight active item
    document.querySelectorAll('.customer-item').forEach(el => {
        if (el.dataset.phone === customer.phone) el.classList.add('active');
        else el.classList.remove('active');
    });
    
    await loadChatHistory(customer.phone);
}

/**
 * Populate Edit Form
 */
function populateEditForm() {
    if (!activeCustomer) return;
    editNameInput.value = activeCustomer.customer_name || '';
    editCityInput.value = activeCustomer.village_city || '';
    editDistrictInput.value = activeCustomer.district || '';
    editStateInput.value = activeCustomer.state || '';
    editPincodeInput.value = activeCustomer.pincode || '';
    editLangInput.value = activeCustomer.language || 'EN';
}

/**
 * Handle Save Details
 */
async function handleSaveDetails() {
    if (!activeCustomer) return;

    const payload = {
        customer_name: editNameInput.value.trim(),
        village_city: editCityInput.value.trim(),
        district: editDistrictInput.value.trim(),
        state: editStateInput.value.trim(),
        pincode: editPincodeInput.value.trim(),
        language: editLangInput.value
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
            confirmTransferBtnEl.disabled = false;
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
            transferModal.classList.add('hidden');
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
        const response = await fetch(`${API_BASE}/history/${phone}`, { headers: AUTH_HEADER });
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
        mediaPreviewModal.classList.add('hidden');
        selectedFile = null;
    };

    sendMediaBtn.onclick = handleSendMedia;

    mediaInputEl.onchange = (e) => {
        const file = e.target.files[0];
        if (!file || !activeCustomer) return;
        
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (re) => {
            if (file.type.startsWith('image/')) {
                previewImg.src = re.target.result;
                document.getElementById('image-preview-container').classList.remove('hidden');
                document.getElementById('file-preview-container').classList.add('hidden');
            } else {
                previewFileName.innerText = file.name;
                document.getElementById('image-preview-container').classList.add('hidden');
                document.getElementById('file-preview-container').classList.remove('hidden');
            }
            previewCaption.value = '';
            mediaPreviewModal.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    };
});

async function handleSendMedia() {
    if (!selectedFile || !activeCustomer) return;
    
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
        const caption = previewCaption.value.trim();
        const response = await fetch(`${API_BASE}/send`, {
            method: 'POST',
            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phone: activeCustomer.phone, 
                mediaData: reader.result, 
                mimeType: selectedFile.type, 
                message: caption || selectedFile.name 
            })
        });

        if (response.ok) {
            mediaPreviewModal.classList.add('hidden');
            selectedFile = null;
            loadChatHistory(activeCustomer.phone);
        } else {
            alert('Failed to send media');
        }
    };
}

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
window.openFullscreen = function(url) {
    const modal = document.getElementById('fullscreenModal');
    const modalImg = document.getElementById('fullscreenImage');
    if (modal && modalImg) {
        modalImg.src = url;
        modal.style.display = 'flex';
    }
}

window.closeFullscreen = function() {
    const modal = document.getElementById('fullscreenModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close fullscreen on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFullscreen();
});

function renderMessages(history) {
    if (!messageContainerEl) return;
    messageContainerEl.innerHTML = '';

    history.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = `message message-${msg.direction}`;
        msgEl.id = `msg-${msg.chat_id}`;

        let contentHtml = '';
        
        // Add Delete Action
        const actionsHtml = `<div class="message-actions" onclick="deleteMessage(${msg.chat_id})" title="Delete Message">
            <i class="fas fa-trash"></i>
        </div>`;

        if (msg.mime_type) {
            let proxyUrl = `${API_BASE}/media/${msg.chat_id}?token=${localStorage.getItem('token')}`;
            let mediaUrl = msg.media_url || proxyUrl;
            
            if (msg.mime_type.startsWith('image/')) {
                contentHtml = `
                    <div class="message-media" onclick="openFullscreen('${mediaUrl}')">
                        <img src="${mediaUrl}" alt="Attachment" 
                             crossorigin="anonymous"
                             onerror="if(this.src !== '${proxyUrl}') { console.log('Supabase load failed, falling back to proxy'); this.src='${proxyUrl}'; } else { this.src='https://placehold.co/200?text=Image+Not+Available'; }">
                        ${msg.body && msg.body !== 'Sent a image' && !msg.body.includes('http') ? `<div class="message-content">${msg.body}</div>` : ''}
                    </div>`;
            } else if (msg.mime_type.startsWith('video/')) {
                contentHtml = `
                    <div class="message-media">
                        <video controls style="max-width: 100%; border-radius: 8px;">
                            <source src="${mediaUrl}" type="${msg.mime_type}">
                            Your browser does not support the video tag.
                        </video>
                        ${msg.body && !msg.body.includes('http') ? `<div class="message-content">${msg.body}</div>` : ''}
                    </div>`;
            } else if (msg.mime_type.startsWith('audio/')) {
                contentHtml = `
                    <div class="message-media" style="padding: 10px; background: #202c33; border-radius: 8px;">
                        <audio controls style="width: 100%;">
                            <source src="${mediaUrl}" type="${msg.mime_type}">
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

        msgEl.innerHTML = `
            ${actionsHtml}
            ${msg.direction === 'outgoing' && msg.sender_name ? `<div class="message-sender">${msg.sender_name}</div>` : ''}
            ${contentHtml}
            <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        
        messageContainerEl.appendChild(msgEl);
    });

    messageContainerEl.scrollTop = messageContainerEl.scrollHeight;
}

async function handleSend() {
    const text = messageInputEl.value.trim();
    if (!text || !activeCustomer) return;
    messageInputEl.value = '';
    try {
        const response = await fetch(`${API_BASE}/send`, {
            method: 'POST',
            headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: activeCustomer.phone, message: text })
        });
        if (response.ok) loadChatHistory(activeCustomer.phone);
        else window.showAlert('Error', 'Failed to send message', 'error');
    } catch (err) { console.error('Send error:', err); }
}

// Media Selection Handler
function handleMediaSelect(e) {
    const file = e.target.files[0];
    if (!file || !activeCustomer) return;
    
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (re) => {
        if (file.type.startsWith('image/')) {
            previewImg.src = re.target.result;
            document.getElementById('image-preview-container').classList.remove('hidden');
            document.getElementById('file-preview-container').classList.add('hidden');
        } else {
            previewFileName.innerText = file.name;
            document.getElementById('image-preview-container').classList.add('hidden');
            document.getElementById('file-preview-container').classList.remove('hidden');
        }
        previewCaption.value = '';
        mediaPreviewModal.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// Event Listeners Initialization
function initEventListeners() {
    sendBtnEl.onclick = handleSend;
    attachBtnEl.onclick = () => mediaInputEl.click();
    mediaInputEl.onchange = handleMediaSelect;
    mobileBackBtnEl.onclick = () => appContainerEl.classList.remove('show-chat');
    messageInputEl.onkeydown = (e) => { if (e.key === 'Enter') handleSend(); };

    // Transfer Modal
    if (transferBtnEl) {
        transferBtnEl.onclick = () => {
            transferModal.classList.remove('hidden');
            selectedTransferUserId = null;
            confirmTransferBtnEl.disabled = true;
            salesSearchEl.value = '';
            loadSalesUsers();
        };
    }

    if (closeTransferModalBtn) closeTransferModalBtn.onclick = () => transferModal.classList.add('hidden');
    if (salesSearchEl) salesSearchEl.oninput = (e) => renderSalesList(e.target.value);
    if (confirmTransferBtnEl) confirmTransferBtnEl.onclick = handleTransfer;
    if (resolveBtnEl) resolveBtnEl.onclick = handleResolve;

    // Media Preview
    if (closePreviewBtn) {
        closePreviewBtn.onclick = () => {
            mediaPreviewModal.classList.add('hidden');
            selectedFile = null;
        };
    }
    if (sendMediaBtn) sendMediaBtn.onclick = handleSendMedia;
}

// Initialize on load
initEventListeners();
