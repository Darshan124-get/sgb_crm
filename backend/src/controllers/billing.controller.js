const pool = require('../config/db');

// Helper to log actions
async function logAudit(connection, data) {
    const { invoice_id, order_id, action, old_value, new_value, changed_by } = data;
    await connection.query(
        `INSERT INTO invoice_logs (invoice_id, order_id, action, old_value, new_value, changed_by) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoice_id || null, order_id || null, action, old_value, new_value, changed_by]
    );
}

async function getVerifiedBalance(connection, orderId) {
    const [orders] = await connection.query('SELECT lead_id FROM orders WHERE order_id = ?', [orderId]);
    const leadId = orders[0]?.lead_id;

    const [payments] = await connection.query(`
        SELECT SUM(amount) as total FROM payments 
        WHERE order_id = ? AND payment_status = 'verified'
    `, [orderId]);

    let leadTotal = 0;
    if (leadId) {
        const [leadPayments] = await connection.query(`
            SELECT SUM(amount) as total FROM lead_advance_payments 
            WHERE lead_id = ? AND verified = 'yes'
        `, [leadId]);
        leadTotal = parseFloat(leadPayments[0]?.total || 0);
    }

    return parseFloat(payments[0]?.total || 0) + leadTotal;
}

const getStats = async (req, res) => {
    try {
        const [pending] = await pool.query("SELECT COUNT(*) as count FROM orders WHERE order_status IN ('draft', 'in_review')");
        const [billedToday] = await pool.query("SELECT COUNT(*) as count FROM invoices WHERE DATE(created_at) = CURRENT_DATE AND invoice_status = 'finalized'");
        const [revenueToday] = await pool.query("SELECT SUM(total_amount) as total FROM invoices WHERE DATE(created_at) = CURRENT_DATE AND invoice_status = 'finalized'");
        const [pendingVerification] = await pool.query("SELECT COUNT(*) as count FROM payments WHERE payment_status = 'pending'");

        res.json({
            pendingBilling: pending[0].count,
            billedToday: billedToday[0].count,
            revenueToday: revenueToday[0].total || 0,
            pendingVerification: pendingVerification[0].count
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching stats: ' + err.message });
    }
};

const getPendingOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT o.*, u.name as sales_person_name, l.source as lead_source,
                   (SELECT COUNT(*) FROM payments p WHERE p.order_id = o.order_id AND p.payment_type = 'advance' AND p.payment_status = 'verified') as advance_verified,
                   (SELECT SUM(amount) FROM payments p WHERE p.order_id = o.order_id AND p.payment_status = 'verified') as advance_paid,
                   (SELECT COUNT(*) FROM payments p WHERE p.order_id = o.order_id AND p.payment_type = 'advance') as has_payment_proof
            FROM orders o
            LEFT JOIN users u ON o.created_by = u.user_id
            LEFT JOIN leads l ON o.lead_id = l.lead_id
            WHERE o.order_status IN ('draft', 'in_review')
            ORDER BY o.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching pending orders: ' + err.message });
    }
};

const getOrdersByStatus = async (req, res) => {
    const { status } = req.query;
    try {
        const [rows] = await pool.query(`
            SELECT o.*, u.name as sales_person_name, 
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.order_id) as item_count,
                   (SELECT SUM(amount) FROM payments WHERE order_id = o.order_id AND payment_status = "verified") as total_paid
            FROM orders o
            LEFT JOIN users u ON o.created_by = u.user_id
            WHERE o.order_status = ?
            ORDER BY o.created_at DESC
        `, [status || 'draft']);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching orders: ' + err.message });
    }
};

const getOrderForBilling = async (req, res) => {
    const { id } = req.params;
    try {
        const [orders] = await pool.query(`
            SELECT o.*, l.delivery_type as lead_delivery_type 
            FROM orders o 
            LEFT JOIN leads l ON o.lead_id = l.lead_id 
            WHERE o.order_id = ?
        `, [id]);
        if (!orders.length) return res.status(404).json({ message: 'Order not found' });

        const [items] = await pool.query(`
            SELECT oi.*, p.name as product_name, p.sku, p.hsn_code, i.current_stock, i.reserved_stock
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            JOIN inventory i ON p.product_id = i.product_id
            WHERE oi.order_id = ?
        `, [id]);

        const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [id]);

        // Fetch lead advances if order has lead_id
        let leadAdvances = [];
        if (orders[0].lead_id) {
            const [advances] = await pool.query(`
                SELECT advance_id, amount, payment_mode, screenshot_url as proof_url, 
                       verified, created_at, 'lead_advance' as source
                FROM lead_advance_payments 
                WHERE lead_id = ?
            `, [orders[0].lead_id]);
            leadAdvances = advances;
        }

        const [logs] = await pool.query(`
            SELECT l.*, u.name as user_name 
            FROM invoice_logs l 
            LEFT JOIN users u ON l.changed_by = u.user_id 
            WHERE l.order_id = ? 
            ORDER BY l.timestamp DESC
        `, [id]);

        res.json({
            ...orders[0],
            items,
            payments: [...payments, ...leadAdvances],
            logs
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching order details: ' + err.message });
    }
};

const updateOrderItems = async (req, res) => {
    const { id } = req.params;
    const { items, discount, shipping_charges } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Check if locked
        const [current] = await connection.query('SELECT order_status, is_locked FROM orders WHERE order_id = ? FOR UPDATE', [id]);
        if (!current.length) throw new Error('Order not found');
        if (current[0].is_locked || current[0].order_status === 'billed') {
            throw new Error('This order is locked and cannot be edited.');
        }

        const [oldItems] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [id]);

        let newSubtotal = 0;

        // 2. Process Items (Add/Update)
        for (const item of items) {
            const oldItem = oldItems.find(oi => oi.product_id === item.product_id);
            const qtyDiff = parseInt(item.quantity) - (oldItem ? oldItem.quantity : 0);
            const priceDiff = parseFloat(item.price) - (oldItem ? parseFloat(oldItem.price) : 0);

            if (qtyDiff !== 0 || priceDiff !== 0) {
                // Adjust reservation if quantity changed
                if (qtyDiff !== 0) {
                    await connection.query('UPDATE inventory SET reserved_stock = reserved_stock + ? WHERE product_id = ?', [qtyDiff, item.product_id]);
                }

                await logAudit(connection, {
                    order_id: id,
                    action: 'ITEM_UPDATE',
                    old_value: oldItem ? `Qty: ${oldItem.quantity}, Price: ${oldItem.price}` : 'New Item',
                    new_value: `Qty: ${item.quantity}, Price: ${item.price}`,
                    changed_by: req.user.id
                });
            }

            const totalItemPrice = parseFloat(item.quantity) * parseFloat(item.price);
            newSubtotal += totalItemPrice;

            if (oldItem) {
                await connection.query('UPDATE order_items SET quantity = ?, price = ?, total_price = ? WHERE order_item_id = ?',
                    [item.quantity, item.price, totalItemPrice, oldItem.order_item_id]);
            } else {
                await connection.query('INSERT INTO order_items (order_id, product_id, quantity, price, total_price) VALUES (?, ?, ?, ?, ?)',
                    [id, item.product_id, item.quantity, item.price, totalItemPrice]);
            }
        }

        // 3. Handle Removed Items
        for (const oi of oldItems) {
            if (!items.find(i => i.product_id === oi.product_id)) {
                await connection.query('UPDATE inventory SET reserved_stock = reserved_stock - ? WHERE product_id = ?', [oi.quantity, oi.product_id]);
                await connection.query('DELETE FROM order_items WHERE order_item_id = ?', [oi.order_item_id]);

                await logAudit(connection, {
                    order_id: id,
                    action: 'ITEM_REMOVED',
                    old_value: `Product ID: ${oi.product_id}`,
                    new_value: 'Removed from order',
                    changed_by: req.user.id
                });
            }
        }

        // 4. Update order totals
        // Note: total_amount in orders table is actually the 'payable subtotal' before invoice tax
        const finalSubtotal = newSubtotal - (parseFloat(discount || 0)) + (parseFloat(shipping_charges || 0));
        await connection.query('UPDATE orders SET total_amount = ?, order_status = "in_review" WHERE order_id = ?', [finalSubtotal, id]);

        await connection.commit();
        res.json({ message: 'Order structure updated successfully', newSubtotal: finalSubtotal });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) {}
        res.status(500).json({ message: 'Error updating items: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
};

const generateInvoice = async (req, res) => {
    const { id } = req.params;
    const { 
        discount, shipping_charges, tax_type, status = 'draft', is_tax_overridden, manual_tax,
        delivery_note, dispatch_through, destination, payment_terms 
    } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [orders] = await connection.query('SELECT * FROM orders WHERE order_id = ? FOR UPDATE', [id]);
        if (!orders.length) throw new Error('Order not found');
        const order = orders[0];

        if (order.order_status === 'billed') {
            throw new Error('Order is already billed.');
        }

        // 1. Precise Sequence Generation
        const [settingsRows] = await connection.query('SELECT setting_key, setting_value FROM settings FOR UPDATE');
        const settings = {};
        settingsRows.forEach(r => settings[r.setting_key] = r.setting_value);

        // Check if a finalized invoice already exists for this order
        const [existingFinalized] = await connection.query('SELECT invoice_id FROM invoices WHERE order_id = ? AND invoice_status = "finalized"', [id]);
        if (existingFinalized.length > 0) {
            throw new Error('A finalized invoice already exists for this order.');
        }

        // Check if draft invoice already exists for this order
        const [existingInvoices] = await connection.query('SELECT invoice_id, invoice_number, invoice_status FROM invoices WHERE order_id = ? AND invoice_status = "draft"', [id]);

        let invoiceId;
        let invoiceNumber;

        if (existingInvoices.length > 0) {
            invoiceId = existingInvoices[0].invoice_id;
            invoiceNumber = existingInvoices[0].invoice_number;
        } else {
            const prefix = settings.invoice_prefix || 'SGB';
            const year = new Date().getFullYear();
            const month = new Date().getMonth() + 1;
            const finYear = month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;

            let nextSeq = parseInt(settings.last_invoice_num || 0) + 1;
            invoiceNumber = `${nextSeq.toString().padStart(4, '0')}/${finYear}`;

            await connection.query("UPDATE settings SET setting_value = ? WHERE setting_key = 'last_invoice_num'", [nextSeq.toString()]);
        }

        // 2. Tax Calculations
        const subtotal = parseFloat(order.total_amount);
        let cgst = 0, sgst = 0, igst = 0;

        if (is_tax_overridden && (req.user.role === 'admin' || req.user.role === 'billing')) {
            cgst = parseFloat(manual_tax?.cgst || 0);
            sgst = parseFloat(manual_tax?.sgst || 0);
            igst = parseFloat(manual_tax?.igst || 0);
        } else {
            const companyState = (settings.company_state || 'Karnataka').toLowerCase();
            const customerState = (order.state || '').toLowerCase();
            const gstRate = parseFloat(settings.gst_rate || 5); // Default to 5% for SGB Dumper

            if (companyState === customerState) {
                cgst = subtotal * (gstRate / 200);
                sgst = subtotal * (gstRate / 200);
            } else {
                igst = subtotal * (gstRate / 100);
            }
        }

        const grandTotal = subtotal + cgst + sgst + igst;

        // 3. Upsert Invoice Record
        if (invoiceId) {
            await connection.query(`
                UPDATE invoices SET 
                    billing_name = ?, 
                    billing_address = ?, 
                    gst_number = ?, 
                    subtotal = ?, 
                    discount = ?, 
                    shipping_charges = ?, 
                    tax_type = ?, 
                    cgst = ?, 
                    sgst = ?, 
                    igst = ?, 
                    total_amount = ?, 
                    invoice_status = ?, 
                    is_tax_overridden = ?,
                    delivery_note = ?,
                    dispatch_through = ?,
                    destination = ?,
                    payment_terms = ?,
                    created_by = ?
                WHERE invoice_id = ?
            `, [
                order.customer_name, order.address, order.gst_number || '',
                subtotal, discount || 0, shipping_charges || 0, tax_type || 'CGST_SGST',
                cgst, sgst, igst, grandTotal, status, is_tax_overridden ? 1 : 0, 
                delivery_note || '', dispatch_through || '', destination || '', payment_terms || '',
                req.user.id, invoiceId
            ]);
        } else {
            const [invResult] = await connection.query(`
                INSERT INTO invoices (
                    order_id, invoice_number, invoice_date, billing_name, billing_address, 
                    gst_number, subtotal, discount, shipping_charges, tax_type, 
                    cgst, sgst, igst, total_amount, invoice_status, is_tax_overridden, 
                    delivery_note, dispatch_through, destination, payment_terms, created_by
                ) VALUES (?, ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, invoiceNumber, order.customer_name, order.address,
                order.gst_number || '', subtotal, discount || 0, shipping_charges || 0,
                tax_type || 'CGST_SGST', cgst, sgst, igst, grandTotal, status, is_tax_overridden ? 1 : 0,
                delivery_note || '', dispatch_through || '', destination || '', payment_terms || '', req.user.id
            ]);
            invoiceId = invResult.insertId;
        }

        // 4. Preserve Item Snapshot
        await connection.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
        const [items] = await connection.query(`
            SELECT oi.*, p.hsn_code 
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id = ?
        `, [id]);

        for (const item of items) {
            await connection.query(
                'INSERT INTO invoice_items (invoice_id, product_id, hsn_code, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)',
                [invoiceId, item.product_id, item.hsn_code || '', item.quantity, item.price, item.total_price]
            );
        }


        // 5. Finalize Action if requested
        if (status === 'finalized') {
            const verifiedTotal = await getVerifiedBalance(connection, id);
            const isFullyPaid = verifiedTotal >= grandTotal;

            // Always move to packing regardless of payment status as per user request
            await connection.query('UPDATE orders SET order_status = "billed", is_locked = 1, billing_done_by = ? WHERE order_id = ?', [req.user.id, id]);
            await connection.query('INSERT INTO packing (order_id, status) VALUES (?, "pending") ON DUPLICATE KEY UPDATE status="pending"', [id]);

            await logAudit(connection, {
                invoice_id: invoiceId,
                order_id: id,
                action: 'INVOICE_GENERATED_FINAL',
                old_value: 'N/A',
                new_value: isFullyPaid ? 'Billed/Packing (Paid)' : 'Billed/Packing (Credit)',
                changed_by: req.user.id
            });
        }
 else {
            await connection.query('UPDATE orders SET order_status = "in_review" WHERE order_id = ?', [id]);
        }

        await connection.commit();
        res.status(201).json({
            message: status === 'finalized' ? 'Invoice generated and finalized' : 'Draft invoice updated and order locked',
            invoiceId,
            invoiceNumber
        });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) {}
        res.status(500).json({ message: 'Error generating invoice: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
};

const finalizeInvoice = async (req, res) => {
    const { id } = req.params; // invoice_id
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [invoices] = await connection.query('SELECT * FROM invoices WHERE invoice_id = ? FOR UPDATE', [id]);
        if (!invoices.length) throw new Error('Invoice not found');
        if (invoices[0].invoice_status !== 'draft') throw new Error('Invoice already finalized');

        // 1. Update Statuses
        await connection.query('UPDATE invoices SET invoice_status = "finalized" WHERE invoice_id = ?', [id]);

        const invoiceTotal = parseFloat(invoices[0].total_amount);
        const verifiedTotal = await getVerifiedBalance(connection, invoices[0].order_id);
        const isFullyPaid = verifiedTotal >= invoiceTotal;

        if (isFullyPaid) {
            await connection.query(`
                UPDATE orders 
                SET order_status = "billed", is_locked = 1, billing_done_by = ? 
                WHERE order_id = ?
            `, [req.user.id, invoices[0].order_id]);
            await connection.query('INSERT INTO packing (order_id, status) VALUES (?, "pending") ON DUPLICATE KEY UPDATE status="pending"', [invoices[0].order_id]);
        } else {
            await connection.query(`
                UPDATE orders 
                SET order_status = "in_review", is_locked = 1, billing_done_by = ? 
                WHERE order_id = ?
            `, [req.user.id, invoices[0].order_id]);
        }

        // 4. Log Audit
        await logAudit(connection, {
            invoice_id: id,
            order_id: invoices[0].order_id,
            action: isFullyPaid ? 'INVOICE_FINALIZED' : 'INVOICE_FINALIZED_PARTIAL',
            old_value: 'draft',
            new_value: isFullyPaid ? 'finalized/packing' : 'finalized/awaiting_payment',
            changed_by: req.user.id
        });

        await connection.commit();
        res.json({ message: 'Invoice finalized. Order is now ready for Packing.' });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) {}
        res.status(500).json({ message: err.message });
    } finally {
        if (connection) connection.release();
    }
};

