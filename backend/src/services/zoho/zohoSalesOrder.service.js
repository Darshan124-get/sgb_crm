const axios = require('axios');
const zohoAuth = require('./zohoAuth.service');
const pool = require('../../config/db');

class ZohoSalesOrderService {
    /**
     * Get next suggested Sales Order number from Zoho Books or DB
     */
    async getNextSalesOrderNumber() {
        try {
            const orgId = process.env.ZOHO_ORGANIZATION_ID;
            if (orgId) {
                const headers = await zohoAuth.getAuthHeaders();
                // Sort by salesorder_number descending to find the highest number in the sequence
                const res = await axios.get(
                    `${zohoAuth.apiDomain}/salesorders?organization_id=${orgId}&sort_column=salesorder_number&sort_order=D&per_page=1`,
                    { headers }
                );
                const latest = res.data.salesorders?.[0]?.salesorder_number;
                if (latest && latest.includes('SO-')) {
                    const numPart = parseInt(latest.replace(/\D/g, ''), 10);
                    if (!isNaN(numPart)) {
                        const nextNum = String(numPart + 1).padStart(5, '0');
                        return `SO-${nextNum}`;
                    }
                }
            }
        } catch (err) {
            console.warn('[ZOHO SO] Failed to fetch latest SO number from Zoho:', err.message);
        }

        // Fallback to internal DB sequence
        const [rows] = await pool.query(`
            SELECT sales_order_number FROM orders 
            WHERE sales_order_number IS NOT NULL AND sales_order_number LIKE 'SO-%'
            ORDER BY order_id DESC LIMIT 1
        `);
        if (rows.length && rows[0].sales_order_number) {
            const numPart = parseInt(rows[0].sales_order_number.replace(/\D/g, ''), 10);
            if (!isNaN(numPart)) {
                return `SO-${String(numPart + 1).padStart(5, '0')}`;
            }
        }

        return `SO-01840`;
    }

    /**
     * Get available Sales Order metadata (Taxes, Salespersons, Delivery Methods)
     */
    async getSalesOrderMetadata() {
        let taxes = [
            { name: 'GST0', rate: 0, id: '3580403000000032424' },
            { name: 'GST5', rate: 5, id: '3580403000000032428' },
            { name: 'GST12', rate: 12, id: '3580403000000032432' },
            { name: 'GST18', rate: 18, id: '3580403000000032436' },
            { name: 'GST28', rate: 28, id: '3580403000000032444' },
            { name: 'IGST0', rate: 0, id: '3580403000000032352' },
            { name: 'IGST5', rate: 5, id: '3580403000000032354' },
            { name: 'IGST12', rate: 12, id: '3580403000000032356' },
            { name: 'IGST18', rate: 18, id: '3580403000000032360' },
            { name: 'IGST28', rate: 28, id: '3580403000000032362' }
        ];

        try {
            const orgId = process.env.ZOHO_ORGANIZATION_ID;
            if (orgId) {
                const headers = await zohoAuth.getAuthHeaders();
                const taxRes = await axios.get(`${zohoAuth.apiDomain}/settings/taxes?organization_id=${orgId}`, { headers });
                if (taxRes.data && taxRes.data.taxes && taxRes.data.taxes.length > 0) {
                    taxes = taxRes.data.taxes.map(t => ({
                        id: t.tax_id,
                        name: t.tax_name,
                        rate: t.tax_percentage
                    }));
                }
            }
        } catch (err) {
            console.warn('[ZOHO SO] Using cached taxes list:', err.message);
        }

        // Active CRM Users as Salespersons
        const [crmUsers] = await pool.query(`
            SELECT user_id, name, email FROM users 
            WHERE status = 'active' OR status IS NULL
            ORDER BY name ASC
        `);

        // Standard Salespersons seen in Zoho
        const standardSalespersons = [
            'Mandara', 'Madan', 'Kavya', 'Preetham', 'Amaresh',
            'Sujith', 'Toolsvilla', 'Abhijith', 'Vinith', 'Shashi', 'Shaila', 'Sameer', 'darshan'
        ];

        const userNames = new Set(crmUsers.map(u => u.name));
        standardSalespersons.forEach(sp => {
            if (!userNames.has(sp)) {
                crmUsers.push({ user_id: 0, name: sp, email: '' });
            }
        });

        // Delivery methods
        const deliveryMethods = ['Post', 'VRL', 'Offline', 'ST Courier', 'DTDC', 'Direct Handover'];

        // Payment terms options
        const paymentTerms = [
            { label: 'Due on Receipt', value: 0 },
            { label: 'Net 15', value: 15 },
            { label: 'Net 30', value: 30 },
            { label: 'Net 45', value: 45 },
            { label: 'Net 60', value: 60 }
        ];

        return {
            taxes,
            salespersons: crmUsers,
            deliveryMethods,
            paymentTerms
        };
    }

