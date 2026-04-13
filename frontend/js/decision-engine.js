// ============================================================
// decision-engine.js — Dynamic Sales Decision Engine Logic
// ============================================================

// Global logic for Dynamic Sales Decision Engine

document.addEventListener('DOMContentLoaded', () => {
    // We bind events later because modal might be loaded dynamically via components.js
    // We'll rely on an observer or simple delegation for static listeners.

    // Delegate click event for pill buttons
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('status-pill')) {
            const wrapper = e.target.closest('.selection-row') || e.target.closest('.status-pill-grid');
            if (wrapper) {
                wrapper.querySelectorAll('.status-pill').forEach(btn => btn.classList.remove('active'));
            }
            e.target.classList.add('active');
            const val = e.target.getAttribute('data-value');

            // Context Detection: Is this inside the Manual Wizard or the Lead Detail Modal?
            const isManual = e.target.closest('.manual-wizard-container') !== null;
            const inputId = isManual ? 'm-de-call-status' : 'de-call-status';
            const input = document.getElementById(inputId);

            if (input) {
                input.value = val;
                if (isManual) {
                    mHandleCallStatusChange(val);
                } else {
                    handleCallStatusChange(val);
                }
            }
        }
    });

    // Delegate change event for dynamic logic
    document.body.addEventListener('change', (e) => {
        if (e.target.id === 'de-sales-status') {
            handleSalesStatusChange(e.target.value);
        } else if (e.target.id === 'm-de-sales-status') {
            mHandleSalesStatusChange(e.target.value);
        } else if (['de-products', 'de-order-discount', 'de-order-advance', 'm-de-products', 'm-de-order-advance'].includes(e.target.id)) {
            calculateOrderAmounts(e.target.id.startsWith('m-') ? 'm-' : '');
        }
    });

    // Handle multi-select change effectively for calculation
    document.body.addEventListener('input', (e) => {
        if (['de-order-discount', 'de-order-advance', 'm-de-order-advance'].includes(e.target.id)) {
            calculateOrderAmounts(e.target.id.startsWith('m-') ? 'm-' : '');
        }
    });
});

let currentStep = 1;
let leadPath = 'normal'; // 'normal', 'quick_order', 'not_connected'

// ─── Shared Helpers ───────────────────────────────────────────

async function loadProductsForEngine(prefix = '') {
    const productSelect = document.getElementById(prefix + 'de-products');
    if (!productSelect) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.API_URL}/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const products = await response.json();
            if (products && products.length > 0) {
                productSelect.innerHTML = products.map(p => `
                    <option value="${p.name}" data-id="${p.product_id}" data-price="${p.price}">${p.name} (₹${p.price})</option>
                `).join('');
            }
        }
    } catch (err) {
        console.error("Failed to load products for engine:", err);
    }
}

function calculateOrderAmounts(prefix = '') {
    const productSelect = document.getElementById(prefix + 'de-products');
    if (!productSelect) return;

    let total = 0;
    let selectedNames = [];

    Array.from(productSelect.selectedOptions).forEach(option => {
        const price = parseFloat(option.getAttribute('data-price')) || 0;
        total += price;
        selectedNames.push(option.value);
    });

    // Update product display list (if exists)
    const displayEl = document.getElementById(prefix + 'de-order-products-display');
    if (displayEl) {
        displayEl.textContent = selectedNames.length > 0 ? selectedNames.join(', ') : 'None';
    }

    // Update summary labels (Manual Wizard)
    const summaryTotalEl = document.getElementById(prefix + 'de-summary-total');
    const summaryCountEl = document.getElementById(prefix + 'de-summary-count');
    if (summaryTotalEl) summaryTotalEl.textContent = total.toLocaleString();
    if (summaryCountEl) summaryCountEl.textContent = productSelect.selectedOptions.length;

    // Update form inputs (Main Modal)
    const totalInput = document.getElementById(prefix + 'de-order-total');
    if (totalInput) {
        if (total === 0 && totalInput.value && totalInput.value !== '0') {
            total = parseFloat(totalInput.value) || 0;
        } else {
            totalInput.value = total;
        }
    }

    const discountEl = document.getElementById(prefix + 'de-order-discount');
    const discount = discountEl ? (parseFloat(discountEl.value) || 0) : 0;

    const finalAmount = total - discount;
    const finalInput = document.getElementById(prefix + 'de-order-final');
    if (finalInput) finalInput.value = finalAmount;

    const advanceEl = document.getElementById(prefix + 'de-order-advance');
    const advance = advanceEl ? (parseFloat(advanceEl.value) || 0) : 0;

    const due = finalAmount - advance;
    const dueInput = document.getElementById(prefix + 'de-order-due');
    if (dueInput) dueInput.value = due;
}


