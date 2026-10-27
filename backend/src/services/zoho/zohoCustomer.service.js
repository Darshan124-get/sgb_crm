const axios = require('axios');
const zohoAuth = require('./zohoAuth.service');
const pool = require('../../config/db');

// Indian State to 2-letter Code mapping for Zoho Books
const STATE_CODE_MAP = {
    'andhra pradesh': 'AP', 'arunachal pradesh': 'AR', 'assam': 'AS', 'bihar': 'BR',
    'chhattisgarh': 'CG', 'goa': 'GA', 'gujarat': 'GJ', 'haryana': 'HR',
    'himachal pradesh': 'HP', 'jharkhand': 'JH', 'karnataka': 'KA', 'kerala': 'KL',
    'madhya pradesh': 'MP', 'maharashtra': 'MH', 'manipur': 'MN', 'meghalaya': 'ML',
    'mizoram': 'MZ', 'nagaland': 'NL', 'odisha': 'OR', 'punjab': 'PB',
    'rajasthan': 'RJ', 'sikkim': 'SK', 'tamil nadu': 'TN', 'telangana': 'TG',
    'tripura': 'TR', 'uttar pradesh': 'UP', 'uttarakhand': 'UK', 'west bengal': 'WB',
    'andaman and nicobar islands': 'AN', 'chandigarh': 'CH',
    'dadra and nagar haveli and daman and diu': 'DN', 'delhi': 'DL',
    'jammu and kashmir': 'JK', 'ladakh': 'LA', 'lakshadweep': 'LD', 'puducherry': 'PY'
};

function resolveStateCode(stateName) {
    if (!stateName) return 'KA';
    const clean = stateName.toLowerCase().trim();
    return STATE_CODE_MAP[clean] || (stateName.length === 2 ? stateName.toUpperCase() : 'KA');
}

class ZohoCustomerService {
    /**
     * Create or Sync a Customer Contact in Zoho Books
     * @param {number} orderId 
     * @param {object} customerData 
     * @param {number} userId 
     */
    async createOrSyncCustomer(orderId, customerData, userId = 1) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured in environment');

        const headers = await zohoAuth.getAuthHeaders();

        // 1. Prepare Contact Name / Display Name
        const contactName = (customerData.display_name || customerData.customer_name || 'Customer').trim();
        const customerSubType = customerData.customer_type === 'business' ? 'business' : 'individual';

        // 2. Parse First Name & Last Name
        let firstName = (customerData.first_name || '').trim();
        let lastName = (customerData.last_name || '').trim();
        if (!firstName && customerData.customer_name) {
            const parts = customerData.customer_name.trim().split(' ');
            firstName = parts[0] || 'Customer';
            lastName = parts.slice(1).join(' ') || '';
        }

        const phone = (customerData.phone || customerData.mobile || '').trim();
        const stateName = customerData.billing_state || customerData.state || 'Karnataka';
        const placeOfSupply = customerData.place_of_supply ? resolveStateCode(customerData.place_of_supply) : resolveStateCode(stateName);

        // 3. Construct Zoho Books Contact Payload
        const contactPayload = {
            contact_name: contactName,
            company_name: customerData.company_name || '',
            customer_sub_type: customerSubType,
            contact_type: 'customer',
            contact_persons: [
                {
                    salutation: customerData.salutation || '',
                    first_name: firstName,
                    last_name: lastName,
                    email: customerData.email || '',
                    phone: customerData.work_phone || '',
                    mobile: customerData.mobile || phone || '',
                    is_primary_contact: true
                }
            ],
            gst_treatment: customerData.gst_treatment || 'consumer',
            gst_no: customerData.gst_number || customerData.gst_no || '',
            place_of_supply: placeOfSupply,
            pan_no: customerData.pan_number || customerData.pan_no || '',
            is_taxable: customerData.tax_preference !== 'tax_exempt',
            currency_code: 'INR',
            billing_address: {
                attention: customerData.billing_attention || contactName,
                address: customerData.billing_address || customerData.address || '',
                street2: customerData.billing_street2 || customerData.village || '',
                city: customerData.billing_city || customerData.city || customerData.district || '',
                state: stateName,
                zip: customerData.billing_pincode || customerData.pincode || '',
                country: 'India',
                phone: customerData.billing_phone || phone
            },
            shipping_address: {
                attention: customerData.shipping_attention || customerData.billing_attention || contactName,
                address: customerData.shipping_address || customerData.billing_address || customerData.address || '',
                street2: customerData.shipping_street2 || customerData.billing_street2 || customerData.village || '',
                city: customerData.shipping_city || customerData.billing_city || customerData.city || '',
                state: customerData.shipping_state || stateName,
                zip: customerData.shipping_pincode || customerData.billing_pincode || customerData.pincode || '',
                country: 'India',
                phone: customerData.shipping_phone || phone
            },
            notes: `Created via SGB Agro CRM from Order #${orderId}`
        };