    /**
     * Create or Sync Sales Order to Zoho Books
     * @param {number} orderId 
     * @param {object} soData 
     * @param {number} userId 
     */
    async createOrSyncSalesOrder(orderId, soData, userId = 1) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [orders] = await connection.query('SELECT * FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
            if (!orders.length) throw new Error('Order not found');
            const order = orders[0];

            const customerId = soData.customer_id || order.zoho_contact_id;
            if (!customerId) {
                throw new Error('Customer is not yet registered in Zoho Books. Please complete Step 1 first.');
            }

            const salesOrderNumber = (soData.salesorder_number || order.sales_order_number || await this.getNextSalesOrderNumber()).trim();
            const date = soData.date || new Date().toISOString().split('T')[0];
            const shipmentDate = soData.shipment_date || null;
            const referenceNumber = soData.reference_number || `ORD-${orderId}`;
            const deliveryMethod = soData.delivery_method || order.delivery_type || 'Post';
            const salespersonName = soData.salesperson_name || '';
            const paymentTerms = parseInt(soData.payment_terms, 10) || 0;
            const contactPhone = (soData.contact_phone || order.phone || '').trim();

            const lineItems = (soData.items || []).map(item => ({
                name: item.name || item.product_name,
                description: item.description || '',
                rate: parseFloat(item.rate || item.price) || 0,
                quantity: parseFloat(item.quantity) || 1,
                tax_id: item.tax_id || undefined
            }));

            if (lineItems.length === 0) {
                throw new Error('Sales Order must contain at least one line item.');
            }

            const discount = parseFloat(soData.discount) || 0;
            const shippingCharge = parseFloat(soData.shipping_charge || soData.shipping_charges) || 0;
            const adjustment = parseFloat(soData.adjustment || soData.round_off) || 0;
            const notes = soData.notes || 'Thank you for doing business with us.';
            const terms = soData.terms || `1. Goods once sold will not be taken back or exchanged.\n2. Payment must be made within the due date mentioned on the invoice.\n3. Any dispute regarding this invoice must be raised within 7 days from the invoice date.\n4. Subject to Koppa Jurisdiction.`;

            // Construct Zoho Books payload
            const zohoPayload = {
                customer_id: customerId,
                salesorder_number: salesOrderNumber,
                reference_number: referenceNumber,
                date: date,
                delivery_method: deliveryMethod,
                notes: notes,
                terms: terms,
                is_inclusive_tax: false,
                line_items: lineItems,
                payment_terms: paymentTerms,
                discount: discount,
                is_discount_before_tax: true,
                shipping_charge: shippingCharge,
                adjustment: adjustment
            };

            if (shipmentDate) {
                zohoPayload.shipment_date = shipmentDate;
            }
            if (salespersonName) {
                zohoPayload.salesperson_name = salespersonName;
            }
            if (contactPhone) {
                zohoPayload.custom_fields = [
                    {
                        label: 'Contact',
                        value: contactPhone
                    }
                ];
            }

            console.log(`[ZOHO SO] Posting Sales Order ${salesOrderNumber} for Order #${orderId}...`);

            let zohoSalesOrder = null;
            let zohoSyncError = null;
            let finalSalesOrderNumber = salesOrderNumber;

            if (orgId && !soData.is_draft_only) {
                const headers = await zohoAuth.getAuthHeaders();

                // 1. First attempt: create with provided or suggested salesorder_number
                try {
                    const response = await axios.post(
                        `${zohoAuth.apiDomain}/salesorders?organization_id=${orgId}&ignore_auto_number_generation=true`,
                        zohoPayload,
                        { headers }
                    );

                    if (response.data && response.data.code === 0 && response.data.salesorder) {
                        zohoSalesOrder = response.data.salesorder;
                        finalSalesOrderNumber = zohoSalesOrder.salesorder_number || finalSalesOrderNumber;
                        console.log(`[ZOHO SO] Successfully created in Zoho! ID: ${zohoSalesOrder.salesorder_id}, Number: ${finalSalesOrderNumber}`);
                    }
                } catch (apiErr) {
                    const errMsg = apiErr.response?.data?.message || apiErr.message;
                    console.warn(`[ZOHO SO] First attempt failed (${finalSalesOrderNumber}): ${errMsg}`);

                    // 2. If number already exists, automatically fallback to Zoho's native auto-sequencing
                    if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('duplicate')) {
                        console.log(`[ZOHO SO] "${finalSalesOrderNumber}" already exists in Zoho. Re-trying with Zoho native auto-sequence...`);
                        try {
                            const retryPayload = { ...zohoPayload };
                            delete retryPayload.salesorder_number; // Let Zoho assign the next available unique series number

                            const retryRes = await axios.post(
                                `${zohoAuth.apiDomain}/salesorders?organization_id=${orgId}`,
                                retryPayload,
                                { headers }
                            );

                            if (retryRes.data && retryRes.data.code === 0 && retryRes.data.salesorder) {
                                zohoSalesOrder = retryRes.data.salesorder;
                                finalSalesOrderNumber = zohoSalesOrder.salesorder_number;
                                console.log(`[ZOHO SO] Retry success! Auto-assigned next series number: ${finalSalesOrderNumber} (ID: ${zohoSalesOrder.salesorder_id})`);
                            } else {
                                throw new Error(retryRes.data?.message || 'Failed during auto-sequence fallback');
                            }
                        } catch (retryErr) {
                            const retryErrMsg = retryErr.response?.data?.message || retryErr.message;
                            console.error(`[ZOHO SO ERROR] Auto-sequence fallback failed: ${retryErrMsg}`);
                            zohoSyncError = retryErrMsg;
                        }
                    } else {
                        zohoSyncError = errMsg;
                    }
                }
            }