/**
 * Triggers the Decision Engine modal from the Lead Details view.
 * Renamed to handleLeadConversionModal to avoid any unintentional collisions.
 */
window.handleLeadConversionModal = function () {
    console.log("[DecisionEngine] handleLeadConversionModal activated...");
    const modal = document.getElementById('decisionEngineModal');
    if (!modal) {
        alert("System Error: Conversion modal container not found. Please refresh (Ctrl+F5).");
        return;
    }

    // 1. Reset everything first
    resetDecisionEngine();

    // 2. Auto-fill available details from the View
    const leadPhone = document.getElementById('leadDetailPhone')?.textContent || '';
    const leadName = document.getElementById('leadDetailName')?.textContent || '';
    const leadVillage = document.getElementById('leadDetailVillage')?.textContent || '';
    const leadState = document.getElementById('leadDetailState')?.textContent || '';
    const leadLanguage = document.getElementById('leadDetailLanguage')?.textContent || 'EN';

    const phoneInput = document.getElementById('de-phone');
    const nameInput = document.getElementById('de-customer-name');
    const villageInput = document.getElementById('de-village');
    const stateInput = document.getElementById('de-state');
    const langInput = document.getElementById('de-language');

    if (phoneInput) phoneInput.value = leadPhone;
    if (nameInput) nameInput.value = leadName;

    if (villageInput && leadVillage && leadVillage !== '-') {
        villageInput.value = leadVillage;
    }

    if (stateInput && leadState && leadState !== '-') {
        stateInput.value = leadState;
    }

    if (langInput && leadLanguage && leadLanguage !== '-') {
        // Handle common text variants if needed, or just set it
        const cleanLang = (leadLanguage === 'Language') ? 'EN' : leadLanguage;
        langInput.value = cleanLang;
    }

    // 3. Load dynamic products
    loadProductsForEngine();

    // 4. Show Modal
    modal.classList.add('active');
    console.log("Modal activated via class.");
}

function closeDecisionEngine() {
    const modal = document.getElementById('decisionEngineModal');
    if (modal) modal.classList.remove('active');
}

// ─── Core Logic ───────────────────────────────────────────────

function handleCallStatusChange(status) {
    if (!status) return;

    if (status === 'Received') {
        leadPath = 'normal';
    } else if (status === 'Booked') {
        leadPath = 'quick_order';
    } else if (['Not Received', 'Switched Off', 'Busy', 'Not Reachable', 'Not Interested', 'WhatsApp'].includes(status)) {
        leadPath = 'not_connected';
    }
}

function hideAllSubforms() {
    const ids = ['de-form-order', 'de-form-followup', 'de-form-reason', 'de-form-feedback', 'de-form-notconnected'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Remove required attributes from all
    const reqIds = ['de-order-screenshot', 'de-followup-date', 'de-lost-reason', 'de-feedback-satisfaction', 'de-nc-date'];
    reqIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.removeAttribute('required');
    });
}

function handleSalesStatusChange(status) {
    hideAllSubforms();

    if (status === 'Ordered') {
        document.getElementById('de-form-order').style.display = 'block';
        document.getElementById('de-order-screenshot').setAttribute('required', 'true');
        calculateOrderAmounts(); // Fresh calculation
    } else if (status === 'Hot/Very Interested' || status === 'Mild/Later' || status === 'Dealer') {
        document.getElementById('de-form-followup').style.display = 'block';
        document.getElementById('de-followup-date').setAttribute('required', 'true');
    } else if (status === 'Cold/Not Interested') {
        document.getElementById('de-form-reason').style.display = 'block';
        document.getElementById('de-lost-reason').setAttribute('required', 'true');
    } else if (status === 'Old Purchased') {
        document.getElementById('de-form-feedback').style.display = 'block';
        document.getElementById('de-feedback-satisfaction').setAttribute('required', 'true');
    }
}

