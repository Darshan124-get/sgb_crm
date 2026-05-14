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

        // Jump to Step logic for Wizard Indicators
        if (e.target.classList.contains('step-ind')) {
            const stepId = e.target.id;
            const stepNum = parseInt(stepId.replace('step', '').replace('-ind', ''));
            if (!isNaN(stepNum)) {
                // Validation: Don't jump ahead of step 1 without a status
                if (stepNum > 1 && !document.getElementById('de-call-status').value) {
                    return window.showAlert("Selection Required", "Please select a Call Status first", "info");
                }
                goToStep(stepNum);
            }
        }

        // Jump to Step for Manual Wizard
        const mStepEl = e.target.closest('.progress-step');
        if (mStepEl) {
            const stepId = mStepEl.id;
            const stepNum = parseInt(stepId.replace('mstep-', ''));
            if (!isNaN(stepNum)) {
                if (stepNum > 1 && !document.getElementById('m-de-call-status').value) {
                    return window.showAlert("Selection Required", "Please select a Call Status first", "info");
                }
                mGoToStep(stepNum);
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

    // Handle amount changes effectively for final/due calculation
    document.body.addEventListener('input', (e) => {
        const amountIds = [
            'de-order-total', 'de-order-discount', 'de-order-advance',
            'm-de-order-total', 'm-de-order-discount', 'm-de-order-advance'
        ];
        if (amountIds.includes(e.target.id)) {
            const prefix = e.target.id.startsWith('m-') ? 'm-' : '';
            updateFinalAndDue(prefix);
        }
    });
});

let currentStep = 1;
let leadPath = 'normal'; // 'normal', 'quick_order', 'not_connected'

// ─── Shared Helpers ───────────────────────────────────────────