            // Calculate total in CRM
            const subtotal = lineItems.reduce((acc, it) => acc + (it.rate * it.quantity), 0);
            const totalAmount = Math.max(0, subtotal - discount + shippingCharge + adjustment);
            const verifiedAdvance = parseFloat(order.advance_amount || 0);
            const balanceAmount = Math.max(0, totalAmount - verifiedAdvance);

            const newStatus = zohoSalesOrder ? 'approved' : (soData.is_draft_only ? 'draft' : 'approved');

            // Update CRM orders table
            await connection.query(`
                UPDATE orders SET 
                    sales_order_number = ?,
                    zoho_salesorder_id = COALESCE(?, zoho_salesorder_id),
                    order_status = ?,
                    approved_at = NOW(),
                    approved_by = ?,
                    total_amount = ?,
                    discount = ?,
                    shipping_charges = ?,
                    extra_charges = ?,
                    balance_amount = ?,
                    delivery_type = ?
                WHERE order_id = ?
            `, [
                finalSalesOrderNumber,
                zohoSalesOrder?.salesorder_id || null,
                newStatus,
                userId,
                totalAmount,
                discount,
                shippingCharge,
                adjustment,
                balanceAmount,
                deliveryMethod,
                orderId
            ]);

            // Update or replace order_items
            if (soData.items && soData.items.length > 0) {
                await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
                for (const it of soData.items) {
                    const prodId = it.product_id || 14; // fallback to valid product id
                    const qty = parseInt(it.quantity, 10) || 1;
                    const price = parseFloat(it.rate || it.price) || 0;
                    const tot = qty * price;

                    await connection.query(`
                        INSERT INTO order_items (order_id, product_id, quantity, price, total_price)
                        VALUES (?, ?, ?, ?, ?)
                    `, [orderId, prodId, qty, price, tot]);
                }
            }

