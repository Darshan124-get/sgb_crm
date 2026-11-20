const axios = require('axios');
const zohoAuth = require('./zohoAuth.service');
const pool = require('../../config/db');

class ZohoInvoiceService {
    /**
     * Prepare initial 1:1 invoice data from Sales Order (fetching from Zoho Books & CRM)
     * @param {string|number} soId - Either Sales Order ID or SO Number
     */
    async prepareInvoiceFromSalesOrder(soId) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured');

        const headers = await zohoAuth.getAuthHeaders();

        // 1. Fetch Sales Order details from Zoho Books
        let zohoSo = null;
        let crmOrder = null;

        // Try lookup by salesorder_id first, then salesorder_number
        try {
            const res = await axios.get(`${zohoAuth.apiDomain}/salesorders/${soId}?organization_id=${orgId}`, { headers });
            if (res.data?.salesorder) zohoSo = res.data.salesorder;
        } catch (e) {
            // Try lookup by salesorder_number query
            try {
                const searchRes = await axios.get(`${zohoAuth.apiDomain}/salesorders?salesorder_number=${encodeURIComponent(soId)}&organization_id=${orgId}`, { headers });
                const soList = searchRes.data?.salesorders || [];
                if (soList.length > 0) {
                    const fullRes = await axios.get(`${zohoAuth.apiDomain}/salesorders/${soList[0].salesorder_id}?organization_id=${orgId}`, { headers });
                    zohoSo = fullRes.data?.salesorder;
                }
            } catch (err2) {
                console.warn('Could not fetch SO from Zoho Books:', err2.message);
            }
        }

        // Try lookup in CRM DB
        const [crmOrders] = await pool.query(
            `SELECT o.*, u.name as salesperson_user_name,
                    (SELECT SUM(amount) FROM payments WHERE order_id = o.order_id AND payment_status = 'verified') as advance_paid
             FROM orders o
             LEFT JOIN users u ON o.created_by = u.user_id
             WHERE o.sales_order_number = ? OR o.zoho_salesorder_id = ? OR o.order_id = ?
             LIMIT 1`,
            [soId, soId, isNaN(soId) ? -1 : parseInt(soId)]
        );
        if (crmOrders.length > 0) crmOrder = crmOrders[0];

        // 2. Fetch Zoho Books Invoice Metadata (Settings, next number, taxes, payment terms, salespeople)
        let invoiceSettings = {};
        let taxes = [];
        let paymentTerms = [];
        let salespersons = [];
        let nextInvoiceNumber = '';

        try {
            const editPageRes = await axios.get(`${zohoAuth.apiDomain}/invoices/editpage?organization_id=${orgId}`, { headers });
            const data = editPageRes.data || {};
            invoiceSettings = data.invoice_settings || {};
            taxes = data.taxes || [];
            paymentTerms = data.payment_terms || [];
            salespersons = data.salespersons || [];

            // Get next number pattern: e.g. "2946/2026-27"
            // Let's check latest invoice number to increment correctly
            const recentInvRes = await axios.get(`${zohoAuth.apiDomain}/invoices?organization_id=${orgId}&sort_column=created_time&sort_order=D&per_page=1`, { headers });
            const latestInv = recentInvRes.data?.invoices?.[0];
            if (latestInv && latestInv.invoice_number) {
                const parts = latestInv.invoice_number.split('/');
                if (parts.length === 2 && !isNaN(parts[0])) {
                    const nextSeq = parseInt(parts[0]) + 1;
                    nextInvoiceNumber = `${nextSeq}/${parts[1]}`;
                } else {
                    nextInvoiceNumber = invoiceSettings.next_number ? `${invoiceSettings.prefix_string || ''}${invoiceSettings.next_number}` : '';
                }
            }
        } catch (metaErr) {
            console.warn('Error fetching invoice editpage meta:', metaErr.message);
        }

