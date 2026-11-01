/**
 * temp-order-report.js
 * ─────────────────────────────────────────────────────────────
 * Sales Manager — Manual Telecaller Sales Tracking
 * Handles: load, batch create (multi-product click selection),
 * edit, delete, monthly summary
 * ─────────────────────────────────────────────────────────────
 */

// ── State ─────────────────────────────────────────────────────
let _allTelecallers = [];
let _allProducts    = [];
let _cachedRecords  = [];

// Selected products map for batch modal:
// Map<productId, { product_id, name, unit_price, quantity, final_amount, notes }>
let _selectedProducts = new Map();

// ── Initialise ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setDefaultFilters();
    populateYearDropdowns();
    loadTelecallers();
    loadProducts();
    loadRecords();
    initSummaryFilters();
    initSearch();
});

// ── Helper: Format Date to Local YYYY-MM-DD ──────────────────
function getLocalDateStr(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const dd   = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// ── Default filter: today's date + current month/year ─────────
function setDefaultFilters() {
    const todayStr = getLocalDateStr(new Date());

    const fltDate = document.getElementById('flt_date');
    if (fltDate) {
        fltDate.value = todayStr;
    }

    const formDate = document.getElementById('form_date');
    if (formDate) {
        formDate.value = todayStr;
        formDate.min = todayStr; // Block previous dates
        formDate.removeAttribute('max');
    }

    const editDate = document.getElementById('edit_date');
    if (editDate) {
        editDate.min = todayStr; // Block previous dates
        editDate.removeAttribute('max');
    }
}

// ── Populate year dropdowns (current year ±2) ─────────────────
function populateYearDropdowns() {
    const now  = new Date();
    const year = now.getFullYear();

    ['flt_year', 'sum_year'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<option value="">All Years</option>';
        for (let y = year + 1; y >= year - 2; y--) {
            el.innerHTML += `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`;
        }
    });

    const sumMonth = document.getElementById('sum_month');
    if (sumMonth) {
        const months = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
        sumMonth.innerHTML = months.map((m, i) =>
            `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`
        ).join('');
    }
}

// ── Load telecallers from API ─────────────────────────────────
async function loadTelecallers() {
    try {
        const token = localStorage.getItem('token');
        const res   = await fetch(`${window.API_URL}/users`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();

        const users = Array.isArray(data) ? data : (data.users || []);

        _allTelecallers = users.filter(u => {
            const r = (u.role_name || u.role || '').toLowerCase();
            return (r.includes('telecaller') || r.includes('sales'))
                   && !r.includes('manager');
        });

        if (!_allTelecallers.length) {
            _allTelecallers = users.filter(u => {
                const r = (u.role_name || u.role || '').toLowerCase();
                return !r.includes('admin') && !r.includes('super');
            });
        }

        populateTelecallerDropdowns();
    } catch (err) {
        console.error('[TOR] loadTelecallers:', err);
        showAlert('Error', 'Could not load telecallers list', 'error');
    }
}

function populateTelecallerDropdowns() {
    const opts = _allTelecallers.map(u =>
        `<option value="${u.user_id}">${u.name}</option>`
    ).join('');

    ['flt_telecaller', 'form_telecaller', 'sum_telecaller', 'edit_telecaller'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const base = el.options[0] ? el.options[0].outerHTML : '';
        el.innerHTML = base + opts;
    });
}

