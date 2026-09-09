const pool = require('../config/db');

exports.getOrders = async (req, res) => {
    const { status, source, search, date } = req.query;
    try {
        let query = `
            SELECT 
                o.*, 
                oi.product_id,
                p.name as product_name, 
                oi.quantity, 
                oi.price, 
                oi.total_price as item_total,
                pk.packed_at,
                s.shipment_id, 
                s.courier_name, 
                s.tracking_id, 
                s.shipped_at, 
                s.status as shipment_status, 
                s.delivery_date, 
                s.check_received_date
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.product_id
            LEFT JOIN packing pk ON o.order_id = pk.order_id AND pk.status = 'packed'
            LEFT JOIN shipments s ON o.order_id = s.order_id
        `;
        const conditions = [];
        const params = [];

        const userRole = (req.user && req.user.role) ? req.user.role.toLowerCase() : 'sales';
        const isManagerOrAdmin = req.user && (req.user.is_manager || userRole === 'admin' || userRole === 'super-admin');

        if (!isManagerOrAdmin && req.user) {
            conditions.push("o.created_by = ?");
            params.push(req.user.id);
        }

        if (status) {
            conditions.push("o.order_status = ?");
            params.push(status);
        }
        if (source) {
            conditions.push("o.order_source = ?");
            params.push(source);
        }
        if (date) {
            conditions.push("DATE(o.created_at) = ?");
            params.push(date);
        }
        if (search) {
            conditions.push("(o.customer_name LIKE ? OR o.phone LIKE ? OR CAST(o.order_id AS CHAR) LIKE ?)");
            const escapedSearch = search.replace(/[%_]/g, '\\$&');
            const searchVal = `%${escapedSearch}%`;
            params.push(searchVal, searchVal, searchVal);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY o.order_id DESC";

        const [rows] = await pool.query(query, params);

        const ordersMap = {};
        rows.forEach(row => {
            if (!ordersMap[row.order_id]) {
                ordersMap[row.order_id] = { 
                    ...row, 
                    items: [],
                    packing_records: [],
                    shipments: []
                };
            }
            const itemExists = ordersMap[row.order_id].items.some(i => i.product_id === row.product_id);
            if (!itemExists && (row.product_name || row.quantity)) {
                ordersMap[row.order_id].items.push({
                    product_id: row.product_id,
                    product_name: row.product_name || 'Generic Product',
                    quantity: row.quantity || 1,
                    price: row.price || 0,
                    item_total: row.item_total || 0,
                    subtotal: row.item_total || 0
                });
            }
        });

        const orderIds = Object.keys(ordersMap);
        if (orderIds.length > 0) {
            const [packingRows] = await pool.query(
                'SELECT * FROM packing WHERE order_id IN (?)',
                [orderIds]
            );
            packingRows.forEach(pr => {
                if (ordersMap[pr.order_id]) {
                    ordersMap[pr.order_id].packing_records.push(pr);
                }
            });

            const [shipmentRows] = await pool.query(
                'SELECT s.*, s.status as shipment_status FROM shipments s WHERE order_id IN (?)',
                [orderIds]
            );
            shipmentRows.forEach(sr => {
                if (ordersMap[sr.order_id]) {
                    ordersMap[sr.order_id].shipments.push(sr);
                }
            });
        }

        res.json(Object.values(ordersMap));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.convertLeadToOrder = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let { lead_id, customer_name, phone, address, city, state, village, district, pincode, delivery_type, total_amount, advance_amount, discount, items } = req.body;
        const [resOrder] = await connection.query(
            "INSERT INTO orders (order_source, lead_id, customer_name, phone, address, village, district, pincode, city, state, delivery_type, total_amount, advance_amount, balance_amount, discount, order_status, created_by) VALUES ('lead', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)",
            [lead_id, customer_name, phone, address || '', village || '', district || '', pincode || '', city || '', state || '', delivery_type || null, total_amount || 0, advance_amount || 0, ((total_amount || 0) - (discount || 0) - (advance_amount || 0)), discount || 0, req.user ? req.user.id : 1]
        );
        const orderId = resOrder.insertId;

        let parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        if (Array.isArray(parsedItems)) {
            for (const item of parsedItems) {
                let pid = parseInt(item.product_id);
                let dbPrice = parseFloat(item.price) || 0;

                if (isNaN(pid) || dbPrice === 0) {
                    const escapedProductId = String(item.product_id || '').replace(/[%_]/g, '\\$&');
                    const [pRows] = await connection.query("SELECT product_id, selling_price, dealer_price FROM products WHERE sku = ? OR name = ? OR name LIKE ? LIMIT 1", [item.product_id, item.product_id, `%${escapedProductId}%`]);
                    if (pRows[0]) {
                        pid = pRows[0].product_id;
                        if (dbPrice === 0) dbPrice = pRows[0].selling_price || pRows[0].dealer_price || 0;
                    }
                }

                if (pid && !isNaN(pid)) {
                    const qty = parseInt(item.quantity) || 1;

                    // Lock inventory and check stock
                    const [invRows] = await connection.query("SELECT current_stock, reserved_stock FROM inventory WHERE product_id = ? FOR UPDATE", [pid]);
                    if (invRows.length === 0) {
                        throw new Error(`Inventory record not found for product ID ${pid}`);
                    }
                    const availableStock = invRows[0].current_stock - invRows[0].reserved_stock;
                    if (availableStock < qty) {
                        throw new Error(`Insufficient stock for product ID ${pid}. Available: ${availableStock}, Requested: ${qty}`);
                    }

                    // Reserve stock
                    await connection.query("UPDATE inventory SET reserved_stock = reserved_stock + ? WHERE product_id = ?", [qty, pid]);

                    // Insert order item
                    await connection.query(
                        "INSERT INTO order_items (order_id, product_id, quantity, price, total_price) VALUES (?, ?, ?, ?, ?)",
                        [orderId, pid, qty, dbPrice, qty * dbPrice]
                    );
                }
            }
        }

        await connection.query("UPDATE leads SET status = 'converted' WHERE lead_id = ?", [lead_id]);
        await connection.commit();

        // Send push notification to Admins and Super Admins about the new draft order
        try {
            const notificationService = require('../services/notification.service');
            const orderRef = `#SGB-Draft-${orderId}`;
            await notificationService.sendToRole(
                'admin',
                'New Order Created',
                `Order ${orderRef} has been created for customer "${customer_name || 'Generic Customer'}".`,
                { orderId: String(orderId), type: 'order_created' }
            );
            await notificationService.sendToRole(
                'super-admin',
                'New Order Created',
                `Order ${orderRef} has been created for customer "${customer_name || 'Generic Customer'}".`,
                { orderId: String(orderId), type: 'order_created' }
            );
        } catch (notifErr) {
            console.error('FCM Notification error (convertLeadToOrder):', notifErr.message);
        }

        res.status(201).json({ success: true, orderId: orderId });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.createDealerOrder = async (req, res) => { res.json({ msg: 'ok' }); };
exports.getStats = async (req, res) => { res.json({ total: 0 }); };
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const VALID_TRANSITIONS = {
        draft: ['in_review', 'billed', 'cancelled'],
        in_review: ['billed', 'cancelled'],
        billed: ['packed', 'cancelled'],
        packed: ['shipped', 'cancelled'],
        shipped: ['delivered', 'cancelled'],
        delivered: ['cancelled'],
        cancelled: []
    };

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch current status
        const [orders] = await connection.query("SELECT order_status FROM orders WHERE order_id = ? FOR UPDATE", [id]);
        if (orders.length === 0) {
            throw new Error('Order not found');
        }

        const currentStatus = orders[0].order_status;

        // If status is the same, no action needed
        if (currentStatus === status) {
            await connection.commit();
            return res.json({ success: true, message: 'Order status is already ' + status });
        }

        // 2. Validate transition
        const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowedTransitions.includes(status)) {
            throw new Error(`Invalid status transition from ${currentStatus} to ${status}`);
        }

        // 3. Handle specific side effects (e.g., Cancellation)
        if (status === 'cancelled') {
            const [items] = await connection.query("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [id]);
            
            if (['draft', 'in_review', 'billed'].includes(currentStatus)) {
                for (const item of items) {
                    await connection.query(
                        "UPDATE inventory SET reserved_stock = GREATEST(0, reserved_stock - ?) WHERE product_id = ?",
                        [item.quantity, item.product_id]
                    );
                }
            } else if (['packed', 'shipped', 'delivered'].includes(currentStatus)) {
                for (const item of items) {
                    await connection.query(
                        "UPDATE inventory SET current_stock = current_stock + ? WHERE product_id = ?",
                        [item.quantity, item.product_id]
                    );
                }
            }
        }

        // Get order details for notification and dealer recalculation
        const [[orderInfo]] = await connection.query(
            "SELECT created_by, customer_name, phone, dealer_id FROM orders WHERE order_id = ?",
            [id]
        );

        // 4. Update status
        await connection.query("UPDATE orders SET order_status = ? WHERE order_id = ?", [status, id]);

        if (orderInfo && orderInfo.dealer_id) {
            try {
                const { recalculateDealerStatus } = require('./dealer.controller');
                if (recalculateDealerStatus) {
                    await recalculateDealerStatus(orderInfo.dealer_id, connection);
                }
            } catch (err) {
                console.error('Error recalculating dealer status in order status transition:', err);
            }
        }

        await connection.commit();

        // Send notifications based on the new status
        try {
            const notificationService = require('../services/notification.service');
            const orderRef = `#SGB-${id}`;
            const customer = orderInfo ? (orderInfo.customer_name || orderInfo.phone || 'Customer') : 'Customer';
            const creatorId = orderInfo ? orderInfo.created_by : null;

            switch (status) {
                case 'in_review':
                    // Notify Admins & Super Admins to review the order
                    await notificationService.sendToRole('admin', 'Order Pending Review', `Order ${orderRef} for "${customer}" is pending approval.`, { orderId: String(id), type: 'order_in_review' });
                    await notificationService.sendToRole('super-admin', 'Order Pending Review', `Order ${orderRef} for "${customer}" is pending approval.`, { orderId: String(id), type: 'order_in_review' });
                    break;
                case 'billed':
                    // Notify Billing Department to process payment
                    await notificationService.sendToDepartment('billing', 'Order Approved & Billed', `Order ${orderRef} has been approved. Billing complete.`, { orderId: String(id), type: 'order_billed' });
                    // Notify Creator (Sales)
                    if (creatorId) {
                        await notificationService.sendToUser(creatorId, 'Your Order was Approved!', `Order ${orderRef} for "${customer}" has been approved.`, { orderId: String(id), type: 'order_billed' });
                    }
                    break;
                case 'packed':
                    // Notify Packing Department that they have a new packing job
                    await notificationService.sendToDepartment('packing', 'New Packing Job', `Order ${orderRef} for "${customer}" is ready to be packed.`, { orderId: String(id), type: 'order_packed' });
                    break;
                case 'shipped':
                    // Notify Shipping Department to send it out
                    await notificationService.sendToDepartment('shipping', 'Ready for Shipment', `Order ${orderRef} is packed and ready for delivery.`, { orderId: String(id), type: 'order_shipped' });
                    break;
                case 'delivered':
                    // Notify Admins & Creator
                    await notificationService.sendToRole('admin', 'Order Delivered', `Order ${orderRef} for "${customer}" has been delivered.`, { orderId: String(id), type: 'order_delivered' });
                    await notificationService.sendToRole('super-admin', 'Order Delivered', `Order ${orderRef} for "${customer}" has been delivered.`, { orderId: String(id), type: 'order_delivered' });
                    if (creatorId) {
                        await notificationService.sendToUser(creatorId, 'Order Delivered', `Your Order ${orderRef} has been successfully delivered.`, { orderId: String(id), type: 'order_delivered' });
                    }
                    break;
                case 'cancelled':
                    // Notify Admins & Creator
                    await notificationService.sendToRole('admin', 'Order Cancelled', `Order ${orderRef} for "${customer}" has been cancelled.`, { orderId: String(id), type: 'order_cancelled' });
                    await notificationService.sendToRole('super-admin', 'Order Cancelled', `Order ${orderRef} for "${customer}" has been cancelled.`, { orderId: String(id), type: 'order_cancelled' });
                    if (creatorId) {
                        await notificationService.sendToUser(creatorId, 'Order Cancelled', `Your Order ${orderRef} has been cancelled.`, { orderId: String(id), type: 'order_cancelled' });
                    }
                    break;
            }
        } catch (notifErr) {
            console.error('FCM Notification error (updateStatus):', notifErr.message);
        }

        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.bulkImportOrders = async (req, res) => {
    const { orders, dryRun = false, autoCreateDealers = true, selectedMissingDealers = [] } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({ message: 'No order records provided for import' });
    }

    const sanitizePhone = (str) => {
        if (!str) return '';
        const cleaned = String(str).replace(/\D/g, '');
        if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.substring(2);
        if (cleaned.length > 10) return cleaned.slice(-10);
        return cleaned;
    };

    const parseOrderDate = (rawDate) => {
        if (!rawDate) return new Date();
        if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;
        if (typeof rawDate === 'number') {
            const parsed = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            if (!isNaN(parsed.getTime())) return parsed;
        }

        const str = String(rawDate).trim();
        if (!str) return new Date();

        const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (yyyymmddMatch) {
            const year = parseInt(yyyymmddMatch[1], 10);
            const month = parseInt(yyyymmddMatch[2], 10) - 1;
            const day = parseInt(yyyymmddMatch[3], 10);
            const parsed = new Date(year, month, day, 12, 0, 0);
            if (!isNaN(parsed.getTime())) return parsed;
        }

        const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1], 10);
            const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
            const year = parseInt(ddmmyyyyMatch[3], 10);
            const parsed = new Date(year, month, day, 12, 0, 0);
            if (!isNaN(parsed.getTime())) return parsed;
        }

        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) return parsed;

        return new Date();
    };

    const formatMySqlDateTime = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const getFlexibleValue = (obj, candidates) => {
        if (!obj || typeof obj !== 'object') return '';
        const keys = Object.keys(obj);
        for (const cand of candidates) {
            const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const k of keys) {
                const keyNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (keyNorm === candNorm && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
                    return obj[k];
                }
            }
        }
        return '';
    };

    const parseFlexibleNumber = (val, defaultVal = 0) => {
        if (val === undefined || val === null || val === '') return defaultVal;
        if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
        const str = String(val).trim();
        if (!str) return defaultVal;
        const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
        if (!cleaned || cleaned === '-' || cleaned === '.') return defaultVal;
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? defaultVal : parsed;
    };

    const normalizeOrderStatus = (val) => {
        if (!val) return 'ordered';
        const str = String(val).trim().toLowerCase().replace(/[\s\-]+/g, '_');
        if (['ordered', 'draft', 'in_review', 'billed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(str)) {
            return str;
        }
        if (['ordered', 'order', 'order_placed', 'booking', 'booked', 'placed', 'new_order'].includes(str)) {
            return 'ordered';
        }
        if (['completed', 'complete', 'done', 'success', 'closed', 'fulfilled', 'received', 'successful'].includes(str)) {
            return 'delivered';
        }
        if (['in_review', 'review', 'pending_approval', 'under_review', 'inreview', 'reviewing'].includes(str)) {
            return 'in_review';
        }
        if (['dispatched', 'dispatch', 'in_transit', 'transit', 'out_for_delivery', 'shipping'].includes(str)) {
            return 'shipped';
        }
        if (['approved', 'billing_done', 'invoice_generated', 'invoiced', 'billing'].includes(str)) {
            return 'billed';
        }
        if (['packing', 'packed_and_ready', 'ready_for_shipment'].includes(str)) {
            return 'packed';
        }
        if (['canceled', 'rejected', 'void', 'cancel'].includes(str)) {
            return 'cancelled';
        }
        if (['new', 'pending', 'created', 'open'].includes(str)) {
            return 'draft';
        }
        return 'ordered';
    };

    const connection = await pool.getConnection();

    try {
        const isIgnoredValue = (val) => {
            if (!val) return true;
            const str = String(val).trim().toUpperCase();
            return !str || str === '-' || str === '--' || str === 'N/A' || str === 'NA' || str === 'NONE' || str === 'NIL' || str === 'NULL' || str === '0' || str === '0000000000' || str === 'UNKNOWN';
        };

        const extractPhoneNumbersFromString = (str) => {
            if (!str) return [];
            const cleanedRaw = String(str).replace(/\+91/g, ' ').replace(/\b91(?=\d{10}\b)/g, ' ');
            const parts = cleanedRaw.split(/[,;\/|\\&+\n\r\t]|\band\b|\bor\b/i);
            const phones = [];
            parts.forEach(part => {
                let digits = part.replace(/\D/g, '');
                if (!digits) return;
                if (digits.length === 11 && digits.startsWith('0')) digits = digits.substring(1);
                else if (digits.length === 12 && digits.startsWith('91')) digits = digits.substring(2);

                if (digits.length === 10) {
                    if (!phones.includes(digits)) phones.push(digits);
                } else if (digits.length > 10) {
                    const matches = digits.match(/[6-9]\d{9}/g);
                    if (matches) {
                        matches.forEach(m => { if (!phones.includes(m)) phones.push(m); });
                    } else {
                        const last10 = digits.slice(-10);
                        if (last10.length === 10 && !phones.includes(last10)) phones.push(last10);
                    }
                } else if (digits.length >= 7) {
                    if (!phones.includes(digits)) phones.push(digits);
                }
            });
            return phones;
        };

        const extractPhoneNumbersFromObject = (item) => {
            if (!item || typeof item !== 'object') return [];
            const rawValues = [];
            const keys = Object.keys(item);
            for (const k of keys) {
                const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normK.includes('contact') || normK.includes('phone') || normK.includes('mobile') || normK.includes('cell')) {
                    const val = item[k];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                        rawValues.push(String(val).trim());
                    }
                }
            }
            const phones = [];
            rawValues.forEach(raw => {
                const extracted = extractPhoneNumbersFromString(raw);
                extracted.forEach(p => { if (!phones.includes(p)) phones.push(p); });
            });
            return phones;
        };

        // Fetch dealers lookup map
        const [dealersList] = await connection.query(`SELECT dealer_id, dealer_name, phone, gst_no, vrl_code, city, state FROM dealers`);
        const phoneMap = new Map();
        const gstMap = new Map();
        const vrlMap = new Map();
        const nameMap = new Map();

        dealersList.forEach(d => {
            const dPhones = extractPhoneNumbersFromString(d.phone);
            dPhones.forEach(p => {
                if (p && !isIgnoredValue(p) && p.length >= 7) {
                    phoneMap.set(p, d.dealer_id);
                }
            });
            const cleanP = sanitizePhone(d.phone);
            if (cleanP && !isIgnoredValue(cleanP) && cleanP.length >= 7 && !phoneMap.has(cleanP)) {
                phoneMap.set(cleanP, d.dealer_id);
            }
            const cleanGst = d.gst_no ? String(d.gst_no).trim().toUpperCase() : '';
            if (cleanGst && !isIgnoredValue(cleanGst) && cleanGst.length >= 5) {
                gstMap.set(cleanGst, d.dealer_id);
            }
            const cleanVrl = d.vrl_code ? String(d.vrl_code).trim().toUpperCase() : '';
            if (cleanVrl && !isIgnoredValue(cleanVrl)) {
                vrlMap.set(cleanVrl, d.dealer_id);
            }
            if (d.dealer_id) {
                vrlMap.set(String(d.dealer_id), d.dealer_id);
                vrlMap.set(`DLR-${String(d.dealer_id).padStart(3, '0')}`, d.dealer_id);
                vrlMap.set(`DLR-${d.dealer_id}`, d.dealer_id);
            }
            const cleanName = d.dealer_name ? String(d.dealer_name).trim().toLowerCase() : '';
            if (cleanName && !isIgnoredValue(cleanName) && !['agri dealer', 'agri store', 'dealer', 'customer', 'unknown'].includes(cleanName)) {
                nameMap.set(cleanName, d.dealer_id);
            }
        });

        // Fetch products lookup map
        const [productsList] = await connection.query(`SELECT product_id, name, sku, selling_price, dealer_price FROM products`);
        const skuMap = new Map();
        const productNameMap = new Map();

        productsList.forEach(p => {
            if (p.sku && !isIgnoredValue(p.sku)) skuMap.set(String(p.sku).trim().toUpperCase(), p);
            if (p.name && !isIgnoredValue(p.name)) productNameMap.set(String(p.name).trim().toLowerCase(), p);
        });

        let matchedByDealerId = 0;
        let matchedByPhone = 0;
        let matchedByGst = 0;
        let matchedByVrl = 0;
        let matchedByName = 0;
        let autoCreatedDealers = 0;
        let unmatchedDealers = 0;
        let ordersImported = 0;
        let duplicateOrders = 0;
        let errorRows = 0;
        let totalRevenue = 0;

        const affectedDealerIds = new Set();
        const previewResults = [];
        const errorList = [];

        if (!dryRun) {
            await connection.beginTransaction();
        }

        for (let i = 0; i < orders.length; i++) {
            const item = orders[i];
            const dealerIdCode = String(getFlexibleValue(item, ['Dealer ID', 'dealer_id', 'Dealer Code', 'vrl_code', 'VRL CODE', 'VRL Code', 'DLR ID', 'Dealer No', 'Code', 'ID', 'Dealer Code / ID'])).trim().toUpperCase();
            const firmName = String(getFlexibleValue(item, ['Firm Name', 'firm_name', 'dealer_name', 'FIRM / SHOP NAME', 'Firm', 'Shop Name', 'Shop', 'Store Name', 'Store', 'Customer Name', 'Customer', 'Party Name', 'Party', 'Business Name', 'Account Name', 'DEALER NAME', 'FIRM NAME', 'Dealer', 'Name', 'Shop/Firm Name'])).trim();
            const contactPerson = String(getFlexibleValue(item, ['Dealer Name', 'Contact Person', 'contact_person', 'owner_name', 'Owner Name', 'Owner', 'CONTACT', 'CONTACT PERSON', 'Person', 'Contact', 'Dealer Owner'])).trim();
            const rowPhones = extractPhoneNumbersFromObject(item);
            const phone = rowPhones.length > 0 ? rowPhones.join(' / ') : sanitizePhone(getFlexibleValue(item, ['Phone', 'phone', 'phone_number', 'Dealer Phone', 'PHONE', 'Mobile', 'Mobile No', 'Mobile Number', 'Phone No', 'Phone Number', 'Contact No', 'Contact Number', 'Cell', 'Whatsapp']));
            const gstNo = String(getFlexibleValue(item, ['GST No', 'gst_no', 'gst_number', 'GST NO.', 'GST NO', 'GSTIN', 'GST', 'Gst Number', 'Gst No'])).trim().toUpperCase();

            const town = String(getFlexibleValue(item, ['Town', 'town_village', 'Town/Village', 'TOWN/VILLAGE', 'Village', 'Place', 'Location'])).trim();
            const city = String(getFlexibleValue(item, ['City', 'city', 'DISTRICT', 'District', 'TOWN/VILLAGE', 'Taluk', 'State/City'])).trim();
            const state = String(getFlexibleValue(item, ['State', 'state', 'STATE']) || 'Karnataka').trim();
            const pincode = String(getFlexibleValue(item, ['Pincode', 'pincode', 'pin_code', 'PINCODE', 'Pin Code', 'Postal Code', 'ZIP'])).trim();

            let address = String(getFlexibleValue(item, ['Address', 'address', 'ADDRESS', 'Location', 'Dealer Address'])).trim();
            if (!address && (town || city || state)) {
                address = [town, city, state, pincode].filter(Boolean).join(', ');
            }

            const orderDateRaw = getFlexibleValue(item, ['Order Date', 'order_date', 'created_at', 'DATE', 'Date', 'Invoice Date', 'Purchase Date', 'Order Created']);
            const shippedDateRaw = getFlexibleValue(item, ['Shipped Date', 'shipped_date', 'Dispatch Date', 'Dispatched Date', 'Shipping Date']);
            const statusRaw = getFlexibleValue(item, ['Status', 'Order Status', 'order_status', 'ORDER STATUS', 'Delivery Status', 'Current Status']);

            const productSku = String(getFlexibleValue(item, ['Product SKU', 'product_sku', 'sku', 'SKU', 'Product Code', 'Item Code', 'Model'])).trim().toUpperCase();
            const productName = String(getFlexibleValue(item, ['Product', 'Product Name', 'product_name', 'Item Name', 'Items', 'Item', 'Material', 'Goods', 'Particulars', 'Description'])).trim();
            const quantity = Math.max(1, Math.round(parseFlexibleNumber(getFlexibleValue(item, ['Quantity', 'quantity', 'Qty', 'QTY', 'Units', 'Count']), 1)));
            const unitPrice = parseFlexibleNumber(getFlexibleValue(item, ['Unit Price', 'unit_price', 'price', 'Price', 'Rate', 'MRP', 'Cost']), 0);
            
            let totalAmount = parseFlexibleNumber(getFlexibleValue(item, ['Total', 'Total Amount', 'total_amount', 'Grand Total', 'Amount', 'Net Amount', 'Value', 'Bill Amount', 'Invoice Amount']), 0);
            const advancePaid = Math.max(0, parseFlexibleNumber(getFlexibleValue(item, ['Advance', 'Advance Paid', 'advance_amount', 'Paid Amount', 'Paid', 'Deposit']), 0));
            const dueAmountRaw = getFlexibleValue(item, ['Due', 'Balance', 'balance_amount', 'Due Amount', 'Pending Amount', 'Outstanding']);

            const deliveryType = String(getFlexibleValue(item, ['Delivery Type', 'delivery_type', 'Dispatch Method', 'Dispatch'])).trim();
            const paymentMethod = String(getFlexibleValue(item, ['Payment Method', 'payment_method', 'Payment Mode']) || 'Bank Transfer').trim();
            const notes = String(getFlexibleValue(item, ['Notes', 'notes', 'Remarks', 'remarks'])).trim();

            if (!firmName && !phone && !gstNo && !dealerIdCode && totalAmount === 0) continue;

            // 1. DEALER MATCHING CASCADE (Dealer ID -> Phone -> GSTIN -> Firm Name)
            let dealerId = null;
            let matchReason = 'UNMATCHED';

            let matchedPhoneId = null;
            for (const p of rowPhones) {
                if (p && !isIgnoredValue(p) && p.length >= 7 && phoneMap.has(p)) {
                    matchedPhoneId = phoneMap.get(p);
                    break;
                }
            }
            if (!matchedPhoneId && phone && !isIgnoredValue(phone) && phoneMap.has(phone)) {
                matchedPhoneId = phoneMap.get(phone);
            }

            if (dealerIdCode && !isIgnoredValue(dealerIdCode) && vrlMap.has(dealerIdCode)) {
                dealerId = vrlMap.get(dealerIdCode);
                matchReason = 'MATCHED_DEALER_ID';
                matchedByDealerId++;
            } else if (matchedPhoneId) {
                dealerId = matchedPhoneId;
                matchReason = 'MATCHED_PHONE';
                matchedByPhone++;
            } else if (gstNo && !isIgnoredValue(gstNo) && gstNo.length >= 5 && gstMap.has(gstNo)) {
                dealerId = gstMap.get(gstNo);
                matchReason = 'MATCHED_GST';
                matchedByGst++;
            } else if (firmName && !isIgnoredValue(firmName) && nameMap.has(firmName.toLowerCase())) {
                dealerId = nameMap.get(firmName.toLowerCase());
                matchReason = 'MATCHED_NAME';
                matchedByName++;
            }

            // 2. AUTO-CREATE DEALER IF MISSING
            const shouldAutoCreateAll = autoCreateDealers === true || String(autoCreateDealers) === 'true' || autoCreateDealers === 1;
            let shouldAutoCreateThisDealer = false;

            if (shouldAutoCreateAll) {
                if (!Array.isArray(selectedMissingDealers) || selectedMissingDealers.length === 0) {
                    shouldAutoCreateThisDealer = true;
                } else {
                    const rowKeys = [
                        phone ? `phone:${phone}` : '',
                        dealerIdCode ? `code:${String(dealerIdCode).trim().toLowerCase()}` : '',
                        firmName ? `name:${String(firmName).trim().toLowerCase()}` : '',
                        contactPerson ? `name:${String(contactPerson).trim().toLowerCase()}` : ''
                    ].filter(Boolean);

                    shouldAutoCreateThisDealer = selectedMissingDealers.some(sel => {
                        const selNorm = String(sel).toLowerCase().trim();
                        return rowKeys.some(rk => rk === selNorm || selNorm.includes(rk) || rk.includes(selNorm));
                    });
                }
            }

            if (!dealerId && shouldAutoCreateThisDealer) {
                const finalDealerName = firmName || contactPerson || (phone ? `Dealer ${phone}` : null) || (dealerIdCode ? `Dealer ${dealerIdCode}` : null) || `Dealer Import Row ${i + 1}`;
                if (!dryRun) {
                    try {
                        const [res] = await connection.query(
                            `INSERT INTO dealers (
                                dealer_name, contact_person, phone, gst_no, vrl_code, town_village, city, state, pincode, address, status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
                            [
                                finalDealerName,
                                contactPerson || null,
                                phone || null,
                                gstNo || null,
                                dealerIdCode || null,
                                town || null,
                                city || null,
                                state || null,
                                pincode || null,
                                address || null
                            ]
                        );
                        dealerId = res.insertId;
                        if (phone && !isIgnoredValue(phone) && phone.length >= 7) phoneMap.set(phone, dealerId);
                        if (gstNo && !isIgnoredValue(gstNo) && gstNo.length >= 5) gstMap.set(gstNo, dealerId);
                        if (dealerIdCode && !isIgnoredValue(dealerIdCode)) vrlMap.set(dealerIdCode, dealerId);
                        if (finalDealerName && !isIgnoredValue(finalDealerName)) nameMap.set(finalDealerName.toLowerCase(), dealerId);
                        autoCreatedDealers++;
                        matchReason = 'AUTO_CREATED';
                    } catch (dErr) {
                        console.error(`Row ${i + 2}: Error auto-creating dealer "${finalDealerName}":`, dErr.message);
                        try {
                            const [res2] = await connection.query(
                                `INSERT INTO dealers (dealer_name, phone, status) VALUES (?, ?, 'Active')`,
                                [finalDealerName, phone || null]
                            );
                            dealerId = res2.insertId;
                            if (phone && !isIgnoredValue(phone) && phone.length >= 7) phoneMap.set(phone, dealerId);
                            if (finalDealerName && !isIgnoredValue(finalDealerName)) nameMap.set(finalDealerName.toLowerCase(), dealerId);
                            autoCreatedDealers++;
                            matchReason = 'AUTO_CREATED';
                        } catch (dErr2) {
                            console.error(`Row ${i + 2}: Minimal dealer creation failed:`, dErr2.message);
                        }
                    }
                } else {
                    dealerId = 999999;
                    autoCreatedDealers++;
                    matchReason = 'AUTO_CREATED';
                }
            } else if (!dealerId) {
                unmatchedDealers++;
                errorRows++;
                errorList.push({ row: i + 2, error: 'Dealer not found in CRM and auto-create is turned off', firm: firmName, phone });
            }

            if (dealerId && dealerId !== 999999) {
                affectedDealerIds.add(dealerId);
            }

            // 3. PRODUCT MATCHING & AUTO-CREATION
            let matchedProd = null;
            if (productSku && skuMap.has(productSku)) {
                matchedProd = skuMap.get(productSku);
            } else if (productName && productNameMap.has(productName.toLowerCase())) {
                matchedProd = productNameMap.get(productName.toLowerCase());
            }

            const targetProdName = productName || (productSku ? `Product ${productSku}` : '');
            if (!matchedProd && targetProdName) {
                const normName = targetProdName.toLowerCase().trim();
                if (productNameMap.has(normName)) {
                    matchedProd = productNameMap.get(normName);
                } else if (!dryRun) {
                    try {
                        const genSku = productSku || `SKU-${Math.floor(10000 + Math.random() * 90000)}`;
                        const [pRes] = await connection.query(
                            `INSERT INTO products (name, sku, selling_price, dealer_price, status)
                             VALUES (?, ?, ?, ?, 'active')`,
                            [targetProdName, genSku, unitPrice || 0, unitPrice || 0]
                        );
                        matchedProd = {
                            product_id: pRes.insertId,
                            name: targetProdName,
                            sku: genSku,
                            dealer_price: unitPrice || 0
                        };
                        productNameMap.set(normName, matchedProd);
                        if (genSku) skuMap.set(genSku.toUpperCase(), matchedProd);
                    } catch (pErr) {
                        console.error(`Row ${i + 2}: Error auto-creating product "${targetProdName}":`, pErr.message);
                    }
                } else {
                    matchedProd = { product_id: 999999, name: targetProdName };
                    productNameMap.set(normName, matchedProd);
                }
            }

            let price = unitPrice;
            if (price === 0 && matchedProd) {
                price = parseFlexibleNumber(matchedProd.dealer_price || matchedProd.selling_price, 0);
            }
            if (price === 0 && totalAmount > 0 && quantity > 0) {
                price = totalAmount / quantity;
            }

            if (totalAmount === 0) {
                totalAmount = price * quantity;
            }

            const advance = Math.min(totalAmount, advancePaid);
            let balance = totalAmount - advance;
            if (dueAmountRaw !== '' && dueAmountRaw !== null && !isNaN(parseFlexibleNumber(dueAmountRaw, NaN))) {
                balance = Math.max(0, parseFlexibleNumber(dueAmountRaw, 0));
            }

            const parsedOrderDate = parseOrderDate(orderDateRaw);
            const formattedOrderDate = formatMySqlDateTime(parsedOrderDate);

            let formattedShippedDate = null;
            if (shippedDateRaw) {
                const parsedShipped = parseOrderDate(shippedDateRaw);
                formattedShippedDate = formatMySqlDateTime(parsedShipped);
            }

            const finalStatus = normalizeOrderStatus(statusRaw);

            if (dryRun) {
                previewResults.push({
                    firm_name: firmName || 'Unknown Dealer',
                    dealer_id_code: dealerIdCode || '-',
                    phone: phone || '-',
                    gst_no: gstNo || '-',
                    match_reason: matchReason,
                    dealer_id: dealerId,
                    total_amount: totalAmount,
                    advance_amount: advance,
                    balance_amount: balance,
                    order_date: parsedOrderDate.toISOString().split('T')[0],
                    shipped_date: formattedShippedDate ? formattedShippedDate.split(' ')[0] : '-',
                    order_status: finalStatus,
                    matched_product: matchedProd ? matchedProd.name : (productName || 'General Item'),
                    quantity
                });
            } else if (dealerId) {
                const customerName = firmName || contactPerson || 'Agri Dealer';
                const [orderRes] = await connection.query(
                    `INSERT INTO orders (
                        order_source, dealer_id, customer_name, phone, address, city, state,
                        order_status, delivery_type, shipped_date, total_amount, advance_amount, balance_amount, created_by, created_at, updated_at
                    ) VALUES ('dealer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        dealerId, customerName, phone, address, city, state,
                        finalStatus, deliveryType || null, formattedShippedDate, totalAmount, advance, balance,
                        req.user ? req.user.id : null, formattedOrderDate, formattedOrderDate
                    ]
                );

                const newOrderId = orderRes.insertId;

                await connection.query(
                    `INSERT INTO order_items (order_id, product_id, quantity, price, total_price)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        newOrderId,
                        matchedProd ? matchedProd.product_id : null,
                        quantity,
                        price,
                        totalAmount
                    ]
                );

                if (advance > 0) {
                    await connection.query(
                        `INSERT INTO order_payments (order_id, amount, payment_method, payment_date, notes)
                         VALUES (?, ?, ?, ?, ?)`,
                        [newOrderId, advance, paymentMethod, formattedOrderDate, notes || 'Imported Payment']
                    );
                }
            }

            ordersImported++;
            totalRevenue += totalAmount;
        }

        if (!dryRun) {
            await connection.commit();

            const { recalculateDealerStatus } = require('./dealer.controller');
            if (recalculateDealerStatus) {
                for (const dId of affectedDealerIds) {
                    await recalculateDealerStatus(dId, connection);
                }
            }
        }

        const dealersFoundCount = matchedByDealerId + matchedByPhone + matchedByGst + matchedByName;

        res.status(200).json({
            success: true,
            dryRun,
            summary: {
                totalRows: orders.length,
                totalParsed: orders.length,
                dealersFound: dealersFoundCount,
                newDealersToCreate: autoCreatedDealers,
                ordersToCreate: ordersImported,
                validRows: ordersImported,
                duplicateOrders,
                errorRows,
                unmatchedDealers,
                totalRevenue
            },
            errors: errorList.slice(0, 50),
            preview: dryRun ? previewResults.slice(0, 100) : undefined
        });

    } catch (err) {
        if (!dryRun && connection) await connection.rollback();
        console.error('bulkImportOrders Error:', err);
        res.status(500).json({ message: 'Error importing orders: ' + err.message });
    } finally {
        connection.release();
    }
};

