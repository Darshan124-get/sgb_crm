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
            stockStatus: 'all',
            activeStatus: 'all',
            sortBy: 'newest'
        }
    };

    // UI Elements
    const contentArea = document.getElementById('inventoryContent');
    const tabs = document.querySelectorAll('.inv-tab');
    const refreshBtn = document.getElementById('refreshDataBtn');
    const addProductBtn = document.getElementById('addProductBtn');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const globalSearchInput = document.getElementById('globalSearch');

    // ─── Search Logic ───
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            state.filters.search = e.target.value.toLowerCase();
            renderActiveTab();
        });
    }

    // Helper for Image URLs
    function getImageUrl(url) {
        if (!url) return 'https://placehold.co/400x400?text=No+Image';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        const baseUrl = window.API_URL.replace('/api', '');
        return `${baseUrl}/${url}`;
    }

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
    const filterStockStatus = document.getElementById('filterStockStatus');
    const filterActiveStatus = document.getElementById('filterActiveStatus');
    const sortBySelect = document.getElementById('sortBy');

    filterCategory.addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        if (state.activeTab === 'products') renderProducts();
        if (state.activeTab === 'stock') renderStock();
    });

    filterStockStatus.addEventListener('change', (e) => {
        state.filters.stockStatus = e.target.value;
        if (state.activeTab === 'products') renderProducts();
        if (state.activeTab === 'stock') renderStock();
    });

    filterActiveStatus.addEventListener('change', (e) => {
        state.filters.activeStatus = e.target.value;
        if (state.activeTab === 'products') renderProducts();
    });

    sortBySelect.addEventListener('change', (e) => {
        state.filters.sortBy = e.target.value;
        if (state.activeTab === 'products') renderProducts();
    });

    // Refresh Logic
    const refreshAll = async () => {
        try {
            await Promise.all([
                fetchProducts(),
                fetchCategories(),
                fetchInventory(),
                fetchLogs(),
                checkLowStock()
            ]);
            populateCategoryFilter();
            renderActiveTab();
        } catch (err) {
            console.error('Refresh failed:', err);
            // Even if one fails, try to render what we have
            renderActiveTab();
        }
    };
    if (refreshBtn) refreshBtn.addEventListener('click', refreshAll);

    function populateCategoryFilter() {
        if (!filterCategory) return;
        const flat = flattenCategories(state.categories);
        const options = flat.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('');
        filterCategory.innerHTML = '<option value="all">All Categories</option>' + options;
    }

    // ─── Button Actions ─────────────────────────────────────────
    if (addProductBtn) addProductBtn.addEventListener('click', () => {
        const catOptions = flattenCategories(state.categories).map(c => `<option value="${c.category_id}">${c.name}</option>`).join('');
        const content = `
            <form id="productForm" style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; padding:0.5rem;">
                <div style="grid-column:1 / -1; display:flex; gap:1.5rem; align-items:flex-start; background:#f8fafc; padding:1.25rem; border-radius:12px; border:1px solid #e2e8f0;">
                        <div>
                            <label class="premium-label">Product Name <span style="color:#ef4444;">*</span></label>
                            <input type="text" name="name" class="form-control-premium" required placeholder="e.g. Battery Sprayer 16L">
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                <label class="premium-label" style="display:block; margin-bottom:0.5rem;">Product Image</label>
                                <div id="imagePreviewContainer" style="width:120px; height:120px; border:2px dashed #cbd5e1; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:white; cursor:pointer;" onclick="document.getElementById('productImageInput').click()">
                                    <i class="fas fa-camera fa-2x" style="color:#94a3b8;"></i>
                                    <img id="imagePreview" style="width:100%; height:100%; object-fit:cover; display:none;">
                                </div>
                                <input type="file" id="productImageInput" name="image" accept="image/*" style="display:none;" onchange="handleImagePreview(this, 'imagePreview')">
                                <p style="font-size:0.65rem; color:#94a3b8; margin-top:0.4rem;">Click to upload</p>
                            </div>
                            <div>
                                <label class="premium-label">Category</label>
                                <select name="category_id" class="form-control-premium">
                                    <option value="">Choose Category...</option>
                                    ${catOptions}
                                </select>
                            </div>
                        </div>
                    <div>
                        <label class="premium-label">SKU (Optional)</label>
                        <input type="text" name="sku" class="form-control-premium" placeholder="Auto-generated if empty">
                    </div>
                </div>

                <div style="grid-column:1 / -1;">
                    <label class="premium-label">Description</label>
                    <textarea name="description" class="form-control-premium" rows="2" placeholder="Briefly describe the product..."></textarea>
                </div>

                <div style="background:#f1f5f9; padding:1.25rem; border-radius:12px; grid-column:1 / -1; display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; border:1px solid #e2e8f0;">
                    <div style="grid-column:1/-1; margin-bottom:0.25rem; font-weight:700; font-size:0.75rem; color:#475569; text-transform:uppercase; letter-spacing:0.025em; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fas fa-indian-rupee-sign"></i> Pricing & Discounts
                    </div>
                    <div>
                        <label class="premium-label">Price (MRP)</label>
                        <input type="number" name="selling_price" class="form-control-premium" required value="0" min="0">
                    </div>
                    <div>
                        <label class="premium-label">Dealer Price</label>
                        <input type="number" name="dealer_price" class="form-control-premium" value="0" min="0">
                    </div>
                    <div>
                        <label class="premium-label">Discount %</label>
                        <input type="number" name="discount_percentage" class="form-control-premium" value="0" min="0" max="100">
                    </div>
                </div>

                <div style="background:#e0f2fe; padding:1.25rem; border-radius:12px; grid-column:1 / -1; display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; border:1px solid #bae6fd;">
                    <div style="grid-column:1/-1; margin-bottom:0.25rem; font-weight:700; font-size:0.75rem; color:#0369a1; text-transform:uppercase; letter-spacing:0.025em; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fas fa-boxes-stacked"></i> Inventory Settings
                    </div>
                    <div>
                        <label class="premium-label">Opening Stock <span style="color:#ef4444;">*</span></label>
                        <input type="number" name="opening_stock" class="form-control-premium" value="0" min="0" required>
                    </div>
                    <div>
                        <label class="premium-label">Min Stock Alert</label>
                        <input type="number" name="min_stock_alert" class="form-control-premium" value="10" min="0">
                    </div>
                    <div>
                        <label class="premium-label">Unit</label>
                        <input type="text" name="unit" class="form-control-premium" placeholder="e.g. PCS, BOX">
                    </div>
                </div>

                <div>
                    <label class="premium-label">Initial Status</label>
                    <select name="status" class="form-control-premium">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div style="grid-column: 1 / -1; display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem; border-top:1px solid #f1f5f9; padding-top:1.25rem;">
                    <button type="button" class="btn btn-outline" onclick="window.hideModal()">Cancel</button>
                    <button type="submit" class="btn" style="background:var(--primary-color); color:white; padding:0 2.5rem; font-weight:700;">Create Product</button>
                </div>
            </form>
        `;

        window.showModal({ title: 'Add New Product', content, hideFooter: true });
        
        document.getElementById('productForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${window.API_URL}/products`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (res.ok) {
                    window.hideModal();
                    refreshAll();
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.message || 'Could not create product.'));
                }
            } catch (err) { 
                console.error('Submission failed:', err);
                alert('Network error. Is the server running?'); 
            }
        };
    });
    
    if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => {
        window.openAddCategoryModal();
    });

    // Initial Load
    refreshAll();

    async function fetchProducts() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            state.products = Array.isArray(data) ? data : [];
        } catch (e) { 
            console.error('Error fetching products:', e);
            state.products = [];
        }
    }

    async function fetchCategories() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/categories/hierarchy`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            state.categories = Array.isArray(data) ? data : [];
        } catch (e) { 
            console.error('Error fetching categories:', e);
            state.categories = [];
        }
    }

    async function fetchInventory() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/inventory`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            state.inventory = Array.isArray(data) ? data : [];
        } catch (e) { 
            console.error('Error fetching inventory:', e);
            state.inventory = [];
        }
    }

    async function fetchLogs() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/inventory/logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            state.logs = Array.isArray(data) ? data : [];
        } catch (e) { 
            console.error('Error fetching logs:', e);
            state.logs = [];
        }
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
        if (state.activeTab !== 'products') return;
        
        let filtered = state.products;

        // Apply Search
        if (state.filters.search) {
            const s = state.filters.search.toLowerCase();
            filtered = filtered.filter(p => 
                (p.name || '').toLowerCase().includes(s) || 
                (p.sku && p.sku.toLowerCase().includes(s)) ||
                (p.category_name && p.category_name.toLowerCase().includes(s))
            );
        }

        // Apply Category Filter
        if (state.filters.category !== 'all') {
            filtered = filtered.filter(p => p.category_id == state.filters.category);
        }

        // Apply Stock Status Filter
        if (state.filters.stockStatus !== 'all') {
            filtered = filtered.filter(p => {
                const stock = parseInt(p.current_stock || 0);
                const min = parseInt(p.min_stock_alert || 0);
                const stockStatus = stock > min ? 'in' : (stock > 0 ? 'low' : 'out');
                return stockStatus === state.filters.stockStatus;
            });
        }

        // Apply Active Status Filter
        if (state.filters.activeStatus !== 'all') {
            filtered = filtered.filter(p => p.status === state.filters.activeStatus);
        }

        // Apply Sorting
        filtered = filtered.sort((a, b) => {
            switch(state.filters.sortBy) {
                case 'newest': return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                case 'oldest': return new Date(a.created_at || 0) - new Date(b.created_at || 0);
                case 'name_asc': return (a.name || '').localeCompare(b.name || '');
                case 'name_desc': return (b.name || '').localeCompare(a.name || '');
                case 'price_asc': return (a.selling_price || 0) - (b.selling_price || 0);
                case 'price_desc': return (b.selling_price || 0) - (a.selling_price || 0);
                case 'stock_desc': return (b.current_stock || 0) - (a.current_stock || 0);
                default: return 0;
            }
        });

        if (filtered.length === 0) {
            contentArea.innerHTML = `
                <div style="padding:5rem 2rem; text-align:center; background:white; border-radius:1rem; border:1px dashed #e2e8f0;">
                    <i class="fas fa-search fa-3x" style="margin-bottom:1.5rem; color:#e2e8f0;"></i>
                    <h3 style="color:#64748b; font-weight:700;">No Products Found</h3>
                    <p style="color:#94a3b8; font-size:0.875rem;">Try adjusting your search criteria or filters.</p>
                </div>
            `;
            return;
        }

        const container = document.createElement('div');
        container.className = 'inv-table-container premium-card';
        container.innerHTML = `
            <table class="inv-table">
                <thead>
                    <tr>
                        <th style="width:140px;">Category</th>
                        <th>Product Details</th>
                        <th style="text-align:right;">Price</th>
                        <th style="text-align:center;">Stock Level</th>
                        <th style="text-align:center;">Status</th>
                        <th style="text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(p => {
                        const stockAmt = parseInt(p.current_stock || 0);
                        const minAmt = parseInt(p.min_stock_alert || 0);
                        const isOutOfStock = stockAmt <= 0;
                        const isLowStock = stockAmt <= minAmt && stockAmt > 0;
                        
                        const stockClass = isOutOfStock ? 'stock-out' : (isLowStock ? 'stock-low' : 'stock-in');
                        const statusColor = p.status === 'active' ? '#10b981' : '#ef4444';
                        
                        return `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:1rem 1.25rem;">
                                <span style="font-size:0.65rem; font-weight:800; color:#64748b; text-transform:uppercase; background:#f1f5f9; padding:3px 10px; border-radius:6px; letter-spacing:0.02em;">
                                    ${p.category_name || 'General'}
                                </span>
                            </td>
                            <td style="padding:1rem 1.25rem;">
                                <div style="display:flex; align-items:center; gap:0.85rem;">
                                    <div style="width:52px; height:52px; border-radius:12px; background:#f8fafc; display:flex; align-items:center; justify-content:center; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                                        <img src="${getImageUrl(p.image_url)}" style="width:100%; height:100%; object-fit:cover;">
                                    </div>
                                    <div style="line-height:1.2;">
                                        <div style="font-weight:700; color:#0f172a; font-size:0.925rem; margin-bottom:0.2rem;">${p.name}</div>
                                        <div style="font-size:0.75rem; color:#94a3b8; font-family:'JetBrains Mono', monospace; font-weight:500;">${p.sku || 'NO-SKU'}</div>
                                    </div>
                                </div>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#1e293b; font-size:1rem; padding:1rem 1.25rem;">
                                ₹${parseFloat(p.selling_price || 0).toLocaleString()}
                            </td>
                            <td style="text-align:center; padding:1rem 1.25rem;">
                                <span class="stock-badge ${stockClass}" style="display:inline-flex; align-items:center; gap:0.4rem; padding:5px 12px; border-radius:8px; font-weight:700; font-size:0.85rem;">
                                    ${stockAmt} <span style="font-size:0.65rem; opacity:0.8;">${p.unit || 'PCS'}</span>
                                    ${isLowStock ? '<i class="fas fa-exclamation-triangle" style="font-size:0.7rem;"></i>' : ''}
                                </span>
                            </td>
                            <td style="text-align:center; padding:1rem 1.25rem;">
                                <span style="display:inline-flex; align-items:center; gap:0.4rem; font-weight:800; color:${statusColor}; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.05em; background:${statusColor}15; padding:4px 10px; border-radius:20px;">
                                    <span style="width:6px; height:6px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
                                    ${p.status || 'active'}
                                </span>
                            </td>
                            <td style="padding:1rem 1.25rem;">
                                <div style="display:flex; gap:0.4rem; justify-content:center;">
                                    <button class="btn-action" title="View" onclick="viewProduct(${p.product_id})" style="width:34px; height:34px;">
                                        <i class="fas fa-eye" style="font-size:0.85rem;"></i>
                                    </button>
                                    <button class="btn-action" title="Edit" onclick="editProduct(${p.product_id})" style="width:34px; height:34px;">
                                        <i class="fas fa-edit" style="font-size:0.85rem;"></i>
                                    </button>
                                    <button class="btn-action" title="Delete" onclick="deleteProduct(${p.product_id})" style="width:34px; height:34px; color:#ef4444;">
                                        <i class="fas fa-trash-alt" style="font-size:0.85rem;"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        contentArea.appendChild(container);
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
            const matchesSearch = (i.name || '').toLowerCase().includes(state.filters.search) || 
                                 (i.sku && i.sku.toLowerCase().includes(state.filters.search));
            const matchesCat = state.filters.category === 'all' || i.category_id == state.filters.category;
            
            let matchesStock = true;
            if (state.filters.stockStatus !== 'all') {
                const stockStatus = i.current_stock > i.min_stock_alert ? 'in' : (i.current_stock > 0 ? 'low' : 'out');
                matchesStock = stockStatus === state.filters.stockStatus;
            }
            return matchesSearch && matchesCat && matchesStock;
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
        const filtered = state.logs.filter(l => {
             const search = state.filters.search;
             return (l.product_name || '').toLowerCase().includes(search) ||
                    (l.sku || '').toLowerCase().includes(search) ||
                    (l.type || '').toLowerCase().includes(search) ||
                    (l.reference || '').toLowerCase().includes(search) ||
                    (l.notes || '').toLowerCase().includes(search);
        });

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
                        ${filtered.map(l => {
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

    // ─── Renderers ─────────────────────────────────────────────

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
                } else {
                    const err = await res.json();
                    alert('Category Error: ' + (err.message || 'Failed to save category.'));
                    console.error('Category Save Error:', err);
                }
            } catch (err) { 
                console.error('Error saving category:', err);
                alert('Error connecting to server to save category.'); 
            }
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
        if (!Array.isArray(cats)) return list;
        cats.forEach(c => {
            list.push({ category_id: c.category_id, name: c.name });
            if (c.children && Array.isArray(c.children)) flattenCategories(c.children, list);
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
            <form id="editProductForm" style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; padding:0.5rem;">
                <div style="grid-column:1 / -1; display:flex; gap:1.5rem; align-items:flex-start; background:#f8fafc; padding:1.25rem; border-radius:12px; border:1px solid #e2e8f0;">
                    <div style="flex-shrink:0;">
                        <label class="premium-label" style="display:block; margin-bottom:0.5rem;">Product Image</label>
                        <div id="editImagePreviewContainer" style="width:120px; height:120px; border:2px dashed #cbd5e1; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:white; cursor:pointer; position:relative;" onclick="document.getElementById('editProductImageInput').click()">
                            <img id="editImagePreview" src="${getImageUrl(p.image_url)}" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0;">
                        </div>
                        <input type="file" id="editProductImageInput" name="image" accept="image/*" style="display:none;" onchange="handleImagePreview(this, 'editImagePreview')">
                        <p style="font-size:0.65rem; color:#94a3b8; margin-top:0.5rem; text-align:center;">Change Image</p>
                    </div>
                    <div style="flex-grow:1; display:flex; flex-direction:column; gap:1rem;">
                        <div>
                            <label class="premium-label">Product Name</label>
                            <input type="text" name="name" class="form-control-premium" required value="${p.name}">
                        </div>
                        <div style="grid-template-columns:1fr 1fr; display:grid; gap:1rem;">
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
                        </div>
                    </div>
                </div>

                <div style="grid-column:1 / -1;">
                    <label class="premium-label">Description</label>
                    <textarea name="description" class="form-control-premium" rows="2">${p.description || ''}</textarea>
                </div>

                <div style="background:#f1f5f9; padding:1.25rem; border-radius:12px; grid-column:1 / -1; display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; border:1px solid #e2e8f0;">
                    <div style="grid-column:1/-1; margin-bottom:0.25rem; font-weight:700; font-size:0.75rem; color:#475569; text-transform:uppercase; letter-spacing:0.025em; display:flex; align-items:center; gap:0.5rem;">
                        <i class="fas fa-indian-rupee-sign"></i> Pricing & Discounts
                    </div>
                    <div>
                        <label class="premium-label">Price (MRP)</label>
                        <input type="number" name="selling_price" class="form-control-premium" required value="${p.selling_price}" min="0">
                    </div>
                    <div>
                        <label class="premium-label">Dealer Price</label>
                        <input type="number" name="dealer_price" class="form-control-premium" value="${p.dealer_price}" min="0">
                    </div>
                    <div>
                        <label class="premium-label">Discount %</label>
                        <input type="number" name="discount_percentage" class="form-control-premium" value="${p.discount_percentage}" min="0" max="100">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; grid-column:1/-1;">
                    <div>
                        <label class="premium-label">Status</label>
                        <select name="status" class="form-control-premium">
                            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div>
                        <label class="premium-label">Unit</label>
                        <input type="text" name="unit" class="form-control-premium" value="${p.unit || ''}" placeholder="e.g. PCS, BOX">
                    </div>
                </div>

                <div style="grid-column:1/-1; display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem; border-top:1px solid #f1f5f9; padding-top:1.25rem;">
                    <button type="button" class="btn btn-outline" onclick="window.hideModal()">Cancel</button>
                    <button type="submit" class="btn" style="background:var(--primary-color); color:white; padding:0 2.5rem; font-weight:700;">Save Changes</button>
                </div>
            </form>
        `;

        window.showModal({ title: 'Edit Product', content, hideFooter: true });

        document.getElementById('editProductForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${window.API_URL}/products/${id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (res.ok) {
                    window.hideModal();
                    refreshAll();
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.message || 'Failed to update product.'));
                }
            } catch (err) { 
                console.error('Update failed:', err);
                alert('Error updating product'); 
            }
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

    window.toggleProductStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const p = state.products.find(prod => prod.product_id === id);
        if (!p) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${window.API_URL}/products/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...p, status: newStatus })
            });
            if (res.ok) refreshAll();
        } catch (err) { alert('Error updating status'); }
    };

    window.viewProduct = (id) => {
        const p = state.products.find(prod => prod.product_id === id);
        if (!p) return;

        const content = `
            <div style="display:grid; grid-template-columns:1fr 2fr; gap:1.5rem; padding:0.5rem;">
                <div>
                    <img src="${getImageUrl(p.image_url)}" style="width:100%; border-radius:12px; border:1px solid #e2e8f0; object-fit:cover;">
                </div>
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <div>
                        <span style="font-size:0.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">${p.category_name || 'General'}</span>
                        <h2 style="font-size:1.5rem; font-weight:800; color:#1e293b; margin:0.2rem 0;">${p.name}</h2>
                        <code style="background:#f1f5f9; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:600; color:#2563eb;">${p.sku || 'No SKU'}</code>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:0.5rem;">
                        <div style="background:#f8fafc; padding:0.75rem; border-radius:8px;">
                            <p style="font-size:0.65rem; color:#64748b; margin:0; font-weight:600;">SELLING PRICE</p>
                            <p style="font-size:1.25rem; font-weight:800; color:var(--primary-color); margin:0;">₹${parseFloat(p.selling_price).toLocaleString()}</p>
                        </div>
                        <div style="background:#f8fafc; padding:0.75rem; border-radius:8px;">
                            <p style="font-size:0.65rem; color:#64748b; margin:0; font-weight:600;">CURRENT STOCK</p>
                            <p style="font-size:1.25rem; font-weight:800; color:#334155; margin:0;">${p.current_stock} <small>${p.unit || 'PCS'}</small></p>
                        </div>
                    </div>

                    <div style="margin-top:0.5rem;">
                        <p style="font-size:0.75rem; font-weight:700; color:#64748b; margin-bottom:0.4rem;">DESCRIPTION</p>
                        <p style="font-size:0.875rem; color:#475569; line-height:1.6; margin:0;">${p.description || 'No description provided for this product.'}</p>
                    </div>

                    <div style="margin-top:auto; padding-top:1rem; display:flex; gap:1rem; border-top:1px solid #f1f5f9;">
                         <button class="btn" style="flex:1; background:#f1f5f9; color:#1e293b;" onclick="window.hideModal()">Close Window</button>
                         <button class="btn" style="flex:1; background:var(--primary-color); color:white;" onclick="window.hideModal(); editProduct(${p.product_id})">Edit Product</button>
                    </div>
                </div>
            </div>
        `;
        window.showModal({ title: 'Product Details', content, hideFooter: true });
    };

    // Shared global functions for image preview
    window.handleImagePreview = (input, previewId) => {
        const preview = document.getElementById(previewId);
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
                if (preview.previousElementSibling) preview.previousElementSibling.style.display = 'none';
            };
            reader.readAsDataURL(input.files[0]);
        }
    };
});