// ── Load products from API ────────────────────────────────────
async function loadProducts() {
    try {
        const token = localStorage.getItem('token');
        const res   = await fetch(`${window.API_URL}/products`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch products');
        _allProducts = await res.json();

        // Populate edit modal product dropdown
        const editProduct = document.getElementById('edit_product');
        if (editProduct) {
            editProduct.innerHTML = '<option value="">— Select Product —</option>' +
                _allProducts.map(p =>
                    `<option value="${p.product_id}" data-price="${p.selling_price || 0}">${escHtml(p.name)}</option>`
                ).join('');
        }

        // Render product cards in batch modal
        renderProductCards();
    } catch (err) {
        console.error('[TOR] loadProducts:', err);
        showAlert('Error', 'Could not load products list', 'error');
    }
}

// ── Render Product Cards (Click-to-Select Multi Picker) ───────
function renderProductCards(searchQuery = '') {
    const grid = document.getElementById('prodGrid');
    if (!grid) return;

    const q = (searchQuery || '').trim().toLowerCase();
    const filtered = _allProducts.filter(p =>
        !q || (p.name || '').toLowerCase().includes(q)
    );

    if (!filtered.length) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:#94a3b8;font-size:0.85rem;">
                <i class="fas fa-box-open" style="font-size:1.4rem;display:block;margin-bottom:0.3rem;opacity:0.4;"></i>
                No matching products found.
            </div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const pid = String(p.product_id);
        const isSelected = _selectedProducts.has(pid);
        const price = parseFloat(p.selling_price || 0);

        return `
            <div class="prod-card ${isSelected ? 'selected' : ''}" id="prodCard_${pid}" onclick="toggleProductSelection('${pid}')">
                <span class="prod-card-check"><i class="fas fa-check"></i></span>
                <span class="prod-card-name">${escHtml(p.name)}</span>
                <span class="prod-card-price">₹${formatNum(price)}</span>
                <span class="prod-card-unit">${p.unit ? escHtml(p.unit) : ''}</span>
            </div>
        `;
    }).join('');
}

function filterProdCards() {
    const q = document.getElementById('prodSearch')?.value || '';
    renderProductCards(q);
}

// ── Toggle Product Selection on Click (No Ctrl needed!) ───────
function toggleProductSelection(productId) {
    const pid = String(productId);
    if (_selectedProducts.has(pid)) {
        _selectedProducts.delete(pid);
    } else {
        const prod = _allProducts.find(p => String(p.product_id) === pid);
        if (!prod) return;
        const unitPrice = parseFloat(prod.selling_price || 0);
        _selectedProducts.set(pid, {
            product_id: prod.product_id,
            name: prod.name,
            unit_price: unitPrice,
            quantity: 1,
            final_amount: unitPrice, // default = unit_price * 1
            notes: ''
        });
    }

    // Update UI card state
    const card = document.getElementById(`prodCard_${pid}`);
    if (card) {
        card.classList.toggle('selected', _selectedProducts.has(pid));
    }

    renderOrderLines();
}