            // Log action in invoice_logs
            try {
                await connection.query(`
                    INSERT INTO invoice_logs (order_id, action, new_value, changed_by)
                    VALUES (?, 'ORDER_APPROVED_TO_SALES_ORDER', ?, ?)
                `, [
                    orderId,
                    JSON.stringify({
                        sales_order_number: finalSalesOrderNumber,
                        zoho_salesorder_id: zohoSalesOrder?.salesorder_id || null,
                        total_amount: totalAmount,
                        zoho_status: zohoSalesOrder ? 'synced' : (zohoSyncError ? `failed: ${zohoSyncError}` : 'local')
                    }),
                    userId
                ]);
            } catch (lErr) { }

            await connection.commit();

            return {
                success: true,
                sales_order_number: finalSalesOrderNumber,
                zoho_salesorder_id: zohoSalesOrder?.salesorder_id || null,
                zoho_salesorder: zohoSalesOrder,
                zoho_sync_error: zohoSyncError,
                total_amount: totalAmount,
                message: zohoSalesOrder 
                    ? `Sales Order ${finalSalesOrderNumber} created and synced to Zoho Books!`
                    : (zohoSyncError ? `Sales Order saved locally (${finalSalesOrderNumber}), but Zoho reported: ${zohoSyncError}` : `Sales Order saved as draft (${finalSalesOrderNumber})`)
            };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Create Direct / Manual Sales Order (without prior order_id)
     * @param {object} soData 
     * @param {number} userId 
     */
    async createDirectSalesOrder(soData, userId = 1) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const customerName = (soData.customer_name || 'Customer').trim();
            const customerPhone = (soData.contact_phone || soData.phone || '').trim();
            const customerId = soData.customer_id || null; // Zoho contact id
            const deliveryMethod = soData.delivery_method || 'Post';
            const referenceNumber = (soData.reference_number || '').trim();
            const salespersonName = soData.salesperson_name || '';
            const paymentTerms = parseInt(soData.payment_terms, 10) || 0;
            const date = soData.date || new Date().toISOString().split('T')[0];
            const shipmentDate = soData.shipment_date || null;
            const notes = soData.notes || 'Thank you for doing business with us.';
            const terms = soData.terms || `1. Goods once sold will not be taken back or exchanged.\n2. Payment must be made within the due date mentioned on the invoice.\n3. Any dispute regarding this invoice must be raised within 7 days from the invoice date.\n4. Subject to Koppa Jurisdiction.`;

            const lineItems = (soData.items || []).map(item => ({
                product_id: item.product_id || null,
                name: item.name || item.product_name,
                description: item.description || '',
                rate: parseFloat(item.rate || item.price) || 0,
                quantity: parseFloat(item.quantity) || 1,
                tax_id: item.tax_id || undefined
            }));

            if (lineItems.length === 0) {
                throw new Error('Sales Order must contain at least one line item.');
            }

            const discount = parseFloat(soData.discount) || 0;
            const shippingCharge = parseFloat(soData.shipping_charge || soData.shipping_charges) || 0;
            const adjustment = parseFloat(soData.adjustment || soData.round_off) || 0;
            const subtotal = lineItems.reduce((acc, it) => acc + (it.rate * it.quantity), 0);
            const totalAmount = Math.max(0, subtotal - discount + shippingCharge + adjustment);
            const advancePaid = parseFloat(soData.advance_amount || 0);
            const balanceAmount = Math.max(0, totalAmount - advancePaid);

            const salesOrderNumber = (soData.salesorder_number || await this.getNextSalesOrderNumber()).trim();

            let zohoSalesOrder = null;
            let zohoSyncError = null;
            let finalSalesOrderNumber = salesOrderNumber;

