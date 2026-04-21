// ============================================================
// inventory.js — Admin Products & Inventory Logic
// Handles: Tab switching, Products, Categories, Stock, Logs
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.requireAuth === 'function' && !window.requireAuth(['admin'])) return;
    
    const state = {
        activeTab: 'products',
        products: [],
        categories: [],
        inventory: [],
        logs: [],
        filters: {
            search: '',
            category: 'all',
            status: 'all'
        }
    };

    // UI Elements
    const contentArea = document.getElementById('inventoryContent');
    const tabs = document.querySelectorAll('.inv-tab');
    const refreshBtn = document.getElementById('refreshDataBtn');
    const addProductBtn = document.getElementById('addProductBtn');
    const globalSearchInput = document.getElementById('globalSearch');

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.activeTab = tab.getAttribute('data-tab');
            renderActiveTab();
        });
    });

    // Filters
    const filterCategory = document.getElementById('filterCategory');
    const filterStatus = document.getElementById('filterStatus');

    filterCategory.addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        if (state.activeTab === 'products') renderProducts();
        if (state.activeTab === 'stock') renderStock();
    });

    filterStatus.addEventListener('change', (e) => {
        state.filters.status = e.target.value;
        if (state.activeTab === 'products') renderProducts();
        if (state.activeTab === 'stock') renderStock();
    });

    // Refresh Logic
    const refreshAll = async () => {
        await Promise.all([
            fetchProducts(),
            fetchCategories(),
            fetchInventory(),
            fetchLogs(),
            checkLowStock()
        ]);
        populateCategoryFilter();
        renderActiveTab();
    };
    refreshBtn.addEventListener('click', refreshAll);

    function populateCategoryFilter() {
        if (!filterCategory) return;
        const flat = flattenCategories(state.categories);
        const options = flat.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('');
        filterCategory.innerHTML = '<option value="all">All Categories</option>' + options;
    }

    // Global Search
    globalSearchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value.toLowerCase();
        if (state.activeTab === 'products') renderProducts();
        if (state.activeTab === 'stock') renderStock();
    });

    // Initial Load
    await refreshAll();

    // ─── API Fetchers ───────────────────────────────────────────
    async function fetchProducts() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            state.products = await res.json();
        } catch (e) { console.error('Error fetching products:', e); }
    }

    async function fetchCategories() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/categories/hierarchy`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            state.categories = await res.json();
        } catch (e) { console.error('Error fetching categories:', e); }
    }

    async function fetchInventory() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/inventory`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            state.inventory = await res.json();
        } catch (e) { console.error('Error fetching inventory:', e); }
    }

    async function fetchLogs() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/inventory/logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            state.logs = await res.json();
        } catch (e) { console.error('Error fetching logs:', e); }
    }

    async function checkLowStock() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/inventory/low-stock`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const alerts = await res.json();
            const badge = document.getElementById('lowStockWarning');
            if (badge) {
                if (alerts.length > 0) {
                    badge.classList.remove('hidden');
                    badge.onclick = () => {
                        tabs.forEach(t => t.classList.remove('active'));
                        document.querySelector('[data-tab="stock"]').classList.add('active');
                        state.activeTab = 'stock';
                        renderActiveTab();
                    };
                } else {
                    badge.classList.add('hidden');
                }
            }
        } catch (e) { console.error('Error checking low stock:', e); }
    }

    // ─── Renderers ─────────────────────────────────────────────
    function renderActiveTab() {
        contentArea.innerHTML = '';
        switch(state.activeTab) {
            case 'products': renderProducts(); break;
            case 'categories': renderCategories(); break;
            case 'stock': renderStock(); break;
            case 'logs': renderLogs(); break;
        }
    }

    function renderProducts() {
        const filtered = state.products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(state.filters.search) || 
                                (p.sku && p.sku.toLowerCase().includes(state.filters.search));
            
            const matchesCat = state.filters.category === 'all' || p.category_id == state.filters.category;
            
            let matchesStatus = true;
            if (state.filters.status !== 'all') {
                const stockStatus = p.current_stock > p.min_stock_alert ? 'in' : (p.current_stock > 0 ? 'low' : 'out');
                matchesStatus = stockStatus === state.filters.status;
            }

            return matchesSearch && matchesCat && matchesStatus;
        });

        if (filtered.length === 0) {
            contentArea.innerHTML = `<div style="padding:4rem;text-align:center;color:#94a3b8;">No products found matching your search.</div>`;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'product-grid';
        grid.innerHTML = filtered.map(p => {
            const stockStatus = p.current_stock > p.min_stock_alert ? 'stock-in' : (p.current_stock > 0 ? 'stock-low' : 'stock-out');
            const stockLabel = p.current_stock > p.min_stock_alert ? 'In Stock' : (p.current_stock > 0 ? 'Low Stock' : 'Out of Stock');

            return `
                <div class="product-card premium-card">
                    <div class="product-img"><i class="fas fa-box"></i></div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <span style="font-size:0.65rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">${p.category_name || 'No Category'}</span>
                            <h3 style="font-size:1rem; font-weight:700; margin:0.25rem 0;">${p.name}</h3>
                            <p style="font-size:0.75rem; color:#64748b; margin-top:-2px;">#${p.sku || 'No SKU'}</p>
                        </div>
                        <span class="stock-badge ${stockStatus}">${stockLabel}</span>
                    </div>
                    <div style="margin-top:0.5rem; display:flex; justify-content:space-between; align-items:flex-end;">
                        <div>
                            <p style="font-size:0.7rem; color:#94a3b8; font-weight:600; text-transform:uppercase;">Selling Price</p>
                            <p style="font-size:1.1rem; font-weight:800; color:var(--primary-color);">₹${p.selling_price}</p>
                        </div>
                        <div style="display:flex; gap:0.5rem;">
                            <button onclick="editProduct(${p.product_id})" class="btn-action" title="Edit"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteProduct(${p.product_id})" class="btn-action" title="Delete" style="color:#ef4444;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        contentArea.appendChild(grid);
    }

    function renderCategories() {
        const container = document.createElement('div');
        container.className = 'inv-table-container premium-card';
        
        const renderLevel = (cats, level = 0) => {
            return cats.map(c => `
                <div class="cat-tree-item" style="padding-left: ${level * 2}rem;">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <i class="fas fa-chevron-right" style="font-size:0.7rem; color:#cbd5e1; ${c.children.length ? '' : 'opacity:0;'}"></i>
                        <span style="font-weight:600;">${c.name}</span>
                        ${c.description ? `<span style="font-size:0.75rem; color:#94a3b8;">— ${c.description}</span>` : ''}
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button onclick="editCategory(${c.category_id})" class="btn-action"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteCategory(${c.category_id})" class="btn-action" style="color:#ef4444;"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                ${c.children.length ? renderLevel(c.children, level + 1) : ''}
            `).join('');
        };

        const header = `
            <div style="padding:1.25rem 1.5rem; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
                <h3 style="font-size:1rem; font-weight:700;">Category Hierarchy</h3>
                <button class="btn" onclick="openAddCategoryModal()" style="height:32px; font-size:0.75rem; background:var(--primary-color); color:white; padding:0 1rem;">
                    <i class="fas fa-plus"></i> New Category
                </button>
            </div>
        `;
        
        container.innerHTML = header + (state.categories.length ? renderLevel(state.categories) : '<div style="padding:2rem;text-align:center;color:#94a3b8;">No categories defined.</div>');
        contentArea.appendChild(container);
    }

    function renderStock() {
        const filtered = state.inventory.filter(i => {
            return i.name.toLowerCase().includes(state.filters.search) || 
                   i.sku.toLowerCase().includes(state.filters.search);
        });

        const tableHTML = `
            <div class="inv-table-container premium-card">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th>Product Details</th>
                            <th>Current Stock</th>
                            <th>Reserved</th>
                            <th>Available</th>
                            <th>Safety Margin</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map(i => {
                            const isLow = i.current_stock < i.min_stock_alert;
                            return `
                                <tr>
                                    <td>
                                        <div style="font-weight:700; color:#1e293b;">${i.name}</div>
                                        <div style="font-size:0.7rem; color:#64748b;">SKU: ${i.sku}</div>
                                    </td>
                                    <td style="font-weight:600; ${isLow ? 'color:#ef4444;' : ''}">
                                        ${i.current_stock} ${i.unit || ''}
                                        ${isLow ? '<i class="fas fa-triangle-exclamation" style="margin-left:4px;"></i>' : ''}
                                    </td>
                                    <td style="color:#94a3b8;">${i.reserved_stock}</td>
                                    <td style="font-weight:700; color:var(--primary-color);">${i.available_stock}</td>
                                    <td>${i.min_stock_alert}</td>
                                    <td>
                                        <button class="btn" onclick="openStockAdjustmentModal(${i.product_id}, '${i.name}')" 
                                                style="height:32px; font-size:0.75rem; border:1px solid #e2e8f0; background:white; font-weight:600;">
                                            Adjust Stock
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        contentArea.innerHTML = tableHTML;
    }

    function renderLogs() {
        const tableHTML = `
            <div class="inv-table-container premium-card">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Product</th>
                            <th>Action Type</th>
                            <th>Quantity</th>
                            <th>Reference</th>
                            <th>Performed By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.logs.map(l => {
                            const date = new Date(l.created_at).toLocaleString();
                            const typeEmoji = l.type === 'in' ? '➕' : (l.type === 'out' ? '➖' : '🔄');
                            const qtyClass = l.type === 'in' ? 'color:#16a34a;' : (l.type === 'out' ? 'color:#dc2626;' : '');
                            
                            return `
                                <tr>
                                    <td style="font-size:0.75rem; color:#64748b;">${date}</td>
                                    <td>
                                        <div style="font-weight:600;">${l.product_name}</div>
                                        <div style="font-size:0.7rem; color:#94a3b8;">SKU: ${l.sku}</div>
                                    </td>
                                    <td><span style="text-transform:uppercase; font-size:0.7rem; font-weight:700;">${typeEmoji} ${l.type}</span></td>
                                    <td style="font-weight:800; ${qtyClass}">${l.quantity > 0 ? '+' : ''}${l.quantity}</td>
                                    <td style="font-size:0.75rem; color:#64748b;">${l.reference_type || 'Manual'}</td>
                                    <td><span class="user-pill" style="font-size:0.75rem; background:#f1f5f9; padding:2px 8px; border-radius:10px;">${l.user_name || 'System'}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        contentArea.innerHTML = tableHTML;
    }

    // ─── Modals Logic ────────────────────────────────────────────
    addProductBtn.onclick = () => {
        const catOptions = flattenCategories(state.categories).map(c => `<option value="${c.category_id}">${c.name}</option>`).join('');
        const content = `
            <form id="productForm" style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; padding:0.5rem;">
                <div style="grid-column:1 / -1;">
                    <label class="premium-label">Product Name</label>
                    <input type="text" name="name" class="form-control-premium" required placeholder="e.g. Battery Sprayer 16L">
                </div>
                
                <div>
                    <label class="premium-label">Category</label>
                    <select name="category_id" class="form-control-premium">
                        <option value="">Choose Category...</option>
                        ${catOptions}
                    </select>
                </div>
                <div>
                    <label class="premium-label">SKU (Auto-generated if empty)</label>
                    <input type="text" name="sku" class="form-control-premium" placeholder="Leave empty for auto">
                </div>

                <div style="grid-column:1 / -1;">
                    <label class="premium-label">Description</label>
                    <textarea name="description" class="form-control-premium" rows="2" placeholder="Product details..."></textarea>
                </div>

                <div style="background:#f8fafc; padding:1rem; border-radius:12px; grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; border:1px solid #e2e8f0;">
                    <div style="grid-column:1/-1; margin-bottom:0.5rem; font-weight:700; font-size:0.8rem; color:#64748b; text-transform:uppercase;">💰 Pricing & Discounts</div>
                    <div>
                        <label class="premium-label">Base Price (MRP)</label>
                        <input type="number" name="selling_price" class="form-control-premium" required value="0">
                    </div>
                    <div>
                        <label class="premium-label">Dealer Price</label>
                        <input type="number" name="dealer_price" class="form-control-premium" value="0">
                    </div>
                    <div>
                        <label class="premium-label">Discount %</label>
                        <input type="number" name="discount_percentage" class="form-control-premium" value="0" min="0" max="100">
                    </div>
                </div>

                <div style="background:#f0f9ff; padding:1rem; border-radius:12px; grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; border:1px solid #bae6fd;">
                    <div style="grid-column:1/-1; margin-bottom:0.5rem; font-weight:700; font-size:0.8rem; color:#0369a1; text-transform:uppercase;">📦 Inventory Settings</div>
                    <div>
                        <label class="premium-label">Opening Stock</label>
                        <input type="number" name="opening_stock" class="form-control-premium" value="0">
                    </div>
                    <div>
                        <label class="premium-label">Min Stock Alert</label>
                        <input type="number" name="min_stock_alert" class="form-control-premium" value="10">
                    </div>
                    <div>
                        <label class="premium-label">Unit</label>
                        <input type="text" name="unit" class="form-control-premium" placeholder="PCS, KGs, etc.">
                    </div>
                </div>

                <div style="grid-column:1/-1; display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem;">
                    <button type="button" class="btn btn-outline" onclick="window.hideModal()">Cancel</button>
                    <button type="submit" class="btn" style="background:var(--primary-color); color:white; padding:0 2rem;">Create Product</button>
                </div>
            </form>
        `;

        window.showModal({ title: 'Add New Product', content, hideFooter: true });
        
        document.getElementById('productForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${window.API_URL}/products`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    window.hideModal();
                    refreshAll();
                } else {
                    const err = await res.json();
                    alert('Error: ' + err.message);
                }
            } catch (err) { alert('Network error'); }
        };
    };

    window.openAddCategoryModal = () => {
        const catOptions = flattenCategories(state.categories).map(c => `<option value="${c.category_id}">${c.name}</option>`).join('');
        const content = `
            <form id="categoryForm" style="padding:0.5rem; display:flex; flex-direction:column; gap:1rem;">
                <div>
                    <label class="premium-label">Category Name</label>
                    <input type="text" name="name" class="form-control-premium" required>
                </div>
                <div>
                    <label class="premium-label">Parent Category</label>
                    <select name="parent_id" class="form-control-premium">
                        <option value="">None (Top Level)</option>
                        ${catOptions}
                    </select>
                </div>
                <div>
                    <label class="premium-label">Description</label>
                    <textarea name="description" class="form-control-premium" rows="2"></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem;">
                    <button type="button" class="btn btn-outline" onclick="window.hideModal()">Cancel</button>
                    <button type="submit" class="btn" style="background:var(--primary-color); color:white;">Save Category</button>
                </div>
            </form>
        `;
        window.showModal({ title: 'Manage Category', content, hideFooter: true });
        
        document.getElementById('categoryForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${window.API_URL}/categories`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    window.hideModal();
                    refreshAll();
                }
            } catch (err) { alert('Error saving category'); }
        };
    };

    window.openStockAdjustmentModal = (prodId, prodName) => {
        const content = `
            <form id="adjustForm" style="padding:0.5rem; display:flex; flex-direction:column; gap:1.25rem;">
                <div style="background:#f8fafc; padding:1rem; border-radius:10px; border:1px solid #e2e8f0;">
                    <p style="font-size:0.75rem; color:#64748b; margin-bottom:0.25rem; font-weight:600;">PRODUCT</p>
                    <p style="font-weight:700; color:#1e293b; font-size:1.1rem;">${prodName}</p>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                    <div>
                        <label class="premium-label">Adjustment Type</label>
                        <select id="adjType" class="form-control-premium" required>
                            <option value="in">Manual Addition (+)</option>
                            <option value="out">Manual Removal (-)</option>
                            <option value="adjustment">Internal Correction</option>
                        </select>
                    </div>
                    <div>
                        <label class="premium-label">Quantity</label>
                        <input type="number" id="adjQty" class="form-control-premium" required placeholder="Amount">
                    </div>
                </div>

                <div>
                    <label class="premium-label">Reason / Reference</label>
                    <input type="text" id="adjReason" class="form-control-premium" placeholder="e.g. Damascus damaged during transit">
                </div>

                <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
                    <button type="button" class="btn btn-outline" onclick="window.hideModal()">Cancel</button>
                    <button type="submit" class="btn" style="background:var(--secondary-color); color:white; padding:0 2rem;">Update Stock</button>
                </div>
            </form>
        `;
        window.showModal({ title: 'Stock Adjustment', content, hideFooter: true });
        
        document.getElementById('adjustForm').onsubmit = async (e) => {
            e.preventDefault();
            const type = document.getElementById('adjType').value;
            let qty = parseInt(document.getElementById('adjQty').value);
            const reason = document.getElementById('adjReason').value;
            
            // Adjust sign based on type if needed
            if ((type === 'out' || type === 'adjustment') && qty > 0) {
                // For 'out' and 'adjustment' we let the user enter positive numbers but send negative if they mean deduction
                // Actually the backend just adds the value, so if user selects 'out' it should probably be negative.
                if (type === 'out') qty = -Math.abs(qty);
            }

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${window.API_URL}/inventory/adjust`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: prodId, type, quantity: qty, reason })
                });
                if (res.ok) {
                    window.hideModal();
                    refreshAll();
                }
            } catch (err) { alert('Error adjusting stock'); }
        };
    };

    // ─── Helpers ───────────────────────────────────────────────
    function flattenCategories(cats, list = []) {
        cats.forEach(c => {
            list.push({ category_id: c.category_id, name: c.name });
            if (c.children && c.children.length) flattenCategories(c.children, list);
        });
        return list;
    }

    // Export to window for global access from HTML strings
    window.editProduct = (id) => {
        const p = state.products.find(prod => prod.product_id === id);
        if (!p) return;

        const catOptions = flattenCategories(state.categories).map(c => `
            <option value="${c.category_id}" ${c.category_id === p.category_id ? 'selected' : ''}>${c.name}</option>
        `).join('');

        const content = `
            <form id="editProductForm" style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; padding:0.5rem;">
                <div style="grid-column:1 / -1;">
                    <label class="premium-label">Product Name</label>
                    <input type="text" name="name" class="form-control-premium" required value="${p.name}">
                </div>
                
                <div>
                    <label class="premium-label">Category</label>
                    <select name="category_id" class="form-control-premium">
                        <option value="">Choose Category...</option>
                        ${catOptions}
                    </select>
                </div>
                <div>
                    <label class="premium-label">SKU</label>
                    <input type="text" name="sku" class="form-control-premium" value="${p.sku || ''}">
                </div>

                <div style="grid-column:1 / -1;">
                    <label class="premium-label">Description</label>
                    <textarea name="description" class="form-control-premium" rows="2">${p.description || ''}</textarea>
                </div>

                <div style="background:#f8fafc; padding:1rem; border-radius:12px; grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; border:1px solid #e2e8f0;">
                    <div style="grid-column:1/-1; margin-bottom:0.5rem; font-weight:700; font-size:0.8rem; color:#64748b; text-transform:uppercase;">💰 Pricing & Discounts</div>
                    <div>
                        <label class="premium-label">Base Price</label>
                        <input type="number" name="selling_price" class="form-control-premium" required value="${p.selling_price}">
                    </div>
                    <div>
                        <label class="premium-label">Dealer Price</label>
                        <input type="number" name="dealer_price" class="form-control-premium" value="${p.dealer_price}">
                    </div>
                    <div>
                        <label class="premium-label">Discount %</label>
                        <input type="number" name="discount_percentage" class="form-control-premium" value="${p.discount_percentage}" min="0" max="100">
                    </div>
                </div>

                <div>
                    <label class="premium-label">Status</label>
                    <select name="status" class="form-control-premium">
                        <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <div>
                    <label class="premium-label">Unit</label>
                    <input type="text" name="unit" class="form-control-premium" value="${p.unit || ''}">
                </div>

                <div style="grid-column:1/-1; display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem;">
                    <button type="button" class="btn btn-outline" onclick="window.hideModal()">Cancel</button>
                    <button type="submit" class="btn" style="background:var(--primary-color); color:white; padding:0 2rem;">Save Changes</button>
                </div>
            </form>
        `;

        window.showModal({ title: 'Edit Product', content, hideFooter: true });

        document.getElementById('editProductForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${window.API_URL}/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    window.hideModal();
                    refreshAll();
                }
            } catch (err) { alert('Error updating product'); }
        };
    };

    window.editCategory = (id) => {
        // Find category in the nested structure
        const findCat = (cats, cid) => {
            for (let c of cats) {
                if (c.category_id === cid) return c;
                if (c.children.length) {
                    const found = findCat(c.children, cid);
                    if (found) return found;
                }
            }
            return null;
        };
        const cat = findCat(state.categories, id);
        if (!cat) return;

        const catOptions = flattenCategories(state.categories)
            .filter(c => c.category_id !== id) // Prevent setting self as parent
            .map(c => `
                <option value="${c.category_id}" ${c.category_id === cat.parent_id ? 'selected' : ''}>${c.name}</option>
            `).join('');

        const content = `
            <form id="editCategoryForm" style="padding:0.5rem; display:flex; flex-direction:column; gap:1rem;">
                <div>
                    <label class="premium-label">Category Name</label>
                    <input type="text" name="name" class="form-control-premium" required value="${cat.name}">
                </div>
                <div>
                    <label class="premium-label">Parent Category</label>
                    <select name="parent_id" class="form-control-premium">
                        <option value="">None (Top Level)</option>
                        ${catOptions}
                    </select>
                </div>
                <div>
                    <label class="premium-label">Description</label>
                    <textarea name="description" class="form-control-premium" rows="2">${cat.description || ''}</textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem;">
                    <button type="button" class="btn btn-outline" onclick="window.hideModal()">Cancel</button>
                    <button type="submit" class="btn" style="background:var(--primary-color); color:white;">Update Category</button>
                </div>
            </form>
        `;
        window.showModal({ title: 'Edit Category', content, hideFooter: true });
        
        document.getElementById('editCategoryForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${window.API_URL}/categories/${id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    window.hideModal();
                    refreshAll();
                }
            } catch (err) { alert('Error updating category'); }
        };
    };

    window.deleteCategory = async (id) => {
        if (!confirm('Are you sure you want to delete this category? Products in this category will be unassigned.')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/categories/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) refreshAll();
        } catch (e) { alert('Failed to delete category'); }
    };

    window.deleteProduct = async (id) => {
        if (!confirm('Are you sure you want to delete this product? All inventory records will be lost.')) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/products/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) refreshAll();
        } catch (e) { alert('Failed to delete product'); }
    };
});