// ─── Step Navigation ──────────────────────────────────────────

function deNextStep(targetStep) {
    const callStatus = document.getElementById('de-call-status').value;

    if (currentStep === 1) {
        if (!callStatus) {
            alert('Please select a Call Status');
            return;
        }

        // Routing logic based on Call Status
        if (leadPath === 'quick_order') {
            // Booked -> Skip to Order
            hideAllSubforms();
            targetStep = 4;
            document.getElementById('de-sales-status-container').style.display = 'block';
            document.getElementById('de-sales-status').value = 'Ordered';
            handleSalesStatusChange('Ordered');
        } else if (leadPath === 'not_connected') {
            // Not connected -> Skip to Form directly
            hideAllSubforms();
            targetStep = 4;
            // Hide standard sales status, show not connected log immediately
            document.getElementById('de-sales-status-container').style.display = 'none';
            document.getElementById('de-form-notconnected').style.display = 'block';
            document.getElementById('de-nc-date').setAttribute('required', 'true');
        } else {
            // Normal flow -> go to Step 2
            targetStep = 2;
            document.getElementById('de-sales-status-container').style.display = 'block';
        }
    }

    goToStep(targetStep);
}

function dePrevStep(targetStep) {
    // Reverse routing logic
    if (currentStep === 4) {
        if (leadPath === 'quick_order' || leadPath === 'not_connected') {
            targetStep = 1; // Go back to start
        } else {
            targetStep = 3;
        }
    }

    goToStep(targetStep);
}

function goToStep(step) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`wizard-step-${i}`);
        if (el) el.style.display = 'none';

        const ind = document.getElementById(`step${i}-ind`);
        if (ind) ind.classList.remove('active');
    }

    // Show target step
    document.getElementById(`wizard-step-${step}`).style.display = 'block';

    // Update indicator up to this step
    for (let i = 1; i <= step; i++) {
        const ind = document.getElementById(`step${i}-ind`);
        if (ind) ind.classList.add('active');
    }

    currentStep = step;
}

function resetDecisionEngine() {
    currentStep = 1;
    leadPath = 'normal';

    hideAllSubforms();

    // Clear status
    document.getElementById('de-call-status').value = '';
    document.querySelectorAll('.status-pill').forEach(btn => btn.classList.remove('active'));

    // Clear Customer Details
    document.getElementById('de-customer-name').value = '';
    document.getElementById('de-village').value = '';
    document.getElementById('de-state').value = 'Karnataka'; // default

    // Clear product selections
    const productSelect = document.getElementById('de-products');
    if (productSelect) {
        Array.from(productSelect.options).forEach(opt => opt.selected = false);
    }

    // Clear amounts
    document.getElementById('de-order-discount').value = 0;
    document.getElementById('de-order-advance').value = 0;
    document.getElementById('de-order-total').value = 0;
    document.getElementById('de-order-final').value = 0;
    document.getElementById('de-order-due').value = 0;

    document.getElementById('de-sales-status-container').style.display = 'block';
    document.getElementById('de-sales-status').value = '';

    handleSalesStatusChange('');
    goToStep(1);
}

// ─── Auto Calculations ────────────────────────────────────────

// calculateOrderAmounts moved to line 84 to support prefix handling

// ─── Submission ───────────────────────────────────────────────

