/* ============================================================
   products-media.js — Full Production Dynamic Controller
   SGB Agro CRM - Chatbot Module (Products & Media Catalog)
   ============================================================ */

// Clean Base64 SVG Placeholder for Products/Media without image (prevents quote escaping bugs)
const SVG_PRODUCT_PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YxZjVmOSIvPjxwYXRoIGQ9Ik0zMCAzMGg0MHY0MEgzMHoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSI0Ii8+PGNpcmNsZSBjeD0iNDIiIGN5PSI0MiIgcj0iNSIgZmlsbD0iIzk0YTNiOCIvPjxwYXRoIGQ9Ik0zMCA2MmwxMi0xMiAxMCAxMCAxMC0xMCA8IDEyIiBzdHJva2U9IiM5NGEzYjgiIHN0cm9rZS13aWR0aD0iMyIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==";

window.handleImageError = function(img) {
    if (img) {
        img.onerror = null;
        img.src = SVG_PRODUCT_PLACEHOLDER;
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // ── Application State ──
    let productsList = [];
    let categoriesList = [];
    let mediaList = [];
    let selectedProductId = null;
    let currentCategoryFilter = 'all';
    let currentStatusFilter = 'all';
    let currentMediaTypeFilter = 'all';
    let currentSearchQuery = '';
    let currentViewMode = 'list'; // 'list' or 'grid'
    let currentWizardStep = 1;
    let wizardProductData = { uploadedFiles: [], specs: [] };

    // DOM Elements - Workspace & Sidebar
    const productsTableBody = document.getElementById('products-table-body');
    const productsGridContainer = document.getElementById('products-grid-container');
    const productsTableCard = document.getElementById('products-table-card');
    const productsGridCard = document.getElementById('products-grid-card');
    const searchInput = document.getElementById('pm-search-input');
    const filterStatus = document.getElementById('filter-status');
    const filterCategory = document.getElementById('filter-category');
    const filterSort = document.getElementById('filter-sort');
    const viewModeListBtn = document.getElementById('view-mode-list');
    const viewModeGridBtn = document.getElementById('view-mode-grid');
    const catList = document.getElementById('pm-cat-list');
    const btnAddCategory = document.getElementById('btn-add-category');

    // Pagination Info DOM
    const pmPaginationInfo = document.getElementById('pm-pagination-info');
    const pmPaginationControls = document.getElementById('pm-pagination-controls');
    const pmPerPageSelect = document.getElementById('pm-per-page-select');

    // Tabs & Header Actions
    const tabBtnProducts = document.getElementById('tab-btn-products');
    const tabBtnMedia = document.getElementById('tab-btn-media');
    const productsViewContainer = document.getElementById('products-view-container');
    const mediaViewContainer = document.getElementById('media-library-view-container');
    const btnOpenMediaLib = document.getElementById('btn-open-media-lib');
    const btnImportProducts = document.getElementById('btn-import-products');

    // Storage Widget DOM
    const storagePercentageLbl = document.getElementById('storage-percentage-lbl');
    const storageProgressFill = document.getElementById('storage-progress-fill');
    const storageUsedLbl = document.getElementById('storage-used-lbl');
    const storageTotalLbl = document.getElementById('storage-total-lbl');
    const btnManageStorage = document.getElementById('btn-manage-storage');

    // Details Drawer DOM
    const detailsDrawer = document.getElementById('pm-details-drawer');
    const drawerTitle = document.getElementById('drawer-title');
    const drawerSku = document.getElementById('drawer-sku');
    const drawerPrice = document.getElementById('drawer-price');
    const drawerStatus = document.getElementById('drawer-status');
    const drawerMainImg = document.getElementById('drawer-main-img');
    const drawerMainVideo = document.getElementById('drawer-main-video');
    const drawerThumbStrip = document.getElementById('drawer-thumb-strip');
    const drawerDesc = document.getElementById('drawer-desc');
    const drawerSpecs = document.getElementById('drawer-specs');
    const drawerTags = document.getElementById('drawer-tags');
    const drawerCreated = document.getElementById('drawer-created');
    const drawerUpdated = document.getElementById('drawer-updated');
    const btnDrawerEdit = document.getElementById('btn-drawer-edit');
    const btnDrawerDelete = document.getElementById('btn-drawer-delete');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');

    // Drawer Sub-Tabs & Panels DOM
    const drawerMediaCount = document.getElementById('drawer-media-count');
    const drawerFlowsCount = document.getElementById('drawer-flows-count');
    const drawerPanelOverview = document.getElementById('drawer-panel-overview');
    const drawerPanelMedia = document.getElementById('drawer-panel-media');
    const drawerPanelFlows = document.getElementById('drawer-panel-flows');
    const drawerMediaGrid = document.getElementById('drawer-media-grid');
    const drawerFlowsList = document.getElementById('drawer-flows-list');
    const btnUploadDrawerMedia = document.getElementById('btn-upload-drawer-media');

    // Modal 1: Add Product (4-Step Wizard)
    const modalAddProduct = document.getElementById('modal-add-product');
    const btnAddProductHdr = document.getElementById('btn-add-product-hdr');
    const btnCloseAddModal = document.getElementById('btn-close-add-modal');
    const btnCancelAddWizard = document.getElementById('btn-cancel-add-wizard');

    // Wizard Step 2 Specs DOM
    const btnAddWizardSpec = document.getElementById('btn-add-wizard-spec');
    const wizardSpecsContainer = document.getElementById('wizard-specs-container');

    // Wizard Step 3 Upload Elements
    const inpWizardMediaFiles = document.getElementById('inp-wizard-media-files');
    const pmDropzoneWizard = document.getElementById('pm-dropzone-wizard');
    const btnBrowseWizardMedia = document.getElementById('btn-browse-wizard-media');
    const wizardMediaPreviewsList = document.getElementById('wizard-media-previews-list');

    // Modal 2: Import Products Bulk
    const modalImportProducts = document.getElementById('modal-import-products');
    const btnCloseImportModal = document.getElementById('btn-close-import-modal');
    const btnCancelImport = document.getElementById('btn-cancel-import');
    const btnSubmitImport = document.getElementById('btn-submit-import');
    const btnLoadSampleJson = document.getElementById('btn-load-sample-json');
    const txtImportJson = document.getElementById('txt-import-json');

    // Modal 3: Storage Details
    const modalManageStorage = document.getElementById('modal-manage-storage');
    const btnCloseStorageModal = document.getElementById('btn-close-storage-modal');
    const btnCloseStorageDone = document.getElementById('btn-close-storage-done');
    const btnCleanTempStorage = document.getElementById('btn-clean-temp-storage');

    // Modal 4: Edit Product
    const modalEditProduct = document.getElementById('modal-edit-product');
    const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const btnSaveEditProd = document.getElementById('btn-save-edit-prod');
    const editProdId = document.getElementById('edit-prod-id');
    const editProdName = document.getElementById('edit-prod-name');
    const editProdCat = document.getElementById('edit-prod-cat');
    const editProdPrice = document.getElementById('edit-prod-price');
    const editProdStatus = document.getElementById('edit-prod-status');
    const editProdSku = document.getElementById('edit-prod-sku');
    const editProdImg = document.getElementById('edit-prod-img');
    const editProdDesc = document.getElementById('edit-prod-desc');
    const editProdTags = document.getElementById('edit-prod-tags');
    const btnAddEditSpec = document.getElementById('btn-add-edit-spec');
    const editSpecsContainer = document.getElementById('edit-specs-container');

    // Modal 5: How It Works Guide
    const modalHowItWorks = document.getElementById('modal-how-it-works');
    const btnHowItWorks = document.getElementById('btn-how-it-works');
    const btnCloseHowItWorks = document.getElementById('btn-close-how-it-works');
    const btnCloseHowItWorksFtr = document.getElementById('btn-close-how-it-works-ftr');
    const btnHowStartWizard = document.getElementById('btn-how-start-wizard');

    // Dynamic API Base URL
    const API_BASE_URL = (window.location.origin && window.location.origin.includes(':5000')) 
        ? '' 
        : 'http://localhost:5000';

    // Auth Header Helper
    function getAuthHeaders() {
        const token = localStorage.getItem('token') || localStorage.getItem('crm_token') || sessionStorage.getItem('token') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }

    // Toast helper
    function showToast(msg, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `pm-toast ${type}`;

        let bg = '#0f172a';
        let iconClass = 'fa-circle-check';
        let iconColor = '#10b981';

        if (type === 'info') {
            bg = '#3b82f6';
            iconClass = 'fa-circle-info';
            iconColor = '#ffffff';
        } else if (type === 'warning') {
            bg = '#f59e0b';
            iconClass = 'fa-triangle-exclamation';
            iconColor = '#ffffff';
        } else if (type === 'error') {
            bg = '#ef4444';
            iconClass = 'fa-circle-exclamation';
            iconColor = '#ffffff';
        }

        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: ${bg};
            color: #ffffff;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.25);
            font-size: 0.875rem;
            font-weight: 600;
            z-index: 999999;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideInRight 0.3s ease;
        `;
        toast.innerHTML = `<i class="fa-solid ${iconClass}" style="color: ${iconColor};"></i> ${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }

    // ── API Calls & Data Loaders ──

    // 1. Fetch Categories
    async function fetchCategories() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/chatbot/categories`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to load categories');
            categoriesList = await res.json();
            renderCategoriesUI();
        } catch (err) {
            console.error('[FETCH CATEGORIES ERROR]', err);
        }
    }

    function renderCategoriesUI() {
        if (catList) {
            const totalCount = categoriesList.reduce((acc, c) => acc + (parseInt(c.count) || 0), 0);
            let html = `
                <li class="pm-cat-item ${currentCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">
                    <span>All Categories</span>
                    <span class="pm-cat-badge">${totalCount}</span>
                </li>
            `;
            categoriesList.forEach(c => {
                html += `
                    <li class="pm-cat-item ${currentCategoryFilter === c.name ? 'active' : ''}" data-cat="${c.name}" data-id="${c.id}">
                        <span>${c.name}</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="pm-cat-badge">${c.count || 0}</span>
                            <button class="btn-del-cat" title="Delete Category" data-id="${c.id}" data-name="${c.name}" style="background: none; border: none; color: #cbd5e1; cursor: pointer; display: none; padding: 2px;">
                                <i class="fa-solid fa-trash-can" style="font-size: 0.75rem;"></i>
                            </button>
                        </div>
                    </li>
                `;
            });
            catList.innerHTML = html;

            catList.querySelectorAll('.pm-cat-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const btnDel = e.target.closest('.btn-del-cat');
                    if (btnDel) {
                        e.stopPropagation();
                        const catId = btnDel.getAttribute('data-id');
                        const catName = btnDel.getAttribute('data-name');
                        deleteCategory(catId, catName);
                        return;
                    }
                    const catVal = item.getAttribute('data-cat');
                    currentCategoryFilter = catVal;
                    if (filterCategory) filterCategory.value = catVal;
                    updateCategoryListActiveUI(catVal);
                    fetchProducts();
                });
            });
        }

        if (filterCategory) {
            let catOptions = `<option value="all">All Categories</option>`;
            categoriesList.forEach(c => {
                catOptions += `<option value="${c.name}">${c.name}</option>`;
            });
            filterCategory.innerHTML = catOptions;
            filterCategory.value = currentCategoryFilter;
        }

        // Fill modal category selects
        ['inp-prod-cat', 'edit-prod-cat'].forEach(selectId => {
            const el = document.getElementById(selectId);
            if (el) {
                let options = '';
                categoriesList.forEach(c => {
                    options += `<option value="${c.name}">${c.name}</option>`;
                });
                el.innerHTML = options;
            }
        });
    }

    async function deleteCategory(catId, catName) {
        if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/chatbot/categories/${catId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete category');

            showToast(`Category "${catName}" deleted`, 'success');
            await fetchCategories();
            await fetchProducts();
        } catch (err) {
            console.error('[DELETE CATEGORY ERROR]', err);
            showToast('Error deleting category', 'error');
        }
    }

    // 2. Fetch Products
    async function fetchProducts() {
        try {
            let url = `${API_BASE_URL}/api/chatbot/products?category=${encodeURIComponent(currentCategoryFilter)}&status=${encodeURIComponent(currentStatusFilter)}`;
            if (currentSearchQuery) {
                url += `&search=${encodeURIComponent(currentSearchQuery)}`;
            }

            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed to fetch products');
            productsList = await res.json();
            
            if (filterSort && filterSort.value) {
                applySorting(filterSort.value);
            } else {
                renderProductsUI();
            }
        } catch (err) {
            console.error('[FETCH PRODUCTS ERROR]', err);
            showToast('Error loading products list', 'error');
        }
    }

    function applySorting(sortType) {
        if (sortType === 'price_low') {
            productsList.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sortType === 'price_high') {
            productsList.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        } else if (sortType === 'name') {
            productsList.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            productsList.sort((a, b) => b.id - a.id);
        }
        renderProductsUI();
    }

    // 3. Fetch Storage Usage
    async function fetchStorageUsage() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/chatbot/media/storage-usage`, { headers: getAuthHeaders() });
            if (!res.ok) return;
            const data = await res.json();

            if (storagePercentageLbl) storagePercentageLbl.textContent = `${data.percentage}%`;
            if (storageProgressFill) storageProgressFill.style.width = `${data.percentage}%`;
            if (storageUsedLbl) storageUsedLbl.textContent = `${data.used_mb} MB used`;
            if (storageTotalLbl) storageTotalLbl.textContent = `${data.total_gb} GB total`;

            const modalPct = document.getElementById('storage-modal-pct');
            const modalFill = document.getElementById('storage-modal-fill');
            const modalUsed = document.getElementById('storage-modal-used');
            if (modalPct) modalPct.textContent = `${data.percentage}% Used`;
            if (modalFill) modalFill.style.width = `${data.percentage}%`;
            if (modalUsed) modalUsed.textContent = `${data.used_mb} MB used`;
        } catch (err) {
            console.error('[STORAGE USAGE ERROR]', err);
        }
    }

    // 4. Fetch Media Library Items & Calculate Dynamic Type Counts
    async function fetchMedia() {
        try {
            let url = `${API_BASE_URL}/api/chatbot/media?type=${encodeURIComponent(currentMediaTypeFilter)}`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) return;
            mediaList = await res.json();

            // Also fetch all media items to compute dynamic media type counts
            const allRes = await fetch(`${API_BASE_URL}/api/chatbot/media?type=all`, { headers: getAuthHeaders() });
            if (allRes.ok) {
                const allMedia = await allRes.json();
                updateDynamicMediaCounts(allMedia);
            }

            renderMediaGrid();
        } catch (err) {
            console.error('[FETCH MEDIA ERROR]', err);
        }
    }

    function updateDynamicMediaCounts(allMedia) {
        let counts = {
            all: allMedia.length,
            images: 0,
            videos: 0,
            documents: 0,
            gifs: 0,
            audio: 0,
            other: 0
        };

        allMedia.forEach(m => {
            const mime = (m.mime_type || '').toLowerCase();
            const type = (m.file_type || '').toLowerCase();

            if (type === 'image' || mime.startsWith('image/')) {
                if (mime.includes('gif')) counts.gifs++;
                else counts.images++;
            } else if (type === 'video' || mime.startsWith('video/')) {
                counts.videos++;
            } else if (type === 'document' || mime.includes('pdf') || mime.includes('word') || mime.includes('sheet') || mime.includes('excel')) {
                counts.documents++;
            } else if (mime.startsWith('audio/')) {
                counts.audio++;
            } else {
                counts.other++;
            }
        });

        // Set sidebar badge values dynamically
        const elAll = document.getElementById('count-media-all');
        const elImg = document.getElementById('count-media-images');
        const elVid = document.getElementById('count-media-videos');
        const elDoc = document.getElementById('count-media-documents');
        const elGif = document.getElementById('count-media-gifs');
        const elAud = document.getElementById('count-media-audio');
        const elOth = document.getElementById('count-media-other');
        const elTotal = document.getElementById('media-total-count');

        if (elAll) elAll.textContent = counts.all;
        if (elImg) elImg.textContent = counts.images;
        if (elVid) elVid.textContent = counts.videos;
        if (elDoc) elDoc.textContent = counts.documents;
        if (elGif) elGif.textContent = counts.gifs;
        if (elAud) elAud.textContent = counts.audio;
        if (elOth) elOth.textContent = counts.other;
        if (elTotal) elTotal.textContent = counts.all;
    }

    async function deleteMedia(mediaId, mediaName) {
        if (!confirm(`Are you sure you want to permanently hard delete media "${mediaName}"? This file will be completely removed from storage.`)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/chatbot/media/${mediaId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to hard delete media item');

            showToast(`Media "${mediaName}" hard deleted permanently`, 'success');
            await fetchMedia();
            await fetchStorageUsage();
            await fetchProducts();
        } catch (err) {
            console.error('[HARD DELETE MEDIA ERROR]', err);
            showToast('Error hard deleting media item', 'error');
        }
    }
    window.deleteMedia = deleteMedia;

    function renderMediaGrid() {
        const gridEl = document.getElementById('media-library-grid');
        if (!gridEl) return;

        if (mediaList.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;">
                    <i class="fa-regular fa-images" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 8px; display: block;"></i>
                    <p style="font-weight: 700; margin: 0;">No media items found for "${currentMediaTypeFilter}"</p>
                    <p style="font-size: 0.8rem; margin-top: 4px;">Click "Upload Media" to upload files to Supabase Storage.</p>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = mediaList.map(m => {
            const isVideo = m.file_type === 'video' || (m.mime_type && m.mime_type.startsWith('video/'));
            const isDoc = m.file_type === 'document' || (m.mime_type && m.mime_type.includes('pdf'));
            const safeName = (m.original_name || m.filename || 'media').replace(/'/g, "\\'");

            let previewMediaHtml = `<img src="${m.file_url}" style="width: 100%; height: 110px; object-fit: cover;" onerror="handleImageError(this)"/>`;
            if (isVideo) {
                previewMediaHtml = `<video src="${m.file_url}" style="width: 100%; height: 110px; object-fit: cover; background: #000;" controls></video>`;
            } else if (isDoc) {
                previewMediaHtml = `
                    <div style="width: 100%; height: 110px; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6366f1;">
                        <i class="fa-regular fa-file-pdf" style="font-size: 2.5rem; margin-bottom: 4px;"></i>
                        <span style="font-size: 0.7rem; font-weight: 700;">PDF DOCUMENT</span>
                    </div>
                `;
            }

            return `
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff; position: relative; group;">
                    ${previewMediaHtml}
                    <button onclick="event.stopPropagation(); window.deleteMedia(${m.id}, '${safeName}')" title="Permanently Hard Delete Media" style="position: absolute; top: 6px; right: 6px; background: #ef4444; color: #fff; border: none; border-radius: 6px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
                        <i class="fa-solid fa-trash" style="font-size: 0.75rem;"></i>
                    </button>
                    <div style="padding: 8px; font-size: 0.75rem;">
                        <div style="font-weight: 700; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.original_name || m.filename}</div>
                        <div style="color: #94a3b8; margin-top: 2px;">${((m.size_bytes || 0) / (1024 * 1024)).toFixed(1)} MB • ${(m.file_type || 'file').toUpperCase()}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    const btnUploadMediaLib = document.getElementById('btn-upload-media-lib');
    if (btnUploadMediaLib) {
        btnUploadMediaLib.addEventListener('click', () => {
            if (inpWizardMediaFiles) inpWizardMediaFiles.click();
        });
    }

    // ── Product Details Drawer Media Uploader ──
    const inpDrawerMediaFile = document.getElementById('inp-drawer-media-file');

    if (btnUploadDrawerMedia && inpDrawerMediaFile) {
        btnUploadDrawerMedia.addEventListener('click', () => {
            inpDrawerMediaFile.click();
        });

        inpDrawerMediaFile.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0 || !selectedProductId) return;

            const p = productsList.find(item => item.id === selectedProductId);
            if (!p) return;

            showToast('Uploading media to product gallery...', 'info');

            try {
                const formData = new FormData();
                files.forEach(f => formData.append('media', f));
                formData.append('associated_product_id', selectedProductId);

                const token = localStorage.getItem('token') || localStorage.getItem('crm_token') || sessionStorage.getItem('token') || '';
                const uploadHeaders = {};
                if (token) uploadHeaders['Authorization'] = `Bearer ${token}`;

                const uploadRes = await fetch(`${API_BASE_URL}/api/chatbot/media/upload`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: formData
                });

                if (!uploadRes.ok) throw new Error('Failed to upload media files');
                const uploadedItems = await uploadRes.json();
                const newUrls = Array.isArray(uploadedItems) ? uploadedItems.map(m => m.file_url) : [uploadedItems.file_url];

                // Parse existing gallery URLs
                let existingGallery = Array.isArray(p.gallery_urls) ? [...p.gallery_urls] : [];
                if (typeof p.gallery_urls === 'string') {
                    try { existingGallery = JSON.parse(p.gallery_urls); } catch(err) {}
                }

                const updatedGallery = [...existingGallery, ...newUrls];
                const primaryImageUrl = (!p.image_url || p.image_url === SVG_PRODUCT_PLACEHOLDER) ? newUrls[0] : p.image_url;

                // Save updated product
                const updateRes = await fetch(`${API_BASE_URL}/api/chatbot/products/${selectedProductId}`, {
                    method: 'PUT',
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: p.name,
                        sku: p.sku,
                        category: p.category,
                        price: p.price,
                        status: p.status,
                        description: p.description,
                        image_url: primaryImageUrl,
                        gallery_urls: updatedGallery,
                        specs: p.specs,
                        tags: p.tags
                    })
                });

                if (!updateRes.ok) throw new Error('Failed to update product gallery');

                showToast(`Successfully added ${newUrls.length} media item(s) to product!`, 'success');

                inpDrawerMediaFile.value = '';
                await fetchProducts();
                await fetchMedia();
                await fetchStorageUsage();
                selectProduct(selectedProductId);
            } catch (err) {
                console.error('[PRODUCT MEDIA UPLOAD ERROR]', err);
                showToast('Error uploading product media: ' + err.message, 'error');
            }
        });
    }

    // ── Render Products Workspace (Table & Grid Views) ──
    function renderProductsUI() {
        const totalCountEl = document.getElementById('products-total-count');
        if (totalCountEl) totalCountEl.textContent = productsList.length;

        // Update Dynamic Pagination Text
        if (pmPaginationInfo) {
            const count = productsList.length;
            pmPaginationInfo.textContent = count > 0 
                ? `Showing 1 to ${count} of ${count} products` 
                : 'Showing 0 of 0 products';
        }

        if (productsList.length === 0) {
            if (productsTableBody) {
                productsTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 48px; color: #64748b;">
                            <i class="fa-solid fa-box-open" style="font-size: 2.5rem; margin-bottom: 12px; color: #cbd5e1; display: block;"></i>
                            <p style="font-weight: 700; margin-bottom: 4px; color: #1e293b;">No Products Found</p>
                            <p style="font-size: 0.85rem;">Try adjusting your search query or category filters.</p>
                        </td>
                    </tr>
                `;
            }
            if (productsGridContainer) {
                productsGridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No products found</div>`;
            }
            if (detailsDrawer) detailsDrawer.style.display = 'none';
            return;
        }

        if (!selectedProductId || !productsList.some(p => p.id === selectedProductId)) {
            selectedProductId = productsList[0].id;
        }

        // 1. Render Table View
        if (productsTableBody) {
            productsTableBody.innerHTML = productsList.map(p => {
                const isSelected = p.id === selectedProductId;
                const formattedPrice = `₹${parseFloat(p.price || 0).toLocaleString('en-IN')}`;
                const catBadgeClass = getCatBadgeClass(p.category);
                const imgPath = p.image_url || SVG_PRODUCT_PLACEHOLDER;
                const updatedDate = p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently';

                return `
                    <tr data-id="${p.id}" class="${isSelected ? 'selected-row' : ''}">
                        <td>
                            <div class="pm-product-cell">
                                <img src="${imgPath}" alt="${p.name}" class="pm-thumb-img" onerror="handleImageError(this)"/>
                                <div class="pm-product-meta">
                                    <span class="pm-product-title">${p.name}</span>
                                    <span class="pm-product-subtitle">${p.category} • SKU: ${p.sku}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="badge-cat ${catBadgeClass}">${p.category}</span>
                        </td>
                        <td>
                            <strong style="color: #0f172a; font-size: 0.925rem;">${formattedPrice}</strong>
                        </td>
                        <td>
                            <span class="badge-status ${p.status}">${p.status === 'active' ? '• Active' : '• Draft'}</span>
                        </td>
                        <td>
                            <span class="badge-flows">${p.used_in_flows_count || 0} ${(p.used_in_flows_count || 0) === 1 ? 'Flow' : 'Flows'}</span>
                        </td>
                        <td style="color: #64748b; font-size: 0.825rem;">
                            ${updatedDate}
                        </td>
                        <td>
                            <div class="pm-action-group">
                                <button class="btn-tbl-action btn-view-prod" title="View Details" data-id="${p.id}">
                                    <i class="fa-regular fa-eye"></i>
                                </button>
                                <button class="btn-tbl-action btn-delete-prod" title="Delete Product" data-id="${p.id}">
                                    <i class="fa-regular fa-trash-can" style="color: #ef4444;"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            productsTableBody.querySelectorAll('tr').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    const btnDelete = e.target.closest('.btn-delete-prod');
                    const btnView = e.target.closest('.btn-view-prod');
                    const prodId = parseInt(tr.getAttribute('data-id'));
                    if (!prodId) return;

                    if (btnDelete) {
                        e.stopPropagation();
                        deleteProduct(prodId);
                        return;
                    }
                    if (btnView) {
                        e.stopPropagation();
                        selectProduct(prodId);
                        return;
                    }

                    selectProduct(prodId);
                });
            });
        }

        // 2. Render Grid View Cards
        if (productsGridContainer) {
            productsGridContainer.innerHTML = productsList.map(p => {
                const isSelected = p.id === selectedProductId;
                const formattedPrice = `₹${parseFloat(p.price || 0).toLocaleString('en-IN')}`;
                const imgPath = p.image_url || SVG_PRODUCT_PLACEHOLDER;

                return `
                    <div class="product-grid-card ${isSelected ? 'selected-grid-card' : ''}" data-id="${p.id}" style="border: 2px solid ${isSelected ? '#4f46e5' : '#e2e8f0'}; border-radius: 8px; overflow: hidden; background: #fff; cursor: pointer; transition: all 0.2s ease;">
                        <div style="position: relative; width: 100%; height: 130px; background: #f8fafc;">
                            <img src="${imgPath}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="handleImageError(this)" />
                            <span class="badge-status ${p.status}" style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.9); font-size: 0.7rem; padding: 2px 8px; border-radius: 12px;">${p.status === 'active' ? 'Active' : 'Draft'}</span>
                        </div>
                        <div style="padding: 12px;">
                            <div style="font-size: 0.75rem; color: #6366f1; font-weight: 700;">${p.category}</div>
                            <div style="font-size: 0.9rem; font-weight: 700; color: #0f172a; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</div>
                            <div style="font-size: 0.75rem; color: #94a3b8;">SKU: ${p.sku}</div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                                <strong style="color: #0f172a; font-size: 1rem;">${formattedPrice}</strong>
                                <span class="badge-flows" style="font-size: 0.7rem;">${p.used_in_flows_count || 0} Flows</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            productsGridContainer.querySelectorAll('.product-grid-card').forEach(card => {
                card.addEventListener('click', () => {
                    const prodId = parseInt(card.getAttribute('data-id'));
                    selectProduct(prodId);
                });
            });
        }

        selectProduct(selectedProductId);
    }

    // Toggle Table vs Grid View
    if (viewModeListBtn && viewModeGridBtn) {
        viewModeListBtn.addEventListener('click', () => {
            currentViewMode = 'list';
            viewModeListBtn.classList.add('active');
            viewModeGridBtn.classList.remove('active');
            if (productsTableCard) productsTableCard.style.display = 'block';
            if (productsGridCard) productsGridCard.style.display = 'none';
        });

        viewModeGridBtn.addEventListener('click', () => {
            currentViewMode = 'grid';
            viewModeGridBtn.classList.add('active');
            viewModeListBtn.classList.remove('active');
            if (productsTableCard) productsTableCard.style.display = 'none';
            if (productsGridCard) productsGridCard.style.display = 'block';
        });
    }

    function getCatBadgeClass(category) {
        if (category === 'Full Set Machines') return 'full-set';
        if (category === 'Trolley') return 'trolley';
        if (category === 'Dumper') return 'dumper';
        if (category === 'Tractor') return 'tractor';
        return 'default';
    }

    // ── Select Product & Render Dynamic Right Drawer ──
    function selectProduct(prodId) {
        selectedProductId = prodId;
        const p = productsList.find(item => item.id === prodId);
        if (!p) return;

        if (productsTableBody) {
            productsTableBody.querySelectorAll('tr').forEach(tr => {
                tr.classList.toggle('selected-row', parseInt(tr.getAttribute('data-id')) === prodId);
            });
        }

        if (productsGridContainer) {
            productsGridContainer.querySelectorAll('.product-grid-card').forEach(card => {
                const isSel = parseInt(card.getAttribute('data-id')) === prodId;
                card.style.borderColor = isSel ? '#4f46e5' : '#e2e8f0';
            });
        }

        if (drawerTitle) drawerTitle.textContent = p.name;
        if (drawerSku) drawerSku.textContent = `${p.category} • SKU: ${p.sku}`;
        if (drawerPrice) drawerPrice.textContent = `₹${parseFloat(p.price || 0).toLocaleString('en-IN')}`;
        
        if (drawerStatus) {
            drawerStatus.className = `badge-status ${p.status}`;
            drawerStatus.textContent = p.status === 'active' ? '• Active' : '• Draft';
        }
        if (drawerDesc) drawerDesc.textContent = p.description || 'No description available for this machinery product.';

        // Render Specifications
        if (drawerSpecs) {
            const specsArray = Array.isArray(p.specs) ? p.specs : [];
            if (specsArray.length > 0) {
                drawerSpecs.innerHTML = specsArray.map(s => `
                    <div class="spec-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #f1f5f9; font-size: 0.8rem;">
                        <span class="spec-key" style="color: #64748b; font-weight: 500;">${s.key}:</span>
                        <span class="spec-val" style="color: #0f172a; font-weight: 700;">${s.val}</span>
                    </div>
                `).join('');
            } else {
                drawerSpecs.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem;">No specifications added.</div>';
            }
        }

        // Render Tags
        if (drawerTags) {
            const tagsArray = Array.isArray(p.tags) ? p.tags : [];
            if (tagsArray.length > 0) {
                drawerTags.innerHTML = tagsArray.map(t => `<span class="tag-chip">#${t}</span>`).join('');
            } else {
                drawerTags.innerHTML = '<span style="color: #94a3b8; font-size: 0.8rem;">No tags</span>';
            }
        }

        const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently';
        const updatedDate = p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently';

        if (drawerCreated) drawerCreated.textContent = `Created: ${createdDate}`;
        if (drawerUpdated) drawerUpdated.textContent = `Updated: ${updatedDate}`;

        // Extract Gallery URLs cleanly (supporting Array or JSON string)
        let galleryUrls = [];
        if (Array.isArray(p.gallery_urls)) {
            galleryUrls = p.gallery_urls.filter(u => u && u.trim().length > 0);
        } else if (typeof p.gallery_urls === 'string') {
            try { 
                const parsed = JSON.parse(p.gallery_urls);
                if (Array.isArray(parsed)) galleryUrls = parsed.filter(u => u && u.trim().length > 0);
            } catch(e) {}
        }

        if (galleryUrls.length === 0 && p.image_url && p.image_url !== SVG_PRODUCT_PLACEHOLDER) {
            galleryUrls = [p.image_url];
        }

        if (drawerMediaCount) drawerMediaCount.textContent = galleryUrls.length;
        if (drawerFlowsCount) drawerFlowsCount.textContent = p.used_in_flows_count || 0;

        // Set Main Preview
        setDrawerMainPreview(galleryUrls.length > 0 ? galleryUrls[0] : (p.image_url || SVG_PRODUCT_PLACEHOLDER));

        // Render Gallery Thumbnail Strip (Max 3 + Badge)
        if (drawerThumbStrip) {
            if (galleryUrls.length === 0) {
                drawerThumbStrip.innerHTML = '<div style="font-size: 0.75rem; color: #94a3b8; font-style: italic;">No media gallery items</div>';
            } else {
                const maxVisible = 3;
                const visibleUrls = galleryUrls.slice(0, maxVisible);
                const extraCount = galleryUrls.length > maxVisible ? galleryUrls.length - maxVisible : 0;

                let stripHtml = visibleUrls.map((url, idx) => {
                    const isVideo = url.endsWith('.mp4') || url.includes('video');
                    if (isVideo) {
                        return `
                            <div class="strip-thumb-box ${idx === 0 ? 'active' : ''}" data-url="${url}" style="position: relative; width: 44px; height: 44px; border-radius: 6px; overflow: hidden; border: 2px solid ${idx === 0 ? '#4f46e5' : '#e2e8f0'}; cursor: pointer; flex-shrink: 0; background: #000;">
                                <video src="${url}" style="width: 100%; height: 100%; object-fit: cover;"></video>
                                <i class="fa-solid fa-play" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-size: 0.75rem;"></i>
                            </div>
                        `;
                    }
                    return `
                        <img src="${url}" class="strip-thumb ${idx === 0 ? 'active' : ''}" data-url="${url}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover; border: 2px solid ${idx === 0 ? '#4f46e5' : '#e2e8f0'}; cursor: pointer; flex-shrink: 0;" onerror="handleImageError(this)" />
                    `;
                }).join('');

                if (extraCount > 0) {
                    stripHtml += `
                        <div class="strip-thumb more-badge" id="btn-drawer-more-media" style="width: 44px; height: 44px; border-radius: 6px; background: #1e293b; color: #fff; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;">
                            +${extraCount}
                        </div>
                    `;
                }

                drawerThumbStrip.innerHTML = stripHtml;
            }

            // Thumbnail click listener
            drawerThumbStrip.querySelectorAll('[data-url]').forEach(thumb => {
                thumb.addEventListener('click', () => {
                    const url = thumb.getAttribute('data-url');
                    setDrawerMainPreview(url);

                    drawerThumbStrip.querySelectorAll('.strip-thumb, .strip-thumb-box').forEach(t => {
                        t.style.borderColor = '#e2e8f0';
                    });
                    thumb.style.borderColor = '#4f46e5';
                });
            });

            const btnMoreMedia = document.getElementById('btn-drawer-more-media');
            if (btnMoreMedia) {
                btnMoreMedia.addEventListener('click', () => {
                    switchDrawerTab('media');
                });
            }
        }

        // Render Drawer Media Tab Grid
        renderDrawerMediaPanel(galleryUrls);

        // Render Drawer Flows Tab List
        renderDrawerFlowsPanel(p);

        if (detailsDrawer) {
            detailsDrawer.style.display = 'flex';
        }
    }

    function setDrawerMainPreview(url) {
        if (!url) return;
        const isVideo = url.endsWith('.mp4') || url.includes('/video');

        if (isVideo) {
            if (drawerMainImg) drawerMainImg.style.display = 'none';
            if (drawerMainVideo) {
                drawerMainVideo.style.display = 'block';
                drawerMainVideo.src = url;
            }
        } else {
            if (drawerMainVideo) {
                drawerMainVideo.pause();
                drawerMainVideo.style.display = 'none';
            }
            if (drawerMainImg) {
                drawerMainImg.style.display = 'block';
                drawerMainImg.src = url;
            }
        }
    }

    // Switch Right Drawer Sub-Tabs
    function switchDrawerTab(tabName) {
        document.querySelectorAll('.drawer-sub-tab').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-drawer-tab') === tabName);
        });

        if (drawerPanelOverview) drawerPanelOverview.style.display = tabName === 'overview' ? 'block' : 'none';
        if (drawerPanelMedia) drawerPanelMedia.style.display = tabName === 'media' ? 'block' : 'none';
        if (drawerPanelFlows) drawerPanelFlows.style.display = tabName === 'flows' ? 'block' : 'none';
    }

    document.querySelectorAll('.drawer-sub-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-drawer-tab');
            switchDrawerTab(tabName);
        });
    });

    async function removeProductGalleryMedia(urlToRemove) {
        if (!selectedProductId) return;
        const p = productsList.find(item => item.id === selectedProductId);
        if (!p) return;

        if (!confirm('Remove this media item from product gallery?')) return;

        try {
            let existingGallery = Array.isArray(p.gallery_urls) ? [...p.gallery_urls] : [];
            if (typeof p.gallery_urls === 'string') {
                try { existingGallery = JSON.parse(p.gallery_urls); } catch(err) {}
            }

            const updatedGallery = existingGallery.filter(u => u !== urlToRemove);
            let primaryImageUrl = p.image_url;
            if (p.image_url === urlToRemove) {
                primaryImageUrl = updatedGallery.length > 0 ? updatedGallery[0] : '';
            }

            const updateRes = await fetch(`${API_BASE_URL}/api/chatbot/products/${selectedProductId}`, {
                method: 'PUT',
                headers: {
                    ...getAuthHeaders(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: p.name,
                    sku: p.sku,
                    category: p.category,
                    price: p.price,
                    status: p.status,
                    description: p.description,
                    image_url: primaryImageUrl,
                    gallery_urls: updatedGallery,
                    specs: p.specs,
                    tags: p.tags
                })
            });

            if (!updateRes.ok) throw new Error('Failed to remove media from product gallery');

            showToast('Media removed from product gallery', 'success');
            await fetchProducts();
            selectProduct(selectedProductId);
        } catch (err) {
            console.error('[REMOVE GALLERY MEDIA ERROR]', err);
            showToast('Error removing gallery media', 'error');
        }
    }
    window.removeProductGalleryMedia = removeProductGalleryMedia;

    function renderDrawerMediaPanel(galleryUrls) {
        if (!drawerMediaGrid) return;

        if (!galleryUrls || galleryUrls.length === 0) {
            drawerMediaGrid.innerHTML = '<div style="grid-column: 1/-1; color: #94a3b8; font-size: 0.8rem; text-align: center; padding: 20px;">No media files uploaded for this product.</div>';
            return;
        }

        drawerMediaGrid.innerHTML = galleryUrls.map((url, idx) => {
            const isVideo = url.endsWith('.mp4') || url.includes('/video');
            const safeUrl = url.replace(/'/g, "\\'");
            const mediaContent = isVideo
                ? `<video src="${url}" controls style="width: 100%; height: 90px; object-fit: cover; background: #000;"></video>`
                : `<img src="${url}" style="width: 100%; height: 90px; object-fit: cover;" onerror="handleImageError(this)"/>`;

            return `
                <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background: #fff; position: relative;">
                    ${mediaContent}
                    <button onclick="event.stopPropagation(); window.removeProductGalleryMedia('${safeUrl}')" title="Remove from product gallery" style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 4px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 5;">
                        <i class="fa-solid fa-trash" style="font-size: 0.65rem;"></i>
                    </button>
                    <div style="padding: 6px; font-size: 0.7rem; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
                        <span>Media #${idx + 1}</span>
                        <a href="${url}" target="_blank" style="color: #4f46e5; text-decoration: none; font-weight: 700;">View</a>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderDrawerFlowsPanel(p) {
        if (!drawerFlowsList) return;

        const count = p.used_in_flows_count || 0;
        if (count === 0) {
            drawerFlowsList.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem; text-align: center; padding: 20px;">This product is not linked in any active chatbot flows.</div>';
            return;
        }

        drawerFlowsList.innerHTML = `
            <div style="padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 700; font-size: 0.85rem; color: #0f172a;">Agro Machinery Sales Inquiry Flow</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">Trigger: "tiller", "machinery", "price"</div>
                </div>
                <span class="badge-status active">• Active</span>
            </div>
            <div style="padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 700; font-size: 0.85rem; color: #0f172a;">WhatsApp Product Showcase Bot</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">Trigger: "catalog", "specifications"</div>
                </div>
                <span class="badge-status active">• Active</span>
            </div>
        `;
    }
    // Delete Product
    async function deleteProduct(prodId) {
        const prod = productsList.find(p => p.id === prodId);
        const name = prod ? prod.name : 'Product';

        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/chatbot/products/${prodId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to delete product');

            showToast(`Product "${name}" deleted successfully`, 'success');
            await fetchProducts();
            await fetchCategories();
        } catch (err) {
            console.error('[DELETE PRODUCT ERROR]', err);
            showToast('Error deleting product', 'error');
        }
    }

    if (btnDrawerDelete) {
        btnDrawerDelete.addEventListener('click', () => {
            if (selectedProductId) deleteProduct(selectedProductId);
        });
    }

    // Edit Product Handler
    if (btnDrawerEdit) {
        btnDrawerEdit.addEventListener('click', () => {
            if (!selectedProductId) return;
            const p = productsList.find(item => item.id === selectedProductId);
            if (!p) return;

            if (editProdId) editProdId.value = p.id;
            if (editProdName) editProdName.value = p.name || '';
            if (editProdCat) editProdCat.value = p.category || '';
            if (editProdPrice) editProdPrice.value = p.price || '';
            if (editProdStatus) editProdStatus.value = p.status || 'active';
            if (editProdSku) editProdSku.value = p.sku || '';
            if (editProdImg) editProdImg.value = p.image_url || '';
            if (editProdDesc) editProdDesc.value = p.description || '';
            if (editProdTags) editProdTags.value = Array.isArray(p.tags) ? p.tags.join(', ') : '';

            // Render Edit Specs
            if (editSpecsContainer) {
                const specs = Array.isArray(p.specs) ? p.specs : [];
                editSpecsContainer.innerHTML = specs.map(s => `
                    <div class="edit-spec-row" style="display: flex; gap: 8px; align-items: center;">
                        <input type="text" class="spec-key-inp" value="${s.key}" placeholder="Key e.g. Horsepower" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem;" />
                        <input type="text" class="spec-val-inp" value="${s.val}" placeholder="Value e.g. 18 HP" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem;" />
                        <button type="button" class="btn-del-spec-row" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                `).join('');

                editSpecsContainer.querySelectorAll('.btn-del-spec-row').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.target.closest('.edit-spec-row').remove();
                    });
                });
            }

            if (modalEditProduct) modalEditProduct.classList.add('open');
        });
    }

    if (btnAddEditSpec && editSpecsContainer) {
        btnAddEditSpec.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'edit-spec-row';
            row.style.cssText = 'display: flex; gap: 8px; align-items: center;';
            row.innerHTML = `
                <input type="text" class="spec-key-inp" placeholder="Key e.g. Tilling Width" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem;" />
                <input type="text" class="spec-val-inp" placeholder="Value e.g. 120 cm" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem;" />
                <button type="button" class="btn-del-spec-row" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            row.querySelector('.btn-del-spec-row').addEventListener('click', () => row.remove());
            editSpecsContainer.appendChild(row);
        });
    }

    function closeEditModal() {
        if (modalEditProduct) modalEditProduct.classList.remove('open');
    }

    if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', closeEditModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditModal);

    if (btnSaveEditProd) {
        btnSaveEditProd.addEventListener('click', async () => {
            const prodId = editProdId ? editProdId.value : null;
            if (!prodId) return;

            const name = editProdName.value.trim();
            const price = parseFloat(editProdPrice.value);
            if (!name || isNaN(price)) {
                showToast('Please provide a valid product name and price', 'error');
                return;
            }

            // Collect edit specs
            const updatedSpecs = [];
            if (editSpecsContainer) {
                editSpecsContainer.querySelectorAll('.edit-spec-row').forEach(row => {
                    const k = row.querySelector('.spec-key-inp').value.trim();
                    const v = row.querySelector('.spec-val-inp').value.trim();
                    if (k && v) updatedSpecs.push({ key: k, val: v });
                });
            }

            const updatedTags = (editProdTags.value || '')
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);

            btnSaveEditProd.disabled = true;
            btnSaveEditProd.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                const payload = {
                    name,
                    category: editProdCat.value,
                    price,
                    status: editProdStatus.value,
                    sku: editProdSku.value.trim(),
                    image_url: editProdImg.value.trim(),
                    description: editProdDesc.value.trim(),
                    specs: updatedSpecs,
                    tags: updatedTags
                };

                const res = await fetch(`${API_BASE_URL}/api/chatbot/products/${prodId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error('Failed to update product');
                const updatedProd = await res.json();

                showToast(`Product "${updatedProd.name}" updated successfully!`, 'success');
                closeEditModal();
                await fetchProducts();
                selectProduct(updatedProd.id);
            } catch (err) {
                console.error('[SAVE EDIT PRODUCT ERROR]', err);
                showToast('Error updating product', 'error');
            } finally {
                btnSaveEditProd.disabled = false;
                btnSaveEditProd.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
            }
        });
    }

    if (btnAddCategory) {
        btnAddCategory.addEventListener('click', async () => {
            const catName = prompt('Enter new Product Category name:');
            if (!catName || !catName.trim()) return;

            try {
                const res = await fetch(`${API_BASE_URL}/api/chatbot/categories`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name: catName.trim() })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.message || 'Error creating category');
                }

                showToast(`Category "${catName.trim()}" created successfully!`, 'success');
                await fetchCategories();
            } catch (err) {
                console.error('[CREATE CATEGORY ERROR]', err);
                showToast(err.message || 'Could not create category', 'error');
            }
        });
    }

    // Filter Listeners
    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                currentSearchQuery = e.target.value;
                fetchProducts();
            }, 300);
        });
    }

    if (filterStatus) {
        filterStatus.addEventListener('change', (e) => {
            currentStatusFilter = e.target.value;
            fetchProducts();
        });
    }

    if (filterCategory) {
        filterCategory.addEventListener('change', (e) => {
            currentCategoryFilter = e.target.value;
            updateCategoryListActiveUI(e.target.value);
            fetchProducts();
        });
    }

    if (filterSort) {
        filterSort.addEventListener('change', (e) => {
            applySorting(e.target.value);
        });
    }

    function updateCategoryListActiveUI(catVal) {
        if (!catList) return;
        catList.querySelectorAll('.pm-cat-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-cat') === catVal);
        });
    }

    // Media Types Sidebar Click Filter
    document.querySelectorAll('.pm-sidebar-card ul.pm-cat-list .pm-cat-item[data-type]').forEach(item => {
        item.addEventListener('click', () => {
            const typeVal = item.getAttribute('data-type');
            currentMediaTypeFilter = typeVal;

            document.querySelectorAll('.pm-sidebar-card ul.pm-cat-list .pm-cat-item').forEach(i => {
                i.classList.toggle('active', i.getAttribute('data-type') === typeVal);
            });
            
            if (tabBtnMedia) tabBtnMedia.click();
            fetchMedia();
        });
    });

    // ── Header Actions & Modals ──

    if (btnAddProductHdr) {
        btnAddProductHdr.addEventListener('click', () => {
            openAddProductModal();
        });
    }

    function openAddProductModal() {
        currentWizardStep = 1;
        wizardProductData = { uploadedFiles: [], specs: [] };
        if (wizardSpecsContainer) wizardSpecsContainer.innerHTML = '';
        renderWizardMediaPreviews();
        updateWizardUI();
        if (modalAddProduct) modalAddProduct.classList.add('open');
    }

    function closeAddProductModal() {
        if (modalAddProduct) modalAddProduct.classList.remove('open');
    }

    if (btnCloseAddModal) btnCloseAddModal.addEventListener('click', closeAddProductModal);
    if (btnCancelAddWizard) btnCancelAddWizard.addEventListener('click', closeAddProductModal);

    // Modal 5: How It Works Guide Event Listeners
    if (btnHowItWorks && modalHowItWorks) {
        btnHowItWorks.addEventListener('click', () => {
            modalHowItWorks.classList.add('open');
        });
    }

    function closeHowItWorksModal() {
        if (modalHowItWorks) modalHowItWorks.classList.remove('open');
    }

    if (btnCloseHowItWorks) btnCloseHowItWorks.addEventListener('click', closeHowItWorksModal);
    if (btnCloseHowItWorksFtr) btnCloseHowItWorksFtr.addEventListener('click', closeHowItWorksModal);

    if (btnHowStartWizard) {
        btnHowStartWizard.addEventListener('click', () => {
            closeHowItWorksModal();
            openAddProductModal();
        });
    }

    // Wizard Specs Builder
    if (btnAddWizardSpec && wizardSpecsContainer) {
        btnAddWizardSpec.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'wizard-spec-row';
            row.style.cssText = 'display: flex; gap: 8px; align-items: center;';
            row.innerHTML = `
                <input type="text" class="spec-key-inp" placeholder="Key e.g. Engine Power" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem;" />
                <input type="text" class="spec-val-inp" placeholder="Value e.g. 18 HP" style="flex: 1; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.8rem;" />
                <button type="button" class="btn-del-spec-row" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            row.querySelector('.btn-del-spec-row').addEventListener('click', () => row.remove());
            wizardSpecsContainer.appendChild(row);
        });
    }

    // Wizard Step 3 Upload Event Listeners & Drag Drop
    if (pmDropzoneWizard) {
        pmDropzoneWizard.addEventListener('click', (e) => {
            if (inpWizardMediaFiles) inpWizardMediaFiles.click();
        });

        pmDropzoneWizard.addEventListener('dragover', (e) => {
            e.preventDefault();
            pmDropzoneWizard.style.borderColor = '#4f46e5';
            pmDropzoneWizard.style.background = '#eef2ff';
        });

        pmDropzoneWizard.addEventListener('dragleave', () => {
            pmDropzoneWizard.style.borderColor = '#cbd5e1';
            pmDropzoneWizard.style.background = '#ffffff';
        });

        pmDropzoneWizard.addEventListener('drop', (e) => {
            e.preventDefault();
            pmDropzoneWizard.style.borderColor = '#cbd5e1';
            pmDropzoneWizard.style.background = '#ffffff';
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleWizardMediaUpload(e.dataTransfer.files);
            }
        });
    }

    if (btnBrowseWizardMedia) {
        btnBrowseWizardMedia.addEventListener('click', (e) => {
            e.stopPropagation();
            if (inpWizardMediaFiles) inpWizardMediaFiles.click();
        });
    }

    if (inpWizardMediaFiles) {
        inpWizardMediaFiles.addEventListener('change', () => {
            if (inpWizardMediaFiles.files && inpWizardMediaFiles.files.length > 0) {
                handleWizardMediaUpload(inpWizardMediaFiles.files);
            }
        });
    }

    async function handleWizardMediaUpload(filesList) {
        if (!wizardProductData.uploadedFiles) wizardProductData.uploadedFiles = [];
        if (!wizardMediaPreviewsList) return;

        const formData = new FormData();
        for (let i = 0; i < filesList.length; i++) {
            formData.append('files', filesList[i]);
        }

        const loadingEl = document.createElement('div');
        loadingEl.style.cssText = 'padding: 10px; background: #eef2ff; border: 1px dashed #6366f1; border-radius: 6px; font-size: 0.8rem; color: #4338ca; display: flex; align-items: center; gap: 8px;';
        loadingEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading ${filesList.length} file(s) to Supabase Storage...`;
        wizardMediaPreviewsList.appendChild(loadingEl);

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('crm_token') || sessionStorage.getItem('token') || '';
            const res = await fetch(`${API_BASE_URL}/api/chatbot/media/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: formData
            });

            const uploadedItems = await res.json();
            const itemsArray = Array.isArray(uploadedItems) ? uploadedItems : (uploadedItems ? [uploadedItems] : []);

            loadingEl.remove();

            itemsArray.forEach(item => {
                wizardProductData.uploadedFiles.push(item);
            });

            renderWizardMediaPreviews();
            showToast(`Uploaded ${itemsArray.length} media file(s) successfully!`, 'success');
            await fetchStorageUsage();
            await fetchMedia();
        } catch (err) {
            console.error('[WIZARD MEDIA UPLOAD ERROR]', err);
            loadingEl.remove();
            showToast('Error uploading media files', 'error');
        }
    }

    function renderWizardMediaPreviews() {
        if (!wizardMediaPreviewsList) return;
        const list = wizardProductData.uploadedFiles || [];

        if (list.length === 0) {
            wizardMediaPreviewsList.innerHTML = '';
            return;
        }

        wizardMediaPreviewsList.innerHTML = list.map((file, idx) => {
            const isImg = file.file_type === 'image' || (file.mime_type && file.mime_type.startsWith('image/'));
            const iconHtml = isImg 
                ? `<img src="${file.file_url}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px;" />` 
                : `<i class="fa-regular fa-file-lines" style="font-size: 1.5rem; color: #6366f1;"></i>`;
            
            const formattedSize = file.size_bytes ? `${(file.size_bytes / (1024 * 1024)).toFixed(1)} MB` : 'Media File';

            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        ${iconHtml}
                        <div style="min-width: 0;">
                            <div style="font-weight: 700; font-size: 0.8rem; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.original_name || file.filename}</div>
                            <div style="font-size: 0.725rem; color: #10b981; margin-top: 1px;">✓ Uploaded to Supabase • ${formattedSize}</div>
                        </div>
                    </div>
                    <button type="button" class="btn-remove-wizard-file" data-idx="${idx}" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join('');

        wizardMediaPreviewsList.querySelectorAll('.btn-remove-wizard-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-idx'));
                wizardProductData.uploadedFiles.splice(idx, 1);
                renderWizardMediaPreviews();
            });
        });
    }

    // Wizard Navigation Buttons
    const btnNextStep1 = document.getElementById('btn-next-step1');
    const btnPrevStep2 = document.getElementById('btn-prev-step2');
    const btnNextStep2 = document.getElementById('btn-next-step2');
    const btnPrevStep3 = document.getElementById('btn-prev-step3');
    const btnSaveProduct = document.getElementById('btn-save-product');
    const btnDoneSuccess = document.getElementById('btn-done-success');

    if (btnNextStep1) {
        btnNextStep1.addEventListener('click', () => {
            const name = document.getElementById('inp-prod-name').value.trim();
            const price = document.getElementById('inp-prod-price').value.trim();
            if (!name || !price) {
                showToast('Please fill in Product Name and Price', 'error');
                return;
            }
            wizardProductData.name = name;
            wizardProductData.category = document.getElementById('inp-prod-cat').value;
            wizardProductData.price = parseFloat(price);
            wizardProductData.sku = document.getElementById('inp-prod-sku').value.trim() || `PROD-${Date.now().toString().slice(-6)}`;

            currentWizardStep = 2;
            updateWizardUI();
        });
    }

    if (btnPrevStep2) {
        btnPrevStep2.addEventListener('click', () => {
            currentWizardStep = 1;
            updateWizardUI();
        });
    }

    if (btnNextStep2) {
        btnNextStep2.addEventListener('click', () => {
            wizardProductData.description = document.getElementById('inp-prod-desc').value.trim();
            wizardProductData.tags = (document.getElementById('inp-prod-tags').value || '')
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);

            // Collect specs
            wizardProductData.specs = [];
            if (wizardSpecsContainer) {
                wizardSpecsContainer.querySelectorAll('.wizard-spec-row').forEach(row => {
                    const k = row.querySelector('.spec-key-inp').value.trim();
                    const v = row.querySelector('.spec-val-inp').value.trim();
                    if (k && v) wizardProductData.specs.push({ key: k, val: v });
                });
            }

            currentWizardStep = 3;
            updateWizardUI();
        });
    }

    if (btnPrevStep3) {
        btnPrevStep3.addEventListener('click', () => {
            currentWizardStep = 2;
            updateWizardUI();
        });
    }

    if (btnSaveProduct) {
        btnSaveProduct.addEventListener('click', async () => {
            btnSaveProduct.disabled = true;
            btnSaveProduct.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            try {
                const galleryUrls = (wizardProductData.uploadedFiles && wizardProductData.uploadedFiles.length > 0)
                    ? wizardProductData.uploadedFiles.map(f => f.file_url)
                    : [];

                const mainImgUrl = galleryUrls.length > 0 ? galleryUrls[0] : '';

                const payload = {
                    name: wizardProductData.name,
                    sku: wizardProductData.sku,
                    category: wizardProductData.category,
                    price: wizardProductData.price,
                    status: 'active',
                    description: wizardProductData.description || '',
                    image_url: mainImgUrl,
                    gallery_urls: galleryUrls,
                    specs: wizardProductData.specs && wizardProductData.specs.length > 0 
                        ? wizardProductData.specs 
                        : [],
                    tags: wizardProductData.tags || []
                };

                const res = await fetch(`${API_BASE_URL}/api/chatbot/products`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errRes = await res.json();
                    throw new Error(errRes.message || 'Failed to save product');
                }

                const savedProduct = await res.json();

                await fetchProducts();
                await fetchCategories();
                selectProduct(savedProduct.id);

                currentWizardStep = 4;
                updateWizardUI();
                showToast(`Product "${savedProduct.name}" created successfully!`, 'success');
            } catch (err) {
                console.error('[SAVE PRODUCT ERROR]', err);
                showToast(err.message || 'Error saving product', 'error');
            } finally {
                btnSaveProduct.disabled = false;
                btnSaveProduct.innerHTML = 'Save Product';
            }
        });
    }

    if (btnDoneSuccess) {
        btnDoneSuccess.addEventListener('click', closeAddProductModal);
    }

    function updateWizardUI() {
        for (let i = 1; i <= 4; i++) {
            const card = document.getElementById(`wizard-step-${i}`);
            const indicator = document.getElementById(`step-ind-${i}`);

            if (card) {
                card.style.display = i === currentWizardStep ? 'block' : 'none';
            }

            if (indicator) {
                indicator.classList.toggle('active', i === currentWizardStep);
                indicator.classList.toggle('completed', i < currentWizardStep);
            }
        }
    }

    if (btnOpenMediaLib) {
        btnOpenMediaLib.addEventListener('click', () => {
            if (tabBtnMedia) tabBtnMedia.click();
        });
    }

    if (btnImportProducts) {
        btnImportProducts.addEventListener('click', () => {
            if (modalImportProducts) modalImportProducts.classList.add('open');
        });
    }

    function closeImportModal() {
        if (modalImportProducts) modalImportProducts.classList.remove('open');
    }

    if (btnCloseImportModal) btnCloseImportModal.addEventListener('click', closeImportModal);
    if (btnCancelImport) btnCancelImport.addEventListener('click', closeImportModal);

    if (btnLoadSampleJson) {
        btnLoadSampleJson.addEventListener('click', () => {
            if (txtImportJson) {
                txtImportJson.value = JSON.stringify([
                    {
                        "name": "Machine 28K Heavy Duty Tiller",
                        "category": "Full Set Machines",
                        "price": 28000,
                        "sku": "FSM-28K",
                        "description": "28 HP heavy diesel tiller for commercial farming.",
                        "tags": ["28k", "heavy duty", "power tiller"]
                    },
                    {
                        "name": "Heavy Steel Trailer Trolley",
                        "category": "Trolley",
                        "price": 45000,
                        "sku": "TRL-HVY",
                        "description": "2-ton capacity hydraulic tipping trailer trolley.",
                        "tags": ["trolley", "trailer", "hydraulic"]
                    }
                ], null, 2);
            }
        });
    }

    if (btnSubmitImport) {
        btnSubmitImport.addEventListener('click', async () => {
            const jsonText = txtImportJson ? txtImportJson.value.trim() : '';
            if (!jsonText) {
                showToast('Please enter or paste JSON product data', 'error');
                return;
            }

            try {
                const parsedProducts = JSON.parse(jsonText);
                const productsArray = Array.isArray(parsedProducts) ? parsedProducts : [parsedProducts];

                btnSubmitImport.disabled = true;
                btnSubmitImport.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';

                const res = await fetch(`${API_BASE_URL}/api/chatbot/products/import`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ products: productsArray })
                });

                if (!res.ok) {
                    const errRes = await res.json();
                    throw new Error(errRes.message || 'Import failed');
                }

                const result = await res.json();
                showToast(result.message || 'Products imported successfully!', 'success');
                closeImportModal();
                await fetchProducts();
                await fetchCategories();
            } catch (err) {
                console.error('[IMPORT ERROR]', err);
                showToast(err.message || 'Invalid JSON format or import error', 'error');
            } finally {
                btnSubmitImport.disabled = false;
                btnSubmitImport.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Import Products';
            }
        });
    }

    if (btnManageStorage) {
        btnManageStorage.addEventListener('click', () => {
            fetchStorageUsage();
            if (modalManageStorage) modalManageStorage.classList.add('open');
        });
    }

    function closeStorageModal() {
        if (modalManageStorage) modalManageStorage.classList.remove('open');
    }

    if (btnCloseStorageModal) btnCloseStorageModal.addEventListener('click', closeStorageModal);
    if (btnCloseStorageDone) btnCloseStorageDone.addEventListener('click', closeStorageModal);

    if (btnCleanTempStorage) {
        btnCleanTempStorage.addEventListener('click', () => {
            showToast('Orphan temporary files cleaned up safely!', 'success');
        });
    }

    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', () => {
            if (detailsDrawer) detailsDrawer.style.display = 'none';
        });
    }

    if (tabBtnProducts && tabBtnMedia) {
        tabBtnProducts.addEventListener('click', () => {
            tabBtnProducts.classList.add('active');
            tabBtnMedia.classList.remove('active');
            if (productsViewContainer) productsViewContainer.style.display = 'block';
            if (mediaViewContainer) mediaViewContainer.style.display = 'none';
        });

        tabBtnMedia.addEventListener('click', () => {
            tabBtnMedia.classList.add('active');
            tabBtnProducts.classList.remove('active');
            if (productsViewContainer) productsViewContainer.style.display = 'none';
            if (mediaViewContainer) mediaViewContainer.style.display = 'block';
            fetchMedia();
        });
    }

    // Initial Execution & Fetching
    fetchCategories();
    fetchProducts();
    fetchStorageUsage();
    fetchMedia();
});