function toggleOtherDelivery(val, wrapperId) {
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
        wrapper.style.display = (val === 'other') ? 'block' : 'none';
        if (wrapper.classList.contains('hidden')) {
            if (val === 'other') wrapper.classList.remove('hidden');
            else wrapper.classList.add('hidden');
        }
    }
}


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
                // IMPORTANT: Using selling_price and name from DB schema
                productSelect.innerHTML = products.map(p => `
                    <option value="${p.name}" data-id="${p.product_id}" data-price="${p.selling_price || 0}">
                        ${p.name} — ₹${p.selling_price || 0}
                    </option>
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

    // Update product display list
    const displayEl = document.getElementById(prefix + 'de-order-products-display');
    if (displayEl) {
        displayEl.textContent = selectedNames.length > 0 ? selectedNames.join(', ') : 'None';
    }

    // Auto-update Total Amount in Step 4
    const totalInput = document.getElementById(prefix + 'de-order-total');
    if (totalInput) {
        // We auto-load the total, but avoid overwriting if it's already set and total is 0 
        // (to handle manual modifications that might have happened)
        if (total > 0 || !totalInput.value) {
            totalInput.value = Math.round(total);
        }
    }

    updateFinalAndDue(prefix);
}

function updateFinalAndDue(prefix = '') {
    const totalInput = document.getElementById(prefix + 'de-order-total');
    const discountInput = document.getElementById(prefix + 'de-order-discount');
    const finalInput = document.getElementById(prefix + 'de-order-final');
    const advanceInput = document.getElementById(prefix + 'de-order-advance');
    const dueInput = document.getElementById(prefix + 'de-order-due');

    const total = parseFloat(totalInput?.value) || 0;
    const discount = parseFloat(discountInput?.value) || 0;
    const advance = parseFloat(advanceInput?.value) || 0;

    const final = Math.max(0, total - discount);
    const due = Math.max(0, final - advance);

    if (finalInput) finalInput.value = Math.round(final);
    if (dueInput) {
        dueInput.value = Math.round(due);
        // Visual feedback for due amount
        dueInput.style.color = due > 0 ? '#ef4444' : '#10b981';
    }
}


/**
 * Triggers the Decision Engine modal from the Lead Details view.
 * Renamed to handleLeadConversionModal to avoid any unintentional collisions.
 */
window.handleLeadConversionModal = function () {
    console.log("[DecisionEngine] handleLeadConversionModal activated...");
    const modal = document.getElementById('decisionEngineModal');
    if (!modal) {
        window.showAlert("System Error", "Conversion modal container not found. Please refresh (Ctrl+F5).", "error");
        return;
    }

    // 1. Reset everything first
    resetDecisionEngine();

    // 2. Auto-fill available details from the View
    const leadPhone = document.getElementById('leadDetailPhone')?.textContent || '';
    const leadName = document.getElementById('leadDetailName')?.textContent || '';
    const leadVillage = document.getElementById('leadDetailVillage')?.textContent || '';
    const leadDistrict = document.getElementById('leadDetailDistrict')?.textContent || '';
    const leadPincode = document.getElementById('leadDetailPincode')?.textContent || '';
    const leadState = document.getElementById('leadDetailState')?.textContent || '';
    const leadLanguage = document.getElementById('leadDetailLanguage')?.textContent || 'EN';

    const phoneInput = document.getElementById('de-phone');
    const nameInput = document.getElementById('de-customer-name');
    const villageInput = document.getElementById('de-village');
    const districtInput = document.getElementById('de-district');
    const pincodeInput = document.getElementById('de-pincode');
    const stateInput = document.getElementById('de-state');
    const langInput = document.getElementById('de-language');

    if (phoneInput) phoneInput.value = leadPhone;
    if (nameInput) nameInput.value = leadName;

    if (villageInput && leadVillage && leadVillage !== '-') {
        villageInput.value = leadVillage;
    }

    if (districtInput && leadDistrict && leadDistrict !== '-') {
        districtInput.value = leadDistrict;
    }

    if (pincodeInput && leadPincode && leadPincode !== '-') {
        pincodeInput.value = leadPincode;
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

    // 4. Auto-select Next Attempt
    const currentCount = parseInt(window.currentLeadData?.call_count || 0);
    const nextAttempt = Math.min(currentCount + 1, 3);
    const attemptInput = document.getElementById('de-call-attempt');
    if (attemptInput) {
        attemptInput.value = nextAttempt;
        // Update UI pills
        document.querySelectorAll('#de-call-attempt-wrapper .status-pill').forEach(pill => {
            pill.classList.toggle('active', pill.getAttribute('data-value') == nextAttempt);
        });
    }

    // 5. Show Modal
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    console.log("Modal activated.");
}

function closeDecisionEngine() {
    const modal = document.getElementById('decisionEngineModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

// ─── Core Logic ───────────────────────────────────────────────

function handleCallStatusChange(status) {
    if (!status) return;

    if (status === 'Received' || status === 'Booked') {
        leadPath = (status === 'Booked') ? 'quick_order' : 'connected';
    } else if (['Not Received', 'Switched Off', 'Busy', 'Not Reachable', 'Not Interested', 'WhatsApp'].includes(status)) {
        leadPath = 'not_connected';
    }

    // Check for auto-routing to Lost on 3rd attempt
    const currentAttemptInput = document.getElementById('de-call-attempt');
    const currentAttempt = currentAttemptInput ? currentAttemptInput.value : '1';
    const unsuccessfulStatuses = ['Not Received', 'Switched Off', 'Busy', 'Not Reachable', 'Not Interested'];
    
    if (currentAttempt == '3' && unsuccessfulStatuses.includes(status)) {
        console.log("[DecisionEngine] 3rd Attempt Unsuccessful - Recommendation: Route to Lost");
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

    const nextBtn = document.getElementById('de-next-3');
    const saveBtn = document.getElementById('de-save-3');

    if (status === 'converted' || status === 'Ordered') {
        // If ordered, we MUST go to step 4 (Product Selection)
        if (nextBtn) nextBtn.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'none';

        // Show the order form in STEP 4 (it will be visible when we go there)
        document.getElementById('de-form-order').style.display = 'block';
        document.getElementById('de-order-screenshot').setAttribute('required', 'true');
        calculateOrderAmounts(); // Fresh calculation
    } else if (status === 'interested' || status === 'followup' || status === 'dealer' || status === 'Hot/Very Interested' || status === 'Mild/Later' || status === 'Dealer') {
        // For interest/followup, we can go to step 4 to pick products OR just save
        // Let's allow going to step 4 to pick what they are interested in
        if (nextBtn) nextBtn.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'block'; // Allow direct save too

        document.getElementById('de-form-followup').style.display = 'block';
        document.getElementById('de-followup-date').setAttribute('required', 'true');
    } else if (status === 'not_interested' || status === 'Cold/Not Interested') {
        // Just save
        if (nextBtn) nextBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'block';

        document.getElementById('de-form-reason').style.display = 'block';
        document.getElementById('de-lost-reason').setAttribute('required', 'true');
    } else if (status === 'lost' || status === 'Old Purchased') {
        // Just save
        if (nextBtn) nextBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'block';

        document.getElementById('de-form-feedback').style.display = 'block';
        document.getElementById('de-feedback-satisfaction').setAttribute('required', 'true');
    } else {
        if (nextBtn) nextBtn.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'none';
    }
}

// ─── Step Navigation ──────────────────────────────────────────

function deNextStep(targetStep) {
    const callStatus = document.getElementById('de-call-status').value;

    if (currentStep === 1) {
        if (!callStatus) {
            window.showAlert("Selection Required", "Please select a Call Status", "info");
            return;
        }

        // Routing logic based on Call Status
        const currentAttemptInput = document.getElementById('de-call-attempt');
        const currentAttempt = currentAttemptInput ? currentAttemptInput.value : '1';
        const unsuccessfulStatuses = ['Not Received', 'Switched Off', 'Busy', 'Not Reachable', 'Not Interested'];

        if (currentAttempt == '3' && unsuccessfulStatuses.includes(callStatus)) {
            // Force Lost Status
            hideAllSubforms();
            targetStep = 3;
            document.getElementById('de-sales-status-container').style.display = 'block';
            const salesStatusSelect = document.getElementById('de-sales-status');
            if (salesStatusSelect) {
                salesStatusSelect.value = 'lost';
                handleSalesStatusChange('lost');
            }
            window.showAlert("Max Attempts Reached", "This is the 3rd unsuccessful attempt. Lead is being marked as Lost.", "warning");
        } else if (leadPath === 'quick_order') {
            // Booked -> Skip to Decision
            hideAllSubforms();
            targetStep = 3;
            document.getElementById('de-sales-status-container').style.display = 'block';
            document.getElementById('de-sales-status').value = 'Ordered';
            handleSalesStatusChange('Ordered');
        } else if (leadPath === 'not_connected') {
            // Not connected -> Skip to Form directly
            hideAllSubforms();
            targetStep = 3; // Decision step now houses the not connected log
            // Hide standard sales status, show not connected log immediately
            document.getElementById('de-sales-status-container').style.display = 'none';
            document.getElementById('de-form-notconnected').style.display = 'block';
            document.getElementById('de-nc-date').setAttribute('required', 'true');
            // Auto-set tomorrow's date
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(10, 0, 0, 0);
            const offset = tomorrow.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(tomorrow - offset)).toISOString().slice(0, 16);
            document.getElementById('de-nc-date').value = localISOTime;
            const currentCount = (window.currentLeadData ? window.currentLeadData.call_count : 0) || 0;
            const nextAttempt = Math.min(currentCount + 1, 3);
            const attemptSelect = document.getElementById('de-nc-attempt');
            if (attemptSelect) {
                if (nextAttempt === 1) attemptSelect.value = "1st Attempt";
                else if (nextAttempt === 2) attemptSelect.value = "2nd Attempt";
                else if (nextAttempt === 3) attemptSelect.value = "3rd Attempt";
            }

            // In not_connected path, Step 3 should show Save button
            if (document.getElementById('de-next-3')) document.getElementById('de-next-3').style.display = 'none';
            if (document.getElementById('de-save-3')) document.getElementById('de-save-3').style.display = 'block';
        } else {
            // Normal flow -> go to Step 2
            targetStep = 2;
            document.getElementById('de-sales-status-container').style.display = 'block';
        }
    } else if (currentStep === 2) {
        targetStep = 3;
    } else if (currentStep === 3) {
        targetStep = 4;
    }

    goToStep(targetStep);
}

function dePrevStep(targetStep) {
    // Reverse routing logic
    if (currentStep === 3) {
        if (leadPath === 'quick_order' || leadPath === 'not_connected') {
            targetStep = 1;
        } else {
            targetStep = 2;
        }
    } else if (currentStep === 4) {
        targetStep = 3;
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

    // Fix: If we reach Step 4 and it's an Order path, ensure amounts are calculated
    if (step === 4) {
        const salesStatus = document.getElementById('de-sales-status').value;
        if (salesStatus === 'Ordered') {
            calculateOrderAmounts();
        }
    }
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
    document.getElementById('de-district').value = '';
    document.getElementById('de-pincode').value = '';
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

    // Reset Delivery Type
    if (document.getElementById('de-delivery-type')) document.getElementById('de-delivery-type').value = 'Post office COD';
    if (document.getElementById('de-delivery-other')) document.getElementById('de-delivery-other').value = '';
    if (document.getElementById('de-delivery-other-wrapper')) document.getElementById('de-delivery-other-wrapper').style.display = 'none';

    document.getElementById('de-sales-status-container').style.display = 'block';
    document.getElementById('de-sales-status').value = '';

    if (document.getElementById('de-next-3')) document.getElementById('de-next-3').style.display = 'block';
    if (document.getElementById('de-save-3')) document.getElementById('de-save-3').style.display = 'none';

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
        const district = document.getElementById('de-district').value;
        const pincode = document.getElementById('de-pincode').value;
        const state = document.getElementById('de-state').value;

        // 1. Process Order if status is Ordered
        if (salesStatus === 'Ordered' && leadPath !== 'not_connected') {
            const selectedOptions = Array.from(document.getElementById('de-products').selectedOptions);
            const items = selectedOptions.map(opt => ({
                product_id: parseInt(opt.getAttribute('data-id')) || 0,
                quantity: 1,
                price: parseFloat(opt.getAttribute('data-price')) || 0
            }));

            // Frontend Validation
            if (!leadId || leadId === 'undefined') return window.showAlert("Error", "Lead ID is missing. Please refresh.", "error");
            if (!customerName || customerName === '-') return window.showAlert("Required Field", "Customer Name is required for order conversion.", "error");
            if (!phone || phone === '-') return window.showAlert("Required Field", "Phone Number is required for order conversion.", "error");
            if (items.length === 0) return window.showAlert("Selection Error", "Please select at least one product in Step 3.", "error");

            const formData = new FormData();
            const deliveryTypeVal = document.getElementById('de-delivery-type').value;
            const deliveryType = deliveryTypeVal === 'other' ? document.getElementById('de-delivery-other').value : deliveryTypeVal;

            formData.append('lead_id', leadId);
            formData.append('customer_name', customerName);
            formData.append('phone', phone);
            formData.append('city', village);
            formData.append('district', district);
            formData.append('pincode', pincode);
            formData.append('state', state);
            formData.append('delivery_type', deliveryType);
            formData.append('total_amount', document.getElementById('de-order-total').value);
            formData.append('advance_amount', document.getElementById('de-order-advance').value);
            formData.append('items', JSON.stringify(items));

            const fileInput = document.getElementById('de-order-screenshot');
            if (fileInput.files[0]) {
                formData.append('screenshot', fileInput.files[0]);
            }

            const orderRes = await fetch(`${window.API_URL}/orders/convert`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!orderRes.ok) {
                const errDetail = await orderRes.json();
                const errorMsg = errDetail.error ? `${errDetail.message}: ${errDetail.error}` : (errDetail.message || 'Failed to create order');
                throw new Error(errorMsg);
            }
        }

        // 2. Log Interaction / Update Lead Info
        let summaryNote = `[Decision Engine] Call: ${callStatus}. Path: ${leadPath}. `;
        let finalStatus = 'contacted';

        let currentCallCount = (window.currentLeadData ? window.currentLeadData.call_count : 0) || 0;

        if (leadPath === 'not_connected') {
            const ncDate = document.getElementById('de-nc-date').value;
            const attemptLabel = document.getElementById('de-nc-attempt').value;

            const unreachedStatuses = ['Not Received', 'Switched Off', 'Busy', 'Not Reachable', 'Not Interested'];
            if (unreachedStatuses.includes(callStatus)) {
                currentCallCount++;
                if (currentCallCount >= 3) {
                    finalStatus = 'lost';
                    summaryNote += `Attempt ${currentCallCount} (${callStatus}). Lead automatically marked as LOST after 3 attempts.`;
                } else {
                    finalStatus = 'callback';
                    summaryNote += `Attempt ${currentCallCount} (${callStatus}). Callback scheduled for: ${ncDate}.`;
                }
            } else {
                finalStatus = 'callback';
                summaryNote += `Status: ${callStatus}. Callback scheduled for: ${ncDate}.`;
            }
        } else {
            summaryNote += `Decision: ${salesStatus}. `;
            if (salesStatus === 'interested' || salesStatus === 'Hot/Very Interested') {
                finalStatus = 'interested';
                summaryNote += `Hot lead. Next Followup: ${document.getElementById('de-followup-date').value}`;
            } else if (salesStatus === 'followup' || salesStatus === 'Mild/Later') {
                finalStatus = 'followup';
                summaryNote += `Next Followup: ${document.getElementById('de-followup-date').value}`;
            } else if (salesStatus === 'not_interested' || salesStatus === 'Cold/Not Interested') {
                finalStatus = 'not_interested';
                summaryNote += `Reason: ${document.getElementById('de-lost-reason').value}. Notes: ${document.getElementById('de-lost-notes').value}`;
            } else if (salesStatus === 'converted' || salesStatus === 'Ordered') {
                finalStatus = 'converted';
            } else if (salesStatus === 'lost' || salesStatus === 'Old Purchased') {
                finalStatus = 'lost';
                summaryNote += `Satisfaction: ${document.getElementById('de-feedback-satisfaction').value}. Feedback: ${document.getElementById('de-feedback-notes').value}`;
            } else if (salesStatus === 'dealer' || salesStatus === 'Dealer') {
                finalStatus = 'dealer';
                summaryNote += `Mapped to Dealer inquiry. Next Followup: ${document.getElementById('de-followup-date').value}`;
            }
        }

        // Add Note
        const noteRes = await fetch(`${window.API_URL}/leads/${leadId}/notes`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: summaryNote })
        });
        if (!noteRes.ok) throw new Error('Failed to save interaction note');

        // Update Lead Details (Name, city, state, status, language)
        // Auto-assign score based on finalStatus
        let finalScore = 'cold';
        if (finalStatus === 'converted' || finalStatus === 'interested') finalScore = 'hot';
        else if (finalStatus === 'followup' || finalStatus === 'callback' || finalStatus === 'dealer') finalScore = 'warm';
        else if (finalStatus === 'not_interested' || finalStatus === 'lost') finalScore = 'cold';

        const updatePayload = {
            customer_name: customerName,
            city: village,
            district: district,
            pincode: pincode,
            state: state,
            status: finalStatus,
            score: finalScore,
            phone_number: phone,
            language: document.getElementById('de-language').value,
            assigned_to: document.getElementById('leadDetailAssignedId')?.value,
            first_message: document.getElementById('leadDetailAmount')?.textContent || '', // preserve
            call_count: currentCallCount
        };

        if (leadPath === 'not_connected') {
            updatePayload.next_followup_date = document.getElementById('de-nc-date').value;
        } else if (['Hot/Very Interested', 'Mild/Later', 'Dealer'].includes(salesStatus)) {
            updatePayload.next_followup_date = document.getElementById('de-followup-date').value;
        }
        const updateRes = await fetch(`${window.API_URL}/leads/${leadId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
        });
        if (!updateRes.ok) throw new Error('Failed to update lead status');

        // 🔥 ACTUALLY CREATE THE ORDER 🔥
        if (finalStatus === 'converted') {
            // Helper to clean currency strings (e.g., "₹ 5,000" -> 5000)
            const cleanNum = (id) => {
                const el = document.getElementById(id);
                if (!el) return 0;
                const val = el.value || el.textContent || "0";
                return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
            };

            // Unified amount collection (Checks both possible IDs)
            const totalAmt = cleanNum('de-order-total') || cleanNum('de-order-final') || cleanNum('de-final-amount');
            const advAmt = cleanNum('de-order-advance') || cleanNum('de-advance-amount');

            // Collect items from Step 3
            const selectedOptions = Array.from(document.getElementById('de-products')?.selectedOptions || []);
            const items = selectedOptions.map(opt => {
                const id = opt.value || opt.getAttribute('data-id');
                const price = parseFloat(opt.getAttribute('data-price')) || 0;
                return {
                    product_id: parseInt(id) || id, // Store ID or Code
                    quantity: 1,
                    price: price
                };
            });

            const deliveryTypeVal = document.getElementById('de-delivery-type').value;
            const deliveryType = deliveryTypeVal === 'other' ? document.getElementById('de-delivery-other').value : deliveryTypeVal;

            const orderPayload = {
                lead_id: leadId,
                customer_name: customerName,
                phone: phone,
                address: village,
                city: village,
                district: district,
                pincode: pincode,
                state: state,
                delivery_type: deliveryType,
                total_amount: totalAmt,
                advance_amount: advAmt,
                items: items
            };

            const orderRes = await fetch(`${window.API_URL}/orders/convert`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if (!orderRes.ok) {
                const errData = await orderRes.json();
                throw new Error("ORDER SAVE FAILED: " + (errData.error || errData.message));
            }

            const oData = await orderRes.json();
            const formattedId = window.formatOrderId(oData.orderId);
            window.showAlert("Success", "ORDER " + formattedId + " SAVED WITH ₹" + totalAmt + "!", "success");
        } else {
            window.showAlert("Success", "Interaction Saved Successfully!", "success");
        }

        // Refresh the underlying Lead Details UI
        if (typeof populateLeadDetails === 'function') {
            populateLeadDetails(leadId);
        } else if (typeof window.populateLeadDetails === 'function') {
            window.populateLeadDetails(leadId);
        }

        // Refresh Lead List/Dashboard if function exists
        if (typeof initLeadList === 'function') {
            initLeadList(window.currentFilters || {});
        } else if (typeof window.initLeadList === 'function') {
            window.initLeadList(window.currentFilters || {});
        }

        closeDecisionEngine();

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

    // Reset Delivery Type
    if (document.getElementById('m-de-delivery-type')) document.getElementById('m-de-delivery-type').value = 'Post office COD';
    if (document.getElementById('m-de-delivery-other')) document.getElementById('m-de-delivery-other').value = '';
    if (document.getElementById('m-de-delivery-other-wrapper')) document.getElementById('m-de-delivery-other-wrapper').classList.add('hidden');
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

    const nextBtn = document.getElementById('m-de-next-3');
    const saveBtn = document.getElementById('m-de-save-3');

    if (status === 'Ordered') {
        const orderForm = document.getElementById('m-de-form-order');
        if (orderForm) orderForm.classList.remove('hidden');
        if (nextBtn) nextBtn.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'none';
        calculateOrderAmounts('m-');
    } else if (['Hot/Very Interested', 'Mild/Later', 'Dealer'].includes(status)) {
        const followupForm = document.getElementById('m-de-form-followup');
        if (followupForm) followupForm.classList.remove('hidden');
        if (nextBtn) nextBtn.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'block';
    } else if (status === 'Cold/Not Interested') {
        const lostForm = document.getElementById('m-de-form-lost');
        if (lostForm) lostForm.classList.remove('hidden');
        if (nextBtn) nextBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'block';
    } else if (status === 'Old Purchased') {
        const feedbackForm = document.getElementById('m-de-form-feedback');
        if (feedbackForm) feedbackForm.classList.remove('hidden');
        if (nextBtn) nextBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'block';
    } else {
        if (nextBtn) nextBtn.style.display = 'block';
        if (saveBtn) saveBtn.style.display = 'none';
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
            targetStep = 3; // Decision
        } else if (mLeadPath === 'not_connected') {
            mHideAllSubforms();
            const ncForm = document.getElementById('m-de-form-notconnected');
            if (ncForm) ncForm.classList.remove('hidden');

            if (document.getElementById('m-de-next-3')) document.getElementById('m-de-next-3').style.display = 'none';
            if (document.getElementById('m-de-save-3')) document.getElementById('m-de-save-3').style.display = 'block';

            targetStep = 3; // Decision (Not Connected)
        } else {
            targetStep = 2;
        }
    } else if (mCurrentStep === 2) {
        targetStep = 3;
    } else if (mCurrentStep === 3) {
        targetStep = 4;
        // In Step 4 (Products), we should always show the save button at the end
        // If it was an order, the m-de-form-order will be visible because mHandleSalesStatusChange was called
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

    // Auto-calculate for manual wizard
    if (step === 4) {
        const salesStatus = document.getElementById('m-de-sales-status')?.value;
        if (salesStatus === 'Ordered') {
            calculateOrderAmounts('m-');
        }
    }

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
        const district = document.getElementById('m-de-district').value;
        const pincode = document.getElementById('m-de-pincode').value;
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
        const createPayload = {
            phone_number: phone,
            customer_name: name,
            city: village,
            district: district,
            pincode: pincode,
            state: state,
            language: lang,
            status: finalLeadStatus,
            source: 'manual',
            delivery_type: (document.getElementById('m-de-sales-status').value === 'Ordered') ?
                (document.getElementById('m-de-delivery-type').value === 'other' ? document.getElementById('m-de-delivery-other').value : document.getElementById('m-de-delivery-type').value) : null
        };

        if (mLeadPath === 'not_connected') {
            createPayload.next_followup_date = document.getElementById('m-de-nc-date').value;
        } else if (['Hot/Very Interested', 'Mild/Later', 'Dealer'].includes(salesStatus)) {
            const fDate = document.getElementById('m-de-followup-date');
            if (fDate) createPayload.next_followup_date = fDate.value;
        }

        const leadRes = await fetch(`${window.API_URL}/leads`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(createPayload)
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

            const deliveryTypeVal = document.getElementById('m-de-delivery-type').value;
            const deliveryType = deliveryTypeVal === 'other' ? document.getElementById('m-de-delivery-other').value : deliveryTypeVal;

            const formData = new FormData();
            formData.append('lead_id', leadId);
            formData.append('customer_name', name);
            formData.append('phone', phone);
            formData.append('city', village);
            formData.append('district', district);
            formData.append('pincode', pincode);
            formData.append('state', state);
            formData.append('delivery_type', deliveryType);
            formData.append('total_amount', document.getElementById('m-de-order-total').value);
            formData.append('advance_amount', document.getElementById('m-de-order-advance').value);
            formData.append('items', JSON.stringify(items));

            const orderRes = await fetch(`${window.API_URL}/orders/convert`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
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