async function submitDecisionEngine() {
    const callStatus = document.getElementById('de-call-status').value;
    const submitBtn = document.getElementById('de-submit-btn');
    const token = localStorage.getItem('token');

    // --- Validation ---
    if (leadPath === 'not_connected') {
        const dateStr = document.getElementById('de-nc-date').value;
        if (!dateStr) return window.showAlert("Required", "Please provide a Next Call Date.", "error");
    } else {
        const salesStatus = document.getElementById('de-sales-status').value;
        if (salesStatus === 'Ordered') {
            const adv = parseFloat(document.getElementById('de-order-advance').value) || 0;
            const file = document.getElementById('de-order-screenshot').files[0];
            if (adv > 0 && !file) {
                return window.showAlert("Payment Record", "Payment screenshot is required when advance is recorded.", "error");
            }
        } else if (['Hot/Very Interested', 'Mild/Later', 'Dealer'].includes(salesStatus)) {
            if (!document.getElementById('de-followup-date').value) {
                return window.showAlert("Required", "Please provide a Next Follow-up Date.", "error");
            }
        } else if (salesStatus === 'Cold/Not Interested') {
            if (!document.getElementById('de-lost-reason').value) {
                return window.showAlert("Required", "Please provide a Reason.", "error");
            }
        } else if (salesStatus === 'Old Purchased') {
            if (!document.getElementById('de-feedback-satisfaction').value) {
                return window.showAlert("Required", "Please provide Satisfaction level.", "error");
            }
        }
    }

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    try {
        const leadId = window.currentViewingLeadId;
        const salesStatus = document.getElementById('de-sales-status').value;
        const customerName = document.getElementById('de-customer-name').value;
        const phone = document.getElementById('de-phone').value;
        const village = document.getElementById('de-village').value;
        const state = document.getElementById('de-state').value;

        // 1. Process Order if status is Ordered
        if (salesStatus === 'Ordered' && leadPath !== 'not_connected') {
            const selectedOptions = Array.from(document.getElementById('de-products').selectedOptions);
            const items = selectedOptions.map(opt => ({
                product_id: opt.getAttribute('data-id'),
                quantity: 1,
                price: parseFloat(opt.getAttribute('data-price')) || 0
            }));

            const orderPayload = {
                lead_id: leadId,
                customer_name: customerName,
                phone: phone,
                city: village,
                state: state,
                advance_amount: parseFloat(document.getElementById('de-order-advance').value) || 0,
                items: items
            };

            const orderRes = await fetch(`${window.API_URL}/orders/convert`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if (!orderRes.ok) {
                const err = await orderRes.json();
                throw new Error(err.message || 'Failed to create order');
            }
        }

        // 2. Log Interaction / Update Lead Info
        let summaryNote = `[Decision Engine] Call: ${callStatus}. Path: ${leadPath}. `;
        let finalStatus = 'contacted';

        if (leadPath === 'not_connected') {
            const ncDate = document.getElementById('de-nc-date').value;
            const attempt = document.getElementById('de-nc-attempt').value;
            summaryNote += `Attempt: ${attempt}. Callback scheduled for: ${ncDate}.`;
            finalStatus = 'callback'; // This might need backend support, or use 'assigned'
        } else {
            summaryNote += `Decision: ${salesStatus}. `;
            if (salesStatus === 'Hot/Very Interested') {
                finalStatus = 'interested';
                summaryNote += `Hot lead. Next Followup: ${document.getElementById('de-followup-date').value}`;
            } else if (salesStatus === 'Mild/Later') {
                finalStatus = 'followup';
                summaryNote += `Next Followup: ${document.getElementById('de-followup-date').value}`;
            } else if (salesStatus === 'Cold/Not Interested') {
                finalStatus = 'not_interested';
                summaryNote += `Reason: ${document.getElementById('de-lost-reason').value}. Notes: ${document.getElementById('de-lost-notes').value}`;
            } else if (salesStatus === 'Ordered') {
                finalStatus = 'converted';
            } else if (salesStatus === 'Old Purchased') {
                finalStatus = 'lost';
                summaryNote += `Satisfaction: ${document.getElementById('de-feedback-satisfaction').value}. Feedback: ${document.getElementById('de-feedback-notes').value}`;
            } else if (salesStatus === 'Dealer') {
                finalStatus = 'dealer';
                summaryNote += `Mapped to Dealer inquiry. Next Followup: ${document.getElementById('de-followup-date').value}`;
            }
        }

        // Add Note
        await fetch(`${window.API_URL}/leads/${leadId}/notes`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: summaryNote })
        });

        // Update Lead Details (Name, city, state, status, language)
        await fetch(`${window.API_URL}/leads/${leadId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_name: customerName,
                city: village,
                state: state,
                status: finalStatus,
                phone_number: phone,
                language: document.getElementById('de-language').value,
                first_message: document.getElementById('leadDetailAmount')?.textContent || '' // preserve
            })
        });

        window.showAlert("Success", "Flow Saved Successfully!", "success");
        closeDecisionEngine();

        if (typeof populateLeadDetails === 'function') {
            populateLeadDetails(leadId);
        }

        // Refresh list if we are on dashboard
        if (typeof initLeadList === 'function') {
            initLeadList();
        }

    } catch (err) {
        console.error(err);
        window.showAlert("Error", "An error occurred: " + err.message, "error");
    } finally {
        submitBtn.innerHTML = 'Save & Convert <i class="fas fa-check ml-2"></i>';
        submitBtn.disabled = false;
    }
}

// ============================================================
// ─── Manual Lead Wizard Logic (M-Prefix) ─────────────────────
// ============================================================

let mCurrentStep = 1;
let mLeadPath = 'normal';

function initManualLeadForm() {
    console.log("Initializing Manual Lead Wizard...");
    mCurrentStep = 1;
    mLeadPath = 'normal';

    // Reset indicators
    for (let i = 1; i <= 4; i++) {
        const ind = document.getElementById(`mstep-${i}`);
        if (ind) ind.classList.remove('active', 'completed');
    }
    const step1Ind = document.getElementById('mstep-1');
    if (step1Ind) step1Ind.classList.add('active');

    // Load products
    loadProductsForEngine('m-');

    mGoToStep(1);
    mHideAllSubforms();
}

function mHandleCallStatusChange(status) {
    if (status === 'Received') {
        mLeadPath = 'normal';
    } else if (status === 'Booked') {
        mLeadPath = 'quick_order';
    } else {
        mLeadPath = 'not_connected';
    }
}

function mHideAllSubforms() {
    const ids = ['m-de-form-order', 'm-de-form-followup', 'm-de-form-lost', 'm-de-form-feedback', 'm-de-form-notconnected', 'm-de-sales-status-container'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function mHandleSalesStatusChange(status) {
    // Keep container visible but hide specific subforms
    ['m-de-form-order', 'm-de-form-followup', 'm-de-form-lost', 'm-de-form-feedback'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    if (status === 'Ordered') {
        const orderForm = document.getElementById('m-de-form-order');
        if (orderForm) orderForm.classList.remove('hidden');
        calculateOrderAmounts('m-');
    } else if (['Hot/Very Interested', 'Mild/Later', 'Dealer'].includes(status)) {
        const followupForm = document.getElementById('m-de-form-followup');
        if (followupForm) followupForm.classList.remove('hidden');
    } else if (status === 'Cold/Not Interested') {
        const lostForm = document.getElementById('m-de-form-lost');
        if (lostForm) lostForm.classList.remove('hidden');
    } else if (status === 'Old Purchased') {
        const feedbackForm = document.getElementById('m-de-form-feedback');
        if (feedbackForm) feedbackForm.classList.remove('hidden');
    }
}

function mDeNextStep(targetStep) {
    if (mCurrentStep === 1) {
        const phone = document.getElementById('m-de-phone').value;
        const status = document.getElementById('m-de-call-status').value;
        if (!phone || phone.length < 10) return window.showAlert("Validation", "Please enter a valid 10-digit phone number", "error");
        if (!status) return window.showAlert("Required", "Please select a call status", "error");

        if (mLeadPath === 'quick_order') {
            mHideAllSubforms();
            const statusContainer = document.getElementById('m-de-sales-status-container');
            if (statusContainer) statusContainer.classList.remove('hidden');
            const salesStatusInput = document.getElementById('m-de-sales-status');
            if (salesStatusInput) {
                salesStatusInput.value = 'Ordered';
                mHandleSalesStatusChange('Ordered');
            }
            targetStep = 4;
        } else if (mLeadPath === 'not_connected') {
            mHideAllSubforms();
            const ncForm = document.getElementById('m-de-form-notconnected');
            if (ncForm) ncForm.classList.remove('hidden');
            targetStep = 4;
        } else {
            targetStep = 2;
        }
    } else if (mCurrentStep === 2) {
        targetStep = 3;
    } else if (mCurrentStep === 3) {
        targetStep = 4;
        mHideAllSubforms();
        const statusContainer = document.getElementById('m-de-sales-status-container');
        if (statusContainer) {
            statusContainer.classList.remove('hidden');
            // Trigger initial subform visibility for the default 'Ordered' status
            const defaultStatus = document.getElementById('m-de-sales-status').value;
            mHandleSalesStatusChange(defaultStatus);
        }
    }
    mGoToStep(targetStep);
}

function mGoToStep(step) {
    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`m-wizard-step-${i}`);
        if (stepEl) stepEl.classList.remove('active');

        const ind = document.getElementById(`mstep-${i}`);
        if (ind) {
            ind.classList.remove('active', 'completed');
            if (i < step) ind.classList.add('completed');
        }
    }

    const targetStepEl = document.getElementById(`m-wizard-step-${step}`);
    if (targetStepEl) targetStepEl.classList.add('active');

    const targetInd = document.getElementById(`mstep-${step}`);
    if (targetInd) targetInd.classList.add('active');

    mCurrentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitManualLeadWizard() {
    const submitBtn = document.getElementById('mSubmitBtn');
    const token = localStorage.getItem('token');

    if (mLeadPath === 'not_connected') {
        const ncDate = document.getElementById('m-de-nc-date').value;
        if (!ncDate) return window.showAlert("Required", "Please select callback date", "error");
    }

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    try {
        const phone = document.getElementById('m-de-phone').value;
        const name = document.getElementById('m-de-customer-name').value;
        const village = document.getElementById('m-de-village').value;
        const state = document.getElementById('m-de-state').value;
        const lang = document.getElementById('m-de-language').value;
        const callStatus = document.getElementById('m-de-call-status').value;
        const salesStatus = document.getElementById('m-de-sales-status').value;

        let finalLeadStatus = 'contacted';
        if (mLeadPath === 'not_connected') finalLeadStatus = 'callback';
        else if (salesStatus === 'Ordered') finalLeadStatus = 'converted';
        else if (salesStatus === 'Hot/Very Interested') finalLeadStatus = 'interested';
        else if (salesStatus === 'Mild/Later') finalLeadStatus = 'followup';
        else if (salesStatus === 'Cold/Not Interested') finalLeadStatus = 'not_interested';
        else if (salesStatus === 'Dealer') finalLeadStatus = 'dealer';

        // 1. Create Lead
        const leadRes = await fetch(`${window.API_URL}/leads`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: phone,
                customer_name: name,
                city: village,
                state: state,
                language: lang,
                status: finalLeadStatus,
                source: 'manual'
            })
        });

        if (!leadRes.ok) {
            const errData = await leadRes.json();
            throw new Error(errData.message || "Failed to create lead");
        }

        const leadData = await leadRes.json();
        const leadId = leadData.lead_id;

        // 2. Add interaction note
        let note = `[Manual Wizard] Call: ${callStatus}. Path: ${mLeadPath}. `;
        if (mLeadPath === 'not_connected') {
            note += `Callback: ${document.getElementById('m-de-nc-date').value}`;
        } else {
            note += `Decision: ${salesStatus}.`;
        }

        await fetch(`${window.API_URL}/leads/${leadId}/notes`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ note })
        });

        // 3. Create Order if Ordered
        if (salesStatus === 'Ordered' && mLeadPath !== 'not_connected') {
            const productSelect = document.getElementById('m-de-products');
            const selectedOptions = Array.from(productSelect.selectedOptions);
            const items = selectedOptions.map(opt => ({
                product_id: opt.getAttribute('data-id'),
                quantity: 1,
                price: parseFloat(opt.getAttribute('data-price')) || 0
            }));

            const orderPayload = {
                lead_id: leadId,
                customer_name: name,
                phone: phone,
                city: village,
                state: state,
                advance_amount: parseFloat(document.getElementById('m-de-order-advance').value) || 0,
                items: items
            };

            const orderRes = await fetch(`${window.API_URL}/orders/convert`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if (!orderRes.ok) throw new Error('Order creation failed but lead was saved');
        }

        window.showAlert("Lead Created", "Manual Lead Registered Successfully!", "success");
        // We'll trust the user to manually refresh or we can trigger a navigation
        if (typeof initLeadNav === 'function') initLeadNav();

    } catch (err) {
        console.error(err);
        window.showAlert("Failed", err.message, "error");
    } finally {
        submitBtn.innerHTML = 'Save Lead Record <i class="fas fa-cloud-arrow-up ml-2"></i>';
        submitBtn.disabled = false;
    }
}
