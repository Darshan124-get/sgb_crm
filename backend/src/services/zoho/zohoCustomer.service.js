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

    /**
     * Fetch paginated list of customers from Zoho Books
     */
    async getCustomersList({ page = 1, limit = 25, search = '' } = {}) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured in environment');

        const headers = await zohoAuth.getAuthHeaders();
        const q = (search || '').trim();

        // If search query is provided, check if it is digits (phone) or name/company/email
        if (q) {
            const isOnlyDigits = /^\d+$/.test(q);
            let searchUrls = [];
            if (isOnlyDigits) {
                searchUrls.push(`${zohoAuth.apiDomain}/contacts?organization_id=${orgId}&contact_type=customer&page=${page}&per_page=${limit}&phone_contains=${encodeURIComponent(q)}`);
                searchUrls.push(`${zohoAuth.apiDomain}/contacts?organization_id=${orgId}&contact_type=customer&page=${page}&per_page=${limit}&contact_name_contains=${encodeURIComponent(q)}`);
            } else {
                searchUrls.push(`${zohoAuth.apiDomain}/contacts?organization_id=${orgId}&contact_type=customer&page=${page}&per_page=${limit}&contact_name_contains=${encodeURIComponent(q)}`);
                searchUrls.push(`${zohoAuth.apiDomain}/contacts?organization_id=${orgId}&contact_type=customer&page=${page}&per_page=${limit}&company_name_contains=${encodeURIComponent(q)}`);
            }

            const seenIds = new Set();
            const combinedContacts = [];
            let finalPageContext = { page, per_page: limit, has_more_page: false };

            for (const sUrl of searchUrls) {
                try {
                    const resp = await axios.get(sUrl, { headers });
                    if (resp.data && resp.data.code === 0 && Array.isArray(resp.data.contacts)) {
                        for (const contact of resp.data.contacts) {
                            if (!seenIds.has(contact.contact_id)) {
                                seenIds.add(contact.contact_id);
                                combinedContacts.push(contact);
                            }
                        }
                        if (resp.data.page_context) {
                            finalPageContext = resp.data.page_context;
                        }
                    }
                } catch (err) {
                    console.warn(`Search URL [${sUrl}] failed:`, err.message);
                }
            }

            return {
                contacts: combinedContacts,
                page_context: finalPageContext
            };
        }

        // Default paginated customer list when no search query is present
        const url = `${zohoAuth.apiDomain}/contacts?organization_id=${orgId}&contact_type=customer&page=${page}&per_page=${limit}&sort_column=created_time&sort_order=D`;
        const response = await axios.get(url, { headers });
        if (response.data && response.data.code === 0) {
            return {
                contacts: response.data.contacts || [],
                page_context: response.data.page_context || { page, per_page: limit, has_more_page: false }
            };
        } else {
            throw new Error(response.data?.message || 'Failed to fetch contacts from Zoho Books');
        }
    }

    /**
     * Fetch customer full details by contact ID
     */
    async getCustomerDetails(contactId) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured in environment');

        const headers = await zohoAuth.getAuthHeaders();
        const response = await axios.get(`${zohoAuth.apiDomain}/contacts/${contactId}?organization_id=${orgId}`, { headers });
        if (response.data && response.data.code === 0) {
            return response.data.contact;
        } else {
            throw new Error(response.data?.message || 'Failed to fetch contact details from Zoho Books');
        }
    }

    /**
     * Fetch customer activity timeline / comments
     */
    async getCustomerTimeline(contactId) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured in environment');

        const headers = await zohoAuth.getAuthHeaders();
        const response = await axios.get(`${zohoAuth.apiDomain}/contacts/${contactId}/comments?organization_id=${orgId}`, { headers });
        if (response.data && response.data.code === 0) {
            return response.data.contact_comments || [];
        } else {
            return [];
        }
    }

    /**
     * Create direct customer in Zoho Books (without requiring an order)
     */
    async createDirectCustomer(customerData, userId = 1) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured in environment');

        const headers = await zohoAuth.getAuthHeaders();

        const contactName = (customerData.display_name || customerData.customer_name || 'Customer').trim();
        const customerSubType = customerData.customer_type === 'business' ? 'business' : 'individual';

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
            notes: 'Created directly via SGB Agro CRM Customers Directory'
        };

        if (customerData.payment_terms !== undefined && customerData.payment_terms !== '') {
            contactPayload.payment_terms = parseInt(customerData.payment_terms, 10) || 0;
        }

        let response;
        try {
            response = await axios.post(
                `${zohoAuth.apiDomain}/contacts?organization_id=${orgId}`,
                contactPayload,
                { headers }
            );
        } catch (apiErr) {
            const zohoErr = apiErr.response?.data;
            if (zohoErr && (zohoErr.code === 3062 || (zohoErr.message && zohoErr.message.toLowerCase().includes('already exists')))) {
                console.log(`[ZOHO CUSTOMER CONFLICT] Contact "${contactName}" already exists in Zoho Books. Searching details...`);
                let existingContact = null;
                try {
                    const searchRes = await axios.get(
                        `${zohoAuth.apiDomain}/contacts?organization_id=${orgId}&contact_name=${encodeURIComponent(contactName)}`,
                        { headers }
                    );
                    const contacts = searchRes.data?.contacts || [];
                    if (contacts.length > 0) {
                        existingContact = contacts[0];
                    }
                } catch (sErr) {
                    console.warn('Search for conflicting contact failed:', sErr.message);
                }

                const existingPhone = (existingContact?.mobile || existingContact?.phone || '').trim();
                const newPhone = phone.trim();
                const cleanExisting = existingPhone.replace(/\D/g, '');
                const cleanNew = newPhone.replace(/\D/g, '');
                const isPhoneMatch = Boolean(cleanExisting && cleanNew && (
                    cleanExisting === cleanNew ||
                    cleanExisting.endsWith(cleanNew) ||
                    cleanNew.endsWith(cleanExisting)
                ));

                const conflictError = new Error(zohoErr.message || `The customer "${contactName}" already exists in Zoho Books.`);
                conflictError.code = 3062;
                conflictError.is_duplicate = true;
                conflictError.existing_contact = existingContact ? {
                    contact_id: existingContact.contact_id,
                    contact_name: existingContact.contact_name,
                    phone: existingContact.phone,
                    mobile: existingContact.mobile,
                    email: existingContact.email,
                    company_name: existingContact.company_name,
                    is_phone_match: isPhoneMatch
                } : null;
                conflictError.entered_phone = newPhone;
                conflictError.suggested_name = newPhone ? `${contactName} (${newPhone})` : `${contactName} (2)`;
                throw conflictError;
            }
            throw new Error(zohoErr?.message || apiErr.message);
        }

        if (response.data && response.data.code === 0 && response.data.contact) {
            return {
                success: true,
                contact_id: response.data.contact.contact_id,
                contact_name: response.data.contact.contact_name,
                customer: response.data.contact
            };
        } else {
            throw new Error(response.data?.message || 'Failed to create customer in Zoho Books');
        }
    }


    /**
     * Update an existing Customer Contact in Zoho Books and CRM DB
     * @param {string} contactId 
     * @param {object} customerData 
     * @param {number} userId 
     */
    async updateCustomer(contactId, customerData, userId = 1) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured in environment');

        const headers = await zohoAuth.getAuthHeaders();

        const contactName = (customerData.display_name || customerData.contact_name || customerData.customer_name || '').trim();
        const customerSubType = customerData.customer_type === 'business' ? 'business' : 'individual';

        let firstName = (customerData.first_name || '').trim();
        let lastName = (customerData.last_name || '').trim();
        if (!firstName && contactName) {
            const parts = contactName.split(' ');
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        }

        const phone = (customerData.phone || customerData.mobile || '').trim();
        const stateName = customerData.billing_state || customerData.state || 'Karnataka';
        const placeOfSupply = customerData.place_of_supply ? resolveStateCode(customerData.place_of_supply) : resolveStateCode(stateName);

        const contactPayload = {
            contact_name: contactName,
            company_name: customerData.company_name || '',
            customer_sub_type: customerSubType,
            contact_type: 'customer',
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
            }
        };

        if (firstName || lastName || phone || customerData.email) {
            contactPayload.contact_persons = [
                {
                    salutation: customerData.salutation || '',
                    first_name: firstName,
                    last_name: lastName,
                    email: customerData.email || '',
                    mobile: phone,
                    is_primary_contact: true
                }
            ];
        }

        const response = await axios.put(
            `${zohoAuth.apiDomain}/contacts/${contactId}?organization_id=${orgId}`,
            contactPayload,
            { headers }
        );

        if (response.data && response.data.code === 0) {
            try {
                await pool.query(
                    `UPDATE orders SET 
                        customer_name = COALESCE(?, customer_name), 
                        phone = COALESCE(?, phone), 
                        address = COALESCE(?, address), 
                        city = COALESCE(?, city), 
                        state = COALESCE(?, state), 
                        pincode = COALESCE(?, pincode) 
                     WHERE zoho_contact_id = ?`,
                    [contactName, phone, contactPayload.billing_address.address, contactPayload.billing_address.city, stateName, contactPayload.billing_address.zip, contactId]
                );
            } catch (dbErr) {
                console.warn('Could not sync customer update to orders table:', dbErr.message);
            }
            return {
                success: true,
                message: 'Customer updated successfully in Zoho Books and CRM',
                contact: response.data.contact
            };
        } else {
            throw new Error(response.data?.message || 'Failed to update customer in Zoho Books');
        }
    }

    /**
     * Mark customer inactive in Zoho Books
     * @param {string} contactId 
     */
    async markCustomerInactive(contactId) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured in environment');

        const headers = await zohoAuth.getAuthHeaders();
        const response = await axios.post(
            `${zohoAuth.apiDomain}/contacts/${contactId}/inactive?organization_id=${orgId}`,
            {},
            { headers }
        );

        if (response.data && response.data.code === 0) {
            try {
                await pool.query(
                    'UPDATE orders SET zoho_contact_id = NULL WHERE zoho_contact_id = ?',
                    [contactId]
                );
            } catch (dbErr) {
                console.warn('Could not unlink zoho_contact_id in orders:', dbErr.message);
            }
            return {
                success: true,
                is_inactive: true,
                message: 'Customer has active transactions in Zoho Books so was marked Inactive and unlinked from CRM.'
            };
        } else {
            throw new Error(response.data?.message || 'Failed to mark customer inactive in Zoho Books');
        }
    }

    /**
     * Delete Customer from Zoho Books & CRM DB
     * If transactions exist, allows fallback/action to mark inactive.
     * @param {string} contactId 
     * @param {string} action
     * @param {number} userId 
     */
    async deleteCustomer(contactId, action = '', userId = 1) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured in environment');

        if (action === 'mark_inactive') {
            return await this.markCustomerInactive(contactId);
        }

        const headers = await zohoAuth.getAuthHeaders();

        try {
            const response = await axios.delete(
                `${zohoAuth.apiDomain}/contacts/${contactId}?organization_id=${orgId}`,
                { headers }
            );

            if (response.data && response.data.code === 0) {
                try {
                    await pool.query(
                        'UPDATE orders SET zoho_contact_id = NULL WHERE zoho_contact_id = ?',
                        [contactId]
                    );
                } catch (dbErr) {
                    console.warn('Could not unlink zoho_contact_id in orders:', dbErr.message);
                }
                return {
                    success: true,
                    message: 'Customer permanently deleted from Zoho Books and unlinked from CRM'
                };
            } else {
                throw new Error(response.data?.message || 'Failed to delete customer from Zoho Books');
            }
        } catch (err) {
            // Check if Zoho Books rejected because documents/transactions are attached (Code 3000)
            const zohoData = err.response?.data;
            if (zohoData && (zohoData.code === 3000 || (zohoData.message && zohoData.message.includes('associated either with some documents or transactions')))) {
                const customErr = new Error(zohoData.message || 'These contacts cannot be deleted as they are associated with documents or transactions.');
                customErr.code = 3000;
                customErr.has_transactions = true;
                throw customErr;
            }
            throw new Error(zohoData?.message || err.message);
        }
    }

}

const serviceInstance = new ZohoCustomerService();
serviceInstance.resolveStateCode = resolveStateCode;
module.exports = serviceInstance;
