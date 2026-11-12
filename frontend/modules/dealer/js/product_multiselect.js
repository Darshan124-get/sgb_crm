/**
 * Reusable Checkbox Multi-Select Dropdown & Product Matching Helpers for B2B Dealer Pages
 * Shared by frontend/modules/dealer/orders.html & frontend/modules/dealer/reports.html
 */
(function (global) {
    'use strict';

    const instances = new Map();
    let stylesInjected = false;
    let globalListenersBound = false;

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function injectStyles() {
        if (stylesInjected || typeof document === 'undefined') return;
        stylesInjected = true;
        const style = document.createElement('style');
        style.id = 'dealer-pm-styles';
        style.textContent = `
            .dealer-pm-wrap {
                position: relative;
                display: inline-block;
                font-family: 'Inter', sans-serif;
                user-select: none;
            }
            .dealer-pm-trigger {
                width: 100%;
                display: inline-flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                color: #0f172a;
                cursor: pointer;
                text-align: left;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }
            .dealer-pm-trigger--compact {
                padding: 0.45rem 0.75rem;
                font-size: 0.8rem;
                font-weight: 600;
                min-width: 165px;
                max-width: 230px;
            }
            .dealer-pm-trigger--standard {
                padding: 0.6rem 0.85rem;
                font-size: 0.85rem;
                font-weight: 500;
                color: #334155;
                min-width: 210px;
            }
            .dealer-pm-trigger:hover {
                border-color: #94a3b8;
            }
            .dealer-pm-trigger.is-open,
            .dealer-pm-trigger.has-selection {
                border-color: #FF6B00;
                box-shadow: 0 0 0 2px rgba(255, 107, 0, 0.12);
            }
            .dealer-pm-label {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }
            .dealer-pm-badge {
                background: #fff7ed;
                color: #ea580c;
                border: 1px solid #fed7aa;
                font-size: 0.7rem;
                font-weight: 700;
                padding: 0.05rem 0.4rem;
                border-radius: 999px;
                flex-shrink: 0;
            }
            .dealer-pm-caret {
                color: #64748b;
                font-size: 0.72rem;
                flex-shrink: 0;
                transition: transform 0.15s ease;
            }
            .dealer-pm-trigger.is-open .dealer-pm-caret {
                transform: rotate(180deg);
                color: #FF6B00;
            }
            .dealer-pm-panel {
                display: none;
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                min-width: 270px;
                max-width: 320px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
                z-index: 1200;
                overflow: hidden;
            }
            .dealer-pm-panel.is-open {
                display: block;
            }
            .dealer-pm-panel.align-right {
                left: auto;
                right: 0;
            }
            .dealer-pm-search-box {
                padding: 0.55rem;
                border-bottom: 1px solid #f1f5f9;
                background: #f8fafc;
            }
            .dealer-pm-search-input {
                width: 100%;
                box-sizing: border-box;
                padding: 0.4rem 0.65rem;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                font-size: 0.78rem;
                color: #0f172a;
                background: #ffffff;
                outline: none;
            }
            .dealer-pm-search-input:focus {
                border-color: #FF6B00;
            }
            .dealer-pm-actions {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.4rem 0.65rem;
                border-bottom: 1px solid #f1f5f9;
                font-size: 0.74rem;
                background: #ffffff;
            }
            .dealer-pm-action-btn {
                background: none;
                border: none;
                padding: 0.15rem 0.3rem;
                font-size: 0.74rem;
                font-weight: 700;
                cursor: pointer;
                border-radius: 4px;
            }
            .dealer-pm-action-btn.select-all {
                color: #ea580c;
            }
            .dealer-pm-action-btn.select-all:hover {
                background: #fff7ed;
            }
            .dealer-pm-action-btn.clear-all {
                color: #64748b;
            }
            .dealer-pm-action-btn.clear-all:hover {
                color: #ef4444;
                background: #fef2f2;
            }
            .dealer-pm-list {
                max-height: 240px;
                overflow-y: auto;
                padding: 0.3rem 0;
            }
            .dealer-pm-item {
                display: flex;
                align-items: center;
                gap: 0.55rem;
                padding: 0.42rem 0.75rem;
                font-size: 0.8rem;
                color: #1e293b;
                cursor: pointer;
                transition: background-color 0.12s ease;
            }
            .dealer-pm-item:hover {
                background: #fff7ed;
            }
            .dealer-pm-item input[type="checkbox"] {
                width: 15px;
                height: 15px;
                accent-color: #FF6B00;
                cursor: pointer;
                flex-shrink: 0;
                margin: 0;
            }
            .dealer-pm-item-text {
                flex: 1;
                line-height: 1.3;
                word-break: break-word;
            }
            .dealer-pm-empty {
                padding: 0.9rem 0.75rem;
                text-align: center;
                font-size: 0.78rem;
                color: #94a3b8;
            }
        `;
        document.head.appendChild(style);
    }

    function bindGlobalListeners() {
        if (globalListenersBound || typeof document === 'undefined') return;
        globalListenersBound = true;

        document.addEventListener('click', (e) => {
            instances.forEach((inst) => {
                if (inst.isOpen && inst.wrap && !inst.wrap.contains(e.target)) {
                    inst.close();
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                instances.forEach((inst) => {
                    if (inst.isOpen) inst.close();
                });
            }
        });
    }

    function normalizeFilterList(productFilter) {
        if (!productFilter) return [];
        const raw = productFilter instanceof Set
            ? Array.from(productFilter)
            : (Array.isArray(productFilter) ? productFilter : [productFilter]);
        const out = [];
        const seen = new Set();
        raw.forEach((val) => {
            const clean = String(val || '').trim().toLowerCase();
            if (clean && !seen.has(clean)) {
                seen.add(clean);
                out.push(clean);
            }
        });
        return out;
    }

    /**
     * Checks whether a parsed item name matches the active single or multi-product filter.
     * Uses exact case-insensitive product-name match to keep "Blade" distinct from "SGB - Blade Protection".
     */
    function itemNameMatchesProducts(itemName, productFilter) {
        const normalizedList = normalizeFilterList(productFilter);
        if (normalizedList.length === 0) return true;
        const cleanItem = String(itemName || '').trim().toLowerCase();
        return normalizedList.includes(cleanItem);
    }

    /**
     * Checks whether an order contains ANY product in the active multi-product selection.
     */
    function orderMatchesProducts(order, productFilter) {
        const normalizedList = normalizeFilterList(productFilter);
        if (normalizedList.length === 0) return true;
        if (!order) return false;

        const targetSet = new Set(normalizedList);

        if (order.items_detailed) {
            const items = String(order.items_detailed).split('||');
            for (const it of items) {
                const pName = (it.split('::')[0] || '').toLowerCase().trim();
                if (targetSet.has(pName)) return true;
            }
        }

        if (order.items_summary) {
            const items = String(order.items_summary).split('||');
            for (const it of items) {
                const match = it.match(/^(.*?)\s*x\s*\d+$/i);
                const pName = (match ? match[1] : (it.split(' x ')[0] || '')).toLowerCase().trim();
                if (targetSet.has(pName)) return true;
            }
        }

        if (Array.isArray(order.items)) {
            for (const it of order.items) {
                const pName = (it.product_name || it.name || '').toLowerCase().trim();
                if (targetSet.has(pName)) return true;
            }
        }

        return false;
    }

    function create(containerId, options = {}) {
        injectStyles();
        bindGlobalListeners();

        const container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
        if (!container) return null;

        const placeholder = options.placeholder || 'All Products';
        const compact = Boolean(options.compact);
        const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};

        const state = {
            id: containerId,
            optionsList: [],
            selectedSet: new Set(),
            searchQuery: '',
            isOpen: false,
            wrap: null,
            triggerBtn: null,
            panel: null,
            listEl: null,
            searchInput: null
        };

        container.innerHTML = '';
        container.classList.add('dealer-pm-wrap');
        if (options.width) {
            container.style.width = options.width;
        }
        state.wrap = container;

        const triggerClass = compact ? 'dealer-pm-trigger--compact' : 'dealer-pm-trigger--standard';
        container.innerHTML = `
            <button type="button" class="dealer-pm-trigger ${triggerClass}" aria-haspopup="listbox" aria-expanded="false">
                <span class="dealer-pm-label">${escapeHtml(placeholder)}</span>
                <span class="dealer-pm-badge" style="display:none;">0</span>
                <i class="fa-solid fa-chevron-down dealer-pm-caret"></i>
            </button>
            <div class="dealer-pm-panel" role="listbox" aria-multiselectable="true">
                <div class="dealer-pm-search-box">
                    <input type="text" class="dealer-pm-search-input" placeholder="Search products..." autocomplete="off">
                </div>
                <div class="dealer-pm-actions">
                    <button type="button" class="dealer-pm-action-btn select-all">Select All</button>
                    <span class="dealer-pm-count" style="color:#64748b;font-weight:600;">0 selected</span>
                    <button type="button" class="dealer-pm-action-btn clear-all">Clear</button>
                </div>
                <div class="dealer-pm-list"></div>
            </div>
        `;

        state.triggerBtn = container.querySelector('.dealer-pm-trigger');
        state.labelEl = container.querySelector('.dealer-pm-label');
        state.badgeEl = container.querySelector('.dealer-pm-badge');
        state.panel = container.querySelector('.dealer-pm-panel');
        state.searchInput = container.querySelector('.dealer-pm-search-input');
        state.countEl = container.querySelector('.dealer-pm-count');
        state.listEl = container.querySelector('.dealer-pm-list');

        const selectAllBtn = container.querySelector('.dealer-pm-action-btn.select-all');
        const clearAllBtn = container.querySelector('.dealer-pm-action-btn.clear-all');

        function updateTriggerSummary() {
            const selected = Array.from(state.selectedSet);
            const count = selected.length;
            if (count === 0) {
                state.labelEl.textContent = placeholder;
                state.badgeEl.style.display = 'none';
                state.triggerBtn.classList.remove('has-selection');
                state.triggerBtn.title = placeholder;
            } else if (count === 1) {
                state.labelEl.textContent = selected[0];
                state.badgeEl.textContent = '1';
                state.badgeEl.style.display = 'inline-block';
                state.triggerBtn.classList.add('has-selection');
                state.triggerBtn.title = selected[0];
            } else {
                state.labelEl.textContent = `${count} Products Selected`;
                state.badgeEl.textContent = String(count);
                state.badgeEl.style.display = 'inline-block';
                state.triggerBtn.classList.add('has-selection');
                state.triggerBtn.title = selected.join(', ');
            }
            state.countEl.textContent = `${count} selected`;
        }

        function getVisibleOptions() {
            const q = state.searchQuery.trim().toLowerCase();
            if (!q) return state.optionsList;
            return state.optionsList.filter((name) => name.toLowerCase().includes(q));
        }

        function renderList() {
            const visible = getVisibleOptions();
            if (visible.length === 0) {
                state.listEl.innerHTML = `<div class="dealer-pm-empty">No matching products found</div>`;
                return;
            }
            state.listEl.innerHTML = visible.map((name) => {
                const checked = state.selectedSet.has(name) ? 'checked' : '';
                return `
                    <label class="dealer-pm-item">
                        <input type="checkbox" value="${escapeHtml(name)}" ${checked}>
                        <span class="dealer-pm-item-text">${escapeHtml(name)}</span>
                    </label>
                `;
            }).join('');
        }

        const api = {
            getSelected() {
                return Array.from(state.selectedSet);
            },
            setSelected(names, opts = {}) {
                const allowed = new Set(state.optionsList);
                state.selectedSet = new Set(
                    (Array.isArray(names) ? names : [])
                        .map((n) => String(n || '').trim())
                        .filter((n) => n && (allowed.size === 0 || allowed.has(n)))
                );
                updateTriggerSummary();
                renderList();
                if (opts.triggerChange) {
                    onChange(api.getSelected());
                }
            },
            setOptions(names) {
                const prevSelected = new Set(state.selectedSet);
                const deduped = Array.from(new Set(
                    (Array.isArray(names) ? names : [])
                        .map((n) => String(n || '').trim())
                        .filter(Boolean)
                )).sort((a, b) => a.localeCompare(b));
                state.optionsList = deduped;
                const nextSet = new Set();
                deduped.forEach((n) => {
                    if (prevSelected.has(n)) nextSet.add(n);
                });
                state.selectedSet = nextSet;
                updateTriggerSummary();
                renderList();
            },
            clear(opts = {}) {
                state.selectedSet.clear();
                state.searchQuery = '';
                if (state.searchInput) state.searchInput.value = '';
                updateTriggerSummary();
                renderList();
                if (opts.triggerChange) {
                    onChange([]);
                }
            },
            open() {
                // Close any other open multi-select instances first
                instances.forEach((other) => {
                    if (other !== state && other.isOpen) other.close();
                });
                state.isOpen = true;
                state.triggerBtn.classList.add('is-open');
                state.triggerBtn.setAttribute('aria-expanded', 'true');
                state.panel.classList.remove('align-right');
                state.panel.classList.add('is-open');

                if (typeof window !== 'undefined') {
                    const rect = state.triggerBtn.getBoundingClientRect();
                    const panelWidth = Math.max(270, state.panel.offsetWidth || 270);
                    if (rect.left + panelWidth > window.innerWidth - 16) {
                        state.panel.classList.add('align-right');
                    }
                }
                if (state.searchInput) {
                    state.searchInput.focus();
                }
            },
            close() {
                state.isOpen = false;
                state.triggerBtn.classList.remove('is-open');
                state.triggerBtn.setAttribute('aria-expanded', 'false');
                state.panel.classList.remove('is-open');
            }
        };

        state.close = api.close;
        state.open = api.open;

        state.triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.isOpen) api.close();
            else api.open();
        });

        state.panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        state.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value || '';
            renderList();
        });

        state.listEl.addEventListener('change', (e) => {
            const cb = e.target;
            if (!cb || cb.type !== 'checkbox') return;
            const val = cb.value;
            if (cb.checked) state.selectedSet.add(val);
            else state.selectedSet.delete(val);
            updateTriggerSummary();
            onChange(api.getSelected());
        });

        selectAllBtn.addEventListener('click', () => {
            const visible = getVisibleOptions();
            visible.forEach((name) => state.selectedSet.add(name));
            updateTriggerSummary();
            renderList();
            onChange(api.getSelected());
        });

        clearAllBtn.addEventListener('click', () => {
            state.selectedSet.clear();
            updateTriggerSummary();
            renderList();
            onChange(api.getSelected());
        });

        instances.set(containerId, state);
        state.api = api;
        updateTriggerSummary();
        renderList();
        return api;
    }

    function getInstance(containerId) {
        const st = instances.get(containerId);
        return st ? st.api : null;
    }

    global.DealerProductMultiSelect = {
        create,
        getInstance,
        normalizeFilterList,
        itemNameMatchesProducts,
        orderMatchesProducts
    };
})(typeof window !== 'undefined' ? window : globalThis);