            // Sync to Zoho if customerId exists and not draft-only
            if (orgId && customerId && !soData.is_draft_only) {
                const headers = await zohoAuth.getAuthHeaders();
                const zohoPayload = {
                    customer_id: customerId,
                    salesorder_number: salesOrderNumber,
                    reference_number: referenceNumber || undefined,
                    date: date,
                    delivery_method: deliveryMethod,
                    notes: notes,
                    terms: terms,
                    is_inclusive_tax: false,
                    line_items: lineItems.map(it => ({
                        name: it.name,
                        description: it.description,
                        rate: it.rate,
                        quantity: it.quantity,
                        tax_id: it.tax_id
                    })),
                    payment_terms: paymentTerms,
                    discount: discount,
                    is_discount_before_tax: true,
                    shipping_charge: shippingCharge,
                    adjustment: adjustment
                };

                if (shipmentDate) zohoPayload.shipment_date = shipmentDate;
                if (salespersonName) zohoPayload.salesperson_name = salespersonName;
                if (customerPhone) {
                    zohoPayload.custom_fields = [{ label: 'Contact', value: customerPhone }];
                }

                console.log(`[ZOHO SO DIRECT] Posting Sales Order ${salesOrderNumber} to Zoho Books...`);

                try {
                    const response = await axios.post(
                        `${zohoAuth.apiDomain}/salesorders?organization_id=${orgId}&ignore_auto_number_generation=true`,
                        zohoPayload,
                        { headers }
                    );

                    if (response.data && response.data.code === 0 && response.data.salesorder) {
                        zohoSalesOrder = response.data.salesorder;
                        finalSalesOrderNumber = zohoSalesOrder.salesorder_number || finalSalesOrderNumber;
                        console.log(`[ZOHO SO DIRECT] Created! ID: ${zohoSalesOrder.salesorder_id}, Number: ${finalSalesOrderNumber}`);
                    }
                } catch (apiErr) {
                    const errMsg = apiErr.response?.data?.message || apiErr.message;
                    console.warn(`[ZOHO SO DIRECT] First attempt failed (${finalSalesOrderNumber}): ${errMsg}`);

                    if (errMsg.toLowerCase().includes('already exists') || errMsg.toLowerCase().includes('duplicate')) {
                        console.log(`[ZOHO SO DIRECT] Duplicate number. Retrying with Zoho auto-sequence...`);
                        try {
                            const retryPayload = { ...zohoPayload };
                            delete retryPayload.salesorder_number;

                            const retryRes = await axios.post(
                                `${zohoAuth.apiDomain}/salesorders?organization_id=${orgId}`,
                                retryPayload,
                                { headers }
                            );

                            if (retryRes.data && retryRes.data.code === 0 && retryRes.data.salesorder) {
                                zohoSalesOrder = retryRes.data.salesorder;
                                finalSalesOrderNumber = retryRes.data.salesorder.salesorder_number;
                                console.log(`[ZOHO SO DIRECT] Auto-assigned: ${finalSalesOrderNumber}`);
                            }
                        } catch (retryErr) {
                            zohoSyncError = retryErr.response?.data?.message || retryErr.message;
                        }
                    } else {
                        zohoSyncError = errMsg;
                    }
                }
            }

            const initialStatus = soData.is_draft_only ? 'draft' : 'approved';

            // Insert into orders table
            const [orderInsert] = await connection.query(`
                INSERT INTO orders (
                    customer_name, phone, order_source, order_status,
                    total_amount, discount, shipping_charges, extra_charges,
                    advance_amount, balance_amount, sales_order_number,
                    zoho_salesorder_id, zoho_contact_id, delivery_type,
                    created_by, approved_by, approved_at, created_at, updated_at
                ) VALUES (
                    ?, ?, 'direct', ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, NOW(), NOW(), NOW()
                )
            `, [
                customerName,
                customerPhone,
                initialStatus,
                totalAmount,
                discount,
                shippingCharge,
                adjustment,
                advancePaid,
                balanceAmount,
                finalSalesOrderNumber,
                zohoSalesOrder?.salesorder_id || null,
                customerId || null,
                deliveryMethod,
                userId,
                userId
            ]);

            const newOrderId = orderInsert.insertId;

            // Insert line items into order_items
            for (const item of lineItems) {
                const prodId = item.product_id || 14;
                const qty = item.quantity || 1;
                const rate = item.rate || 0;
                const tot = qty * rate;

                await connection.query(`
                    INSERT INTO order_items (order_id, product_id, quantity, price, total_price)
                    VALUES (?, ?, ?, ?, ?)
                `, [newOrderId, prodId, qty, rate, tot]);
            }