const getPayments = async (req, res) => {
    try {
        const { status } = req.query;
        let query = `
            SELECT p.*, o.customer_name as customer_name, o.order_id 
            FROM payments p
            JOIN orders o ON p.order_id = o.order_id
        `;
        const params = [];

        if (status) {
            query += ' WHERE p.payment_status = ?';
            params.push(status);
        }

        query += ' ORDER BY p.created_at DESC';

        const [payments] = await pool.query(query, params);
        res.json(payments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching payments: ' + err.message });
    }
};

const addPayment = async (req, res) => {
    const { order_id, amount, mode, type, proof_url } = req.body;
    try {
        await pool.query(`
            INSERT INTO payments (order_id, amount, payment_mode, payment_type, proof_url, payment_status, created_at) 
            VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
        `, [order_id, amount, mode, type, proof_url]);

        res.status(201).json({ message: 'Payment recorded and awaiting verification' });
    } catch (err) {
        res.status(500).json({ message: 'Error recording payment: ' + err.message });
    }
};

const verifyLeadAdvance = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // verified / rejected
    const verified = status === 'verified' ? 'yes' : 'no';

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Update Lead Advance Record
        await connection.query(`
            UPDATE lead_advance_payments 
            SET verified = ?, verified_by = ?
            WHERE advance_id = ?
        `, [verified, req.user.id, id]);

        if (verified === 'yes') {
            // 2. Find associated order
            const [advances] = await connection.query('SELECT lead_id FROM lead_advance_payments WHERE advance_id = ?', [id]);
            const leadId = advances[0]?.lead_id;

            if (leadId) {
                const [orders] = await connection.query('SELECT order_id FROM orders WHERE lead_id = ?', [leadId]);
                const orderId = orders[0]?.order_id;
                
                if (orderId) {
                    const [invoices] = await connection.query('SELECT * FROM invoices WHERE order_id = ? AND invoice_status = "finalized"', [orderId]);

                    if (invoices.length > 0) {
                        const verifiedTotal = await getVerifiedBalance(connection, orderId);
                        const grandTotal = parseFloat(invoices[0].total_amount);

                        if (verifiedTotal >= grandTotal) {
                            await connection.query(`
                                UPDATE orders SET order_status = "billed", is_locked = 1, billing_done_by = ? 
                                WHERE order_id = ?
                            `, [req.user.id, orderId]);
                            await connection.query('INSERT INTO packing (order_id, status) VALUES (?, "pending") ON DUPLICATE KEY UPDATE status="pending"', [orderId]);
                        }
                    }
                }
            }
        }

        await connection.commit();
        res.json({ message: 'Lead advance status updated' });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) {}
        console.error('Verify Lead Advance Error:', err);
        res.status(500).json({ message: 'Error verifying lead advance: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
};

const verifyPayment = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // verified / rejected
    if (!['verified', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Update Payment Status
        await connection.query(`
            UPDATE payments 
            SET payment_status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP 
            WHERE payment_id = ?
        `, [status, req.user.id, id]);

        if (status === 'verified') {
            // 2. Get Order & Invoice Details
            const [pRecs] = await connection.query('SELECT order_id FROM payments WHERE payment_id = ?', [id]);
            const orderId = pRecs[0]?.order_id;

            if (orderId) {
                const [orders] = await connection.query('SELECT * FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
                const [invoices] = await connection.query('SELECT * FROM invoices WHERE order_id = ? AND invoice_status = "finalized"', [orderId]);

                if (invoices.length > 0) {
                const verifiedTotal = await getVerifiedBalance(connection, orderId);
                const grandTotal = parseFloat(invoices[0].total_amount);

                if (verifiedTotal >= grandTotal) {
                    // 3. Move to Packing
                    await connection.query(`
                        UPDATE orders 
                        SET order_status = "billed", is_locked = 1, billing_done_by = ? 
                        WHERE order_id = ?
                    `, [req.user.id, orderId]);

                    await connection.query('INSERT INTO packing (order_id, status) VALUES (?, "pending") ON DUPLICATE KEY UPDATE status="pending"', [orderId]);

                    await logAudit(connection, {
                        invoice_id: invoices[0].invoice_id,
                        order_id: orderId,
                        action: 'AUTO_FINALIZED_ON_PAYMENT',
                        old_value: 'Awaiting Payment',
                        new_value: 'Billed/Packing',
                        changed_by: req.user.id
                    });
                    }
                }
            }
        }

        await connection.commit();
        res.json({ message: 'Payment status updated' });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) {}
        console.error('Verify Payment Error:', err);
        res.status(500).json({ message: 'Error verifying payment: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
};

const getAllInvoices = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT i.*, o.customer_name as order_customer 
            FROM invoices i 
            LEFT JOIN orders o ON i.order_id = o.order_id 
            ORDER BY i.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching invoices: ' + err.message });
    }
};

const getInvoiceById = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Fetch Settings
        const [rows] = await pool.query('SELECT * FROM settings');
        const settings = {};
        rows.forEach(r => settings[r.setting_key] = r.setting_value);

        // 2. Fetch Invoice & Order Details
        const [invoices] = await pool.query(`
            SELECT i.*, o.customer_name, o.phone, o.address, o.city, o.state, o.pincode,
                   o.shipping_name, o.shipping_address, o.shipping_city, o.shipping_state, o.shipping_pincode,
                   o.created_at as order_date
            FROM invoices i
            JOIN orders o ON i.order_id = o.order_id
            WHERE i.invoice_id = ?
        `, [id]);

        if (!invoices.length) return res.status(404).json({ message: 'Invoice not found' });

        // 3. Fetch Items with HSN
        const [items] = await pool.query(`
            SELECT ii.*, p.name as product_name, p.sku, p.unit
            FROM invoice_items ii
            LEFT JOIN products p ON ii.product_id = p.product_id
            WHERE ii.invoice_id = ?
        `, [id]);

        const invoice = invoices[0];
        const amountInWords = numberToWords(invoice.total_amount);

        res.json({ 
            ...invoice, 
            items, 
            settings,
            amount_in_words: amountInWords
        });
    } catch (err) {
        console.error('getInvoiceById Error:', err);
        res.status(500).json({ message: 'Error fetching invoice: ' + err.message });
    }
};


const getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM settings');
        const settings = {};
        rows.forEach(r => settings[r.setting_key] = r.setting_value);
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching settings: ' + err.message });
    }
};

const updateSettings = async (req, res) => {
    const settings = req.body; // { key: value }
    try {
        for (const [key, value] of Object.entries(settings)) {
            await pool.query('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        }
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating settings: ' + err.message });
    }
};

const printInvoice = async (req, res) => {
    const { id } = req.params;
    try {
        const [invoices] = await pool.query('SELECT * FROM invoices WHERE invoice_id = ?', [id]);
        if (!invoices.length) return res.status(404).send('Invoice not found');
        const invoice = invoices[0];

        const [items] = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);

        // Simple HTML template for printing
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice - ${invoice.invoice_number}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #333; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
                    .invoice-title { font-size: 24px; font-weight: bold; }
                    .details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                    th { text-align: left; background: #f8f8f8; padding: 12px; border-bottom: 1px solid #ddd; }
                    td { padding: 12px; border-bottom: 1px solid #eee; }
                    .totals { float: right; width: 300px; }
                    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
                    .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="no-print" style="margin-bottom: 20px; text-align: right;">
                    <button onclick="window.print()">Print Invoice</button>
                    <button onclick="window.close()">Close</button>
                </div>
                <div class="header">
                    <div>
                        <div class="invoice-title">SGB AGRO</div>
                        <p>Address Line 1, City, State, ZIP<br>GSTIN: 27XXXXXXXXXXXXZ</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin:0;">Tax Invoice</h2>
                        <p>Invoice #: ${invoice.invoice_number}<br>Date: ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="details">
                    <div>
                        <h3>Bill To:</h3>
                        <p><strong>${invoice.billing_name}</strong><br>${invoice.billing_address}<br>GSTIN: ${invoice.gst_number || 'N/A'}</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th style="text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td>Product #${item.product_id}</td>
                                <td>${item.quantity}</td>
                                <td>₹${parseFloat(item.price).toLocaleString()}</td>
                                <td style="text-align: right;">₹${parseFloat(item.total).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="totals">
                    <div class="total-row"><span>Subtotal:</span> <span>₹${parseFloat(invoice.subtotal).toLocaleString()}</span></div>
                    ${invoice.cgst > 0 ? `<div class="total-row"><span>CGST:</span> <span>₹${parseFloat(invoice.cgst).toLocaleString()}</span></div>` : ''}
                    ${invoice.sgst > 0 ? `<div class="total-row"><span>SGST:</span> <span>₹${parseFloat(invoice.sgst).toLocaleString()}</span></div>` : ''}
                    ${invoice.igst > 0 ? `<div class="total-row"><span>IGST:</span> <span>₹${parseFloat(invoice.igst).toLocaleString()}</span></div>` : ''}
                    <div class="total-row grand-total"><span>Grand Total:</span> <span>₹${parseFloat(invoice.total_amount).toLocaleString()}</span></div>
                </div>
            </body>
            </html>
        `;
        res.send(html);
    } catch (err) {
        res.status(500).send('Error generating invoice print view');
    }
};

const numberToWords = (num) => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const format = (n) => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + format(n % 100) : '');
        if (n < 100000) return format(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + format(n % 1000) : '');
        if (n < 10000000) return format(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + format(n % 100000) : '');
        return format(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + format(n % 10000000) : '');
    };

    const [whole, decimal] = num.toString().split('.');
    let res = format(parseInt(whole)) + ' Only';
    
    if (decimal && parseInt(decimal.padEnd(2, '0')) > 0) {
        res = format(parseInt(whole)) + ' and ' + format(parseInt(decimal.padEnd(2, '0'))) + ' Paise Only';
    }
    return 'INR ' + res;
};

module.exports = {
    getStats,
    getPendingOrders,
    getOrderForBilling,
    updateOrderItems,
    addPayment,
    verifyPayment,
    verifyLeadAdvance,
    generateInvoice,
    finalizeInvoice,
    getAllInvoices,
    getInvoiceById,
    getSettings,
    updateSettings,
    getPayments,
    printInvoice,
    getOrdersByStatus
};
