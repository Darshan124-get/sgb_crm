window.BILLING_API_URL = window.BILLING_API_URL || (window.API_URL ? `${window.API_URL}/billing` : 'http://127.0.0.1:5000/api/billing');
var BILLING_API_URL = window.BILLING_API_URL;
let currentOrder = null;

window.openOrderBilling = async function (orderId) {
    const modal = document.getElementById('billingModal');
    const modalBody = document.getElementById('modalBody');
    modal.style.display = 'flex';
    modalBody.innerHTML = '<div style="text-align:center; padding: 5rem;"><div class="loader"></div></div>';

    try {
        const res = await fetch(`${BILLING_API_URL}/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        currentOrder = await res.json();

        renderWorkstation();
    } catch (err) {
        modalBody.innerHTML = '<p style="color: #ef4444; padding: 2rem;">Failed to load order details.</p>';
    }
}


window.copyToClipboard = function(text) {
    if(!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if(window.showAlert) {
            window.showAlert('Copied', 'Text copied to clipboard!', 'success');
        } else {
            console.log('Copied to clipboard');
        }
    }).catch(err => console.error('Could not copy text: ', err));
};

window.formatFullAddress = function() {
    if(!currentOrder) return '';
    const d = currentOrder;
    let parts = [];
    if(d.village) parts.push(d.village);
    if(d.sub_district || d.taluk) parts.push(d.sub_district || d.taluk);
    if(d.district || d.city) parts.push(d.district || d.city);
    if(d.state) parts.push(d.state);
    
    let str = parts.join(', ');
    if(d.pincode) str += ' - ' + d.pincode;
    if(d.phone) str += ' | Ph: ' + d.phone;
    return str;
};

window.updateZohoBill = function(val) {
    if (!currentOrder) return;
    currentOrder.zoho_bill_number = val;
};

window.updateDiscount = function(val) {
    if (!currentOrder) return;
    currentOrder.discount = parseFloat(val) || 0;
    
    const subtotal = currentOrder.items.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.quantity, 10)), 0);
    const grandTotal = subtotal - (parseFloat(currentOrder.discount) || 0) + (parseFloat(currentOrder.shipping_charges) || 0) + (parseFloat(currentOrder.extra_charges) || 0);
    const verifiedTotal = (currentOrder.payments || []).reduce((sum, p) => {
        if (p.payment_status === 'verified' || p.verified === 'yes') return sum + parseFloat(p.amount);
        return sum;
    }, 0);
    const advancePaid = Math.max(verifiedTotal, parseFloat(currentOrder.advance_amount) || 0);
    const balanceDue = Math.max(0, grandTotal - advancePaid);
    
    currentOrder.grandTotal = grandTotal;
    currentOrder.balanceDue = balanceDue;

    const displayGrand = document.getElementById('displayGrandTotal');
    if (displayGrand) displayGrand.textContent = '₹' + grandTotal.toLocaleString();
    
    const displayDue = document.getElementById('displayBalanceDue');
    if (displayDue) {
        displayDue.textContent = '₹' + balanceDue.toLocaleString();
        displayDue.style.color = balanceDue > 0 ? '#ef4444' : '#10b981';
    }
};

const INDIAN_STATES = [
    { code: 'AP', name: 'Andhra Pradesh' },
    { code: 'AR', name: 'Arunachal Pradesh' },
    { code: 'AS', name: 'Assam' },
    { code: 'BR', name: 'Bihar' },
    { code: 'CG', name: 'Chhattisgarh' },
    { code: 'GA', name: 'Goa' },
    { code: 'GJ', name: 'Gujarat' },
    { code: 'HR', name: 'Haryana' },
    { code: 'HP', name: 'Himachal Pradesh' },
    { code: 'JH', name: 'Jharkhand' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'KL', name: 'Kerala' },
    { code: 'MP', name: 'Madhya Pradesh' },
    { code: 'MH', name: 'Maharashtra' },
    { code: 'MN', name: 'Manipur' },
    { code: 'ML', name: 'Meghalaya' },
    { code: 'MZ', name: 'Mizoram' },
    { code: 'NL', name: 'Nagaland' },
    { code: 'OR', name: 'Odisha' },
    { code: 'PB', name: 'Punjab' },
    { code: 'RJ', name: 'Rajasthan' },
    { code: 'SK', name: 'Sikkim' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'TG', name: 'Telangana' },
    { code: 'TR', name: 'Tripura' },
    { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'UK', name: 'Uttarakhand' },
    { code: 'WB', name: 'West Bengal' },
    { code: 'AN', name: 'Andaman and Nicobar Islands' },
    { code: 'CH', name: 'Chandigarh' },
    { code: 'DN', name: 'Dadra and Nagar Haveli and Daman and Diu' },
    { code: 'DL', name: 'Delhi' },
    { code: 'JK', name: 'Jammu and Kashmir' },
    { code: 'LA', name: 'Ladakh' },
    { code: 'LD', name: 'Lakshadweep' },
    { code: 'PY', name: 'Puducherry' }
];

let currentWorkstationStep = 1;
let currentZohoSubTab = 'other_details';

window.switchWorkstationStep = function(step) {
    currentWorkstationStep = step;
    window.renderWorkstation(step);
};

window.switchZohoSubTab = function(tabName) {
    currentZohoSubTab = tabName;
    const tabOther = document.getElementById('zohoTabContentOther');
    const tabAddress = document.getElementById('zohoTabContentAddress');
    const btnOther = document.getElementById('btnZohoTabOther');
    const btnAddress = document.getElementById('btnZohoTabAddress');

    if (tabName === 'other_details') {
        if (tabOther) tabOther.style.display = 'block';
        if (tabAddress) tabAddress.style.display = 'none';
        if (btnOther) { btnOther.style.borderBottom = '3px solid #3b82f6'; btnOther.style.color = '#1e293b'; btnOther.style.fontWeight = '700'; }
        if (btnAddress) { btnAddress.style.borderBottom = '3px solid transparent'; btnAddress.style.color = '#64748b'; btnAddress.style.fontWeight = '500'; }
    } else {
        if (tabOther) tabOther.style.display = 'none';
        if (tabAddress) tabAddress.style.display = 'block';
        if (btnOther) { btnOther.style.borderBottom = '3px solid transparent'; btnOther.style.color = '#64748b'; btnOther.style.fontWeight = '500'; }
        if (btnAddress) { btnAddress.style.borderBottom = '3px solid #3b82f6'; btnAddress.style.color = '#1e293b'; btnAddress.style.fontWeight = '700'; }
    }
};

window.copyBillingToShippingAddress = function() {
    const fields = [
        ['zohoBillAttention', 'zohoShipAttention'],
        ['zohoBillStreet1', 'zohoShipStreet1'],
        ['zohoBillStreet2', 'zohoShipStreet2'],
        ['zohoBillCity', 'zohoShipCity'],
        ['zohoBillState', 'zohoShipState'],
        ['zohoBillPincode', 'zohoShipPincode'],
        ['zohoBillPhone', 'zohoShipPhone']
    ];
    fields.forEach(([src, dst]) => {
        const srcEl = document.getElementById(src);
        const dstEl = document.getElementById(dst);
        if (srcEl && dstEl) dstEl.value = srcEl.value;
    });
    if (window.showAlert) {
        window.showAlert('Copied!', 'Billing address copied to shipping address.', 'success');
    }
};

window.renderWorkstation = function(step = 1) {
    currentWorkstationStep = step;
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const data = currentOrder;
    if (!data) return;

    if (modalTitle) {
        modalTitle.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">
                    ${step === 1 ? 'Step 1: Create Customer in Zoho Books' : 'Step 2: Sales Order Creation'}
                </span>
                <span style="font-size: 0.75rem; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 6px; font-weight: 700;">
                    ORDER #${data.order_id}
                </span>
            </div>
        `;
    }

    // Step Progress Bar
    const progressBar = `
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; gap: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem;">
            <div onclick="switchWorkstationStep(1)" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem 1rem; border-radius: 8px; background: ${step === 1 ? '#eff6ff' : 'transparent'}; border: 1px solid ${step === 1 ? '#93c5fd' : 'transparent'};">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step === 1 ? '#3b82f6' : (data.zoho_contact_id ? '#10b981' : '#cbd5e1')}; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">
                    ${data.zoho_contact_id ? '✓' : '1'}
                </span>
                <span style="font-size: 0.85rem; font-weight: 700; color: ${step === 1 ? '#1d4ed8' : '#64748b'};">
                    1. Customer Details (Zoho)
                </span>
            </div>

            <i class="fa-solid fa-arrow-right" style="color: #cbd5e1; font-size: 0.8rem;"></i>

            <div onclick="${data.zoho_contact_id ? 'switchWorkstationStep(2)' : ''}" style="display: flex; align-items: center; gap: 0.5rem; cursor: ${data.zoho_contact_id ? 'pointer' : 'not-allowed'}; opacity: ${data.zoho_contact_id || step === 2 ? 1 : 0.6}; padding: 0.5rem 1rem; border-radius: 8px; background: ${step === 2 ? '#eff6ff' : 'transparent'}; border: 1px solid ${step === 2 ? '#93c5fd' : 'transparent'};">
                <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step === 2 ? '#3b82f6' : '#cbd5e1'}; color: white; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem;">
                    2
                </span>
                <span style="font-size: 0.85rem; font-weight: 700; color: ${step === 2 ? '#1d4ed8' : '#64748b'};">
                    2. Sales Order Creation
                </span>
            </div>
        </div>
    `;

    if (step === 1) {
        modalBody.innerHTML = progressBar + renderZohoCustomerStep(data);
        switchZohoSubTab(currentZohoSubTab);
    } else {
        modalBody.innerHTML = progressBar + renderSalesOrderStep(data);
    }
};

function renderZohoCustomerStep(data) {
    const rawName = (data.customer_name || '').trim();
    const parts = rawName.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    const isBusiness = data.order_source === 'dealer' || Boolean(data.company_name);
    const companyName = data.company_name || data.dealer_name || '';
    const displayName = rawName || companyName || 'Customer';
    const phone = data.phone || '';
    const stateName = data.state || 'Karnataka';

    const addressPart1 = data.address || '';
    const addressPart2 = [data.village, data.sub_district || data.taluk].filter(Boolean).join(', ');
    const city = data.city || data.district || '';
    const pincode = data.pincode || '';

    return `
        <div class="zoho-customer-form" style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); max-height: 75vh; overflow-y: auto;">
            ${data.zoho_contact_id ? `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #166534; font-weight: 600; font-size: 0.85rem;">
                        <i class="fa-solid fa-circle-check" style="color: #10b981; margin-right: 6px;"></i>
                        Customer is already registered on Zoho Books (Contact ID: <strong>${data.zoho_contact_id}</strong>)
                    </span>
                    <button type="button" class="btn-billing primary" onclick="switchWorkstationStep(2)" style="padding: 0.4rem 0.8rem; font-size: 0.78rem;">
                        Next: Sales Order ➔
                    </button>
                </div>
            ` : ''}

            <!-- Customer Type -->
            <div style="display: flex; align-items: center; margin-bottom: 1.5rem; gap: 3rem;">
                <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569;">Customer Type</label>
                <div style="display: flex; gap: 2rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; color: #1e293b; cursor: pointer;">
                        <input type="radio" name="zoho_customer_type" value="business" ${isBusiness ? 'checked' : ''} style="accent-color: #3b82f6;"> Business
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; color: #1e293b; cursor: pointer;">
                        <input type="radio" name="zoho_customer_type" value="individual" ${!isBusiness ? 'checked' : ''} style="accent-color: #3b82f6;"> Individual
                    </label>
                </div>
            </div>

            <!-- Primary Contact -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 1.25rem; gap: 3rem;">
                <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569; padding-top: 0.5rem;">Primary Contact</label>
                <div style="display: flex; gap: 0.75rem; flex: 1; max-width: 650px;">
                    <select id="zohoSalutation" style="width: 120px; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                        <option value="">Salutation</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Ms.">Ms.</option>
                        <option value="Miss">Miss</option>
                        <option value="Dr.">Dr.</option>
                    </select>
                    <input type="text" id="zohoFirstName" value="${firstName}" placeholder="First Name" style="flex: 1; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                    <input type="text" id="zohoLastName" value="${lastName}" placeholder="Last Name" style="flex: 1; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                </div>
            </div>

            <!-- Company Name -->
            <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569;">Company Name</label>
                <input type="text" id="zohoCompanyName" value="${companyName}" placeholder="Company Name (optional)" style="flex: 1; max-width: 650px; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
            </div>

            <!-- Display Name (Required) -->
            <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                <label style="width: 160px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Display Name *</label>
                <input type="text" id="zohoDisplayName" value="${displayName}" placeholder="Customer Display Name" style="flex: 1; max-width: 650px; padding: 0.55rem 0.75rem; border: 2px solid #93c5fd; border-radius: 8px; font-size: 0.875rem; font-weight: 600; color: #1e293b; outline: none;">
            </div>

            <!-- Email Address -->
            <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569;">Email Address</label>
                <div style="position: relative; flex: 1; max-width: 650px;">
                    <i class="fa-regular fa-envelope" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                    <input type="email" id="zohoEmail" value="${data.email || ''}" placeholder="email@example.com" style="width: 100%; box-sizing: border-box; padding: 0.55rem 0.75rem 0.55rem 2.25rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                </div>
            </div>

            <!-- Phone Numbers -->
            <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569;">Phone</label>
                <div style="display: flex; gap: 1rem; flex: 1; max-width: 650px;">
                    <div style="display: flex; flex: 1;">
                        <span style="background: #f1f5f9; border: 1px solid #cbd5e1; border-right: none; padding: 0.55rem 0.75rem; border-radius: 8px 0 0 8px; font-weight: 700; font-size: 0.8rem; color: #64748b;">+91</span>
                        <input type="text" id="zohoWorkPhone" placeholder="Work Phone" style="width: 100%; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0 8px 8px 0; font-size: 0.85rem; outline: none;">
                    </div>
                    <div style="display: flex; flex: 1;">
                        <span style="background: #f1f5f9; border: 1px solid #cbd5e1; border-right: none; padding: 0.55rem 0.75rem; border-radius: 8px 0 0 8px; font-weight: 700; font-size: 0.8rem; color: #64748b;">+91</span>
                        <input type="text" id="zohoMobile" value="${phone}" placeholder="Mobile" style="width: 100%; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0 8px 8px 0; font-size: 0.85rem; outline: none;">
                    </div>
                </div>
            </div>

            <!-- Language -->
            <div style="display: flex; align-items: center; margin-bottom: 2rem; gap: 3rem;">
                <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569;">Customer Language</label>
                <select id="zohoLanguage" style="width: 250px; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                    <option value="English">English</option>
                    <option value="Kannada">Kannada</option>
                    <option value="Hindi">Hindi</option>
                </select>
            </div>

            <!-- Sub Tabs: Other Details | Address -->
            <div style="border-bottom: 2px solid #f1f5f9; display: flex; gap: 2rem; margin-bottom: 1.5rem;">
                <button type="button" id="btnZohoTabOther" onclick="switchZohoSubTab('other_details')" style="padding: 0.5rem 0.5rem; background: transparent; border: none; border-bottom: 3px solid #3b82f6; font-size: 0.9rem; font-weight: 700; color: #1e293b; cursor: pointer;">
                    Other Details
                </button>
                <button type="button" id="btnZohoTabAddress" onclick="switchZohoSubTab('address')" style="padding: 0.5rem 0.5rem; background: transparent; border: none; border-bottom: 3px solid transparent; font-size: 0.9rem; font-weight: 500; color: #64748b; cursor: pointer;">
                    Address
                </button>
            </div>

            <!-- OTHER DETAILS TAB -->
            <div id="zohoTabContentOther">
                <!-- GST Treatment -->
                <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                    <label style="width: 160px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">GST Treatment *</label>
                    <select id="zohoGstTreatment" style="flex: 1; max-width: 450px; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                        <option value="consumer" ${!data.gst_number ? 'selected' : ''}>Consumer</option>
                        <option value="business_gst" ${data.gst_number ? 'selected' : ''}>Registered Business - Regular</option>
                        <option value="business_composition">Registered Business - Composition</option>
                        <option value="business_none">Unregistered Business</option>
                        <option value="overseas">Overseas</option>
                        <option value="special_economic_zone">Special Economic Zone</option>
                        <option value="deemed_export">Deemed Export</option>
                    </select>
                </div>

                <!-- Place of Supply -->
                <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                    <label style="width: 160px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Place of Supply *</label>
                    <select id="zohoPlaceOfSupply" style="flex: 1; max-width: 450px; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                        ${INDIAN_STATES.map(s => `
                            <option value="${s.code}" ${(s.name.toLowerCase() === stateName.toLowerCase() || s.code.toLowerCase() === stateName.toLowerCase()) ? 'selected' : ''}>
                                [${s.code}] ${s.name}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- PAN -->
                <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                    <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569;">PAN</label>
                    <input type="text" id="zohoPan" value="${data.pan_number || ''}" placeholder="ABCDE1234F" style="flex: 1; max-width: 450px; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none; text-transform: uppercase;">
                </div>

                <!-- Tax Preference -->
                <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                    <label style="width: 160px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Tax Preference *</label>
                    <div style="display: flex; gap: 2rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; color: #1e293b; cursor: pointer;">
                            <input type="radio" name="zoho_tax_preference" value="taxable" checked style="accent-color: #3b82f6;"> Taxable
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 600; color: #1e293b; cursor: pointer;">
                            <input type="radio" name="zoho_tax_preference" value="tax_exempt" style="accent-color: #3b82f6;"> Tax Exempt
                        </label>
                    </div>
                </div>

                <!-- Currency -->
                <div style="display: flex; align-items: center; margin-bottom: 1.25rem; gap: 3rem;">
                    <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569;">Currency</label>
                    <input type="text" value="INR - Indian Rupee" readonly style="flex: 1; max-width: 450px; padding: 0.55rem 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; font-size: 0.85rem; color: #475569;">
                </div>

                <!-- Payment Terms -->
                <div style="display: flex; align-items: center; margin-bottom: 1.5rem; gap: 3rem;">
                    <label style="width: 160px; font-weight: 600; font-size: 0.85rem; color: #475569;">Payment Terms</label>
                    <select id="zohoPaymentTerms" style="flex: 1; max-width: 450px; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                        <option value="0">Due on Receipt</option>
                        <option value="15">Net 15</option>
                        <option value="30">Net 30</option>
                        <option value="45">Net 45</option>
                        <option value="60">Net 60</option>
                    </select>
                </div>
            </div>

            <!-- ADDRESS TAB -->
            <div id="zohoTabContentAddress" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem;">
                    <!-- Billing Address -->
                    <div>
                        <h4 style="margin: 0 0 1rem 0; color: #0f172a; font-size: 1rem; font-weight: 800;">Billing Address</h4>
                        
                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Attention</label>
                            <input type="text" id="zohoBillAttention" value="${rawName}" placeholder="Attention" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Country / Region</label>
                            <input type="text" id="zohoBillCountry" value="India" readonly style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; font-size: 0.85rem; color: #475569;">
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Street 1</label>
                            <input type="text" id="zohoBillStreet1" value="${addressPart1}" placeholder="Street Address" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Street 2 / Village / Taluk</label>
                            <input type="text" id="zohoBillStreet2" value="${addressPart2}" placeholder="Village, Taluk, Landmark" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">City / District</label>
                            <input type="text" id="zohoBillCity" value="${city}" placeholder="City" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                            <div>
                                <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">State</label>
                                <input type="text" id="zohoBillState" value="${stateName}" placeholder="State" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                            </div>
                            <div>
                                <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">PIN Code</label>
                                <input type="text" id="zohoBillPincode" value="${pincode}" placeholder="PIN Code" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                            </div>
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Phone</label>
                            <input type="text" id="zohoBillPhone" value="${phone}" placeholder="Phone" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>
                    </div>

                    <!-- Shipping Address -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="margin: 0; color: #0f172a; font-size: 1rem; font-weight: 800;">Shipping Address</h4>
                            <button type="button" onclick="copyBillingToShippingAddress()" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-arrow-down"></i> Copy billing address
                            </button>
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Attention</label>
                            <input type="text" id="zohoShipAttention" value="${data.shipping_name || rawName}" placeholder="Attention" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Country / Region</label>
                            <input type="text" id="zohoShipCountry" value="India" readonly style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; font-size: 0.85rem; color: #475569;">
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Street 1</label>
                            <input type="text" id="zohoShipStreet1" value="${data.shipping_address || addressPart1}" placeholder="Street Address" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Street 2 / Village / Taluk</label>
                            <input type="text" id="zohoShipStreet2" value="${addressPart2}" placeholder="Village, Taluk, Landmark" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">City / District</label>
                            <input type="text" id="zohoShipCity" value="${data.shipping_city || city}" placeholder="City" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                            <div>
                                <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">State</label>
                                <input type="text" id="zohoShipState" value="${data.shipping_state || stateName}" placeholder="State" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                            </div>
                            <div>
                                <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">PIN Code</label>
                                <input type="text" id="zohoShipPincode" value="${data.shipping_pincode || pincode}" placeholder="PIN Code" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                            </div>
                        </div>

                        <div style="margin-bottom: 0.75rem;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Phone</label>
                            <input type="text" id="zohoShipPhone" value="${phone}" placeholder="Phone" style="width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none;">
                        </div>
                    </div>
                </div>
            </div>

            <!-- ACTION FOOTER -->
            <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem;">
                <button type="button" onclick="closeModal()" style="padding: 0.75rem 1.5rem; background: white; color: #64748b; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; cursor: pointer;">
                    Cancel
                </button>
                <button type="button" id="btnSaveZohoCustomer" onclick="saveZohoCustomer()" class="btn-billing primary" style="padding: 0.75rem 2rem; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                    <i class="fa-solid fa-cloud-arrow-up"></i> Save & Create Customer in Zoho ➔
                </button>
            </div>
        </div>
    `;
}

window.saveZohoCustomer = async function() {
    if (!currentOrder) return;
    const btn = document.getElementById('btnSaveZohoCustomer');
    const originalText = btn ? btn.innerHTML : '';

    const displayName = (document.getElementById('zohoDisplayName')?.value || '').trim();
    if (!displayName) {
        alert('Please enter a Customer Display Name');
        document.getElementById('zohoDisplayName')?.focus();
        return;
    }

    const customerType = document.querySelector('input[name="zoho_customer_type"]:checked')?.value || 'individual';
    const taxPreference = document.querySelector('input[name="zoho_tax_preference"]:checked')?.value || 'taxable';

    const payload = {
        customer_type: customerType,
        salutation: document.getElementById('zohoSalutation')?.value || '',
        first_name: document.getElementById('zohoFirstName')?.value || '',
        last_name: document.getElementById('zohoLastName')?.value || '',
        company_name: document.getElementById('zohoCompanyName')?.value || '',
        display_name: displayName,
        customer_name: displayName,
        email: document.getElementById('zohoEmail')?.value || '',
        work_phone: document.getElementById('zohoWorkPhone')?.value || '',
        mobile: document.getElementById('zohoMobile')?.value || '',
        phone: document.getElementById('zohoMobile')?.value || document.getElementById('zohoWorkPhone')?.value || '',
        gst_treatment: document.getElementById('zohoGstTreatment')?.value || 'consumer',
        place_of_supply: document.getElementById('zohoPlaceOfSupply')?.value || 'KA',
        pan_number: document.getElementById('zohoPan')?.value || '',
        tax_preference: taxPreference,
        payment_terms: document.getElementById('zohoPaymentTerms')?.value || 0,

        // Billing
        billing_attention: document.getElementById('zohoBillAttention')?.value || displayName,
        billing_address: document.getElementById('zohoBillStreet1')?.value || '',
        billing_street2: document.getElementById('zohoBillStreet2')?.value || '',
        billing_city: document.getElementById('zohoBillCity')?.value || '',
        billing_state: document.getElementById('zohoBillState')?.value || '',
        billing_pincode: document.getElementById('zohoBillPincode')?.value || '',
        billing_phone: document.getElementById('zohoBillPhone')?.value || '',

        // Shipping
        shipping_attention: document.getElementById('zohoShipAttention')?.value || displayName,
        shipping_address: document.getElementById('zohoShipStreet1')?.value || '',
        shipping_street2: document.getElementById('zohoShipStreet2')?.value || '',
        shipping_city: document.getElementById('zohoShipCity')?.value || '',
        shipping_state: document.getElementById('zohoShipState')?.value || '',
        shipping_pincode: document.getElementById('zohoShipPincode')?.value || '',
        shipping_phone: document.getElementById('zohoShipPhone')?.value || ''
    };

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Customer in Zoho...';
    }

    try {
        const res = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/zoho-customer`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            currentOrder.zoho_contact_id = data.contact_id;
            currentOrder.customer_name = displayName;
            currentOrder.phone = payload.phone;
            currentOrder.address = payload.billing_address;
            currentOrder.city = payload.billing_city;
            currentOrder.state = payload.billing_state;
            currentOrder.pincode = payload.billing_pincode;

            if (window.showAlert) {
                window.showAlert('Success!', `Customer "${displayName}" created on Zoho Books! (Contact ID: ${data.contact_id})`, 'success');
            } else {
                alert(`Customer created on Zoho Books! Contact ID: ${data.contact_id}`);
            }

            // Immediately switch to Step 2: Sales Order Creation
            window.switchWorkstationStep(2);
        } else {
            alert('Zoho Customer Error: ' + (data.message || 'Failed to create customer'));
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    } catch (err) {
        alert('Network or server error: ' + err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

// Cache for Sales Order metadata (Taxes, Salespersons, Delivery Methods, All Products)
let zohoSoMeta = null;
let allCrmProducts = [];

async function ensureSalesOrderMeta() {
    if (!zohoSoMeta) {
        try {
            const [metaRes, prodRes] = await Promise.all([
                fetch(`${BILLING_API_URL}/sales-orders/meta`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }),
                fetch(`${API_URL}/products`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                })
            ]);
            zohoSoMeta = await metaRes.json();
            const prodData = await prodRes.json();
            allCrmProducts = Array.isArray(prodData) ? prodData : (prodData.products || []);
        } catch (err) {
            console.warn('Could not load Sales Order metadata:', err);
            zohoSoMeta = {
                next_salesorder_number: 'SO-01829',
                taxes: [],
                salespersons: [],
                deliveryMethods: ['Post', 'VRL', 'Offline'],
                paymentTerms: [{ label: 'Due on Receipt', value: 0 }]
            };
        }
    }
    return zohoSoMeta;
}

function renderSalesOrderStep(data) {
    // Ensure metadata is requested in background if not yet loaded
    ensureSalesOrderMeta().then(() => {
        // Populate dynamic dropdowns if rendered
        repopulateSoDropdowns();
    });

    const items = data.items || [];
    // Ensure all items have tax and line calculations
    items.forEach((it, idx) => {
        if (it.quantity === undefined) it.quantity = 1;
        if (it.rate === undefined) it.rate = parseFloat(it.price) || 0;
        if (it.tax_rate === undefined) it.tax_rate = 0;
        if (it.tax_name === undefined) it.tax_name = '';
        if (it.tax_id === undefined) it.tax_id = '';
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const nextShipDate = new Date();
    nextShipDate.setDate(nextShipDate.getDate() + 2);
    const shipmentDateStr = nextShipDate.toISOString().split('T')[0];

    const soNumber = data.sales_order_number || zohoSoMeta?.next_salesorder_number || 'SO-01829';
    const refNumber = `ORD-${data.order_id}`;
    const contactPhone = data.phone || data.lead_phone || data.dealer_phone || '';
    const creatorName = data.creator_name || data.sales_person_name || 'darshan';
    const deliveryMethod = data.delivery_type || data.dispatch_through || 'Post';

    return `
        <div class="zoho-sales-order-wrapper" style="background: white; padding: 2.25rem 2.5rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); max-height: 80vh; overflow-y: auto; font-family: 'Inter', sans-serif;">
            
            <!-- Zoho Page Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 1.25rem; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fa-solid fa-cart-shopping" style="font-size: 1.35rem; color: #2563eb;"></i>
                    <h2 style="margin: 0; font-size: 1.45rem; font-weight: 800; color: #0f172a; font-family: 'Outfit', sans-serif;">New Sales Order</h2>
                    <span style="background: #e0f2fe; color: #0284c7; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">Order #${data.order_id}</span>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
                        <i class="fa-solid fa-cloud-check" style="color: #10b981; margin-right: 4px;"></i> Zoho Books Integration Active
                    </span>
                </div>
            </div>

            <!-- Primary Metadata Grid (Zoho 1:1) -->
            <div style="display: flex; flex-direction: column; gap: 1.2rem; max-width: 900px; margin-bottom: 2.5rem;">
                
                <!-- Customer Name -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Customer Name *</label>
                    <div style="flex: 1; display: flex; align-items: center; gap: 0.75rem;">
                        <div style="flex: 1; padding: 0.6rem 0.85rem; border: 1.5px solid #93c5fd; border-radius: 8px; background: #f0fdf4; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">
                                ${data.customer_name || 'Customer'}
                                <span style="font-size: 0.75rem; color: #166534; font-weight: 600; margin-left: 0.5rem;">
                                    (Zoho Contact ID: ${data.zoho_contact_id || 'Auto-linked'})
                                </span>
                            </span>
                            <button type="button" onclick="switchWorkstationStep(1)" style="border: none; background: transparent; color: #2563eb; font-size: 0.78rem; font-weight: 700; cursor: pointer; text-decoration: underline;">
                                Change
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Sales Order# -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Sales Order# *</label>
                    <div style="flex: 1; display: flex; align-items: center; gap: 0.5rem;">
                        <input type="text" id="soNumberInput" value="${soNumber}" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-weight: 700; color: #0f172a; outline: none;">
                        <button type="button" title="Regenerate Sequence" onclick="refreshSoNumber()" style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 0.55rem 0.8rem; cursor: pointer; color: #475569;">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                    </div>
                </div>

                <!-- Reference# -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 600; font-size: 0.85rem; color: #475569;">Reference#</label>
                    <input type="text" id="soReferenceInput" value="${refNumber}" placeholder="Reference Number" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                </div>

                <!-- Sales Order Date -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Sales Order Date *</label>
                    <input type="date" id="soDateInput" value="${todayStr}" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: #1e293b; outline: none;">
                </div>

                <!-- Expected Shipment Date -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 600; font-size: 0.85rem; color: #475569;">Expected Shipment Date</label>
                    <input type="date" id="soShipmentDateInput" value="${shipmentDateStr}" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                </div>

                <!-- Payment Terms -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 600; font-size: 0.85rem; color: #475569;">Payment Terms</label>
                    <select id="soPaymentTermsInput" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                        <option value="0" selected>Due on Receipt</option>
                        <option value="15">Net 15</option>
                        <option value="30">Net 30</option>
                        <option value="45">Net 45</option>
                        <option value="60">Net 60</option>
                    </select>
                </div>

                <!-- Delivery Method -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 600; font-size: 0.85rem; color: #475569;">Delivery Method</label>
                    <select id="soDeliveryMethodInput" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                        <option value="Post" ${deliveryMethod.toLowerCase().includes('post') ? 'selected' : ''}>Post</option>
                        <option value="VRL" ${deliveryMethod.toLowerCase().includes('vrl') ? 'selected' : ''}>VRL</option>
                        <option value="Offline" ${deliveryMethod.toLowerCase().includes('offline') ? 'selected' : ''}>Offline</option>
                        <option value="ST Courier">ST Courier</option>
                        <option value="DTDC">DTDC</option>
                        <option value="Direct Handover">Direct Handover</option>
                    </select>
                </div>

                <!-- Salesperson -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Salesperson *</label>
                    <select id="soSalespersonInput" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-weight: 600; outline: none;">
                        <option value="${creatorName}">${creatorName}</option>
                    </select>
                </div>

                <!-- Contact -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Contact *</label>
                    <input type="text" id="soContactPhoneInput" value="${contactPhone}" placeholder="Customer Phone" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-weight: 600; outline: none;">
                </div>
            </div>

            <!-- Item Table Section (Zoho 1:1) -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; font-family: 'Outfit', sans-serif;">Item Table</h3>
                <span style="font-size: 0.78rem; font-weight: 700; color: #2563eb; cursor: pointer;" onclick="openBulkItemModal()">
                    <i class="fa-solid fa-boxes-stacked"></i> Bulk Actions
                </span>
            </div>

            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 1.25rem;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;" id="zohoItemGridTable">
                    <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
                        <tr>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 42%;">ITEM DETAILS</th>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 14%; text-align: right;">QUANTITY</th>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 16%; text-align: right;">RATE</th>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 16%;">TAX</th>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 12%; text-align: right;">AMOUNT</th>
                            <th style="padding: 0.75rem 0.5rem; width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="zohoItemGridBody">
                        <!-- Populated by renderZohoLineItems() -->
                    </tbody>
                </table>
            </div>

            <!-- Table Buttons (Add New Row / Add in Bulk) -->
            <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                <button type="button" onclick="addNewZohoItemRow()" style="padding: 0.5rem 1rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 0.8rem; color: #2563eb; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-plus-circle"></i> Add New Row
                </button>
                <button type="button" onclick="openBulkItemModal()" style="padding: 0.5rem 1rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 0.8rem; color: #2563eb; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-layer-group"></i> Add Items in Bulk
                </button>
            </div>

            <!-- Split Section: Customer Notes / Terms (Left) & Zoho Subtotals / Adjustments (Right) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-bottom: 2.5rem; align-items: start;">
                
                <!-- Left: Notes & Terms -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div>
                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 0.5rem;">Customer Notes</label>
                        <textarea id="soCustomerNotes" rows="3" style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-family: inherit; outline: none;">Thank you for doing business with us.</textarea>
                    </div>

                    <div>
                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 0.5rem;">Terms & Conditions</label>
                        <textarea id="soTermsConditions" rows="5" style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.8rem; font-family: inherit; outline: none; line-height: 1.5; color: #475569;">1. Goods once sold will not be taken back or exchanged.
2. Payment must be made within the due date mentioned on the invoice.
3. Late payment may attract additional charges or interest as applicable.
4. Any dispute regarding this invoice must be raised within 7 days from the invoice date.
5. Subject to Koppa Jurisdiction.</textarea>
                    </div>
                </div>

                <!-- Right: Calculations & Totals (Zoho 1:1) -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem 1.75rem; display: flex; flex-direction: column; gap: 1rem;">
                    
                    <!-- Sub Total -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="font-weight: 600; color: #475569;">Sub Total</span>
                        <span id="soSubtotalDisplay" style="font-weight: 800; color: #0f172a;">₹0.00</span>
                    </div>

                    <!-- Discount -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="font-weight: 600; color: #475569;">Discount</span>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="number" step="0.01" id="soDiscountValue" value="${data.discount || 0}" oninput="recalculateZohoTotals()" style="width: 100px; padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; text-align: right; outline: none;">
                            <select id="soDiscountType" onchange="recalculateZohoTotals()" style="padding: 0.35rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; font-weight: 700; background: white;">
                                <option value="flat">₹</option>
                                <option value="percent">%</option>
                            </select>
                        </div>
                    </div>

                    <!-- Shipping Charges -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="font-weight: 600; color: #475569;">Shipping Charges</span>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <span style="color: #64748b;">₹</span>
                            <input type="number" step="0.01" id="soShippingCharges" value="${data.shipping_charges || 0}" oninput="recalculateZohoTotals()" style="width: 110px; padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; text-align: right; outline: none;">
                        </div>
                    </div>

                    <!-- TDS / TCS Radio Selector -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; border-top: 1px dashed #e2e8f0; padding-top: 0.75rem;">
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 4px; font-weight: 600; cursor: pointer;">
                                <input type="radio" name="so_tax_withholding" value="tds" onchange="toggleWithholdingTax()"> TDS
                            </label>
                            <label style="display: flex; align-items: center; gap: 4px; font-weight: 600; cursor: pointer;">
                                <input type="radio" name="so_tax_withholding" value="tcs" onchange="toggleWithholdingTax()"> TCS
                            </label>
                        </div>
                        <select id="soWithholdingTaxSelect" onchange="recalculateZohoTotals()" style="width: 140px; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; background: white; outline: none;">
                            <option value="0">Select a Tax</option>
                            <option value="0.1">0.1%</option>
                            <option value="0.075">0.075%</option>
                        </select>
                    </div>

                    <!-- Round off -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="font-weight: 600; color: #475569;">Round off</span>
                        <input type="number" step="0.01" id="soRoundoffInput" value="0.00" oninput="recalculateZohoTotals(true)" style="width: 110px; padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; text-align: right; outline: none;">
                    </div>

                    <!-- Total (₹) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #cbd5e1; padding-top: 0.85rem; margin-top: 0.5rem;">
                        <span style="font-size: 1.15rem; font-weight: 800; color: #0f172a; font-family: 'Outfit', sans-serif;">Total ( ₹ )</span>
                        <span id="soTotalFinalDisplay" style="font-size: 1.45rem; font-weight: 900; color: #2563eb; font-family: 'Outfit', sans-serif;">₹0.00</span>
                    </div>

                    <!-- Verified Advance & Balance Info -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; margin-top: 0.5rem; font-size: 0.8rem; display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">Advance Verified: <strong style="color: #10b981;">₹${(parseFloat(data.advance_amount) || 0).toLocaleString()}</strong></span>
                        <span style="color: #64748b;">Balance COD Due: <strong id="soBalanceCodDue" style="color: #ef4444;">₹0.00</strong></span>
                    </div>
                </div>
            </div>

            <!-- Zoho Sticky Footer Action Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #f1f5f9; padding-top: 1.5rem; background: white; position: sticky; bottom: 0;">
                <div style="display: flex; gap: 0.75rem;">
                    <button type="button" onclick="submitZohoSalesOrder(true)" class="btn-billing secondary" style="padding: 0.65rem 1.4rem; font-weight: 700;">
                        Save as Draft
                    </button>
                    <button type="button" id="btnZohoSaveAndSend" onclick="submitZohoSalesOrder(false)" class="btn-billing primary" style="padding: 0.65rem 2rem; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Save and Send
                    </button>
                    <button type="button" onclick="closeModal()" class="btn-billing secondary" style="padding: 0.65rem 1.25rem;">
                        Cancel
                    </button>
                </div>

                <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">
                    Total Quantity: <strong id="soTotalQtyCount" style="color: #0f172a;">0</strong>
                </div>
            </div>
        </div>
    `;
}

// Function to populate line items dynamically into the Zoho grid
window.renderZohoLineItems = function() {
    const tbody = document.getElementById('zohoItemGridBody');
    if (!tbody || !currentOrder) return;

    const items = currentOrder.items || [];
    if (items.length === 0) {
        // Automatically add one blank line
        items.push({
            product_id: 14,
            product_name: '',
            rate: 0,
            quantity: 1,
            tax_rate: 0,
            tax_name: '',
            tax_id: ''
        });
    }

    const taxes = zohoSoMeta?.taxes || [];

    tbody.innerHTML = items.map((it, idx) => {
        const itemAmount = (parseFloat(it.rate) || 0) * (parseFloat(it.quantity) || 1);

        // Build product dropdown options
        let productOptions = `<option value="">Type or click to select an item...</option>`;
        allCrmProducts.forEach(p => {
            const isSel = (it.product_id == p.product_id) || (it.product_name && it.product_name.toLowerCase() === p.name.toLowerCase());
            productOptions += `<option value="${p.product_id}" data-rate="${p.selling_price || 0}" data-sku="${p.sku || ''}" ${isSel ? 'selected' : ''}>${p.name}</option>`;
        });

        // Build tax dropdown options
        let taxOptions = `<option value="0" data-id="" data-name="">Select a Tax</option>`;
        taxes.forEach(t => {
            const isSel = (it.tax_id && it.tax_id === t.id) || (it.tax_name && it.tax_name === t.name);
            taxOptions += `<option value="${t.rate}" data-id="${t.id}" data-name="${t.name}" ${isSel ? 'selected' : ''}>${t.name} [${t.rate}%]</option>`;
        });

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 0.85rem 1rem;">
                    <select class="form-input" style="width: 100%; font-weight: 700; margin-bottom: 4px;" onchange="onZohoProductSelected(${idx}, this)">
                        ${productOptions}
                    </select>
                    <input type="text" placeholder="Add a description to your item" value="${it.description || ''}" oninput="currentOrder.items[${idx}].description = this.value" style="width: 100%; border: none; font-size: 0.78rem; color: #64748b; outline: none; background: transparent;">
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                    <input type="number" min="1" step="1" value="${it.quantity || 1}" oninput="onZohoItemQtyChange(${idx}, this.value)" style="width: 70px; text-align: right; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; outline: none;">
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                    <input type="number" step="0.01" value="${it.rate || 0}" oninput="onZohoItemRateChange(${idx}, this.value)" style="width: 90px; text-align: right; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; outline: none;">
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <select style="width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; outline: none;" onchange="onZohoItemTaxChange(${idx}, this)">
                        ${taxOptions}
                    </select>
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right; font-weight: 800; color: #0f172a; font-size: 0.95rem;">
                    ₹${itemAmount.toFixed(2)}
                </td>
                <td style="padding: 0.85rem 0.5rem; text-align: center;">
                    ${items.length > 1 ? `
                        <button type="button" onclick="removeZohoItemRow(${idx})" title="Delete Row" style="border: none; background: transparent; color: #ef4444; cursor: pointer; font-size: 0.9rem;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');

    recalculateZohoTotals();
};

window.onZohoProductSelected = function(idx, selectEl) {
    const opt = selectEl.options[selectEl.selectedIndex];
    const prodId = opt.value;
    const rate = parseFloat(opt.dataset.rate) || 0;
    const prodName = opt.text;

    if (!currentOrder.items[idx]) return;
    currentOrder.items[idx].product_id = prodId;
    currentOrder.items[idx].product_name = prodName;
    currentOrder.items[idx].name = prodName;
    currentOrder.items[idx].rate = rate;
    currentOrder.items[idx].price = rate;

    renderZohoLineItems();
};

window.onZohoItemQtyChange = function(idx, val) {
    if (!currentOrder.items[idx]) return;
    currentOrder.items[idx].quantity = parseFloat(val) || 1;
    renderZohoLineItems();
};

window.onZohoItemRateChange = function(idx, val) {
    if (!currentOrder.items[idx]) return;
    currentOrder.items[idx].rate = parseFloat(val) || 0;
    currentOrder.items[idx].price = parseFloat(val) || 0;
    renderZohoLineItems();
};

window.onZohoItemTaxChange = function(idx, selectEl) {
    if (!currentOrder.items[idx]) return;
    const opt = selectEl.options[selectEl.selectedIndex];
    currentOrder.items[idx].tax_rate = parseFloat(opt.value) || 0;
    currentOrder.items[idx].tax_id = opt.dataset.id || '';
    currentOrder.items[idx].tax_name = opt.dataset.name || '';
    recalculateZohoTotals();
};

window.addNewZohoItemRow = function() {
    if (!currentOrder) return;
    currentOrder.items = currentOrder.items || [];
    currentOrder.items.push({
        product_id: 14,
        product_name: '',
        rate: 0,
        quantity: 1,
        tax_rate: 0,
        tax_name: '',
        tax_id: ''
    });
    renderZohoLineItems();
};

window.removeZohoItemRow = function(idx) {
    if (!currentOrder || !currentOrder.items) return;
    currentOrder.items.splice(idx, 1);
    renderZohoLineItems();
};

window.recalculateZohoTotals = function(manualRoundoff = false) {
    if (!currentOrder) return;
    const items = currentOrder.items || [];
    
    let subtotal = 0;
    let totalQty = 0;

    items.forEach(it => {
        const lineTotal = (parseFloat(it.rate) || 0) * (parseFloat(it.quantity) || 1);
        subtotal += lineTotal;
        totalQty += (parseFloat(it.quantity) || 1);
    });

    const discountVal = parseFloat(document.getElementById('soDiscountValue')?.value) || 0;
    const discountType = document.getElementById('soDiscountType')?.value || 'flat';
    let discountAmount = discountType === 'percent' ? (subtotal * discountVal / 100) : discountVal;

    const shippingCharge = parseFloat(document.getElementById('soShippingCharges')?.value) || 0;
    
    // Raw total before roundoff
    const rawTotal = subtotal - discountAmount + shippingCharge;
    
    let roundoff = 0;
    const roundoffEl = document.getElementById('soRoundoffInput');
    if (manualRoundoff && roundoffEl) {
        roundoff = parseFloat(roundoffEl.value) || 0;
    } else if (roundoffEl) {
        roundoff = Math.round(rawTotal) - rawTotal;
        roundoffEl.value = roundoff.toFixed(2);
    }

    const finalTotal = Math.max(0, rawTotal + roundoff);
    const advancePaid = parseFloat(currentOrder.advance_amount) || 0;
    const balanceDue = Math.max(0, finalTotal - advancePaid);

    // Update displays
    if (document.getElementById('soSubtotalDisplay')) {
        document.getElementById('soSubtotalDisplay').innerText = `₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (document.getElementById('soTotalFinalDisplay')) {
        document.getElementById('soTotalFinalDisplay').innerText = `₹${finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (document.getElementById('soBalanceCodDue')) {
        document.getElementById('soBalanceCodDue').innerText = `₹${balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (document.getElementById('soTotalQtyCount')) {
        document.getElementById('soTotalQtyCount').innerText = totalQty;
    }
};

window.repopulateSoDropdowns = function() {
    const spSelect = document.getElementById('soSalespersonInput');
    if (spSelect && zohoSoMeta?.salespersons) {
        const currentVal = spSelect.value;
        spSelect.innerHTML = zohoSoMeta.salespersons.map(sp => 
            `<option value="${sp.name}" ${sp.name === currentVal ? 'selected' : ''}>${sp.name}</option>`
        ).join('');
    }

    // Call renderZohoLineItems once dropdowns and meta are ready
    renderZohoLineItems();
};

window.refreshSoNumber = async function() {
    try {
        const res = await fetch(`${BILLING_API_URL}/sales-orders/meta`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const meta = await res.json();
        if (meta.next_salesorder_number && document.getElementById('soNumberInput')) {
            document.getElementById('soNumberInput').value = meta.next_salesorder_number;
        }
    } catch (e) { }
};

window.submitZohoSalesOrder = async function(isDraft = false) {
    if (!currentOrder) return;

    const btn = document.getElementById('btnZohoSaveAndSend');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing & Syncing to Zoho...';
    }

    const payload = {
        is_draft_only: isDraft,
        salesorder_number: document.getElementById('soNumberInput')?.value?.trim(),
        reference_number: document.getElementById('soReferenceInput')?.value?.trim(),
        date: document.getElementById('soDateInput')?.value,
        shipment_date: document.getElementById('soShipmentDateInput')?.value,
        payment_terms: document.getElementById('soPaymentTermsInput')?.value,
        delivery_method: document.getElementById('soDeliveryMethodInput')?.value,
        salesperson_name: document.getElementById('soSalespersonInput')?.value,
        contact_phone: document.getElementById('soContactPhoneInput')?.value?.trim(),
        notes: document.getElementById('soCustomerNotes')?.value?.trim(),
        terms: document.getElementById('soTermsConditions')?.value?.trim(),
        discount: parseFloat(document.getElementById('soDiscountValue')?.value) || 0,
        shipping_charge: parseFloat(document.getElementById('soShippingCharges')?.value) || 0,
        adjustment: parseFloat(document.getElementById('soRoundoffInput')?.value) || 0,
        items: (currentOrder.items || []).map(i => ({
            product_id: i.product_id,
            product_name: i.product_name || i.name,
            name: i.product_name || i.name,
            rate: parseFloat(i.rate || i.price) || 0,
            quantity: parseFloat(i.quantity) || 1,
            tax_id: i.tax_id || undefined
        }))
    };

    try {
        const res = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/zoho-salesorder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
            closeModal();
            alert(`✅ ${data.message}`);
            if (typeof loadPendingOrders === 'function') loadPendingOrders();
            if (typeof loadSalesOrdersList === 'function') loadSalesOrdersList();
        } else {
            alert(`Error: ${data.message || 'Failed to process Sales Order'}`);
        }
    } catch (err) {
        alert('Server/Network Error: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.openBulkItemModal = function() {
    const list = allCrmProducts.map(p => `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.75rem; border-bottom: 1px solid #f1f5f9; cursor: pointer;">
            <div>
                <input type="checkbox" class="bulk-item-cb" value="${p.product_id}" data-name="${p.name}" data-rate="${p.selling_price || 0}">
                <strong style="margin-left: 0.5rem; font-size: 0.85rem; color: #0f172a;">${p.name}</strong>
            </div>
            <span style="font-weight: 700; color: #2563eb; font-size: 0.85rem;">₹${parseFloat(p.selling_price || 0).toLocaleString()}</span>
        </label>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'bulkItemModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div style="background: white; border-radius: 12px; width: 90%; max-width: 500px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
            <div style="padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #0f172a;">Add Items in Bulk</h3>
                <button type="button" onclick="document.getElementById('bulkItemModal').remove()" style="border: none; background: transparent; font-size: 1.25rem; cursor: pointer;">&times;</button>
            </div>
            <div style="padding: 1rem 1.25rem; overflow-y: auto; flex: 1;">
                ${list || '<p style="color: #64748b;">No products found</p>'}
            </div>
            <div style="padding: 1rem 1.25rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem;">
                <button type="button" onclick="document.getElementById('bulkItemModal').remove()" style="padding: 0.5rem 1rem; border: 1px solid #cbd5e1; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
                <button type="button" onclick="confirmBulkItemsAdd()" style="padding: 0.5rem 1.25rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">Add Selected</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmBulkItemsAdd = function() {
    const selected = document.querySelectorAll('.bulk-item-cb:checked');
    if (!currentOrder) return;
    currentOrder.items = currentOrder.items || [];
    selected.forEach(cb => {
        currentOrder.items.push({
            product_id: cb.value,
            product_name: cb.dataset.name,
            name: cb.dataset.name,
            rate: parseFloat(cb.dataset.rate) || 0,
            quantity: 1,
            tax_rate: 0,
            tax_name: '',
            tax_id: ''
        });
    });
    const m = document.getElementById('bulkItemModal');
    if (m) m.remove();
    renderZohoLineItems();
};

// =====================================================================
// DIRECT / STANDALONE SALES ORDER MODAL WORKSTATION
// =====================================================================

window.openDirectSalesOrderModal = async function() {
    await ensureSalesOrderMeta();

    const todayStr = new Date().toISOString().split('T')[0];
    const nextShipDate = new Date();
    nextShipDate.setDate(nextShipDate.getDate() + 2);
    const shipmentDateStr = nextShipDate.toISOString().split('T')[0];
    const soNumber = zohoSoMeta?.next_salesorder_number || 'SO-01841';

    // Initialize standalone currentOrder
    currentOrder = {
        order_id: null,
        is_direct: true,
        customer_name: '',
        zoho_contact_id: '',
        phone: '',
        advance_amount: 0,
        discount: 0,
        shipping_charges: 0,
        items: [
            {
                product_id: allCrmProducts[0]?.product_id || 14,
                product_name: allCrmProducts[0]?.name || '',
                name: allCrmProducts[0]?.name || '',
                rate: parseFloat(allCrmProducts[0]?.selling_price || 0),
                quantity: 1,
                tax_rate: 0,
                tax_name: '',
                tax_id: ''
            }
        ]
    };

    const modal = document.getElementById('billingModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    if (modalTitle) {
        modalTitle.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">
                    + Create Sales Order
                </span>
                <span style="font-size: 0.75rem; background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 6px; font-weight: 700;">
                    MANUAL / DIRECT
                </span>
            </div>
        `;
    }

    modalBody.innerHTML = `
        <div class="zoho-sales-order-wrapper" style="background: white; padding: 2.25rem 2.5rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); max-height: 80vh; overflow-y: auto; font-family: 'Inter', sans-serif;">
            
            <!-- Zoho Page Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 1.25rem; margin-bottom: 2rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fa-solid fa-cart-shopping" style="font-size: 1.35rem; color: #2563eb;"></i>
                    <h2 style="margin: 0; font-size: 1.45rem; font-weight: 800; color: #0f172a; font-family: 'Outfit', sans-serif;">New Sales Order</h2>
                    <span style="background: #e0f2fe; color: #0284c7; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">Direct Invoice Pipeline</span>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.8rem; color: #64748b; font-weight: 600;">
                        <i class="fa-solid fa-cloud-check" style="color: #10b981; margin-right: 4px;"></i> Zoho Books Accounting Mode
                    </span>
                </div>
            </div>

            <!-- Primary Metadata Grid (Zoho 1:1) -->
            <div style="display: flex; flex-direction: column; gap: 1.2rem; max-width: 900px; margin-bottom: 2.5rem;">
                
                <!-- Customer Name (Live Searchable Dropdown) -->
                <div style="display: flex; align-items: flex-start; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444; margin-top: 8px;">Customer Name *</label>
                    <div style="flex: 1; position: relative;">
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="text" id="directCustomerSearch" placeholder="Type customer or dealer name, phone..." oninput="onDirectCustomerSearch(this.value)" autocomplete="off" style="flex: 1; padding: 0.6rem 0.85rem; border: 1.5px solid #3b82f6; border-radius: 8px; font-size: 0.9rem; font-weight: 600; outline: none; background: #fff;">
                            <button type="button" onclick="openDirectCustomerPopup()" title="Create New Customer" style="padding: 0.6rem 0.9rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; color: #3b82f6; font-size: 0.85rem; font-weight: 700; white-space: nowrap;">
                                <i class="fa-solid fa-user-plus"></i> New
                            </button>
                        </div>
                        <input type="hidden" id="directCustomerId" value="">
                        <input type="hidden" id="directZohoContactId" value="">
                        <div id="directCustomerDropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); max-height: 250px; overflow-y: auto; z-index: 1000; margin-top: 4px;">
                            <!-- Search Results -->
                        </div>
                        <div id="directSelectedCustomerBadge" style="margin-top: 6px; display: none;">
                            <!-- Selected Badge -->
                        </div>
                    </div>
                </div>

                <!-- Sales Order# -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Sales Order# *</label>
                    <div style="flex: 1; display: flex; align-items: center; gap: 0.5rem;">
                        <input type="text" id="soNumberInput" value="${soNumber}" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-weight: 700; color: #0f172a; outline: none;">
                        <button type="button" title="Regenerate Sequence" onclick="refreshSoNumber()" style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 0.55rem 0.8rem; cursor: pointer; color: #475569;">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                    </div>
                </div>

                <!-- Reference# -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 600; font-size: 0.85rem; color: #475569;">Reference#</label>
                    <input type="text" id="soReferenceInput" placeholder="Reference Number / PO" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                </div>

                <!-- Sales Order Date -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Sales Order Date *</label>
                    <input type="date" id="soDateInput" value="${todayStr}" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: #1e293b; outline: none;">
                </div>

                <!-- Expected Shipment Date -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 600; font-size: 0.85rem; color: #475569;">Expected Shipment Date</label>
                    <input type="date" id="soShipmentDateInput" value="${shipmentDateStr}" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                </div>

                <!-- Payment Terms -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 600; font-size: 0.85rem; color: #475569;">Payment Terms</label>
                    <select id="soPaymentTermsInput" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                        <option value="0" selected>Due on Receipt</option>
                        <option value="15">Net 15</option>
                        <option value="30">Net 30</option>
                        <option value="45">Net 45</option>
                        <option value="60">Net 60</option>
                    </select>
                </div>

                <!-- Delivery Method -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 600; font-size: 0.85rem; color: #475569;">Delivery Method</label>
                    <select id="soDeliveryMethodInput" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;">
                        <option value="Post" selected>Post</option>
                        <option value="VRL">VRL</option>
                        <option value="Offline">Offline</option>
                        <option value="ST Courier">ST Courier</option>
                        <option value="DTDC">DTDC</option>
                        <option value="Direct Handover">Direct Handover</option>
                    </select>
                </div>

                <!-- Salesperson -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Salesperson *</label>
                    <select id="soSalespersonInput" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-weight: 600; outline: none;">
                        <!-- Repopulated dynamically -->
                    </select>
                </div>

                <!-- Contact -->
                <div style="display: flex; align-items: center; gap: 2rem;">
                    <label style="width: 170px; font-weight: 700; font-size: 0.85rem; color: #ef4444;">Contact *</label>
                    <input type="text" id="soContactPhoneInput" placeholder="Customer Phone Number" style="flex: 1; max-width: 420px; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-weight: 600; outline: none;">
                </div>
            </div>

            <!-- Item Table Section (Zoho 1:1) -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; font-family: 'Outfit', sans-serif;">Item Table</h3>
                <span style="font-size: 0.78rem; font-weight: 700; color: #2563eb; cursor: pointer;" onclick="openBulkItemModal()">
                    <i class="fa-solid fa-boxes-stacked"></i> Bulk Actions
                </span>
            </div>

            <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 1.25rem;">
                <table style="width: 100%; border-collapse: collapse; text-align: left;" id="zohoItemGridTable">
                    <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1;">
                        <tr>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 42%;">ITEM DETAILS</th>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 14%; text-align: right;">QUANTITY</th>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 16%; text-align: right;">RATE</th>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 16%;">TAX</th>
                            <th style="padding: 0.75rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #475569; font-weight: 700; width: 12%; text-align: right;">AMOUNT</th>
                            <th style="padding: 0.75rem 0.5rem; width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="zohoItemGridBody">
                        <!-- Populated by renderZohoLineItems() -->
                    </tbody>
                </table>
            </div>

            <!-- Table Buttons (Add New Row / Add in Bulk) -->
            <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                <button type="button" onclick="addNewZohoItemRow()" style="padding: 0.5rem 1rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 0.8rem; color: #2563eb; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-plus-circle"></i> Add New Row
                </button>
                <button type="button" onclick="openBulkItemModal()" style="padding: 0.5rem 1rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 0.8rem; color: #2563eb; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-layer-group"></i> Add Items in Bulk
                </button>
            </div>

            <!-- Split Section: Customer Notes / Terms (Left) & Zoho Subtotals / Adjustments (Right) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-bottom: 2.5rem; align-items: start;">
                
                <!-- Left: Notes & Terms -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                    <div>
                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 0.5rem;">Customer Notes</label>
                        <textarea id="soCustomerNotes" rows="3" style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; font-family: inherit; outline: none;">Thank you for doing business with us.</textarea>
                    </div>

                    <div>
                        <label style="display: block; font-weight: 700; font-size: 0.85rem; color: #334155; margin-bottom: 0.5rem;">Terms & Conditions</label>
                        <textarea id="soTermsConditions" rows="5" style="width: 100%; box-sizing: border-box; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.8rem; font-family: inherit; outline: none; line-height: 1.5; color: #475569;">1. Goods once sold will not be taken back or exchanged.
2. Payment must be made within the due date mentioned on the invoice.
3. Late payment may attract additional charges or interest as applicable.
4. Any dispute regarding this invoice must be raised within 7 days from the invoice date.
5. Subject to Koppa Jurisdiction.</textarea>
                    </div>
                </div>

                <!-- Right: Calculations & Totals (Zoho 1:1) -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem 1.75rem; display: flex; flex-direction: column; gap: 1rem;">
                    
                    <!-- Sub Total -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="font-weight: 600; color: #475569;">Sub Total</span>
                        <span id="soSubtotalDisplay" style="font-weight: 800; color: #0f172a;">₹0.00</span>
                    </div>

                    <!-- Discount -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="font-weight: 600; color: #475569;">Discount</span>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="number" step="0.01" id="soDiscountValue" value="0" oninput="recalculateZohoTotals()" style="width: 100px; padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; text-align: right; outline: none;">
                            <select id="soDiscountType" onchange="recalculateZohoTotals()" style="padding: 0.35rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; font-weight: 700; background: white;">
                                <option value="flat">₹</option>
                                <option value="percent">%</option>
                            </select>
                        </div>
                    </div>

                    <!-- Shipping Charges -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="font-weight: 600; color: #475569;">Shipping Charges</span>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <span style="color: #64748b;">₹</span>
                            <input type="number" step="0.01" id="soShippingCharges" value="0" oninput="recalculateZohoTotals()" style="width: 110px; padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; text-align: right; outline: none;">
                        </div>
                    </div>

                    <!-- TDS / TCS Radio Selector -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; border-top: 1px dashed #e2e8f0; padding-top: 0.75rem;">
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 4px; font-weight: 600; cursor: pointer;">
                                <input type="radio" name="so_tax_withholding" value="tds" onchange="toggleWithholdingTax()"> TDS
                            </label>
                            <label style="display: flex; align-items: center; gap: 4px; font-weight: 600; cursor: pointer;">
                                <input type="radio" name="so_tax_withholding" value="tcs" onchange="toggleWithholdingTax()"> TCS
                            </label>
                        </div>
                        <select id="soWithholdingTaxSelect" onchange="recalculateZohoTotals()" style="width: 140px; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; background: white; outline: none;">
                            <option value="0">Select a Tax</option>
                            <option value="0.1">0.1%</option>
                            <option value="0.075">0.075%</option>
                        </select>
                    </div>

                    <!-- Round off -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="font-weight: 600; color: #475569;">Round off</span>
                        <input type="number" step="0.01" id="soRoundoffInput" value="0.00" oninput="recalculateZohoTotals(true)" style="width: 110px; padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; text-align: right; outline: none;">
                    </div>

                    <!-- Total (₹) -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #cbd5e1; padding-top: 0.85rem; margin-top: 0.5rem;">
                        <span style="font-size: 1.15rem; font-weight: 800; color: #0f172a; font-family: 'Outfit', sans-serif;">Total ( ₹ )</span>
                        <span id="soTotalFinalDisplay" style="font-size: 1.45rem; font-weight: 900; color: #2563eb; font-family: 'Outfit', sans-serif;">₹0.00</span>
                    </div>

                    <!-- Advance Paid Input -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; border-top: 1px dashed #e2e8f0; padding-top: 0.75rem;">
                        <span style="font-weight: 600; color: #475569;">Advance Received</span>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <span style="color: #10b981; font-weight: 700;">₹</span>
                            <input type="number" step="0.01" id="soDirectAdvancePaid" value="0" oninput="currentOrder.advance_amount = this.value; recalculateZohoTotals();" style="width: 110px; padding: 0.35rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; text-align: right; outline: none; color: #10b981;">
                        </div>
                    </div>

                    <!-- Balance COD Due Display -->
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem; margin-top: 0.5rem; font-size: 0.8rem; display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">Balance COD Due: <strong id="soBalanceCodDue" style="color: #ef4444;">₹0.00</strong></span>
                    </div>
                </div>
            </div>

            <!-- Zoho Sticky Footer Action Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #f1f5f9; padding-top: 1.5rem; background: white; position: sticky; bottom: 0;">
                <div style="display: flex; gap: 0.75rem;">
                    <button type="button" onclick="submitDirectSalesOrder(true)" class="btn-billing secondary" style="padding: 0.65rem 1.4rem; font-weight: 700;">
                        Save as Draft
                    </button>
                    <button type="button" id="btnDirectZohoSave" onclick="submitDirectSalesOrder(false)" class="btn-billing primary" style="padding: 0.65rem 2rem; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);">
                        <i class="fa-solid fa-cloud-arrow-up"></i> Save and Send (Zoho Sync)
                    </button>
                    <button type="button" onclick="closeModal()" class="btn-billing secondary" style="padding: 0.65rem 1.25rem;">
                        Cancel
                    </button>
                </div>

                <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">
                    Total Quantity: <strong id="soTotalQtyCount" style="color: #0f172a;">0</strong>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    repopulateSoDropdowns();
};

let directCustomerSearchTimer = null;
window.onDirectCustomerSearch = function(query) {
    clearTimeout(directCustomerSearchTimer);
    const drop = document.getElementById('directCustomerDropdown');
    if (!drop) return;

    if (!query || query.trim().length < 2) {
        drop.style.display = 'none';
        return;
    }

    directCustomerSearchTimer = setTimeout(async () => {
        drop.innerHTML = '<div style="padding: 1rem; text-align: center; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Searching customers...</div>';
        drop.style.display = 'block';

        try {
            const res = await fetch(`${BILLING_API_URL}/sales-orders/customers/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            const results = data.results || [];

            if (results.length === 0) {
                drop.innerHTML = `
                    <div style="padding: 1rem; text-align: center; color: #64748b; font-size: 0.85rem;">
                        No matching customer found.
                        <div style="margin-top: 8px;">
                            <button type="button" onclick="useCustomTypedCustomer('${query.replace(/'/g, "\\'")}')" style="padding: 4px 10px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px; font-weight: 700; cursor: pointer;">
                                Use "${query}" as Customer
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            drop.innerHTML = results.map(r => `
                <div onclick='selectDirectCustomer(${JSON.stringify(r).replace(/'/g, "&#39;")})' style="padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                    <div>
                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">
                            ${r.name || r.company_name}
                            ${r.source === 'zoho' ? '<span style="font-size: 0.65rem; background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 700;">ZOHO</span>' : '<span style="font-size: 0.65rem; background: #ede9fe; color: #6d28d9; padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 700;">DEALER</span>'}
                        </div>
                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                            ${r.phone ? '📞 ' + r.phone : ''} ${r.city ? '📍 ' + r.city + ', ' + r.state : ''}
                        </div>
                    </div>
                    <span style="font-size: 0.78rem; color: #2563eb; font-weight: 700;">Select ➔</span>
                </div>
            `).join('');

        } catch (err) {
            drop.innerHTML = '<div style="padding: 1rem; text-align: center; color: #ef4444;">Failed to load results.</div>';
        }
    }, 250);
};

window.selectDirectCustomer = function(c) {
    const searchInput = document.getElementById('directCustomerSearch');
    const drop = document.getElementById('directCustomerDropdown');
    const badge = document.getElementById('directSelectedCustomerBadge');
    const phoneInput = document.getElementById('soContactPhoneInput');

    if (searchInput) searchInput.value = c.name || c.company_name;
    if (drop) drop.style.display = 'none';

    if (currentOrder) {
        currentOrder.customer_name = c.name || c.company_name;
        currentOrder.zoho_contact_id = c.zoho_contact_id || null;
        currentOrder.phone = c.phone || '';
    }

    if (phoneInput && c.phone) {
        phoneInput.value = c.phone;
    }

    if (badge) {
        badge.style.display = 'block';
        badge.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; color: #166534; font-weight: 600;">
                <i class="fa-solid fa-circle-check" style="color: #10b981;"></i>
                Selected: <strong>${c.name}</strong> ${c.zoho_contact_id ? `(Zoho ID: ${c.zoho_contact_id})` : '(Local Dealer)'}
            </div>
        `;
    }
};

window.useCustomTypedCustomer = function(name) {
    const searchInput = document.getElementById('directCustomerSearch');
    const drop = document.getElementById('directCustomerDropdown');
    const badge = document.getElementById('directSelectedCustomerBadge');

    if (searchInput) searchInput.value = name;
    if (drop) drop.style.display = 'none';

    if (currentOrder) {
        currentOrder.customer_name = name;
        currentOrder.zoho_contact_id = null;
    }

    if (badge) {
        badge.style.display = 'block';
        badge.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 8px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; color: #1d4ed8; font-weight: 600;">
                <i class="fa-solid fa-user"></i>
                Customer: <strong>${name}</strong> (New / Ad-hoc)
            </div>
        `;
    }
};

window.submitDirectSalesOrder = async function(isDraft = false) {
    const custName = (document.getElementById('directCustomerSearch')?.value || '').trim();
    if (!custName) {
        alert('Please select or enter a Customer Name.');
        document.getElementById('directCustomerSearch')?.focus();
        return;
    }

    const btn = document.getElementById('btnDirectZohoSave');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing Sales Order...';
    }

    const payload = {
        is_draft_only: isDraft,
        customer_name: custName,
        customer_id: currentOrder?.zoho_contact_id || undefined,
        salesorder_number: document.getElementById('soNumberInput')?.value?.trim(),
        reference_number: document.getElementById('soReferenceInput')?.value?.trim(),
        date: document.getElementById('soDateInput')?.value,
        shipment_date: document.getElementById('soShipmentDateInput')?.value,
        payment_terms: document.getElementById('soPaymentTermsInput')?.value,
        delivery_method: document.getElementById('soDeliveryMethodInput')?.value,
        salesperson_name: document.getElementById('soSalespersonInput')?.value,
        contact_phone: document.getElementById('soContactPhoneInput')?.value?.trim(),
        notes: document.getElementById('soCustomerNotes')?.value?.trim(),
        terms: document.getElementById('soTermsConditions')?.value?.trim(),
        discount: parseFloat(document.getElementById('soDiscountValue')?.value) || 0,
        shipping_charge: parseFloat(document.getElementById('soShippingCharges')?.value) || 0,
        adjustment: parseFloat(document.getElementById('soRoundoffInput')?.value) || 0,
        advance_amount: parseFloat(document.getElementById('soDirectAdvancePaid')?.value) || 0,
        items: (currentOrder.items || []).map(i => ({
            product_id: i.product_id,
            product_name: i.product_name || i.name,
            name: i.product_name || i.name,
            rate: parseFloat(i.rate || i.price) || 0,
            quantity: parseFloat(i.quantity) || 1,
            tax_id: i.tax_id || undefined
        }))
    };

    try {
        const res = await fetch(`${BILLING_API_URL}/sales-orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
            closeModal();
            alert(`✅ ${data.message}`);
            if (typeof loadSalesOrdersList === 'function') loadSalesOrdersList();
        } else {
            alert(`Error: ${data.message || 'Failed to create Direct Sales Order'}`);
        }
    } catch (err) {
        alert('Server/Network Error: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.updateOrderItemPrice = function(idx, newPrice) {
    if (!currentOrder || !currentOrder.items || !currentOrder.items[idx]) return;
    currentOrder.items[idx].price = parseFloat(newPrice) || 0;
    updateDiscount(currentOrder.discount || 0);
};

window.updateOrderItemQty = function(idx, newQty) {
    if (!currentOrder || !currentOrder.items || !currentOrder.items[idx]) return;
    currentOrder.items[idx].quantity = parseInt(newQty, 10) || 1;
    updateDiscount(currentOrder.discount || 0);
};


window.approveSalesOrder = async function() {
    if (!currentOrder) return;
    if (!confirm(`Are you sure you want to approve Order #${currentOrder.order_id} and convert it to a Sales Order?`)) return;

    try {
        const res = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                discount: currentOrder.discount,
                shipping_charges: currentOrder.shipping_charges,
                extra_charges: currentOrder.extra_charges,
                zoho_bill_number: currentOrder.zoho_bill_number
            })
        });

        const data = await res.json();
        if (res.ok) {
            closeModal();
            if (window.showAlert) {
                window.showAlert('Order Approved!', `Order converted to Sales Order ${data.sales_order_number || ''}. Now ready under Sales Orders.`, 'success');
            } else {
                alert(`Order Approved! Converted to Sales Order ${data.sales_order_number || ''}`);
            }
            if (typeof loadPendingOrders === 'function') loadPendingOrders();
            if (typeof loadSalesOrdersList === 'function') loadSalesOrdersList();
        } else {
            alert(data.message || 'Failed to approve order');
        }
    } catch (err) {
        alert('Error approving order: ' + err.message);
    }
};

// =====================================================================
// 1:1 ZOHO BOOKS SALES ORDER DETAILS WORKSTATION
// =====================================================================

window.viewSalesOrderDetails = async function(identifier) {
    const modal = document.getElementById('zohoSoDetailModal');
    const container = document.getElementById('zohoSoDetailContent');
    if (!modal || !container) return;

    modal.style.display = 'flex';
    container.innerHTML = `
        <div style="text-align: center; padding: 6rem; color: #64748b;">
            <div class="loader" style="margin: 0 auto 1.5rem auto;"></div>
            <div style="font-weight: 700; font-size: 1.1rem; color: #0f172a;">Loading Sales Order Details...</div>
            <div style="font-size: 0.85rem; margin-top: 4px;">Fetching 1:1 Zoho Books record and CRM data</div>
        </div>
    `;

    try {
        const res = await fetch(`${BILLING_API_URL}/sales-orders/${encodeURIComponent(identifier)}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
            container.innerHTML = `
                <div style="padding: 3rem; text-align: center;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <h3 style="margin: 0; color: #0f172a;">Failed to load Sales Order</h3>
                    <p style="color: #64748b; font-size: 0.9rem;">${data.message || 'Record not found'}</p>
                    <button class="btn-billing secondary" onclick="closeZohoSoDetails()" style="margin-top: 1rem;">Close</button>
                </div>
            `;
            return;
        }

        renderZohoSoDetailsWorkstation(data);
    } catch (err) {
        container.innerHTML = `
            <div style="padding: 3rem; text-align: center;">
                <p style="color: #ef4444;">Error connecting to server: ${err.message}</p>
                <button class="btn-billing secondary" onclick="closeZohoSoDetails()">Close</button>
            </div>
        `;
    }
};

window.closeZohoSoDetails = function() {
    const modal = document.getElementById('zohoSoDetailModal');
    if (modal) modal.style.display = 'none';
};

window.renderZohoSoDetailsWorkstation = function(payload) {
    const container = document.getElementById('zohoSoDetailContent');
    const zSo = payload.zoho_salesorder;
    const crmOrder = payload.order;

    const soNumber = zSo?.salesorder_number || crmOrder?.sales_order_number || ('SO-' + crmOrder?.order_id);
    const orderId = crmOrder?.order_id || null;
    const customerName = zSo?.customer_name || crmOrder?.customer_name || 'Customer';
    const soDate = zSo?.date || (crmOrder?.created_at ? new Date(crmOrder.created_at).toISOString().split('T')[0] : 'N/A');
    const paymentTerms = zSo?.payment_terms_label || 'Due on Receipt';
    const salesperson = zSo?.salesperson_name || crmOrder?.sales_person_name || 'Aravind';
    const totalAmount = parseFloat(zSo?.total || crmOrder?.total_amount || 0);
    const subTotal = parseFloat(zSo?.sub_total || totalAmount);
    const discount = parseFloat(zSo?.discount_amount || crmOrder?.discount || 0);
    const roundOff = parseFloat(zSo?.adjustment || 0);

    // Address rendering
    const bAddr = zSo?.billing_address || {};
    const billingLines = [
        customerName,
        bAddr.attention || '',
        bAddr.address || crmOrder?.address || '',
        bAddr.street2 || '',
        [bAddr.city || crmOrder?.city, bAddr.state || crmOrder?.state].filter(Boolean).join(', '),
        [bAddr.country || 'India', bAddr.zip || crmOrder?.pincode].filter(Boolean).join(' - '),
        bAddr.phone || crmOrder?.phone ? `+91-${(bAddr.phone || crmOrder?.phone).replace('+91-', '')}` : ''
    ].filter(Boolean);

    const sAddr = zSo?.shipping_address || bAddr;
    const shippingLines = [
        customerName,
        sAddr.attention || '',
        sAddr.address || crmOrder?.shipping_address || crmOrder?.address || '',
        sAddr.street2 || '',
        [sAddr.city || crmOrder?.shipping_city || crmOrder?.city, sAddr.state || crmOrder?.shipping_state || crmOrder?.state].filter(Boolean).join(', '),
        [sAddr.country || 'India', sAddr.zip || crmOrder?.shipping_pincode || crmOrder?.pincode].filter(Boolean).join(' - '),
        sAddr.phone || crmOrder?.phone ? `+91-${(sAddr.phone || crmOrder?.phone).replace('+91-', '')}` : ''
    ].filter(Boolean);

    // Line items
    const lineItems = (zSo?.line_items && zSo.line_items.length > 0)
        ? zSo.line_items
        : (payload.items || []).map(it => ({
            name: it.product_name || it.name,
            sku: it.sku || '',
            quantity: it.quantity || 1,
            rate: parseFloat(it.price) || 0,
            item_total: (parseFloat(it.price) || 0) * (it.quantity || 1),
            quantity_packed: 0,
            quantity_shipped: 0,
            quantity_invoiced: 0
        }));

    // Taxes
    const taxesList = zSo?.taxes || [];

    // Order status badges
    const isClosed = (zSo?.order_status === 'closed' || zSo?.status === 'invoiced' || crmOrder?.order_status === 'billed');
    const invoiceStatus = isClosed ? 'Invoiced' : (zSo?.invoiced_status === 'not_invoiced' ? 'Not Invoiced' : 'Pending');
    const paymentStatus = zSo?.paid_status === 'paid' ? 'Paid' : (zSo?.paid_status === 'partially_paid' ? 'Partially Paid' : 'Unpaid');
    const shipmentStatus = zSo?.shipped_status === 'fulfilled' ? 'Fulfilled' : (zSo?.shipped_status || 'Pending');

    container.innerHTML = `
        <!-- Top Toolbar Header (1:1 Zoho Books) -->
        <div style="background: white; border-bottom: 1px solid #e2e8f0; padding: 1rem 1.75rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button type="button" onclick="closeZohoSoDetails()" title="Back to Sales Orders List" style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 0.5rem 0.75rem; cursor: pointer; color: #475569; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-arrow-left"></i> Back
                </button>
                <h2 style="margin: 0; font-size: 1.35rem; font-weight: 800; color: #0f172a; font-family: 'Outfit', sans-serif;">
                    ${soNumber}
                </h2>
                ${zSo ? '<span style="background: #e0f2fe; color: #0284c7; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">Synced with Zoho Books</span>' : ''}
            </div>

            <!-- Top Bar Actions (Close & Back only) -->
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button type="button" onclick="closeZohoSoDetails()" style="background: transparent; border: none; font-size: 1.6rem; cursor: pointer; color: #94a3b8; padding: 0 0.5rem; line-height: 1;">
                    &times;
                </button>
            </div>
        </div>

        <!-- Scrollable Document Viewport -->
        <div style="flex: 1; overflow-y: auto; padding: 2rem; background: #f1f5f9;">
            
            <!-- What's Next Notice Banner (with Action Controls on the Marked Place) -->
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #475569;">
                    <i class="fa-solid fa-wand-magic-sparkles" style="color: #6366f1;"></i>
                    <span><strong>WHAT'S NEXT?</strong> Convert the sales order into packages, shipments or invoices.</span>
                </div>
                
                <!-- Action Controls Group (Exact Marked Place) -->
                <div style="display: flex; gap: 0.45rem; align-items: center; position: relative;">
                    
                    <!-- 1. Edit Button -->
                    <button type="button" class="btn-billing" style="background: white; border: 1px solid #cbd5e1; color: #1e293b; font-size: 0.8rem; padding: 0.45rem 0.85rem; font-weight: 700; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="editCurrentSalesOrder('${soNumber}')">
                        <i class="fa-solid fa-pen" style="color: #64748b; font-size: 0.75rem;"></i> Edit
                    </button>

                    <!-- 2. PDF / Print Button -->
                    <button type="button" id="btnSoPdfPrint" class="btn-billing" style="background: white; border: 1px solid #cbd5e1; color: #1e293b; font-size: 0.8rem; padding: 0.45rem 0.85rem; font-weight: 700; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;" onclick="downloadZohoSoPdf('${soNumber}')">
                        <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> PDF/Print
                    </button>

                    <!-- 3. Convert Button / Dropdown -->
                    <div style="position: relative; display: inline-block;">
                        ${orderId ? `
                            <button type="button" onclick="toggleConvertDropdown(event)" style="padding: 0.45rem 1rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
                                <i class="fa-solid fa-file-invoice"></i> Convert ▾
                            </button>
                            <div id="soConvertDropdownMenu" style="display: none; position: absolute; right: 0; top: 38px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.12); width: 190px; z-index: 10000; overflow: hidden; font-size: 0.85rem;">
                                <button type="button" onclick="openOrderBilling(${orderId})" style="width: 100%; text-align: left; padding: 0.7rem 1rem; border: none; background: white; color: #1e293b; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='white'">
                                    <i class="fa-solid fa-file-invoice" style="color: #2563eb;"></i> Convert to Invoice
                                </button>
                                <button type="button" onclick="fulfillCurrentSalesOrder('${soNumber}')" style="width: 100%; text-align: left; padding: 0.7rem 1rem; border: none; background: white; color: #1e293b; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='white'">
                                    <i class="fa-solid fa-box" style="color: #10b981;"></i> Create Package
                                </button>
                            </div>
                        ` : `
                            <button type="button" onclick="alert('This Sales Order has already been synced with Zoho Books and is ready for invoicing!')" style="padding: 0.45rem 1rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                <i class="fa-solid fa-file-invoice"></i> Convert ▾
                            </button>
                        `}
                    </div>

                    <!-- 4. More (...) Dropdown Menu -->
                    <div style="position: relative; display: inline-block;">
                        <button type="button" id="btnSoMoreActions" onclick="toggleZohoSoMoreMenu(event)" style="border: 1px solid #cbd5e1; background: white; border-radius: 6px; width: 32px; height: 32px; cursor: pointer; color: #475569; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem;">
                            &hellip;
                        </button>
                        
                        <!-- Dropdown Content (Zoho 1:1) -->
                        <div id="soMoreDropdownMenu" style="display: none; position: absolute; right: 0; top: 38px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.12); width: 230px; z-index: 10000; overflow: hidden; font-size: 0.85rem;">
                            <button type="button" onclick="fulfillCurrentSalesOrder('${soNumber}')" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: white; color: #1e293b; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                                <i class="fa-solid fa-truck-ramp-box" style="color: #2563eb; width: 16px;"></i> Mark shipment as fulfilled
                            </button>
                            <button type="button" onclick="openCancelItemsModal('${soNumber}')" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: white; color: #1e293b; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                                <i class="fa-solid fa-ban" style="color: #f59e0b; width: 16px;"></i> Cancel Items
                            </button>
                            <div style="height: 1px; background: #e2e8f0; margin: 2px 0;"></div>
                            <button type="button" onclick="hardDeleteSalesOrderBoth('${soNumber}', ${orderId || 'null'})" style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: none; background: white; color: #ef4444; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='white'">
                                <i class="fa-solid fa-trash-can" style="color: #ef4444; width: 16px;"></i> Delete
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Zoho Books Paper Container -->
            <div style="background: white; border-radius: 12px; padding: 3rem; box-shadow: 0 4px 20px rgba(0,0,0,0.04); max-width: 1050px; margin: 0 auto; border: 1px solid #e2e8f0;">
                
                <!-- Main Header Grid: Order info (Left) vs Addresses (Right) -->
                <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 3rem; margin-bottom: 2.5rem;">
                    
                    <!-- Left Column: Title & Status Matrix -->
                    <div>
                        <h1 style="font-size: 1.85rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0; font-family: 'Outfit', sans-serif;">SALES ORDER</h1>
                        <div style="font-size: 0.95rem; font-weight: 700; color: #334155; margin-bottom: 1.75rem;">
                            Sales Order# <strong>${soNumber}</strong>
                        </div>

                        <!-- Status Matrix -->
                        <div style="margin-bottom: 2rem;">
                            <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 0.75rem;">STATUS</div>
                            <div style="display: grid; grid-template-columns: 90px 1fr; row-gap: 0.6rem; font-size: 0.85rem;">
                                <span style="color: #64748b;">Order</span>
                                <div>
                                    <span style="background: #0284c7; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">
                                        ${zSo?.status ? zSo.status.toUpperCase() : 'CONFIRMED'}
                                    </span>
                                </div>

                                <span style="color: #64748b;">Invoice</span>
                                <span style="color: ${isClosed ? '#166534' : '#64748b'}; font-weight: 600;">${invoiceStatus}</span>

                                <span style="color: #64748b;">Payment</span>
                                <span style="color: ${zSo?.paid_status === 'paid' ? '#166534' : '#65a30d'}; font-weight: 600;">${paymentStatus}</span>

                                <span style="color: #64748b;">Shipment</span>
                                <span style="color: ${shipmentStatus === 'Fulfilled' ? '#166534' : '#d97706'}; font-weight: 600;">${shipmentStatus}</span>
                            </div>
                        </div>

                        <!-- Order Dates & Terms Grid -->
                        <div style="display: grid; grid-template-columns: 120px 1fr; row-gap: 0.6rem; font-size: 0.85rem;">
                            <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #94a3b8;">ORDER DATE</span>
                            <span style="color: #0f172a; font-weight: 700;">${soDate}</span>

                            <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #94a3b8;">PAYMENT TERMS</span>
                            <span style="color: #0f172a; font-weight: 600;">${paymentTerms}</span>

                            <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #94a3b8;">SALESPERSON</span>
                            <span style="color: #0f172a; font-weight: 600;">${salesperson}</span>
                        </div>
                    </div>

                    <!-- Right Column: Billing & Shipping Addresses (Zoho 1:1) -->
                    <div style="display: flex; flex-direction: column; gap: 1.75rem;">
                        <!-- Billing Address -->
                        <div>
                            <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 0.5rem;">BILLING ADDRESS</div>
                            <div style="color: #2563eb; font-weight: 800; font-size: 0.95rem; margin-bottom: 4px;">${customerName}</div>
                            <div style="color: #334155; font-size: 0.85rem; line-height: 1.5; white-space: pre-line;">
                                ${billingLines.slice(1).join('\n')}
                            </div>
                        </div>

                        <!-- Shipping Address -->
                        <div>
                            <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 0.5rem;">SHIPPING ADDRESS</div>
                            <div style="color: #334155; font-size: 0.85rem; line-height: 1.5; white-space: pre-line;">
                                ${shippingLines.slice(1).join('\n')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Items & Description Table (Zoho 1:1) -->
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 2rem;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                            <tr>
                                <th style="padding: 0.85rem 1.25rem; font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 800; width: 45%;">ITEMS & DESCRIPTION</th>
                                <th style="padding: 0.85rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 800; text-align: center; width: 12%;">ORDERED</th>
                                <th style="padding: 0.85rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 800; width: 15%;">STATUS</th>
                                <th style="padding: 0.85rem 1rem; font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 800; text-align: right; width: 13%;">RATE</th>
                                <th style="padding: 0.85rem 1.25rem; font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 800; text-align: right; width: 15%;">AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lineItems.map(it => `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 1rem 1.25rem;">
                                        <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${it.name || 'Item'}</div>
                                        ${it.sku ? `<div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">SKU: ${it.sku}</div>` : ''}
                                    </td>
                                    <td style="padding: 1rem; text-align: center; font-weight: 700; color: #0f172a; font-size: 0.9rem;">
                                        ${it.quantity} <span style="font-size: 0.75rem; color: #64748b; font-weight: 500;">pcs</span>
                                    </td>
                                    <td style="padding: 1rem; font-size: 0.78rem; color: #475569; line-height: 1.4;">
                                        <div>0 Packed</div>
                                        <div>${it.quantity} Force fulfilled</div>
                                        <div>${it.quantity_invoiced || 0} Invoiced</div>
                                    </td>
                                    <td style="padding: 1rem; text-align: right; font-weight: 600; color: #334155; font-size: 0.9rem;">
                                        ₹${parseFloat(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td style="padding: 1rem 1.25rem; text-align: right; font-weight: 800; color: #0f172a; font-size: 0.95rem;">
                                        ₹${parseFloat(it.item_total || (it.rate * it.quantity) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Subtotals & Taxes Calculation Block (Zoho 1:1) -->
                <div style="display: flex; justify-content: flex-end; margin-bottom: 3rem;">
                    <div style="width: 380px; display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.9rem;">
                        
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600; color: #475569;">Sub Total</span>
                            <span style="font-weight: 800; color: #0f172a;">₹${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                        ${discount > 0 ? `
                            <div style="display: flex; justify-content: space-between; align-items: center; color: #dc2626;">
                                <span style="font-weight: 600;">Discount</span>
                                <span style="font-weight: 700;">- ₹${discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        ` : ''}

                        ${taxesList.map(t => `
                            <div style="display: flex; justify-content: space-between; align-items: center; color: #475569;">
                                <span style="font-weight: 600;">${t.tax_name}</span>
                                <span style="font-weight: 700; color: #0f172a;">₹${parseFloat(t.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        `).join('')}

                        ${roundOff !== 0 ? `
                            <div style="display: flex; justify-content: space-between; align-items: center; color: #64748b;">
                                <span style="font-weight: 600;">Round off</span>
                                <span style="font-weight: 700;">₹${roundOff.toFixed(2)}</span>
                            </div>
                        ` : ''}

                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #cbd5e1; padding-top: 0.85rem; margin-top: 0.25rem;">
                            <span style="font-size: 1.15rem; font-weight: 800; color: #0f172a; font-family: 'Outfit', sans-serif;">Total</span>
                            <span style="font-size: 1.35rem; font-weight: 900; color: #0f172a; font-family: 'Outfit', sans-serif;">
                                ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- More Information Footer Block (Zoho 1:1) -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 1.5rem; font-size: 0.85rem;">
                    <div style="font-weight: 800; color: #0f172a; margin-bottom: 0.75rem; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em;">More Information</div>
                    <div style="display: flex; gap: 2rem; color: #475569;">
                        <span>Salesperson</span>
                        <strong style="color: #0f172a;">: ${salesperson}</strong>
                    </div>
                </div>

            </div>
        </div>
    `;
};

async function generateFinalInvoice() {
    if (!confirm('Are you sure you want to mark this order as Billed and send it to packing?')) return;

    try {
        // Save any changes made (like discount) before finalizing
        const updateRes = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentOrder)
        });

        if (!updateRes.ok) {
            const err = await updateRes.json();
            alert('Failed to save changes: ' + err.message);
            return;
        }

        const res = await fetch(`${BILLING_API_URL}/orders/${currentOrder.order_id}/invoice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'finalized',
                discount: currentOrder.discount,
                shipping_charges: currentOrder.shipping_charges,
                extra_charges: currentOrder.extra_charges
            })
        });

        if (res.ok) {
            const invData = await res.json();
            closeModal();
            showFinalizeCopyModal(invData.invoiceId);

            if (typeof switchTab === 'function') {
                // switchTab('invoices'); // User requested to disable auto-navigation
            }
            loadInvoices();
        } else {
            const err = await res.json();
            window.showAlert('Error', err.message || 'Failed to generate invoice', 'error');
        }
    } catch (err) {
        window.showAlert('Error', 'Invoice generation failed: ' + err.message, 'error');
    }
}

async function loadInvoices() {
    const tbody = document.getElementById('invoicesBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem;"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${BILLING_API_URL}/invoices`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const invoices = await res.json();

        tbody.innerHTML = invoices.map(inv => `
            <tr>
                <td style="font-weight: 800; color: var(--billing-primary);">${inv.invoice_number}</td>
                <td>${window.formatOrderId(inv.order_id, inv.created_at)}</td>
                <td style="font-weight: 600;">${inv.order_customer}</td>
                <td>${new Date(inv.created_at).toLocaleDateString()}</td>
                <td style="font-weight: 700;">₹${parseFloat(inv.total_amount).toLocaleString()}</td>
                <td><span class="status-badge status-${inv.invoice_status}">${inv.invoice_status}</span></td>
                <td>
                    ${inv.invoice_status === 'draft' ?
                `<div style="display:flex; gap:0.4rem; align-items:center;">
                            <button class="btn-billing success" style="width: auto; padding: 0.5rem 0.85rem;" onclick="finalizeInvoice(${inv.invoice_id})">Finalize</button>
                            <button class="btn-billing" style="width: auto; padding: 0.5rem 0.75rem; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; cursor: pointer;" title="Hard Delete Invoice from DB" onclick="hardDeleteInvoice(${inv.invoice_id}, '${inv.invoice_number}')"><i class="fas fa-trash-alt"></i></button>
                          </div>` :
                `<div style="display:flex; gap:0.4rem; align-items:center;">
                            <button class="btn-billing primary" style="width: auto; padding: 0.5rem 0.75rem;" title="View Invoice" onclick="viewInvoice(${inv.invoice_id})"><i class="fas fa-eye"></i></button>
                            <button class="btn-billing success" style="width: auto; padding: 0.5rem 0.75rem;" title="Print/Download" onclick="printInvoice(${inv.invoice_id})"><i class="fas fa-print"></i></button>
                            <button class="btn-billing" style="width: auto; padding: 0.5rem 0.75rem; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; cursor: pointer;" title="Hard Delete Invoice from DB" onclick="hardDeleteInvoice(${inv.invoice_id}, '${inv.invoice_number}')"><i class="fas fa-trash-alt"></i></button>
                          </div>`}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #ef4444;">Error loading invoices.</td></tr>';
    }
}

async function finalizeInvoice(invoiceId) {
    if (!confirm('Once finalized, this invoice becomes immutable and the order moves to Packing. Proceed?')) return;

    try {
        const res = await fetch(`${BILLING_API_URL}/invoices/${invoiceId}/finalize`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            alert('Invoice Finalized & Order sent to Packing.');
            loadInvoices();
        } else {
            const result = await res.json();
            alert(result.message);
        }
    } catch (err) {
        alert('Error finalizing invoice');
    }
}

async function loadPayments(status = 'pending') {
    const tbody = document.getElementById('paymentsBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem;"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${BILLING_API_URL}/payments?status=${status}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const payments = await res.json();

        tbody.innerHTML = payments.map(p => `
            <tr>
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
                <td style="font-weight: 600;">${p.customer_name}</td>
                <td>${window.formatOrderId(p.order_id, p.created_at)}</td>
                <td style="font-weight: 700;">₹${parseFloat(p.amount).toLocaleString()}</td>
                <td><span style="font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 4px;">${p.payment_mode.toUpperCase()}</span></td>
                <td><span class="status-badge status-${p.payment_status}">${p.payment_status}</span></td>
                <td>
                    ${p.payment_status === 'pending' ?
                `<button class="btn-billing primary" style="width: auto; padding: 0.5rem 1rem;" onclick="verifyPayment(${p.payment_id}, 'verified'); loadPayments('${status}')">Verify</button>` :
                `<a href="${p.proof_url}" target="_blank" class="btn-billing" style="width: auto; padding: 0.5rem 0.75rem; background: #f1f5f9; color: #475569; text-decoration:none;"><i class="fas fa-file-invoice"></i> Proof</a>`}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #ef4444;">Error loading payments.</td></tr>';
    }
}

function closeModal() {
    const m = document.getElementById('billingModal');
    if (m) m.style.display = 'none';
}
window.closeModal = closeModal;

/** Finalize & Copy Modal Logic **/
async function showFinalizeCopyModal(invoiceId) {
    const modal = document.getElementById('finalizeCopyModal');
    const dataBox = document.getElementById('finalizeCopyData');
    
    modal.style.display = 'flex';
    dataBox.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Preparing summary...</div>';

    try {
        const res = await fetch(`${BILLING_API_URL}/invoices/${invoiceId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch invoice details');
        
        const data = await res.json();
        
        if (!data || !data.items) throw new Error('Incomplete data received');

        const productsStr = data.items.map((item, index) => `${index + 1}. ${item.product_name} (Qty: ${item.quantity}) - ₹${parseFloat(item.price * item.quantity).toLocaleString()}`).join('\n');
        
        const addressLine = [data.billing_village, data.billing_district, data.state].filter(Boolean).join(', ');
        const pincodeStr = data.billing_pincode ? ` - ${data.billing_pincode}` : '';

        const message = `
SGB AGRIVAAN - DISPATCH SUMMARY
--------------------------------------------------
[ CUSTOMER DETAILS ]
Name     : ${data.billing_name || 'N/A'}
Phone    : ${data.billing_phone || 'N/A'}
Address  : ${data.billing_address || 'N/A'}
           ${addressLine}${pincodeStr}

[ ORDER DETAILS ]
${productsStr}

[ FINANCIALS ]
Total Amount : ₹${parseFloat(data.total_amount || 0).toLocaleString()}
Advance Paid : ₹${parseFloat(data.advance_paid || 0).toLocaleString()}
Balance Due  : ₹${(parseFloat(data.total_amount || 0) - parseFloat(data.advance_paid || 0)).toLocaleString()}

[ LOGISTICS ]
Courier      : ${data.dispatch_through || 'N/A'}
Destination  : ${data.destination || 'N/A'}
--------------------------------------------------
System Generated Document
`.trim();

        dataBox.innerText = message;
        // Store for copying
        window.lastBilledMessage = message;
        
    } catch (err) {
        console.error(err);
        dataBox.innerHTML = '<p style="color: #ef4444;">Failed to generate summary. Please check History tab.</p>';
    }
}

async function copyFinalizeData() {
    const btn = document.querySelector('.btn-finalize-copy.primary');
    const originalContent = btn.innerHTML;
    
    try {
        if (!window.lastBilledMessage) return;
        await navigator.clipboard.writeText(window.lastBilledMessage);
        
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied to Clipboard!';
        btn.style.background = '#10b981';
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.background = '';
        }, 2000);
    } catch (err) {
        alert('Failed to copy to clipboard');
    }
}

function closeFinalizeCopyModal() {
    document.getElementById('finalizeCopyModal').style.display = 'none';
}

function viewInvoice(invoiceId) {
    window.open(`invoice.html?id=${invoiceId}`, '_blank');
}

function printInvoice(invoiceId) {
    window.open(`invoice.html?id=${invoiceId}`, '_blank');
}

function setupSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.oninput = (e) => {
        };
    }
}

BILLING_API_URL = window.BILLING_API_URL || `${window.API_URL}/billing`;

let currentTab = 'dashboard';
let pendingOrders = [];

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    loadSidebar();
    setupSearch();

    // Detect standalone HTML page
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '').toLowerCase();

    if (currentPage === 'invoices') {
        loadInvoices();
        return;
    }
    if (currentPage === 'payments') {
        loadPayments('pending');
        return;
    }
    if (currentPage === 'reports') {
        loadReports();
        return;
    }
    if (currentPage === 'settings') {
        loadSettings();
        return;
    }
    if (currentPage === 'pending') {
        loadPendingOrders();
        return;
    }
    if (currentPage === 'sales-orders') {
        if (typeof loadSalesOrdersList === 'function') loadSalesOrdersList();
        return;
    }
    if (currentPage === 'customers') {
        if (typeof loadCustomersList === 'function') loadCustomersList();
        return;
    }
    if (currentPage === 'dashboard') {
        loadDashboard();
        return;
    }

    // Fallback / legacy tab switching for billing.html
    const initialHash = window.location.hash.replace('#', '');
    const validTabs = ['dashboard', 'pending', 'invoices', 'payments', 'reports', 'customers', 'settings'];
    const initialTab = validTabs.includes(initialHash) ? initialHash : 'dashboard';

    switchTab(initialTab);

    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.replace('#', '');
        if (newHash && validTabs.includes(newHash)) {
            switchTab(newHash);
        }
    });
}

function loadSidebar() {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (window.renderSidebar) {
        window.renderSidebar('billing');
    }
}

function switchTab(tab) {
    const tabs = document.querySelectorAll('.tab-content');
    if (!tabs || tabs.length === 0) return;

    tabs.forEach(c => c.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const tabEl = document.getElementById(tab);
    if (tabEl) tabEl.style.display = 'block';
    const link = document.getElementById(`side-${tab}`) || document.getElementById(`nav-${tab}`);
    if (link) link.classList.add('active');

    if (tab === 'pending') loadPendingOrders();
    if (tab === 'payments') loadPayments();
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'invoices') loadInvoices();
    if (tab === 'reports') loadReports();
    if (tab === 'settings') loadSettings();
}



async function loadReports() {
    const container = document.getElementById('reportsContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding: 5rem;"><div class="loader"></div></div>';

    try {
        const res = await fetch(`${BILLING_API_URL}/reports/revenue`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const stats = await res.json();

        container.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 16px; border: 1px solid #e2e8f0;">
                <h3 style="margin-bottom: 2rem;">Financial Performance Report</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin-bottom: 3rem;">
                    <div style="padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
                        <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.5rem;">Daily Billed Amount</p>
                        <p style="font-size: 1.5rem; font-weight: 800;">₹${stats.revenueToday.toLocaleString()}</p>
                    </div>
                    <div style="padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
                        <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.5rem;">Estimated GST Collected</p>
                        <p style="font-size: 1.5rem; font-weight: 800; color: var(--billing-primary);">₹${(stats.revenueToday * 0.18).toLocaleString()}</p>
                    </div>
                    <div style="padding: 1.5rem; background: #f8fafc; border-radius: 12px;">
                        <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 0.5rem;">Invoices Generated</p>
                        <p style="font-size: 1.5rem; font-weight: 800;">${stats.billedToday}</p>
                    </div>
                </div>
                
                <table class="report-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; background: #f1f5f9;">
                            <th style="padding: 1rem;">Date</th>
                            <th style="padding: 1rem;">Metric</th>
                            <th style="padding: 1rem; text-align: right;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style="padding: 1rem;">${new Date().toDateString()}</td><td style="padding: 1rem;">Total Revenue</td><td style="padding: 1rem; text-align: right; font-weight: 700;">₹${stats.revenueToday.toLocaleString()}</td></tr>
                        <tr><td style="padding: 1rem;">${new Date().toDateString()}</td><td style="padding: 1rem;">Finalized Invoices</td><td style="padding: 1rem; text-align: right;">${stats.billedToday}</td></tr>
                        <tr><td style="padding: 1rem;">${new Date().toDateString()}</td><td style="padding: 1rem;">Draft Conversion Rate</td><td style="padding: 1rem; text-align: right;">${((stats.billedToday / (stats.pendingBilling + stats.billedToday || 1)) * 100).toFixed(1)}%</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = '<p style="color: #ef4444;">Failed to load reports.</p>';
    }
}

let revenueTrendChartInstance = null;
let statusDistributionChartInstance = null;
let monthlyRevenueChartInstance = null;
let sparklineChartInstances = {};

async function populateDashboardFilters(billingUsers) {
    // Populate Sales Executives
    try {
        const salesSelect = document.getElementById('dashSalesExecutive');
        if (salesSelect && salesSelect.options.length <= 1) {
            const res = await fetch(`/api/users/sales`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const salesExecs = await res.json();
                salesExecs.forEach(exec => {
                    const opt = document.createElement('option');
                    opt.value = exec.user_id;
                    opt.innerText = exec.name;
                    salesSelect.appendChild(opt);
                });
            }
        }
    } catch (err) {
        console.error('Failed to populate Sales Executive filter:', err);
    }

    // Populate Billing Users
    try {
        const billingSelect = document.getElementById('dashBillingUser');
        if (billingSelect && billingSelect.options.length <= 1 && billingUsers) {
            billingUsers.forEach(user => {
                const opt = document.createElement('option');
                opt.value = user.user_id;
                opt.innerText = user.name;
                billingSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Failed to populate Billing User filter:', err);
    }
}

function renderKpiCard(title, value, trend, iconClass, iconBg, iconColor, iconGlow, sparklineId) {
    const isNegative = trend.startsWith('-');
    const isZero = trend.startsWith('0');
    
    let cleanTrend = trend;
    if (trend.startsWith('+') || trend.startsWith('-')) {
        cleanTrend = trend.substring(1);
    }
    
    let trendArrow = '↑';
    let trendColor = '#10b981';
    if (isNegative) {
        trendArrow = '↓';
        trendColor = '#ef4444';
    } else if (isZero) {
        trendArrow = '→';
        trendColor = '#94a3b8';
    }

    return `
        <div class="stat-card" style="padding: 1.5rem; border-radius: 16px; display: flex; flex-direction: column; justify-content: space-between; height: 165px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; border-top: 4px solid ${iconColor}; background: white; transition: all 0.3s ease; position: relative; overflow: hidden;">
            <div style="display: flex; align-items: flex-start; gap: 1rem; z-index: 2;">
                <div style="width: 44px; height: 44px; border-radius: 10px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; box-shadow: 0 4px 10px ${iconGlow};">
                    <i class="${iconClass}"></i>
                </div>
                <div style="display: flex; flex-direction: column;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">${title}</div>
                    <div style="font-size: 2.25rem; font-weight: 700; color: #1e293b; font-family: 'Outfit'; margin-top: 0.25rem; line-height: 1.1;">${value}</div>
                </div>
            </div>
            <div style="display: flex; align-items: flex-end; justify-content: space-between; z-index: 2; margin-top: 0.5rem;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 0.95rem; font-weight: 700; color: ${trendColor}; display: inline-flex; align-items: center; gap: 0.15rem; font-family: 'Inter';">
                        ${trendArrow} ${cleanTrend}
                    </span>
                    <span style="color: #94a3b8; font-size: 0.725rem; font-weight: 500; margin-top: 1px; font-family: 'Inter';">vs yesterday</span>
                </div>
                <div style="width: 90px; height: 40px; position: relative; bottom: -2px;">
                    <canvas id="${sparklineId}" style="width: 90px; height: 40px;"></canvas>
                </div>
            </div>
        </div>
    `;
}

function initSparkline(canvasId, data, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (sparklineChartInstances[canvasId]) {
        sparklineChartInstances[canvasId].destroy();
    }

    sparklineChartInstances[canvasId] = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: data.map((_, i) => i),
            datasets: [{
                data: data,
                borderColor: color,
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function initRevenueTrendChart(trendData) {
    const ctx = document.getElementById('revenueTrendChart');
    if (!ctx) return;

    if (revenueTrendChartInstance) {
        revenueTrendChartInstance.destroy();
    }

    const timeframe = document.getElementById('trendTimeframe')?.value || 'daily';
    
    let labels = trendData.labels;
    let thisWeek = trendData.thisWeek;
    let lastWeek = trendData.lastWeek;

    if (timeframe === 'weekly') {
        labels = ['Week 1', 'Week 2'];
        const sum = arr => arr.reduce((a,b)=>a+b, 0);
        thisWeek = [sum(trendData.thisWeek.slice(0, 3)), sum(trendData.thisWeek.slice(3))];
        lastWeek = [sum(trendData.lastWeek.slice(0, 3)), sum(trendData.lastWeek.slice(3))];
    }

    revenueTrendChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'This Week (₹)',
                    data: thisWeek,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointHoverRadius: 6
                },
                {
                    label: 'Last Week (₹)',
                    data: lastWeek,
                    borderColor: '#94a3b8',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointBackgroundColor: '#94a3b8',
                    pointHoverRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Inter', weight: 600 }, boxWidth: 12 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ₹${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } },
                y: { 
                    ticks: {
                        font: { family: 'Inter' },
                        callback: function(value) {
                            return '₹' + (value >= 1000 ? (value / 1000) + 'k' : value);
                        }
                    }
                }
            }
        }
    });
}

window.updateRevenueTrendChart = function() {
    loadDashboard();
};

function initStatusDistributionChart(dist) {
    const canvas = document.getElementById('statusDistributionChart');
    if (!canvas) return;

    if (statusDistributionChartInstance) {
        statusDistributionChartInstance.destroy();
    }

    document.getElementById('distributionTotal').innerText = dist.total;

    const legendDiv = document.getElementById('statusDistributionLegend');
    const items = [
        { label: 'Generated', val: dist.generated, color: '#3b82f6' },
        { label: 'Pending', val: dist.pending, color: '#f59e0b' },
        { label: 'Verified', val: dist.verified, color: '#10b981' },
        { label: 'Rejected', val: dist.rejected, color: '#ef4444' }
    ];
    
    const total = dist.total || 1;
    legendDiv.innerHTML = items.map(item => {
        const pct = Math.round((item.val / total) * 100);
        return `
            <div style="display:flex; align-items:center; gap: 0.35rem;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color};"></div>
                <div style="font-weight: 500; color: #64748b; flex: 1;">${item.label}</div>
                <div style="font-weight: 700; color: #1e293b;">${pct}% (${item.val})</div>
            </div>
        `;
    }).join('');

    statusDistributionChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Generated', 'Pending', 'Verified', 'Rejected'],
            datasets: [{
                data: [dist.generated, dist.pending, dist.verified, dist.rejected],
                backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            cutout: '72%',
            plugins: { legend: { display: false } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function initMonthlyRevenueChart(monthlyData) {
    const ctx = document.getElementById('monthlyRevenueChart');
    if (!ctx) return;

    if (monthlyRevenueChartInstance) {
        monthlyRevenueChartInstance.destroy();
    }

    const yearOption = document.getElementById('monthlyRevenueYear')?.value || 'this_year';
    const data = yearOption === 'this_year' ? monthlyData.thisYear : monthlyData.lastYear;
    const labelText = yearOption === 'this_year' ? 'This Year (₹)' : 'Last Year (₹)';

    const maxVal = Math.max(...data);

    const backgroundColors = data.map((val, idx) => {
        if (val === maxVal && val > 0) return '#4f46e5';
        return 'rgba(99, 102, 241, 0.25)';
    });

    const borderColors = data.map((val, idx) => {
        if (val === maxVal && val > 0) return '#4f46e5';
        return '#6366f1';
    });

    monthlyRevenueChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: labelText,
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Revenue: ₹${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } },
                y: {
                    ticks: {
                        font: { family: 'Inter' },
                        callback: function(value) {
                            if (value >= 100000) return '₹' + (value / 100000) + 'L';
                            if (value >= 1000) return '₹' + (value / 1000) + 'k';
                            return '₹' + value;
                        }
                    }
                }
            }
        }
    });
}

window.updateMonthlyRevenueChart = function() {
    loadDashboard();
};

window.refreshDashboard = function() {
    loadDashboard();
};

window.exportReport = function() {
    if (window.showAlert) {
        window.showAlert('Exporting...', 'Preparing your CSV report for download!', 'info');
    }
    const headers = ['Date Range', 'New Orders', 'Pending Orders', 'Billing Drafts', 'Bills Generated', 'Revenue Billed'];
    const row = [
        document.getElementById('dashDateRange')?.value || 'today',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(1) .stat-value')?.innerText || '0',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(2) .stat-value')?.innerText || '0',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(3) .stat-value')?.innerText || '0',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(4) .stat-value')?.innerText || '0',
        document.getElementById('dashboardStatsRow')?.querySelector('.stat-card:nth-child(5) .stat-value')?.innerText || '0'
    ];
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + row.join(',');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `billing_dashboard_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

async function loadDashboard() {
    try {
        const dateRange = document.getElementById('dashDateRange')?.value || 'today';
        const billingUser = document.getElementById('dashBillingUser')?.value || '';
        const paymentStatus = document.getElementById('dashPaymentStatus')?.value || '';
        const customerType = document.getElementById('dashCustomerType')?.value || '';
        const salesExecutive = document.getElementById('dashSalesExecutive')?.value || '';

        const params = new URLSearchParams({
            dateRange,
            billingUser,
            paymentStatus,
            customerType,
            salesExecutive
        });

        const res = await fetch(`${BILLING_API_URL}/stats?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const stats = await res.json();

        await populateDashboardFilters(stats.billingUsers);

        const statsRow = document.getElementById('dashboardStatsRow');
        const kpis = stats.kpis;
        statsRow.innerHTML = `
            ${renderKpiCard('New Orders Today', kpis.newOrders.value, kpis.newOrders.trend, 'fa-solid fa-cart-shopping', 'rgba(59, 130, 246, 0.1)', '#3b82f6', 'rgba(59, 130, 246, 0.2)', 'sparklineNewOrders')}
            ${renderKpiCard('Pending Orders', kpis.pendingOrders.value, kpis.pendingOrders.trend, 'fa-solid fa-clipboard-list', 'rgba(245, 158, 11, 0.1)', '#f59e0b', 'rgba(245, 158, 11, 0.2)', 'sparklinePendingOrders')}
            ${renderKpiCard('Billing (Drafts)', kpis.billingDrafts.value, kpis.billingDrafts.trend, 'fa-solid fa-file-invoice', 'rgba(16, 185, 129, 0.1)', '#10b981', 'rgba(16, 185, 129, 0.2)', 'sparklineBillingDrafts')}
            ${renderKpiCard('Bills Generated Today', kpis.billsGenerated.value, kpis.billsGenerated.trend, 'fa-solid fa-file-invoice-dollar', 'rgba(139, 92, 246, 0.1)', '#8b5cf6', 'rgba(139, 92, 246, 0.2)', 'sparklineBillsGenerated')}
            ${renderKpiCard('Revenue Billed Today', '₹' + kpis.revenueBilled.value.toLocaleString(), kpis.revenueBilled.trend, 'fa-solid fa-indian-rupee-sign', 'rgba(99, 102, 241, 0.1)', '#6366f1', 'rgba(99, 102, 241, 0.2)', 'sparklineRevenue')}
        `;

        setTimeout(() => {
            initSparkline('sparklineNewOrders', kpis.newOrders.sparkline, '#3b82f6');
            initSparkline('sparklinePendingOrders', kpis.pendingOrders.sparkline, '#f59e0b');
            initSparkline('sparklineBillingDrafts', kpis.billingDrafts.sparkline, '#10b981');
            initSparkline('sparklineBillsGenerated', kpis.billsGenerated.sparkline, '#8b5cf6');
            initSparkline('sparklineRevenue', kpis.revenueBilled.sparkline, '#6366f1');
        }, 50);

        const bottomRow = document.getElementById('dashboardBottomStatsRow');
        const bkpis = stats.bottomKpis;
        
        const formatBillingTime = (seconds) => {
            if (!seconds) return '0s';
            const m = Math.floor(seconds / 60);
            const s = seconds % 60;
            if (m > 0) return `${m}m ${s}s`;
            return `${s}s`;
        };

        const getTrendArrowInfo = (trendStr) => {
            const isNegative = trendStr.startsWith('-');
            const isZero = trendStr.startsWith('0');
            let clean = trendStr;
            if (trendStr.startsWith('+') || trendStr.startsWith('-')) {
                clean = trendStr.substring(1);
            }
            return {
                arrow: isNegative ? '↓' : (isZero ? '→' : '↑'),
                color: isNegative ? '#ef4444' : (isZero ? '#94a3b8' : '#10b981'),
                clean
            };
        };

        const tAverageInvoice = getTrendArrowInfo(bkpis.avgInvoiceValue.trend);
        const tAvgBillingTime = getTrendArrowInfo(bkpis.avgBillingTime.trend);
        const isTimeNeg = bkpis.avgBillingTime.trend.startsWith('-');
        const isTimeZero = bkpis.avgBillingTime.trend.startsWith('0');
        const tTimeColor = isTimeNeg ? '#10b981' : (isTimeZero ? '#94a3b8' : '#ef4444');
        const tTimeArrow = isTimeNeg ? '↓' : (isTimeZero ? '→' : '↑');
        const tTimeClean = isTimeNeg || bkpis.avgBillingTime.trend.startsWith('+') ? bkpis.avgBillingTime.trend.substring(1) : bkpis.avgBillingTime.trend;
        const tBillsPending = getTrendArrowInfo(bkpis.billsPending.trend);

        bottomRow.innerHTML = `
            <div class="stat-card" style="padding: 1.25rem; border-radius: 16px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; background: white; transition: all 0.3s ease; height: 110px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                    <i class="fa-solid fa-receipt"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">Average Invoice Value</div>
                    <div style="font-size: 1.65rem; font-weight: 800; color: #1e293b; font-family: 'Outfit'; margin: 2px 0; line-height: 1.2;">₹${Math.round(bkpis.avgInvoiceValue.value).toLocaleString()}</div>
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${tAverageInvoice.color}; display: inline-flex; align-items: center; gap: 0.15rem; font-family: 'Inter';">
                        ${tAverageInvoice.arrow} ${tAverageInvoice.clean} <span style="color: #94a3b8; font-weight: 500;">vs yesterday</span>
                    </span>
                </div>
            </div>

            <div class="stat-card" style="padding: 1.25rem; border-radius: 16px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; background: white; transition: all 0.3s ease; height: 110px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                    <i class="fa-solid fa-clock"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">Avg. Billing Time</div>
                    <div style="font-size: 1.65rem; font-weight: 800; color: #1e293b; font-family: 'Outfit'; margin: 2px 0; line-height: 1.2;">${formatBillingTime(bkpis.avgBillingTime.value)}</div>
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${tTimeColor}; display: inline-flex; align-items: center; gap: 0.15rem; font-family: 'Inter';">
                        ${tTimeArrow} ${tTimeClean} <span style="color: #94a3b8; font-weight: 500;">vs yesterday</span>
                    </span>
                </div>
            </div>

            <div class="stat-card" style="padding: 1.25rem; border-radius: 16px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; background: white; transition: all 0.3s ease; height: 110px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                    <i class="fa-solid fa-hourglass-half"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">Bills Pending</div>
                    <div style="font-size: 1.65rem; font-weight: 800; color: #1e293b; font-family: 'Outfit'; margin: 2px 0; line-height: 1.2;">${bkpis.billsPending.value}</div>
                    <span style="font-size: 0.75rem; font-weight: 600; color: ${tBillsPending.color}; display: inline-flex; align-items: center; gap: 0.15rem; font-family: 'Inter';">
                        ${tBillsPending.arrow} ${tBillsPending.clean} <span style="color: #94a3b8; font-weight: 500;">vs yesterday</span>
                    </span>
                </div>
            </div>

            <div class="stat-card" style="padding: 1.25rem; border-radius: 16px; display: flex; align-items: center; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); border: 1px solid #f1f5f9; background: white; transition: all 0.3s ease; height: 110px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(99, 102, 241, 0.1); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
                    <i class="fa-solid fa-arrow-trend-up"></i>
                </div>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.85rem; color: #64748b; font-weight: 500; font-family: 'Inter';">Daily Target</span>
                        <span style="font-size: 0.75rem; font-weight: 700; color: #4f46e5; font-family: 'Inter';">${bkpis.dailyTarget.achievedPercent}% achieved</span>
                    </div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b; font-family: 'Outfit'; margin: 2px 0; line-height: 1.1;">₹${bkpis.dailyTarget.value.toLocaleString()}</div>
                    <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${bkpis.dailyTarget.achievedPercent}%; height: 100%; background: linear-gradient(90deg, #4f46e5 0%, #6366f1 100%); border-radius: 4px; transition: width 0.8s ease;"></div>
                    </div>
                </div>
            </div>
        `;

        initRevenueTrendChart(stats.revenueTrend);
        initStatusDistributionChart(stats.statusDistribution);
        initMonthlyRevenueChart(stats.monthlyRevenue);

        const activityDiv = document.getElementById('recentActivity');
        if (activityDiv) {
            const invRes = await fetch(`${BILLING_API_URL}/invoices`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const invoices = await invRes.json();
            activityDiv.innerHTML = invoices.slice(0, 5).map(inv => `
                <div style="display:flex; align-items:center; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;">
                    <div style="background: #f1f5f9; width: 32px; height: 32px; border-radius: 8px; display:flex; align-items:center; justify-content:center; color: var(--billing-primary);">
                        <i class="fas fa-file-invoice" style="font-size: 0.875rem;"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size: 0.875rem; font-weight: 600; color: #1e293b;">Invoice ${inv.invoice_number} generated</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${inv.billing_name || inv.order_customer || 'Customer'} | ₹${parseFloat(inv.total_amount).toLocaleString()}</div>
                    </div>
                    <div style="font-size: 0.7rem; color: #94a3b8;">${new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `).join('') || '<p style="text-align:center; padding: 2rem; color: #94a3b8;">No recent activity.</p>';
        }

        const alertsDiv = document.getElementById('systemAlerts');
        if (alertsDiv) {
            const alerts = [];
            if (bkpis.billsPending.value > 0) {
                alerts.push({ type: 'warning', text: `${bkpis.billsPending.value} payments awaiting verification.` });
            }
            if (stats.pendingBilling > 10) {
                alerts.push({ type: 'danger', text: `Billing backlog: ${stats.pendingBilling} orders pending.` });
            }
            alertsDiv.innerHTML = alerts.map(a => `
                <div style="background: rgba(255,255,255,0.1); padding: 0.75rem; border-radius: 12px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.75rem; border: 1px solid rgba(255,255,255,0.1);">
                    <i class="fas fa-circle-exclamation" style="color: ${a.type === 'danger' ? '#ef4444' : '#f59e0b'};"></i>
                    <span style="font-size: 0.875rem; font-weight: 500;">${a.text}</span>
                </div>
            `).join('') || '<p style="opacity: 0.7; font-size: 0.875rem; text-align:center;">✅ All systems in sync.</p>';
        }

    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

let allPendingOrders = [];

window.loadPendingOrders = async function() {
    const tbody = document.getElementById('pendingOrdersBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 3rem;"><div class="loader"></div></td></tr>';

    try {
        const res = await fetch(`${BILLING_API_URL}/pending`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.status === 401) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align:center; padding: 3rem;">
                        <div style="background: #ffffff; border: 1px solid #fecaca; border-radius: 12px; padding: 2rem; max-width: 440px; margin: 0 auto; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.08);">
                            <i class="fa-solid fa-clock-rotate-left" style="font-size: 2.25rem; color: #ef4444; margin-bottom: 0.75rem; display: block;"></i>
                            <h3 style="color: #991b1b; margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 800;">Session Expired</h3>
                            <p style="color: #64748b; font-size: 0.85rem; margin: 0 0 1.25rem 0;">Your login session has expired. Please sign in again to continue.</p>
                            <a href="../../index.html?error=session_expired" style="display: inline-block; background: #3b82f6; color: white; padding: 0.65rem 1.75rem; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 0.875rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                                <i class="fa-solid fa-right-to-bracket" style="margin-right: 6px;"></i> Sign In Again
                            </a>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `Server responded with status ${res.status}`);
        }
        const data = await res.json();
        allPendingOrders = Array.isArray(data) ? data : [];

        // Wire up filters once
        document.querySelectorAll('.filter-input-v2').forEach(input => {
            input.onchange = () => applyPendingFilters();
        });

        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.oninput = () => applyPendingFilters();
        }

        applyPendingFilters();
    } catch (err) {
        console.error('Error in loadPendingOrders:', err);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: #ef4444; padding: 2rem;">Error loading pending orders: ' + (err.message || 'Server error') + '</td></tr>';
    }
};

window.applyPendingFilters = function() {
    const tbody = document.getElementById('pendingOrdersBody');
    if (!tbody) return;

    const filterDateEl = document.getElementById('pendingFilterDate') || document.getElementById('filterDate');
    const filterSalesEl = document.getElementById('pendingFilterSales') || document.getElementById('filterSales');
    const filterPaymentEl = document.getElementById('pendingFilterStatus') || document.getElementById('filterPayment');
    const filterSourceEl = document.getElementById('pendingFilterSource') || document.getElementById('filterSource');
    const searchEl = document.getElementById('globalSearch');

    const filterDate = filterDateEl ? filterDateEl.value : '';
    const filterSales = filterSalesEl ? filterSalesEl.value : '';
    const filterPayment = filterPaymentEl ? filterPaymentEl.value : '';
    const filterSource = filterSourceEl ? filterSourceEl.value : '';
    const search = searchEl ? searchEl.value.toLowerCase().trim() : '';

    const filtered = (allPendingOrders || []).filter(order => {
        const matchesDate = !filterDate || (order.created_at && new Date(order.created_at).toISOString().split('T')[0] === filterDate);
        const matchesSales = !filterSales || order.sales_person_name === filterSales;
        
        let matchesPayment = true;
        if (filterPayment === 'verified') {
            matchesPayment = Boolean(order.advance_verified);
        } else if (filterPayment === 'unverified') {
            matchesPayment = !order.advance_verified;
        } else if (filterPayment === 'draft') {
            matchesPayment = (order.order_status === 'draft');
        } else if (filterPayment === 'partial') {
            const adv = parseFloat(order.advance_paid || 0);
            const tot = parseFloat(order.total_amount || 0);
            matchesPayment = adv > 0 && adv < tot;
        } else if (filterPayment === 'full') {
            const adv = parseFloat(order.advance_paid || 0);
            const tot = parseFloat(order.total_amount || 0);
            matchesPayment = adv >= tot && tot > 0;
        }

        const matchesSource = !filterSource || (order.order_source === filterSource || order.lead_source === filterSource);

        let matchesSearch = true;
        if (search) {
            const combined = `${order.order_id} ${order.customer_name || ''} ${order.phone || ''} ${order.sales_person_name || ''}`.toLowerCase();
            matchesSearch = combined.includes(search);
        }

        return matchesDate && matchesSales && matchesPayment && matchesSource && matchesSearch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 3rem; color: #64748b;">No orders match these filters.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(order => `
        <tr>
            <td style="font-weight: 700;">${window.formatOrderId ? window.formatOrderId(order.order_id, order.created_at) : '#SGB-' + order.order_id}</td>
            <td style="font-weight: 600;">${order.customer_name || 'N/A'}</td>
            <td>${order.phone || 'N/A'}</td>
            <td>${order.sales_person_name || 'Staff'}</td>
            <td style="font-weight: 700; color: #10b981;">₹${parseFloat(order.advance_paid || 0).toLocaleString()}</td>
            <td>
                ${order.has_payment_proof ?
            `<button class="btn-billing" style="width: auto; padding: 4px 10px; background: #f1f5f9; color: #3b82f6;" onclick="openOrderBilling(${order.order_id})"><i class="fas fa-image"></i> View</button>` :
            '<span style="opacity: 0.4;">N/A</span>'}
            </td>
            <td style="font-weight: 800; color: var(--billing-primary);">₹${parseFloat(order.total_amount || 0).toLocaleString()}</td>
            <td><span class="status-badge status-${order.order_status || 'draft'}">${(order.order_status || 'draft').toUpperCase()}</span></td>
            <td>
                <button class="btn-billing primary" style="width: auto; padding: 0.4rem 0.85rem; font-size: 0.78rem; font-weight: 700; white-space: nowrap;" onclick="openOrderBilling(${order.order_id})">
                    <i class="fa-solid fa-user-plus"></i> Create Customer
                </button>
            </td>

        </tr>
    `).join('');

    // Populate Sales Filter if empty
    const salesSelect = document.getElementById('pendingFilterSales') || document.getElementById('filterSales');
    if (salesSelect && salesSelect.options.length <= 1) {
        const staff = [...new Set((allPendingOrders || []).map(o => o.sales_person_name).filter(Boolean))];
        staff.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            salesSelect.appendChild(opt);
        });
    }
};

window.filterPendingOrders = window.applyPendingFilters;




async function loadSettings() {
    const container = document.getElementById('settingsForm');
    container.innerHTML = '<div style="text-align:center; padding: 2rem;"><div class="loader"></div></div>';

    try {
        const res = await fetch(`${BILLING_API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const settings = await res.json();

        container.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Company State (for GST Logic)</label>
                <input type="text" id="setting_company_state" class="form-input" value="${settings.company_state || ''}" placeholder="e.g. Maharashtra">
            </div>
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Invoice Prefix</label>
                <input type="text" id="setting_invoice_prefix" class="form-input" value="${settings.invoice_prefix || 'SGB'}">
            </div>
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Default GST Rate (%)</label>
                <input type="number" id="setting_gst_rate" class="form-input" value="${settings.gst_rate || 18}">
            </div>
            <div style="margin-bottom: 1.5rem;">
                <label style="display:block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">Last Invoice Number (Sequence)</label>
                <input type="number" id="setting_last_invoice_num" class="form-input" value="${settings.last_invoice_num || 0}">
                <p style="font-size: 0.7rem; color: #ef4444; margin-top: 0.25rem;">⚠️ Only change this to fix sequence gaps. Be careful.</p>
            </div>
            <button class="btn-billing primary" style="max-width: 250px;" onclick="saveSettings()">Save Configuration</button>
        `;
    } catch (err) {
        container.innerHTML = '<p style="color: #ef4444;">Failed to load settings.</p>';
    }
}

async function saveSettings() {
    try {
        const data = {
            company_state: document.getElementById('setting_company_state').value,
            invoice_prefix: document.getElementById('setting_invoice_prefix').value,
            gst_rate: document.getElementById('setting_gst_rate').value,
            last_invoice_num: document.getElementById('setting_last_invoice_num').value
        };

        const res = await fetch(`${BILLING_API_URL}/settings`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert('Settings saved!');
            loadSettings();
        } else {
            alert('Failed to save settings.');
        }
    } catch (err) {
        alert('Error saving settings.');
    }
}

// ─── Auto Fill Logic ─────────────────────────────────────────

window.fetchPincodeDetails = async function(pincode) {
    if (!pincode || pincode.length !== 6) return;
    
    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await res.json();
        
        if (data && data[0] && data[0].Status === 'Success') {
            const postOffices = data[0].PostOffice;
            const state = postOffices[0].State;
            const district = postOffices[0].District;
            
            document.getElementById('billCustomerState').value = state;
            document.getElementById('billCustomerDistrict').value = district;
            
            const villageSelect = document.getElementById('billCustomerVillage');
            if (villageSelect) {
                villageSelect.innerHTML = postOffices.map(po => `<option value="${po.Name}">${po.Name}</option>`).join('');
                if (postOffices.length > 0) {
                    villageSelect.value = postOffices[0].Name; // Force selection
                }
            }
            
            if (typeof autoFormatAddress === 'function') autoFormatAddress();
        }
    } catch (e) {
        console.error('Failed to fetch pincode details', e);
    }
};

window.autoFormatAddress = function() {
    const village = document.getElementById('billCustomerVillage')?.value || '';
    const district = document.getElementById('billCustomerDistrict')?.value || '';
    const state = document.getElementById('billCustomerState')?.value || '';
    const pincode = document.getElementById('billCustomerPincode')?.value || '';
    const phone = document.getElementById('billCustomerPhone')?.value || '';
    
    const parts = [];
    if (village && village !== 'Select Village') parts.push(village);
    if (district) parts.push(district);
    if (state) parts.push(state);
    
    let addressStr = parts.join(', ');
    if (pincode) addressStr += ` - ${pincode}`;
    if (phone) addressStr += `\nPh: ${phone}`;
    
    const addressInput = document.getElementById('billCustomerAddress');
    if (addressInput) {
        addressInput.value = addressStr;
    }
};

window.hardDeleteInvoice = async function(invoiceId, invoiceNumber) {
    if (!confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY HARD-DELETE Invoice ${invoiceNumber} from the CRM DB?\n\nThis action CANNOT be undone. The invoice, invoice items, and related pending packing records will be completely removed from the database.`)) {
        return;
    }

    try {
        const res = await fetch(`${BILLING_API_URL}/invoices/${invoiceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await res.json();
        if (res.ok && data.success) {
            alert(`✅ ${data.message || 'Invoice deleted successfully'}`);
            if (typeof loadInvoices === 'function') loadInvoices();
        } else {
            alert(`Error: ${data.message || 'Failed to delete invoice'}`);
        }
    } catch (err) {
        alert('Server/Network Error: ' + err.message);
    }
};


// ==========================================
// ZOHO BOOKS 1:1 ACTIONS HANDLERS (CRM & ZOHO SYNC)
// ==========================================

let activeZohoSoPayload = null;

// Store payload reference when rendering workstation
const origRenderZohoSo = window.renderZohoSoDetailsWorkstation;
window.renderZohoSoDetailsWorkstation = function(payload) {
    activeZohoSoPayload = payload;
    origRenderZohoSo(payload);
};

window.toggleZohoSoMoreMenu = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('soMoreDropdownMenu');
    if (menu) {
        menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none';
    }
};

document.addEventListener('click', function(e) {
    const menu = document.getElementById('soMoreDropdownMenu');
    const btn = document.getElementById('btnSoMoreActions');
    if (menu && menu.style.display === 'block') {
        if (!menu.contains(e.target) && !btn?.contains(e.target)) {
            menu.style.display = 'none';
        }
    }
});

// 1. Download official PDF from Zoho Books
window.downloadZohoSoPdf = async function(soNumber) {
    const btn = document.getElementById('btnSoPdfPrint');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing PDF...';
    }

    try {
        const res = await fetch(`${BILLING_API_URL}/sales-orders/${encodeURIComponent(soNumber)}/pdf`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            // Fallback to browser print if Zoho PDF not available
            window.print();
            return;
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SalesOrder_${soNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (err) {
        console.warn('PDF fetch error, falling back to print:', err.message);
        window.print();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

// 2. Mark shipment as fulfilled (CRM & Zoho sync)
window.fulfillCurrentSalesOrder = async function(soNumber) {
    const menu = document.getElementById('soMoreDropdownMenu');
    if (menu) menu.style.display = 'none';

    if (!confirm(`Are you sure you want to mark Sales Order "${soNumber}" shipment as Fulfilled?\n\nThis will update CRM shipping/packing and synchronize fulfillment status with Zoho Books.`)) {
        return;
    }

    try {
        const res = await fetch(`${BILLING_API_URL}/sales-orders/${encodeURIComponent(soNumber)}/fulfill`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                delivery_method: activeZohoSoPayload?.zoho_salesorder?.delivery_method || 'Post'
            })
        });

        const data = await res.json();
        if (data.success) {
            alert(`✅ ${data.message}`);
            // Refresh details and lists
            viewSalesOrderDetails(soNumber);
            if (typeof loadSalesOrdersList === 'function') loadSalesOrdersList();
        } else {
            alert('Error: ' + (data.message || 'Failed to mark as fulfilled'));
        }
    } catch (err) {
        alert('Server/Network Error: ' + err.message);
    }
};

// 3. Cancel Items Modal Dialog & Handler
window.openCancelItemsModal = function(soNumber) {
    const menu = document.getElementById('soMoreDropdownMenu');
    if (menu) menu.style.display = 'none';

    const zSo = activeZohoSoPayload?.zoho_salesorder;
    const items = (zSo?.line_items && zSo.line_items.length > 0)
        ? zSo.line_items
        : (activeZohoSoPayload?.items || []);

    if (items.length === 0) {
        alert('No line items found to cancel.');
        return;
    }

    const itemsHtml = items.map((it, idx) => `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.6rem; cursor: pointer; background: #f8fafc;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#f8fafc'">
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" class="so-cancel-item-cb" value="${it.line_item_id || it.item_id || it.product_id}" style="width: 18px; height: 18px; cursor: pointer;">
                <div>
                    <strong style="color: #0f172a; font-size: 0.9rem;">${it.name || it.product_name || 'Item'}</strong>
                    <div style="font-size: 0.78rem; color: #64748b;">Qty: ${it.quantity} | Rate: ₹${parseFloat(it.rate || it.price || 0).toLocaleString()}</div>
                </div>
            </div>
            <span style="font-weight: 800; color: #ef4444; font-size: 0.9rem;">
                ₹${parseFloat(it.item_total || (it.rate * it.quantity) || 0).toLocaleString()}
            </span>
        </label>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'cancelItemsModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); z-index: 100000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    modal.innerHTML = `
        <div style="background: white; border-radius: 14px; width: 90%; max-width: 520px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.25); display: flex; flex-direction: column;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-ban" style="color: #f59e0b;"></i> Cancel Items - ${soNumber}
                </h3>
                <button type="button" onclick="document.getElementById('cancelItemsModal')?.remove()" style="border: none; background: transparent; font-size: 1.5rem; color: #94a3b8; cursor: pointer;">&times;</button>
            </div>
            
            <div style="padding: 1.5rem; max-height: 55vh; overflow-y: auto;">
                <p style="font-size: 0.85rem; color: #64748b; margin-top: 0; margin-bottom: 1rem;">
                    Select the line item(s) you wish to cancel. The order totals will be re-calculated and synchronized with Zoho Books:
                </p>
                <div id="cancelItemsList">
                    ${itemsHtml}
                </div>
                <div style="margin-top: 1rem;">
                    <label style="font-size: 0.8rem; font-weight: 700; color: #475569;">Cancellation Reason (Optional)</label>
                    <input type="text" id="soCancelReasonInput" placeholder="e.g. Out of stock, customer requested removal" style="width: 100%; padding: 0.55rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 4px; font-size: 0.85rem; box-sizing: border-box; outline: none;">
                </div>
            </div>

            <div style="padding: 1rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.75rem;">
                <button type="button" onclick="document.getElementById('cancelItemsModal')?.remove()" class="btn-billing secondary" style="padding: 0.55rem 1.25rem;">Cancel</button>
                <button type="button" id="btnConfirmCancelItems" onclick="submitCancelItems('${soNumber}')" class="btn-billing" style="padding: 0.55rem 1.5rem; background: #ef4444; color: white; font-weight: 700; border: none; border-radius: 8px; cursor: pointer;">
                    Confirm & Cancel Items
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
};

window.submitCancelItems = async function(soNumber) {
    const checkboxes = document.querySelectorAll('.so-cancel-item-cb:checked');
    if (checkboxes.length === 0) {
        alert('Please check at least one item to cancel.');
        return;
    }

    const itemIds = Array.from(checkboxes).map(cb => cb.value);
    const reason = document.getElementById('soCancelReasonInput')?.value?.trim();

    const btn = document.getElementById('btnConfirmCancelItems');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling...';
    }

    try {
        const res = await fetch(`${BILLING_API_URL}/sales-orders/${encodeURIComponent(soNumber)}/cancel-items`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ item_ids: itemIds, reason })
        });

        const data = await res.json();
        if (data.success) {
            document.getElementById('cancelItemsModal')?.remove();
            alert(`✅ ${data.message}`);
            viewSalesOrderDetails(soNumber);
            if (typeof loadSalesOrdersList === 'function') loadSalesOrdersList();
        } else {
            alert('Error: ' + (data.message || 'Failed to cancel items'));
        }
    } catch (err) {
        alert('Server/Network Error: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Confirm & Cancel Items';
        }
    }
};

// 4. Hard Delete Sales Order (2-way sync: CRM DB & Zoho Books)
window.hardDeleteSalesOrderBoth = async function(soNumber, orderId) {
    const menu = document.getElementById('soMoreDropdownMenu');
    if (menu) menu.style.display = 'none';

    const confirmMsg = `⚠️ PERMANENT DELETE WARNING:
Are you sure you want to hard delete Sales Order "${soNumber}"?

This will permanently:
1. Delete the Sales Order from Zoho Books.
2. Delete the Sales Order records from CRM database.`;

    if (!confirm(confirmMsg)) return;

    try {
        const res = await fetch(`${BILLING_API_URL}/sales-orders/${encodeURIComponent(soNumber)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        const data = await res.json();
        if (res.ok && data.success) {
            closeZohoSoDetails();
            alert(`✅ ${data.message}`);
            if (typeof loadSalesOrdersList === 'function') loadSalesOrdersList();
            if (typeof loadPendingOrders === 'function') loadPendingOrders();
        } else {
            alert('Delete Error: ' + (data.message || 'Failed to delete Sales Order'));
        }
    } catch (err) {
        alert('Server/Network Error: ' + err.message);
    }
};

// 5. Edit Sales Order (Opens Edit Workstation)
window.editCurrentSalesOrder = function(soNumber) {
    if (!activeZohoSoPayload) return;
    const crmOrder = activeZohoSoPayload.order;
    const zSo = activeZohoSoPayload.zoho_salesorder;

    // Set currentOrder context for editing
    window.currentOrder = crmOrder || {
        order_id: null,
        sales_order_number: soNumber,
        zoho_salesorder_id: zSo?.salesorder_id,
        customer_name: zSo?.customer_name,
        phone: zSo?.cf_contact || zSo?.billing_address?.phone || '',
        advance_amount: 0,
        items: (zSo?.line_items || []).map(li => ({
            product_id: 14,
            product_name: li.name,
            name: li.name,
            rate: li.rate,
            quantity: li.quantity,
            tax_id: li.tax_id
        }))
    };

    closeZohoSoDetails();
    if (crmOrder && crmOrder.order_id) {
        window.switchWorkstationStep(2);
        const modal = document.getElementById('billingModal');
        if (modal) modal.style.display = 'flex';
    } else {
        window.openDirectSalesOrderModal();
    }
};

window.toggleConvertDropdown = function(e) {
    if (e) e.stopPropagation();
    const drop = document.getElementById('soConvertDropdownMenu');
    if (drop) {
        drop.style.display = (drop.style.display === 'none' || !drop.style.display) ? 'block' : 'none';
    }
};

document.addEventListener('click', function(e) {
    const drop = document.getElementById('soConvertDropdownMenu');
    if (drop && drop.style.display === 'block') {
        drop.style.display = 'none';
    }
});
