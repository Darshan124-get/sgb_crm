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

function renderSalesOrderStep(data) {
    const items = data.items || [];
    const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.quantity, 10)), 0);
    const grandTotal = subtotal - (parseFloat(data.discount) || 0) + (parseFloat(data.shipping_charges) || 0) + (parseFloat(data.extra_charges) || 0);
    const verifiedTotal = (data.payments || []).reduce((sum, p) => {
        if (p.payment_status === 'verified' || p.verified === 'yes') return sum + parseFloat(p.amount);
        return sum;
    }, 0);
    const advancePaid = Math.max(verifiedTotal, parseFloat(data.advance_amount) || 0);
    const balanceDue = Math.max(0, grandTotal - advancePaid);

    data.grandTotal = grandTotal;
    data.balanceDue = balanceDue;
    data.advance_amount = advancePaid;

    return `
        <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); max-height: 75vh; overflow-y: auto;">
            <!-- Verified Customer Summary Card -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 4px;">
                        <span style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${data.customer_name || 'Customer'}</span>
                        <span style="font-size: 0.72rem; background: #dcfce7; color: #166534; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                            <i class="fa-solid fa-check"></i> Zoho Contact: ${data.zoho_contact_id || 'Linked'}
                        </span>
                    </div>
                    <div style="color: #64748b; font-size: 0.85rem;">
                        <i class="fa-solid fa-phone" style="margin-right: 4px;"></i> ${data.phone || 'N/A'} &nbsp;|&nbsp; 
                        <i class="fa-solid fa-location-dot" style="margin-right: 4px;"></i> ${data.city || ''}, ${data.state || ''} ${data.pincode ? '-' + data.pincode : ''}
                    </div>
                </div>

                <button type="button" onclick="switchWorkstationStep(1)" style="background: white; border: 1px solid #cbd5e1; color: #3b82f6; font-size: 0.8rem; font-weight: 700; padding: 0.45rem 0.9rem; border-radius: 8px; cursor: pointer;">
                    <i class="fa-solid fa-pen-to-square"></i> Edit Customer
                </button>
            </div>

            <!-- Product Items Section -->
            <h3 style="margin: 0 0 1rem 0; color: #1e293b; font-weight: 800; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fas fa-box" style="color: #10b981; margin-right: 0.5rem;"></i> Order Items</span>
                <span style="font-size: 0.8rem; font-weight: 600; color: #64748b;">${items.length} item(s)</span>
            </h3>

            <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 1.5rem;">
                <table class="edit-table" style="margin: 0; width: 100%;">
                    <thead style="background: #f8fafc;">
                        <tr>
                            <th style="padding: 0.85rem 1rem; text-align: left;">Product</th>
                            <th style="width: 140px; text-align: right; padding: 0.85rem 1rem;">Unit Price</th>
                            <th style="width: 100px; text-align: center; padding: 0.85rem 1rem;">Quantity</th>
                            <th style="width: 140px; text-align: right; padding: 0.85rem 1rem;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.length > 0 ? items.map((item, idx) => `
                            <tr style="border-top: 1px solid #e2e8f0;">
                                <td style="padding: 1rem; font-weight: 700;">
                                    ${item.product_name}
                                    <div style="font-size: 0.72rem; color: #64748b; font-weight: 500;">SKU: ${item.sku || 'N/A'}</div>
                                </td>
                                <td style="text-align: right; font-weight: 600; padding: 1rem;">
                                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.25rem;">
                                        <span>₹</span>
                                        <input type="number" value="${item.price}" oninput="updateOrderItemPrice(${idx}, this.value)" style="width: 90px; text-align: right; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; outline: none;">
                                    </div>
                                </td>
                                <td style="text-align: center; font-weight: 800; padding: 1rem;">
                                    <input type="number" min="1" value="${item.quantity}" oninput="updateOrderItemQty(${idx}, this.value)" style="width: 60px; text-align: center; padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 800; outline: none;">
                                </td>
                                <td style="text-align: right; font-weight: 800; color: #0f172a; padding: 1rem;">
                                    ₹${(parseFloat(item.price) * parseInt(item.quantity, 10)).toLocaleString()}
                                </td>
                            </tr>
                        `).join('') : `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #64748b;">No items in order.</td></tr>`}
                    </tbody>
                </table>
            </div>

            <!-- Summary & Adjustments -->
            <div style="display: flex; justify-content: flex-end; gap: 2.5rem; background: #f8fafc; padding: 1.5rem 2rem; border-radius: 10px; border: 1px solid #e2e8f0; align-items: center; flex-wrap: wrap;">
                <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Discount</div>
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;">
                        <span style="font-weight: 800; color: #ef4444;">-₹</span>
                        <input type="number" id="editableDiscount" value="${data.discount || 0}" oninput="updateDiscount(this.value)" style="width: 90px; padding: 0.3rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 800; text-align: right; color: #ef4444; outline: none;">
                    </div>
                </div>

                <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Value</div>
                    <div id="displayGrandTotal" style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">₹${grandTotal.toLocaleString()}</div>
                </div>

                <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Advance Paid</div>
                    <div style="font-size: 1.25rem; font-weight: 800; color: #10b981;">₹${advancePaid.toLocaleString()}</div>
                </div>

                <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Balance COD Due</div>
                    <div id="displayBalanceDue" style="font-size: 1.45rem; font-weight: 900; color: ${balanceDue > 0 ? '#ef4444' : '#10b981'};">₹${balanceDue.toLocaleString()}</div>
                </div>
            </div>

            <!-- ACTION FOOTER FOR STEP 2 -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <button type="button" onclick="switchWorkstationStep(1)" style="padding: 0.75rem 1.5rem; background: white; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; cursor: pointer;">
                    ⬅ Back to Customer Info
                </button>

                <div style="display: flex; gap: 1rem;">
                    <button type="button" onclick="approveSalesOrder()" class="btn-billing primary" style="padding: 0.75rem 2.2rem; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                        <i class="fa-solid fa-check-double"></i> Approve & Create Sales Order
                    </button>
                </div>
            </div>
        </div>
    `;
}

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
                `<button class="btn-billing success" style="width: auto; padding: 0.5rem 1rem;" onclick="finalizeInvoice(${inv.invoice_id})">Finalize</button>` :
                `<div style="display:flex; gap:0.5rem;">
                            <button class="btn-billing primary" style="width: auto; padding: 0.5rem 0.75rem;" title="View Invoice" onclick="viewInvoice(${inv.invoice_id})"><i class="fas fa-eye"></i></button>
                            <button class="btn-billing success" style="width: auto; padding: 0.5rem 0.75rem;" title="Print/Download" onclick="printInvoice(${inv.invoice_id})"><i class="fas fa-print"></i></button>
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