// ── Render Order Lines Table Inside Batch Modal ───────────────
function renderOrderLines() {
    const linesWrap = document.getElementById('orderLines');
    const linesSection = document.getElementById('orderLinesSection');
    const emptyMsg = document.getElementById('noSelectionMsg');
    const btnSave = document.getElementById('btnSaveAll');
    const countLabel = document.getElementById('selectedCountLabel');

    const count = _selectedProducts.size;
    if (countLabel) {
        countLabel.innerHTML = `<strong>${count}</strong> product${count === 1 ? '' : 's'} selected`;
    }
    if (btnSave) {
        btnSave.disabled = count === 0;
    }

    if (count === 0) {
        if (linesSection) linesSection.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = '';
        if (linesWrap) linesWrap.innerHTML = '';
        return;
    }

    if (linesSection) linesSection.style.display = '';
    if (emptyMsg) emptyMsg.style.display = 'none';

    if (!linesWrap) return;

    linesWrap.innerHTML = Array.from(_selectedProducts.values()).map(item => {
        const pid = String(item.product_id);
        return `
            <div class="order-line" id="orderLine_${pid}">
                <div style="min-width:0;">
                    <div class="order-line-name" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
                    <input type="text"
                           placeholder="Notes / remark (optional)"
                           value="${escHtml(item.notes || '')}"
                           oninput="updateLineNotes('${pid}', this.value)"
                           style="width:100%;margin-top:0.35rem;font-size:0.75rem;padding:0.25rem 0.5rem;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
                </div>
                <div>
                    <input type="number"
                           step="0.01"
                           min="0"
                           value="${item.unit_price}"
                           oninput="updateLineUnitPrice('${pid}', this.value)">
                </div>
                <div>
                    <input type="number"
                           min="1"
                           value="${item.quantity}"
                           oninput="updateLineQty('${pid}', this.value)">
                </div>
                <div>
                    <input type="number"
                           step="0.01"
                           min="0"
                           class="final-inp"
                           value="${item.final_amount}"
                           title="Click to customize final amount"
                           oninput="updateLineFinal('${pid}', this.value)">
                </div>
                <div>
                    <button class="btn-danger-sm" onclick="removeProductLine('${pid}')" title="Remove" style="padding:0.4rem 0.5rem;">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function updateLineUnitPrice(productId, val) {
    const item = _selectedProducts.get(String(productId));
    if (!item) return;
    const up = parseFloat(val) || 0;
    item.unit_price = up;
    item.final_amount = parseFloat((up * item.quantity).toFixed(2));
    const finalInp = document.querySelector(`#orderLine_${productId} .final-inp`);
    if (finalInp) finalInp.value = item.final_amount;
}

function updateLineQty(productId, val) {
    const item = _selectedProducts.get(String(productId));
    if (!item) return;
    const qty = parseInt(val, 10) || 1;
    item.quantity = qty;
    item.final_amount = parseFloat((item.unit_price * qty).toFixed(2));
    const finalInp = document.querySelector(`#orderLine_${productId} .final-inp`);
    if (finalInp) finalInp.value = item.final_amount;
}

function updateLineFinal(productId, val) {
    const item = _selectedProducts.get(String(productId));
    if (!item) return;
    item.final_amount = parseFloat(val) || 0;
}

function updateLineNotes(productId, val) {
    const item = _selectedProducts.get(String(productId));
    if (!item) return;
    item.notes = val;
}

function removeProductLine(productId) {
    toggleProductSelection(productId);
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab) {
    document.getElementById('panel-records').style.display = tab === 'records' ? '' : 'none';
    document.getElementById('panel-summary').style.display = tab === 'summary' ? '' : 'none';

    document.getElementById('tab-records').classList.toggle('active', tab === 'records');
    document.getElementById('tab-summary').classList.toggle('active', tab === 'summary');

    if (tab === 'summary') loadSummary();
}

// ── Build filter params ───────────────────────────────────────
function buildFilterParams() {
    const p = new URLSearchParams();
    const date = document.getElementById('flt_date').value;
    const month = document.getElementById('flt_month').value;
    const year  = document.getElementById('flt_year').value;
    const tc    = document.getElementById('flt_telecaller').value;

    if (date)  p.set('date', date);
    else {
        if (month) p.set('month', month);
        if (year)  p.set('year', year);
    }
    if (tc) p.set('telecaller_id', tc);

    return p;
}

// ── Load records ──────────────────────────────────────────────
async function loadRecords() {
    const tbody = document.getElementById('recordsTableBody');
    tbody.innerHTML = `<tr><td colspan="9" class="tor-loading"><i class="fas fa-circle-notch fa-spin"></i> Loading...</td></tr>`;

    try {
        const token = localStorage.getItem('token');
        const params = buildFilterParams();
        const res = await fetch(`${window.API_URL}/temp-order-report?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch records');
        const data = await res.json();

        updateStats(data.count, data.totalQty, data.totalAmount);
        renderRecordsTable(data.records || []);
        _cachedRecords = data.records || [];
    } catch (err) {
        console.error('[TOR] loadRecords:', err);
        tbody.innerHTML = `<tr><td colspan="9" class="tor-empty"><i class="fas fa-triangle-exclamation"></i>Failed to load records</td></tr>`;
    }
}

function updateStats(count, qty, amount) {
    document.getElementById('stat_count').textContent  = count ?? '—';
    document.getElementById('stat_qty').textContent    = qty ?? '—';
    document.getElementById('stat_amount').textContent = amount ? `₹${formatNum(amount)}` : '—';
}

function formatNum(v) {
    return parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderRecordsTable(records) {
    const tbody = document.getElementById('recordsTableBody');
    if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="tor-empty"><i class="fas fa-inbox"></i>No records found for the selected filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map((r, i) => {
        const calcAmount  = parseFloat(r.unit_price) * parseInt(r.quantity, 10);
        const finalAmount = parseFloat(r.final_amount);
        const isModified  = Math.abs(finalAmount - calcAmount) > 0.01;
        const dateStr     = new Date(r.record_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

        return `
        <tr>
            <td style="color:var(--tor-slate);font-size:0.78rem;">${i + 1}</td>
            <td style="font-weight:600;white-space:nowrap;">${dateStr}</td>
            <td><span class="tc-chip"><i class="fas fa-headset"></i>${escHtml(r.telecaller_name)}</span></td>
            <td><span class="prod-chip"><i class="fas fa-box"></i>${escHtml(r.product_name)}</span></td>
            <td style="color:var(--tor-slate);">₹${formatNum(r.unit_price)}</td>
            <td style="font-weight:600;">${r.quantity}</td>
            <td class="amount-cell ${isModified ? 'modified-amount' : ''}">
                ₹${formatNum(r.final_amount)}
                ${isModified ? '<i class="fas fa-pencil" title="Manually adjusted" style="font-size:0.65rem;margin-left:3px;opacity:0.7;"></i>' : ''}
            </td>
            <td class="notes-cell" title="${escHtml(r.notes || '')}">${r.notes ? escHtml(r.notes) : '<span style="opacity:0.35;">—</span>'}</td>
            <td style="white-space:nowrap;">
                <button class="btn-edit-sm" onclick="openEditModal(${r.id})" title="Edit">
                    <i class="fas fa-pencil"></i>
                </button>
                <button class="btn-danger-sm" onclick="deleteRecord(${r.id})" title="Delete">
                    <i class="fas fa-trash-can"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Filters ───────────────────────────────────────────────────
function filterChanged() {
    const dateEl = document.getElementById('flt_date');
    if (dateEl.value) {
        document.getElementById('flt_month').value = '';
        document.getElementById('flt_year').value  = '';
    }
    loadRecords();
}

function clearFilters() {
    document.getElementById('flt_date').value       = '';
    document.getElementById('flt_month').value      = '';
    document.getElementById('flt_year').value       = '';
    document.getElementById('flt_telecaller').value = '';
    loadRecords();
}

// ── Summary ───────────────────────────────────────────────────
function initSummaryFilters() {
    setTimeout(() => {
        const sumYear = document.getElementById('sum_year');
        if (sumYear && !sumYear.options.length) {
            const now = new Date();
            const year = now.getFullYear();
            sumYear.innerHTML = '';
            for (let y = year + 1; y >= year - 2; y--) {
                sumYear.innerHTML += `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`;
            }
        }
    }, 200);
}

async function loadSummary() {
    const tc    = document.getElementById('sum_telecaller').value;
    const month = document.getElementById('sum_month').value;
    const year  = document.getElementById('sum_year').value;

    const summaryProductBody = document.getElementById('summaryProductBody');
    summaryProductBody.innerHTML = `<tr><td colspan="4" class="tor-loading"><i class="fas fa-circle-notch fa-spin"></i></td></tr>`;

    const tcBreakdown = document.getElementById('tcBreakdownSection');
    tcBreakdown.style.display = 'none';

    try {
        const token = localStorage.getItem('token');
        const p = new URLSearchParams();
        if (tc)    p.set('telecaller_id', tc);
        if (month) p.set('month', month);
        if (year)  p.set('year', year);

        const res = await fetch(`${window.API_URL}/temp-order-report/summary?${p.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch summary');
        const data = await res.json();

        // Stats
        document.getElementById('sum_stat_qty').textContent     = data.grandTotal?.qty ?? '—';
        document.getElementById('sum_stat_amount').textContent  = data.grandTotal?.amount ? `₹${formatNum(data.grandTotal.amount)}` : '—';
        document.getElementById('sum_stat_products').textContent = (data.byProduct || []).length;

        // Product table
        const byProduct = data.byProduct || [];
        if (!byProduct.length) {
            summaryProductBody.innerHTML = `<tr><td colspan="4" class="tor-empty"><i class="fas fa-inbox"></i>No data found.</td></tr>`;
        } else {
            summaryProductBody.innerHTML = byProduct.map((r, i) => `
                <tr>
                    <td style="color:var(--tor-slate);font-size:0.78rem;">${i+1}</td>
                    <td><span class="prod-chip"><i class="fas fa-box"></i>${escHtml(r.product_name)}</span></td>
                    <td style="font-weight:700;">${r.total_qty}</td>
                    <td style="font-weight:700;color:var(--tor-emerald);">₹${formatNum(r.total_amount)}</td>
                </tr>`
            ).join('');
        }

        // Footer
        document.getElementById('sum_foot_qty').textContent    = data.grandTotal?.qty ?? '—';
        document.getElementById('sum_foot_amount').textContent = data.grandTotal?.amount ? `₹${formatNum(data.grandTotal.amount)}` : '—';

        // Telecaller breakdown (only when showing all)
        if (!tc && (data.byTelecaller || []).length > 0) {
            tcBreakdown.style.display = '';
            const tcBody = document.getElementById('summaryTcBody');
            tcBody.innerHTML = data.byTelecaller.map((r, i) => `
                <tr>
                    <td style="color:var(--tor-slate);font-size:0.78rem;">${i+1}</td>
                    <td><span class="tc-chip"><i class="fas fa-headset"></i>${escHtml(r.telecaller_name)}</span></td>
                    <td>${r.record_count}</td>
                    <td style="font-weight:700;">${r.total_qty}</td>
                    <td style="font-weight:700;color:var(--tor-emerald);">₹${formatNum(r.total_amount)}</td>
                </tr>`
            ).join('');
        }
    } catch (err) {
        console.error('[TOR] loadSummary:', err);
        summaryProductBody.innerHTML = `<tr><td colspan="4" class="tor-empty"><i class="fas fa-triangle-exclamation"></i>Failed to load summary.</td></tr>`;
    }
}

// ── Multi-Product Batch Modal ─────────────────────────────────
function openAddModal() {
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-clipboard-list" style="color:var(--tor-primary);margin-right:0.4rem;"></i> Add Sales Records';
    }

    // Default date = local today
    const dateStr = getLocalDateStr(new Date());
    const formDate = document.getElementById('form_date');
    if (formDate) {
        formDate.value = dateStr;
        formDate.min = dateStr; // Block previous dates
        formDate.removeAttribute('max');
    }

    // Reset selected telecaller & clear search
    const formTc = document.getElementById('form_telecaller');
    if (formTc) formTc.value = '';

    const searchInp = document.getElementById('prodSearch');
    if (searchInp) searchInp.value = '';

    // Clear selections
    _selectedProducts.clear();
    renderProductCards();
    renderOrderLines();

    document.getElementById('torModalOverlay').classList.add('open');
}

function closeModal() {
    document.getElementById('torModalOverlay').classList.remove('open');
}

function overlayClose(e) {
    if (e.target === document.getElementById('torModalOverlay')) closeModal();
}

// ── Save Batch (Multiple Products for One Telecaller) ─────────
async function saveBatch() {
    const record_date   = document.getElementById('form_date').value;
    const telecaller_id = document.getElementById('form_telecaller').value;

    if (!record_date) {
        return showAlert('Validation', 'Please select a record date.', 'warning');
    }
    const todayStr = getLocalDateStr(new Date());
    if (record_date < todayStr) {
        return showAlert('Validation', 'Past dates are not allowed. Please select today or future date.', 'warning');
    }
    if (!telecaller_id) {
        return showAlert('Validation', 'Please select a telecaller.', 'warning');
    }
    if (_selectedProducts.size === 0) {
        return showAlert('Validation', 'Please click and select at least one product.', 'warning');
    }

    const items = Array.from(_selectedProducts.values()).map(it => ({
        product_id:   it.product_id,
        unit_price:   it.unit_price,
        quantity:     it.quantity,
        final_amount: it.final_amount,
        notes:        (it.notes || '').trim()
    }));

    const btn = document.getElementById('btnSaveAll');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving all records...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/temp-order-report/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                record_date,
                telecaller_id,
                items,
            }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save batch records');

        showAlert('Success', `${data.savedCount || items.length} product record(s) saved successfully!`, 'success');
        closeModal();
        loadRecords();
    } catch (err) {
        console.error('[TOR] saveBatch:', err);
        showAlert('Error', err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save All Records';
    }
}

// ── Single Record Edit Modal ──────────────────────────────────
function openEditModal(id) {
    const rec = _cachedRecords.find(r => r.id === id);
    if (!rec) return showAlert('Error', 'Record not found', 'error');

    const todayStr = getLocalDateStr(new Date());
    const editDateInp = document.getElementById('edit_date');
    if (editDateInp) {
        editDateInp.min = todayStr; // Block previous dates
        editDateInp.removeAttribute('max');
        editDateInp.value = rec.record_date ? rec.record_date.split('T')[0] : todayStr;
    }

    document.getElementById('edit_record_id').value = rec.id;
    document.getElementById('edit_telecaller').value = rec.telecaller_id;
    document.getElementById('edit_product').value = rec.product_id;
    document.getElementById('edit_unit_price').value = rec.unit_price;
    document.getElementById('edit_qty').value = rec.quantity;
    document.getElementById('edit_final_amount').value = rec.final_amount;
    document.getElementById('edit_notes').value = rec.notes || '';

    document.getElementById('torEditModalOverlay').classList.add('open');
}

function closeEditModal() {
    document.getElementById('torEditModalOverlay').classList.remove('open');
}

function overlayEditClose(e) {
    if (e.target === document.getElementById('torEditModalOverlay')) closeEditModal();
}

function onEditProductChange() {
    const sel = document.getElementById('edit_product');
    const opt = sel.options[sel.selectedIndex];
    const price = parseFloat(opt.dataset.price || 0);
    document.getElementById('edit_unit_price').value = price > 0 ? price.toFixed(2) : '';
    recalcEditFinal();
}

function recalcEditFinal() {
    const up  = parseFloat(document.getElementById('edit_unit_price').value) || 0;
    const qty = parseInt(document.getElementById('edit_qty').value, 10) || 1;
    document.getElementById('edit_final_amount').value = (up * qty).toFixed(2);
}

async function submitEditForm(e) {
    e.preventDefault();

    const recordId      = document.getElementById('edit_record_id').value;
    const record_date   = document.getElementById('edit_date').value;
    const telecaller_id = document.getElementById('edit_telecaller').value;
    const product_id    = document.getElementById('edit_product').value;
    const unit_price    = document.getElementById('edit_unit_price').value;
    const quantity      = document.getElementById('edit_qty').value;
    const final_amount  = document.getElementById('edit_final_amount').value;
    const notes         = document.getElementById('edit_notes').value.trim();

    if (!record_date || !telecaller_id || !product_id || !final_amount) {
        return showAlert('Validation', 'Please fill in all required fields.', 'warning');
    }
    const todayStr = getLocalDateStr(new Date());
    if (record_date < todayStr) {
        return showAlert('Validation', 'Past dates are not allowed. Please select today or future date.', 'warning');
    }

    const payload = { record_date, telecaller_id, product_id, unit_price, quantity, final_amount, notes };
    const btn = document.getElementById('btnSubmitEdit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Updating...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/temp-order-report/${recordId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Update failed');

        showAlert('Success', 'Record updated successfully.', 'success');
        closeEditModal();
        loadRecords();
    } catch (err) {
        console.error('[TOR] submitEditForm:', err);
        showAlert('Error', err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Update Record';
    }
}

// ── Delete ────────────────────────────────────────────────────
async function deleteRecord(id) {
    const confirmed = confirm('Delete this sales record? This action cannot be undone.');
    if (!confirmed) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${window.API_URL}/temp-order-report/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed');

        showAlert('Deleted', 'Record removed successfully.', 'success');
        loadRecords();
    } catch (err) {
        console.error('[TOR] deleteRecord:', err);
        showAlert('Error', err.message, 'error');
    }
}

// ── Search (client-side filter on cached records) ─────────────
function initSearch() {
    const inp = document.getElementById('globalSearch');
    if (!inp) return;
    inp.addEventListener('input', () => {
        const q = inp.value.trim().toLowerCase();
        if (!q) {
            renderRecordsTable(_cachedRecords);
        } else {
            const filtered = _cachedRecords.filter(r =>
                (r.telecaller_name || '').toLowerCase().includes(q) ||
                (r.product_name    || '').toLowerCase().includes(q) ||
                (r.notes           || '').toLowerCase().includes(q)
            );
            renderRecordsTable(filtered);
        }
    });
}

// ── Utility ───────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Toast Notification (Auto-dismissing, non-blocking) ────────
function showToast(message, type = 'success') {
    let container = document.getElementById('torToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'torToastContainer';
        container.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;z-index:9999999;display:flex;flex-direction:column;gap:0.6rem;pointer-events:none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colorMap = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    const iconMap = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };
    const color = colorMap[type] || '#10b981';
    const icon = iconMap[type] || 'fa-circle-check';

    toast.style.cssText = `
        background:#ffffff;
        color:#0f172a;
        padding:0.85rem 1.25rem;
        border-radius:12px;
        box-shadow:0 12px 30px rgba(0,0,0,0.18);
        border:1px solid #e2e8f0;
        border-left:5px solid ${color};
        display:flex;
        align-items:center;
        gap:0.75rem;
        font-size:0.875rem;
        font-weight:600;
        pointer-events:auto;
        animation:alertSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        min-width:280px;
        max-width:420px;
    `;
    toast.innerHTML = `<i class="fa-solid ${icon}" style="color:${color};font-size:1.1rem;"></i><span>${escHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 320);
    }, 3000);
}

function showAlert(title, msg, type = 'info') {
    showToast(msg || title, type);
}