        // 3. Fallback Next Invoice Number from CRM DB if Zoho didn't give one
        if (!nextInvoiceNumber) {
            const [lastCrmInv] = await pool.query('SELECT invoice_number FROM invoices ORDER BY invoice_id DESC LIMIT 1');
            if (lastCrmInv.length > 0 && lastCrmInv[0].invoice_number) {
                const parts = lastCrmInv[0].invoice_number.split('/');
                if (parts.length === 2 && !isNaN(parts[0])) {
                    nextInvoiceNumber = `${parseInt(parts[0]) + 1}/${parts[1]}`;
                } else {
                    nextInvoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
                }
            } else {
                nextInvoiceNumber = '2946/2026-27';
            }
        }

        // 4. Construct Customer & Address Information
        const customerName = zohoSo?.customer_name || crmOrder?.customer_name || 'Customer';
        const customerId = zohoSo?.customer_id || crmOrder?.zoho_contact_id || '';
        const billingAddress = zohoSo?.billing_address || {
            attention: customerName,
            address: crmOrder?.address || '',
            city: crmOrder?.city || '',
            state: crmOrder?.state || 'Karnataka',
            zipcode: crmOrder?.pincode || '',
            country: 'India',
            phone: crmOrder?.phone || ''
        };
        const shippingAddress = zohoSo?.shipping_address || billingAddress;

        // 5. Line items mapping
        let lineItems = [];
        if (zohoSo && Array.isArray(zohoSo.line_items) && zohoSo.line_items.length > 0) {
            lineItems = zohoSo.line_items.map(item => {
                const qtyOrdered = item.quantity || 1;
                const qtyInvoiced = item.quantity_invoiced || 0;
                const qtyToInvoice = Math.max(1, qtyOrdered - qtyInvoiced);
                const rate = parseFloat(item.rate || 0);
                const lineTotal = rate * qtyToInvoice;

                return {
                    line_item_id: item.line_item_id || '',
                    item_id: item.item_id || '',
                    salesorder_item_id: item.line_item_id || '',
                    name: item.name || 'Agri Product',
                    sku: item.sku || '',
                    description: item.description || '',
                    hsn_or_sac: item.hsn_or_sac || '',
                    product_type: item.product_type || 'goods',
                    quantity_ordered: qtyOrdered,
                    quantity_invoiced: qtyInvoiced,
                    quantity_packed: item.quantity_packed || 0,
                    quantity: qtyToInvoice,
                    rate: rate,
                    tax_id: item.tax_id || '3580403000000032428',
                    tax_name: item.tax_name || 'GST5',
                    tax_percentage: item.tax_percentage !== undefined ? item.tax_percentage : 5,
                    tax_type: item.tax_type || 'tax_group',
                    amount: lineTotal
                };
            });
        } else if (crmOrder) {
            // Load from CRM order_items
            const [crmItems] = await pool.query(
                `SELECT oi.*, p.name as product_name, p.sku, p.hsn_code, p.gst_percentage
                 FROM order_items oi
                 LEFT JOIN products p ON oi.product_id = p.product_id
                 WHERE oi.order_id = ?`,
                [crmOrder.order_id]
            );
            lineItems = crmItems.map(item => {
                const qty = parseInt(item.quantity) || 1;
                const rate = parseFloat(item.price) || 0;
                const taxPct = parseFloat(item.gst_percentage) || 5;
                return {
                    line_item_id: '',
                    item_id: '',
                    salesorder_item_id: '',
                    name: item.product_name || 'Agri Product',
                    sku: item.sku || '',
                    description: '',
                    hsn_or_sac: item.hsn_code || '',
                    product_type: 'goods',
                    quantity_ordered: qty,
                    quantity_invoiced: 0,
                    quantity_packed: 0,
                    quantity: qty,
                    rate: rate,
                    tax_id: taxPct === 12 ? '3580403000000032432' : (taxPct === 18 ? '3580403000000032436' : '3580403000000032428'),
                    tax_name: `GST${taxPct}`,
                    tax_percentage: taxPct,
                    tax_type: 'tax_group',
                    amount: rate * qty
                };
            });
        }