            // Log creation
            try {
                await connection.query(`
                    INSERT INTO invoice_logs (order_id, action, new_value, changed_by)
                    VALUES (?, 'DIRECT_SALES_ORDER_CREATED', ?, ?)
                `, [
                    newOrderId,
                    JSON.stringify({
                        sales_order_number: finalSalesOrderNumber,
                        zoho_salesorder_id: zohoSalesOrder?.salesorder_id || null,
                        total_amount: totalAmount,
                        zoho_synced: !!zohoSalesOrder
                    }),
                    userId
                ]);
            } catch (lErr) {}

            await connection.commit();

            return {
                success: true,
                order_id: newOrderId,
                sales_order_number: finalSalesOrderNumber,
                zoho_salesorder_id: zohoSalesOrder?.salesorder_id || null,
                zoho_salesorder: zohoSalesOrder,
                zoho_sync_error: zohoSyncError,
                total_amount: totalAmount,
                message: zohoSalesOrder
                    ? `Direct Sales Order ${finalSalesOrderNumber} created and synced to Zoho Books!`
                    : (zohoSyncError ? `Sales Order saved locally (${finalSalesOrderNumber}), but Zoho reported: ${zohoSyncError}` : `Sales Order saved as draft (${finalSalesOrderNumber})`)
            };

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Get Sales Order Details by Order ID or Zoho SO ID
     * @param {number|string} orderId 
     */
    async getSalesOrderDetails(orderId) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;

        // 1. Fetch from local CRM DB
        const [orders] = await pool.query(`
            SELECT o.*, u.name as sales_person_name, l.source as lead_source,
                   inv.invoice_id, inv.invoice_number
            FROM orders o
            LEFT JOIN users u ON o.created_by = u.user_id
            LEFT JOIN leads l ON o.lead_id = l.lead_id
            LEFT JOIN invoices inv ON o.order_id = inv.order_id AND inv.invoice_status = 'finalized'
            WHERE o.order_id = ? OR o.sales_order_number = ? OR o.zoho_salesorder_id = ?
            LIMIT 1
        `, [orderId, orderId, orderId]);

        const order = orders[0] || null;

        // Fetch local order_items
        let items = [];
        if (order) {
            const [itemRows] = await pool.query(`
                SELECT oi.*, p.name as product_name, p.sku
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ?
            `, [order.order_id]);
            items = itemRows;
        }

        // 2. Fetch live from Zoho Books if zoho_salesorder_id or sales_order_number exists
        let zohoSalesOrder = null;
        const targetZohoSoId = order?.zoho_salesorder_id;
        const targetZohoSoNumber = order?.sales_order_number;

        if (orgId && (targetZohoSoId || targetZohoSoNumber)) {
            try {
                const headers = await zohoAuth.getAuthHeaders();
                if (targetZohoSoId) {
                    const res = await axios.get(`${zohoAuth.apiDomain}/salesorders/${targetZohoSoId}?organization_id=${orgId}`, { headers });
                    if (res.data && res.data.code === 0 && res.data.salesorder) {
                        zohoSalesOrder = res.data.salesorder;
                    }
                } else if (targetZohoSoNumber) {
                    const res = await axios.get(`${zohoAuth.apiDomain}/salesorders?organization_id=${orgId}&search_text=${encodeURIComponent(targetZohoSoNumber)}`, { headers });
                    if (res.data && res.data.salesorders && res.data.salesorders.length > 0) {
                        const matchedSo = res.data.salesorders.find(s => s.salesorder_number === targetZohoSoNumber) || res.data.salesorders[0];
                        const fullRes = await axios.get(`${zohoAuth.apiDomain}/salesorders/${matchedSo.salesorder_id}?organization_id=${orgId}`, { headers });
                        if (fullRes.data && fullRes.data.salesorder) {
                            zohoSalesOrder = fullRes.data.salesorder;
                        }
                    }
                }
            } catch (err) {
                console.warn('[ZOHO SO DETAILS] Could not fetch live from Zoho:', err.message);
            }
        }

        return {
            order,
            items,
            zoho_salesorder: zohoSalesOrder
        };
    }
}

module.exports = new ZohoSalesOrderService();