        if (customerData.payment_terms) {
            contactPayload.payment_terms = parseInt(customerData.payment_terms, 10) || 0;
        }

        console.log(`[ZOHO CUSTOMER] Creating contact "${contactName}" for Order #${orderId}...`);

        let zohoContact = null;
        try {
            const response = await axios.post(
                `${zohoAuth.apiDomain}/contacts?organization_id=${orgId}`,
                contactPayload,
                { headers }
            );

            if (response.data.code === 0 && response.data.contact) {
                zohoContact = response.data.contact;
                console.log(`[ZOHO CUSTOMER] Contact created successfully! ID: ${zohoContact.contact_id}`);
            } else {
                throw new Error(response.data.message || 'Unknown response from Zoho Books');
            }
        } catch (apiErr) {
            const errMsg = apiErr.response?.data?.message || apiErr.message;
            console.error(`[ZOHO CUSTOMER ERROR] Failed to create contact: ${errMsg}`);

            // If contact already exists in Zoho (e.g. duplicate name or phone), search for it
            if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('duplicate')) {
                console.log(`[ZOHO CUSTOMER] Searching existing contact for "${contactName}"...`);
                try {
                    const searchRes = await axios.get(
                        `${zohoAuth.apiDomain}/contacts?organization_id=${orgId}&contact_name=${encodeURIComponent(contactName)}`,
                        { headers }
                    );
                    if (searchRes.data.contacts && searchRes.data.contacts.length > 0) {
                        zohoContact = searchRes.data.contacts[0];
                        console.log(`[ZOHO CUSTOMER] Reusing existing contact: ${zohoContact.contact_id}`);
                    }
                } catch (searchErr) {
                    // Fallthrough to throw original error
                }
            }

            if (!zohoContact) {
                throw new Error(`Zoho Books Error: ${errMsg}`);
            }
        }

        // 4. Update Order record with Zoho Contact ID & Customer Details
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.query(`
                UPDATE orders SET 
                    zoho_contact_id = ?,
                    customer_type = ?,
                    company_name = ?,
                    email = ?,
                    gst_treatment = ?,
                    place_of_supply = ?,
                    pan_number = ?,
                    customer_name = ?,
                    phone = ?,
                    address = ?,
                    city = ?,
                    state = ?,
                    pincode = ?,
                    shipping_name = ?,
                    shipping_address = ?,
                    shipping_city = ?,
                    shipping_state = ?,
                    shipping_pincode = ?
                WHERE order_id = ?
            `, [
                zohoContact.contact_id,
                customerSubType,
                customerData.company_name || null,
                customerData.email || null,
                customerData.gst_treatment || 'consumer',
                placeOfSupply,
                customerData.pan_number || null,
                contactName,
                phone,
                customerData.billing_address || customerData.address || '',
                customerData.billing_city || customerData.city || '',
                stateName,
                customerData.billing_pincode || customerData.pincode || '',
                contactPayload.shipping_address.attention,
                contactPayload.shipping_address.address,
                contactPayload.shipping_address.city,
                contactPayload.shipping_address.state,
                contactPayload.shipping_address.zip,
                orderId
            ]);

            // Audit log
            try {
                await connection.query(`
                    INSERT INTO invoice_logs (order_id, action, new_value, changed_by)
                    VALUES (?, 'ZOHO_CUSTOMER_CREATED', ?, ?)
                `, [
                    orderId,
                    JSON.stringify({
                        zoho_contact_id: zohoContact.contact_id,
                        contact_name: zohoContact.contact_name,
                        gst_treatment: customerData.gst_treatment
                    }),
                    userId
                ]);
            } catch (logErr) { }

            await connection.commit();
        } catch (dbErr) {
            await connection.rollback();
            throw dbErr;
        } finally {
            connection.release();
        }

        return {
            success: true,
            contact_id: zohoContact.contact_id,
            contact_name: zohoContact.contact_name,
            customer: zohoContact
        };
    }
}

module.exports = new ZohoCustomerService();