        // Custom fields extraction
        const cfTermsOfDelivery = zohoSo?.cf_terms_of_delivery || '';
        const cfContactNo = zohoSo?.cf_contact || crmOrder?.phone || '';
        const cfDestination = zohoSo?.cf_destination || (crmOrder?.pincode ? `Pincode ${crmOrder.pincode}` : '');

        // Today's date ISO
        const todayDate = new Date().toISOString().split('T')[0];

        return {
            success: true,
            salesorder_id: zohoSo?.salesorder_id || crmOrder?.zoho_salesorder_id || '',
            salesorder_number: zohoSo?.salesorder_number || crmOrder?.sales_order_number || soId,
            order_id: crmOrder?.order_id || null,
            customer_id: customerId,
            customer_name: customerName,
            billing_address: billingAddress,
            shipping_address: shippingAddress,
            gst_treatment: zohoSo?.gst_treatment || crmOrder?.gst_treatment || 'consumer',
            place_of_supply: zohoSo?.place_of_supply || crmOrder?.place_of_supply || 'KA',
            invoice_number: nextInvoiceNumber,
            date: todayDate,
            payment_terms: zohoSo?.payment_terms || 0,
            payment_terms_label: zohoSo?.payment_terms_label || 'Due on Receipt',
            due_date: todayDate,
            salesperson_id: zohoSo?.salesperson_id || '',
            salesperson_name: zohoSo?.salesperson_name || crmOrder?.salesperson_user_name || '',
            cf_terms_of_delivery: cfTermsOfDelivery,
            cf_contact_no: cfContactNo,
            cf_destination: cfDestination,
            notes: zohoSo?.notes || 'Thanks for doing business with us.',
            terms: zohoSo?.terms || '1. Goods once sold will not be taken back or exchanged.\n2. Payment must be made within the due date mentioned on the invoice.\n3. Late payment may attract additional charges or interest as applicable.\n4. Any dispute regarding this invoice must be raised within 7 days from the invoice date.',
            line_items: lineItems,
            sub_total: zohoSo?.sub_total || 0,
            discount: zohoSo?.discount || 0,
            shipping_charge: zohoSo?.shipping_charge || 0,
            shipping_charge_tax_id: zohoSo?.shipping_charge_tax_id || '',
            shipping_charge_tax_name: zohoSo?.shipping_charge_tax_name || '',
            shipping_charge_tax_percentage: zohoSo?.shipping_charge_tax_percentage || 0,
            shipping_charge_sac_code: zohoSo?.shipping_charge_sac_code || '996811',
            adjustment: zohoSo?.adjustment || 0,
            total: zohoSo?.total || 0,
            taxes,
            payment_terms_list: paymentTerms,
            salespersons_list: salespersons
        };
    }

    /**
     * Create Invoice in Zoho Books and save full record to CRM DB
     * @param {object} payload - Complete invoice payload from the workstation
     * @param {number} userId - Requesting user ID
     */
    async createInvoice(payload, userId = 1) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured');

        const headers = await zohoAuth.getAuthHeaders();

        // 1. Construct Zoho Books Invoice Payload
        const zohoPayload = {
            customer_id: payload.customer_id,
            invoice_number: payload.invoice_number,
            reference_number: payload.salesorder_number || '',
            date: payload.date || new Date().toISOString().split('T')[0],
            due_date: payload.due_date || payload.date || new Date().toISOString().split('T')[0],
            payment_terms: payload.payment_terms !== undefined ? parseInt(payload.payment_terms) : 0,
            payment_terms_label: payload.payment_terms_label || 'Due on Receipt',
            salesperson_id: payload.salesperson_id || undefined,
            salesperson_name: payload.salesperson_name || undefined,
            place_of_supply: payload.place_of_supply || 'KA',
            gst_treatment: payload.gst_treatment || 'consumer',
            gst_no: payload.gst_no || undefined,
            notes: payload.notes || 'Thanks for doing business with us.',
            terms: payload.terms || '',
            discount: parseFloat(payload.discount || 0),
            is_discount_before_tax: true,
            discount_type: payload.discount_type || 'entity_level',
            shipping_charge: parseFloat(payload.shipping_charge || 0),
            shipping_charge_tax_id: payload.shipping_charge_tax_id || undefined,
            shipping_charge_sac_code: payload.shipping_charge_sac_code || undefined,
            adjustment: parseFloat(payload.adjustment || 0),
            subject: payload.subject || undefined,
            line_items: (payload.line_items || []).map(item => ({
                line_item_id: item.line_item_id || undefined,
                item_id: item.item_id || undefined,
                salesorder_item_id: item.salesorder_item_id || undefined,
                name: item.name,
                description: item.description || '',
                rate: parseFloat(item.rate || 0),
                quantity: parseFloat(item.quantity || 1),
                tax_id: item.tax_id || undefined,
                hsn_or_sac: item.hsn_or_sac || undefined
            })),
            custom_fields: [
                {
                    customfield_id: '3580403000000263001',
                    value: payload.cf_terms_of_delivery || ''
                },
                {
                    customfield_id: '3580403000000261014',
                    value: payload.cf_contact_no || ''
                },
                {
                    customfield_id: '3580403000001977091',
                    value: payload.cf_destination || 'Pincode'
                }
            ]
        };

        // If Sales Order ID is present, attach it
        if (payload.salesorder_id) {
            zohoPayload.salesorder_id = payload.salesorder_id;
        }

        // 2. Post to Zoho Books: POST /invoices?organization_id=...
        let zohoInvoice = null;
        try {
            const zohoRes = await axios.post(
                `${zohoAuth.apiDomain}/invoices?organization_id=${orgId}`,
                zohoPayload,
                { headers }
            );

            if (zohoRes.data && zohoRes.data.code === 0) {
                zohoInvoice = zohoRes.data.invoice;
            } else {
                throw new Error(zohoRes.data?.message || 'Zoho Books returned error creating invoice');
            }
        } catch (zErr) {
            const errData = zErr.response?.data;
            const errMsg = errData?.message || zErr.message;
            console.error('[ZOHO INVOICE CREATE ERROR]:', errData || zErr.message);
            throw new Error(`Zoho Books Error: ${errMsg}`);
        }

        // 3. Persist to CRM MySQL Database
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const crmOrderId = payload.order_id || null;
            const finalInvNumber = zohoInvoice.invoice_number || payload.invoice_number;
            const finalInvId = zohoInvoice.invoice_id || null;
            const finalTotal = parseFloat(zohoInvoice.total || payload.total || 0);
            const finalSubtotal = parseFloat(zohoInvoice.sub_total || payload.sub_total || 0);
            const finalDiscount = parseFloat(zohoInvoice.discount_total || payload.discount || 0);
            const finalShipping = parseFloat(zohoInvoice.shipping_charge || payload.shipping_charge || 0);
            const finalBalance = parseFloat(zohoInvoice.balance || finalTotal);
            const finalDueDate = zohoInvoice.due_date || payload.due_date || payload.date;
            const finalStatus = zohoInvoice.status || 'draft';

            // Insert into invoices table
            const [invRes] = await connection.query(`
                INSERT INTO invoices (
                    order_id, salesorder_number, invoice_number, zoho_invoice_id,
                    invoice_date, due_date, billing_name, billing_address,
                    gst_number, subtotal, discount, shipping_charges,
                    total_amount, balance_due, invoice_status, created_by,
                    delivery_note, destination, billing_phone
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                crmOrderId,
                payload.salesorder_number || '',
                finalInvNumber,
                finalInvId,
                payload.date,
                finalDueDate,
                payload.customer_name || 'Customer',
                typeof payload.billing_address === 'string' ? payload.billing_address : JSON.stringify(payload.billing_address || {}),
                payload.gst_no || '',
                finalSubtotal,
                finalDiscount,
                finalShipping,
                finalTotal,
                finalBalance,
                finalStatus === 'paid' ? 'finalized' : 'draft',
                userId,
                payload.cf_terms_of_delivery || '',
                payload.cf_destination || '',
                payload.cf_contact_no || ''
            ]);

            const insertedInvoiceId = invRes.insertId;

            // Insert line items
            if (Array.isArray(payload.line_items)) {
                for (const item of payload.line_items) {
                    const qty = parseInt(item.quantity) || 1;
                    const price = parseFloat(item.rate) || 0;
                    const gstPct = parseFloat(item.tax_percentage) || 5;
                    const lineTotal = price * qty;

                    await connection.query(`
                        INSERT INTO invoice_items (
                            invoice_id, product_id, quantity, price, gst_percentage, total, hsn_code
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        insertedInvoiceId,
                        item.product_id || 14,
                        qty,
                        price,
                        gstPct,
                        lineTotal,
                        item.hsn_or_sac || ''
                    ]);
                }
            }

            // If linked to a CRM order, update order status to 'billed'
            if (crmOrderId) {
                await connection.query(`
                    UPDATE orders
                    SET order_status = 'billed',
                        zoho_bill_number = ?
                    WHERE order_id = ?
                `, [finalInvNumber, crmOrderId]);

                // Also insert invoice log
                await connection.query(`
                    INSERT INTO invoice_logs (order_id, action, old_value, new_value, changed_by)
                    VALUES (?, 'INVOICE_CREATED', 'so_created', 'billed', ?)
                `, [crmOrderId, userId]);
            }

            await connection.commit();

            return {
                success: true,
                message: `Invoice ${finalInvNumber} successfully created in Zoho Books and synchronized to CRM!`,
                invoice_id: insertedInvoiceId,
                zoho_invoice_id: finalInvId,
                invoice_number: finalInvNumber,
                invoice: zohoInvoice
            };
        } catch (dbErr) {
            await connection.rollback();
            console.error('Error saving invoice to CRM database:', dbErr);
            // Even if local DB save had an issue, Zoho invoice was created
            return {
                success: true,
                message: `Invoice ${zohoInvoice.invoice_number} created in Zoho Books (DB sync notice: ${dbErr.message})`,
                zoho_invoice_id: zohoInvoice.invoice_id,
                invoice_number: zohoInvoice.invoice_number,
                invoice: zohoInvoice
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Get Invoices List reconciling Zoho Books & CRM database
     * @param {object} query 
     */
    async getInvoicesList(query = {}) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        let zohoInvoices = [];

        if (orgId) {
            try {
                const headers = await zohoAuth.getAuthHeaders();
                let url = `${zohoAuth.apiDomain}/invoices?organization_id=${orgId}&sort_column=date&sort_order=D&per_page=100`;
                if (query.customer_id) url += `&customer_id=${query.customer_id}`;
                if (query.reference_number) url += `&reference_number=${encodeURIComponent(query.reference_number)}`;

                const res = await axios.get(url, { headers });
                zohoInvoices = res.data?.invoices || [];
            } catch (err) {
                console.warn('Could not fetch invoices from Zoho Books:', err.response?.data || err.message);
            }
        }

        // Fetch from CRM DB
        const [crmInvoices] = await pool.query(`
            SELECT i.*, o.customer_name as order_customer, o.sales_order_number as crm_so_number,
                   o.phone as customer_phone
            FROM invoices i
            LEFT JOIN orders o ON i.order_id = o.order_id
            ORDER BY i.created_at DESC
            LIMIT 150
        `);

        // If we have Zoho Invoices, map into table format matching user requirements
        if (zohoInvoices.length > 0) {
            return zohoInvoices.map(inv => {
                // Find matching CRM record if any
                const matchedCrm = crmInvoices.find(c =>
                    c.zoho_invoice_id === inv.invoice_id ||
                    c.invoice_number === inv.invoice_number ||
                    (inv.reference_number && (c.salesorder_number === inv.reference_number || c.crm_so_number === inv.reference_number))
                );

                return {
                    invoice_id: matchedCrm?.invoice_id || inv.invoice_id,
                    zoho_invoice_id: inv.invoice_id,
                    invoice_number: inv.invoice_number,
                    order_id: matchedCrm?.order_id || null,
                    salesorder_number: inv.reference_number || matchedCrm?.salesorder_number || matchedCrm?.crm_so_number || '—',
                    customer_name: inv.customer_name || matchedCrm?.billing_name || matchedCrm?.order_customer || 'Customer',
                    date: inv.date,
                    due_date: inv.due_date,
                    due_days: inv.due_days || '',
                    status: inv.status || 'draft',
                    total: parseFloat(inv.total || 0),
                    balance: parseFloat(inv.balance !== undefined ? inv.balance : inv.total || 0),
                    currency_symbol: inv.currency_symbol || '₹',
                    created_time: inv.created_time || inv.date
                };
            });
        }

        // Fallback to CRM DB invoices if Zoho is unreachable
        return crmInvoices.map(inv => ({
            invoice_id: inv.invoice_id,
            zoho_invoice_id: inv.zoho_invoice_id,
            invoice_number: inv.invoice_number,
            order_id: inv.order_id,
            salesorder_number: inv.salesorder_number || inv.crm_so_number || '—',
            customer_name: inv.billing_name || inv.order_customer || 'Customer',
            date: inv.invoice_date,
            due_date: inv.due_date || inv.invoice_date,
            due_days: '',
            status: inv.invoice_status === 'finalized' ? 'sent' : inv.invoice_status,
            total: parseFloat(inv.total_amount || 0),
            balance: parseFloat(inv.balance_due || inv.total_amount || 0),
            currency_symbol: '₹',
            created_time: inv.created_at
        }));
    }

    /**
     * Delete Invoice permanently from Zoho Books & CRM database
     * @param {string|number} invoiceId 
     * @param {number} userId 
     */
    async deleteInvoice(invoiceId, userId = 1) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Find invoice in DB
            const [rows] = await connection.query(
                'SELECT * FROM invoices WHERE invoice_id = ? OR zoho_invoice_id = ? OR invoice_number = ?',
                [invoiceId, invoiceId, invoiceId]
            );

            const inv = rows[0] || null;
            const zohoInvId = inv?.zoho_invoice_id || (String(invoiceId).startsWith('35804') ? invoiceId : null);

            // Delete from Zoho Books if zoho ID is known
            if (orgId && zohoInvId) {
                try {
                    const headers = await zohoAuth.getAuthHeaders();
                    await axios.delete(
                        `${zohoAuth.apiDomain}/invoices/${zohoInvId}?organization_id=${orgId}`,
                        { headers }
                    );
                    console.log(`[ZOHO INVOICE DELETE] Deleted invoice ${zohoInvId} from Zoho Books`);
                } catch (zErr) {
                    console.warn(`[ZOHO INVOICE DELETE] Warning:`, zErr.response?.data?.message || zErr.message);
                }
            }

            if (inv) {
                // Delete line items
                await connection.query('DELETE FROM invoice_items WHERE invoice_id = ?', [inv.invoice_id]);
                // Delete invoice
                await connection.query('DELETE FROM invoices WHERE invoice_id = ?', [inv.invoice_id]);

                // If linked to an order, revert order status back to 'approved' / 'so_created'
                if (inv.order_id) {
                    await connection.query(`
                        UPDATE orders
                        SET order_status = 'approved',
                            zoho_bill_number = NULL
                        WHERE order_id = ?
                    `, [inv.order_id]);

                    await connection.query(`
                        INSERT INTO invoice_logs (order_id, action, old_value, new_value, changed_by)
                        VALUES (?, 'INVOICE_DELETED', 'billed', 'approved', ?)
                    `, [inv.order_id, userId]);
                }
            }

            await connection.commit();

            return {
                success: true,
                message: 'Invoice permanently deleted from Zoho Books and CRM database'
            };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Download or stream Zoho Invoice PDF
     * @param {string|number} invoiceId 
     */
    async getInvoicePdf(invoiceId) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured');

        // Look up zoho_invoice_id if passed local invoice_id or invoice_number
        let zohoInvId = invoiceId;
        const [rows] = await pool.query('SELECT zoho_invoice_id FROM invoices WHERE invoice_id = ? OR invoice_number = ?', [invoiceId, invoiceId]);
        if (rows.length > 0 && rows[0].zoho_invoice_id) {
            zohoInvId = rows[0].zoho_invoice_id;
        }

        const headers = await zohoAuth.getAuthHeaders();

        // If zohoInvId contains a slash or non-numeric (e.g. 1578/2026-27), search Zoho first to get actual zoho_invoice_id
        if (isNaN(zohoInvId)) {
            try {
                const searchRes = await axios.get(
                    `${zohoAuth.apiDomain}/invoices?invoice_number=${encodeURIComponent(invoiceId)}&organization_id=${orgId}`,
                    { headers }
                );
                const list = searchRes.data?.invoices || [];
                if (list.length > 0 && list[0].invoice_id) {
                    zohoInvId = list[0].invoice_id;
                }
            } catch (err) {
                console.warn('Could not search invoice by number in getInvoicePdf:', err.message);
            }
        }

        const response = await axios.get(
            `${zohoAuth.apiDomain}/invoices/${zohoInvId}?organization_id=${orgId}&accept=pdf`,
            {
                headers,
                responseType: 'arraybuffer'
            }
        );

        return response.data;
    }

    /**
     * Get complete details of a single invoice from Zoho Books and CRM
     * @param {string|number} invoiceId
     */
    async getInvoiceDetails(invoiceId) {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) throw new Error('ZOHO_ORGANIZATION_ID is not configured');

        let zohoInvId = invoiceId;
        let crmInvoice = null;
        let crmOrder = null;

        // Try lookup in CRM DB first
        const [invRows] = await pool.query(
            'SELECT * FROM invoices WHERE invoice_id = ? OR zoho_invoice_id = ? OR invoice_number = ? LIMIT 1',
            [invoiceId, invoiceId, invoiceId]
        );
        if (invRows.length > 0) {
            crmInvoice = invRows[0];
            if (crmInvoice.zoho_invoice_id) {
                zohoInvId = crmInvoice.zoho_invoice_id;
            }
            if (crmInvoice.order_id) {
                const [orderRows] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [crmInvoice.order_id]);
                if (orderRows.length > 0) crmOrder = orderRows[0];
            }
        }

        const headers = await zohoAuth.getAuthHeaders();
        let zohoInvoice = null;
        let payments = [];

        try {
            const invRes = await axios.get(
                `${zohoAuth.apiDomain}/invoices/${zohoInvId}?organization_id=${orgId}`,
                { headers }
            );
            if (invRes.data?.invoice) {
                zohoInvoice = invRes.data.invoice;
            }
        } catch (err) {
            // Try lookup by invoice_number
            try {
                const searchRes = await axios.get(
                    `${zohoAuth.apiDomain}/invoices?invoice_number=${encodeURIComponent(invoiceId)}&organization_id=${orgId}`,
                    { headers }
                );
                const list = searchRes.data?.invoices || [];
                if (list.length > 0) {
                    const fullRes = await axios.get(
                        `${zohoAuth.apiDomain}/invoices/${list[0].invoice_id}?organization_id=${orgId}`,
                        { headers }
                    );
                    zohoInvoice = fullRes.data?.invoice;
                    zohoInvId = zohoInvoice?.invoice_id || zohoInvId;
                }
            } catch (err2) {
                console.warn('Could not fetch invoice from Zoho Books:', err2.message);
            }
        }

        // Fetch payments list associated with this invoice
        if (zohoInvId) {
            try {
                const payRes = await axios.get(
                    `${zohoAuth.apiDomain}/invoices/${zohoInvId}/payments?organization_id=${orgId}`,
                    { headers }
                );
                payments = payRes.data?.payments || [];
            } catch (payErr) {
                console.warn('Error fetching invoice payments:', payErr.message);
            }
        }

        return {
            success: true,
            invoice: zohoInvoice,
            crm_invoice: crmInvoice,
            order: crmOrder,
            payments: payments
        };
    }
}

module.exports = new ZohoInvoiceService();
