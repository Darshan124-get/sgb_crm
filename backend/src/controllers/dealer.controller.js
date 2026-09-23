const pool = require('../config/db');

const ensureOrderPaymentsTable = async (db = pool) => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS order_payments (
                payment_id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                payment_method VARCHAR(50) DEFAULT 'Bank Transfer',
                payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        try {
            await db.query(`ALTER TABLE order_payments ADD COLUMN payment_date DATETIME DEFAULT CURRENT_TIMESTAMP`);
        } catch (e) { /* column exists */ }
        try {
            await db.query(`ALTER TABLE order_payments ADD COLUMN notes TEXT`);
        } catch (e) { /* column exists */ }
        try {
            await db.query(`ALTER TABLE orders ADD COLUMN shipped_date DATETIME NULL`);
        } catch (e) { /* column exists */ }
    } catch (err) {
        console.error('ensureOrderPaymentsTable Error:', err);
    }
};

function parseOrderDate(dateInputStr) {
    if (!dateInputStr) return new Date();
    const str = String(dateInputStr).trim();
    if (!str) return new Date();

    const now = new Date();

    // 1. YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
    }

    // 2. DD-MM-YYYY or DD/MM/YYYY
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
        const parts = str.split(/[-/]/).map(Number);
        const [d, m, y] = parts;
        return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
    }

    // 3. ISO or Date string
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }

    return new Date();
}

const recalculateDealerStatus = async (dealerId, db = pool) => {
    if (!dealerId) return null;
    try {
        const [orderRows] = await db.query(
            `SELECT MAX(created_at) as last_order_date 
             FROM orders 
             WHERE dealer_id = ? AND (order_status IS NULL OR LOWER(order_status) != 'cancelled')`,
            [dealerId]
        );

        const lastOrderDate = orderRows[0]?.last_order_date ? new Date(orderRows[0].last_order_date) : null;
        let computedStatus = 'Inactive';
        let remainingDays = 0;
        let activeUntilDate = null;

        if (lastOrderDate && !isNaN(lastOrderDate.getTime())) {
            const now = new Date();
            const effectiveOrderDate = lastOrderDate.getTime() > now.getTime() ? now : lastOrderDate;
            activeUntilDate = new Date(effectiveOrderDate.getTime() + 45 * 24 * 60 * 60 * 1000);
            const diffMs = activeUntilDate.getTime() - now.getTime();
            const rawDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            remainingDays = Math.min(45, Math.max(0, rawDays));
            if (remainingDays > 0) {
                computedStatus = 'Active';
            } else {
                computedStatus = 'Inactive';
                remainingDays = 0;
            }
        }

        await db.query(`UPDATE dealers SET status = ? WHERE dealer_id = ?`, [computedStatus, dealerId]);

        return {
            dealer_id: dealerId,
            last_order_date: lastOrderDate ? lastOrderDate.toISOString() : null,
            active_until: activeUntilDate ? activeUntilDate.toISOString() : null,
            remaining_days: remainingDays,
            status: computedStatus,
            has_orders: !!lastOrderDate
        };
    } catch (err) {
        console.error(`Error recalculating status for dealer ${dealerId}:`, err);
        return null;
    }
};

exports.recalculateDealerStatus = recalculateDealerStatus;

exports.getDealers = async (req, res) => {
    try {
        const query = `
            SELECT 
                d.*,
                (
                    SELECT MAX(o.created_at)
                    FROM orders o
                    WHERE o.dealer_id = d.dealer_id AND (o.order_status IS NULL OR LOWER(o.order_status) != 'cancelled')
                ) as last_order_date,
                IFNULL((
                    SELECT SUM(IFNULL(o.total_amount, 0))
                    FROM orders o
                    WHERE o.dealer_id = d.dealer_id AND (o.order_status IS NULL OR LOWER(o.order_status) != 'cancelled')
                ), 0) as total_business
            FROM dealers d
            ORDER BY total_business DESC, d.created_at DESC
        `;
        const [rows] = await pool.query(query);

        const now = new Date();
        const updatedRows = await Promise.all(rows.map(async (d) => {
            let lastOrderDate = null;
            if (d.last_order_date) {
                const parsed = new Date(d.last_order_date);
                if (!isNaN(parsed.getTime())) {
                    lastOrderDate = parsed;
                }
            }

            let computedStatus = 'Inactive';
            let remainingDays = 0;
            let activeUntilDate = null;

            if (lastOrderDate) {
                const effectiveOrderDate = lastOrderDate.getTime() > now.getTime() ? now : lastOrderDate;
                activeUntilDate = new Date(effectiveOrderDate.getTime() + 45 * 24 * 60 * 60 * 1000);
                const diffMs = activeUntilDate.getTime() - now.getTime();
                const rawDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                remainingDays = Math.min(45, Math.max(0, rawDays));
                if (remainingDays > 0) {
                    computedStatus = 'Active';
                } else {
                    computedStatus = 'Inactive';
                    remainingDays = 0;
                }
            }

            // Keep dealers table status in sync
            if (d.status !== computedStatus) {
                try {
                    await pool.query('UPDATE dealers SET status = ? WHERE dealer_id = ?', [computedStatus, d.dealer_id]);
                } catch (e) {
                    console.error('Error syncing dealer status in DB:', e);
                }
            }

            return {
                ...d,
                total_business: parseFloat(d.total_business || 0),
                last_order_date: lastOrderDate ? lastOrderDate.toISOString() : null,
                active_until: activeUntilDate ? activeUntilDate.toISOString() : null,
                remaining_days: remainingDays,
                status: computedStatus,
                computed_status: computedStatus,
                has_orders: !!lastOrderDate
            };
        }));

        res.json(updatedRows);
    } catch (err) {
        console.error('getDealers Error:', err);
        res.status(500).json({ message: 'Error fetching dealers' });
    }
};

exports.createDealer = async (req, res) => {
    const {
        dealer_name, firm_name,
        contact_person, owner_name, dealer_owner_name,
        phone, phone_number, contact,
        email, address, town_village, city, taluk, district, state, pincode, pin_code,
        visited_date, visited_by, gst_no, gst_number,
        nearest_vrl, vrl_code, status, image_url, image
    } = req.body;

    const finalDealerName = firm_name || dealer_name || 'Agri Dealer Store';
    const finalContactPerson = owner_name || dealer_owner_name || contact_person || '';
    const finalPhone = phone_number || phone || contact || '';
    const finalPincode = pincode || pin_code || '';
    const finalGstNo = gst_no || gst_number || '';
    const finalStatus = status || 'Active';
    const finalImageUrl = image_url || image || '';

    // Construct address summary if separate fields passed
    let finalAddress = address;
    if (!finalAddress) {
        const parts = [];
        if (town_village) parts.push(town_village);
        if (taluk) parts.push(`${taluk} Taluk`);
        if (city) parts.push(city);
        if (district && district !== city) parts.push(district);
        if (state) parts.push(state);
        if (finalPincode) parts.push(finalPincode);
        finalAddress = parts.join(', ');
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO dealers (
                dealer_name, contact_person, phone, email, address, town_village, city, taluk, district, state, pincode,
                visited_date, visited_by, gst_no, nearest_vrl, vrl_code, status, image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                finalDealerName, finalContactPerson, finalPhone, email || '', finalAddress || '',
                town_village || '', city || '', taluk || '', district || '', state || '', finalPincode,
                visited_date || '', visited_by || '', finalGstNo, nearest_vrl || '', vrl_code || '', finalStatus, finalImageUrl
            ]
        );
        res.status(201).json({ message: 'Dealer added successfully', dealer_id: result.insertId });
    } catch (err) {
        console.error('createDealer Error:', err);
        res.status(500).json({ message: 'Error adding dealer: ' + err.message });
    }
};

exports.updateDealer = async (req, res) => {
    const {
        dealer_name, firm_name,
        contact_person, owner_name, dealer_owner_name,
        phone, phone_number, contact,
        email, address, town_village, city, taluk, district, state, pincode, pin_code,
        visited_date, visited_by, gst_no, gst_number,
        nearest_vrl, vrl_code, status, image_url, image
    } = req.body;

    const finalDealerName = firm_name || dealer_name || '';
    const finalContactPerson = owner_name || dealer_owner_name || contact_person || '';
    const finalPhone = phone_number || phone || contact || '';
    const finalPincode = pincode || pin_code || '';
    const finalGstNo = gst_no || gst_number || '';
    const finalStatus = status || 'Active';
    const finalImageUrl = image_url || image || '';

    let finalAddress = address;
    if (!finalAddress || town_village || city || state) {
        const parts = [];
        if (town_village) parts.push(town_village);
        if (taluk) parts.push(`${taluk} Taluk`);
        if (city) parts.push(city);
        if (district && district !== city) parts.push(district);
        if (state) parts.push(state);
        if (finalPincode) parts.push(finalPincode);
        finalAddress = parts.join(', ');
    }

    try {
        const [result] = await pool.query(
            `UPDATE dealers SET 
                dealer_name = ?,
                contact_person = ?,
                phone = ?,
                email = ?,
                address = ?,
                town_village = ?,
                city = ?,
                taluk = ?,
                district = ?,
                state = ?,
                pincode = ?,
                visited_date = ?,
                visited_by = ?,
                gst_no = ?,
                nearest_vrl = ?,
                vrl_code = ?,
                status = ?,
                image_url = ?
            WHERE dealer_id = ?`,
            [
                finalDealerName, finalContactPerson, finalPhone, email || '', finalAddress || '',
                town_village || '', city || '', taluk || '', district || '', state || '', finalPincode || '',
                visited_date || '', visited_by || '', finalGstNo || '', nearest_vrl || '', vrl_code || '', finalStatus,
                finalImageUrl, req.params.id
            ]
        );

        // Keep orders table customer_name & info in sync with updated dealer
        if (finalDealerName) {
            await pool.query(
                `UPDATE orders SET 
                    customer_name = ?,
                    phone = ?,
                    address = ?,
                    city = ?,
                    state = ?,
                    district = ?,
                    pincode = ?
                WHERE dealer_id = ?`,
                [
                    finalDealerName,
                    finalPhone || '',
                    finalAddress || '',
                    city || '',
                    state || '',
                    district || '',
                    finalPincode || '',
                    req.params.id
                ]
            );
        }

        res.json({ message: 'Dealer updated successfully', affectedRows: result.affectedRows });
    } catch (err) {
        console.error('updateDealer Error:', err);
        res.status(500).json({ message: 'Error updating dealer: ' + err.message });
    }
};

exports.deleteDealer = async (req, res) => {
    try {
        await pool.query('DELETE FROM dealers WHERE dealer_id = ?', [req.params.id]);
        res.json({ message: 'Dealer deleted successfully' });
    } catch (err) {
        console.error('deleteDealer Error:', err);
        res.status(500).json({ message: 'Error deleting dealer' });
    }
};

exports.bulkDeleteDealers = async (req, res) => {
    const { dealerIds } = req.body;
    if (!Array.isArray(dealerIds) || dealerIds.length === 0) {
        return res.status(400).json({ message: 'No dealer IDs provided for bulk deletion' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Delete order items for these dealers' orders
        await connection.query(
            `DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE dealer_id IN (?))`,
            [dealerIds]
        );

        // 2. Delete order payments
        try {
            await connection.query(
                `DELETE FROM order_payments WHERE order_id IN (SELECT order_id FROM orders WHERE dealer_id IN (?))`,
                [dealerIds]
            );
        } catch (e) {}

        // 3. Delete orders for these dealers
        await connection.query(`DELETE FROM orders WHERE dealer_id IN (?)`, [dealerIds]);

        // 4. Delete dealers
        const [result] = await connection.query(`DELETE FROM dealers WHERE dealer_id IN (?)`, [dealerIds]);

        await connection.commit();
        res.json({ success: true, count: result.affectedRows, message: `Successfully deleted ${result.affectedRows} dealer(s)` });
    } catch (err) {
        await connection.rollback();
        console.error('bulkDeleteDealers Error:', err);
        res.status(500).json({ message: 'Error deleting dealers: ' + err.message });
    } finally {
        connection.release();
    }
};

exports.createDealerOrder = async (req, res) => {
    const dealerId = req.params.id;
    const {
        items,
        total_amount,
        advance_amount,
        balance_amount,
        payment_type,
        delivery_type,
        payment_method,
        payment_date,
        order_date,
        purchased_date,
        notes
    } = req.body;

    const dateInputStr = payment_date || order_date || purchased_date;
    const orderDate = parseOrderDate(dateInputStr);

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [dealers] = await connection.query('SELECT * FROM dealers WHERE dealer_id = ?', [dealerId]);
        if (dealers.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Dealer not found' });
        }
        const dealer = dealers[0];

        let totalVal = parseFloat(total_amount || 0);
        if (totalVal <= 0 && Array.isArray(items) && items.length > 0) {
            totalVal = items.reduce((sum, it) => {
                const price = parseFloat(it.price || 0);
                const qty = parseInt(it.quantity, 10) || 1;
                const disc = parseFloat(it.discount || 0);
                const itemTotal = parseFloat(it.total_price || (Math.max(0, price - disc) * qty));
                return sum + itemTotal;
            }, 0);
        }
        const advVal = parseFloat(advance_amount || 0);
        const balVal = parseFloat(balance_amount !== undefined && balance_amount !== null ? balance_amount : (totalVal - advVal));

        const [orderRes] = await connection.query(
            `INSERT INTO orders (
                order_source, dealer_id, customer_name, phone, address, city, state,
                delivery_type, order_status, total_amount, advance_amount, balance_amount, created_by, created_at
            ) VALUES ('dealer', ?, ?, ?, ?, ?, ?, ?, 'ordered', ?, ?, ?, ?, ?)`,
            [
                dealerId,
                dealer.firm_name || dealer.dealer_name || 'Dealer Store',
                dealer.phone || '',
                dealer.address || '',
                dealer.city || '',
                dealer.state || 'Karnataka',
                delivery_type || null,
                totalVal,
                advVal,
                balVal,
                req.user ? req.user.id : null,
                orderDate
            ]
        );
        const newOrderId = orderRes.insertId;

        // Automatically recalculate dealer status from latest valid orders
        await recalculateDealerStatus(dealerId, connection);

        if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                await connection.query(
                    `INSERT INTO order_items (order_id, product_id, quantity, price, total_price)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        newOrderId,
                        item.product_id || null,
                        parseInt(item.quantity, 10) || 1,
                        parseFloat(item.price || 0),
                        parseFloat(item.total_price || (item.price * item.quantity))
                    ]
                );
            }
        }

        if (advVal > 0) {
            await connection.query(
                `INSERT INTO order_payments (order_id, amount, payment_method, payment_date, notes)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    newOrderId,
                    advVal,
                    payment_method || 'Bank Transfer',
                    orderDate,
                    notes || 'Advance Payment'
                ]
            );
        }

        await connection.commit();
        connection.release();

        res.status(201).json({
            message: 'Dealer order confirmed successfully',
            order_id: newOrderId
        });
    } catch (err) {
        await connection.rollback();
        connection.release();
        console.error('createDealerOrder Error:', err);
        res.status(500).json({ message: 'Error creating dealer order: ' + err.message });
    }
};

exports.getDealerOrders = async (req, res) => {
    try {
        const query = `
            SELECT 
                o.order_id,
                o.dealer_id,
                o.customer_name,
                o.phone,
                o.address,
                o.city,
                o.state,
                o.district,
                o.pincode,
                o.village,
                o.sub_district,
                o.order_status,
                o.delivery_type,
                o.dispatch_through,
                o.shipped_date,
                o.total_amount,
                o.discount,
                o.shipping_charges,
                o.advance_amount,
                o.balance_amount,
                o.created_by,
                u.name as created_by_name,
                o.created_at,
                d.dealer_name,
                d.contact_person,
                d.phone as dealer_phone,
                d.city as dealer_city,
                d.gst_no,
                d.vrl_code,
                d.nearest_vrl,
                d.town_village,
                d.taluk,
                d.district as dealer_district,
                d.pincode as dealer_pincode,
                GROUP_CONCAT(DISTINCT CONCAT(IFNULL(p.name, 'Agri Product'), ' x ', oi.quantity) SEPARATOR '||') as items_summary,
                GROUP_CONCAT(DISTINCT CONCAT(IFNULL(p.name, 'Agri Product'), '::', IFNULL(oi.quantity, 1), '::', IFNULL(oi.price, 0), '::', IFNULL(oi.total_price, 0)) SEPARATOR '||') as items_detailed,
                (
                    SELECT GROUP_CONCAT(CONCAT(op.amount, '::', IFNULL(op.payment_method, 'Cash'), '::', DATE_FORMAT(IFNULL(op.payment_date, op.created_at), '%d/%m/%Y'), '::', IFNULL(op.notes, 'Payment')) SEPARATOR '||')
                    FROM order_payments op WHERE op.order_id = o.order_id
                ) as payment_history_str
            FROM orders o
            LEFT JOIN dealers d ON o.dealer_id = d.dealer_id
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.product_id
            LEFT JOIN users u ON o.created_by = u.user_id
            WHERE o.order_source = 'dealer' OR o.dealer_id IS NOT NULL
            GROUP BY o.order_id
            ORDER BY o.created_at DESC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        console.error('getDealerOrders Error:', err);
        res.status(500).json({ message: 'Error fetching dealer orders' });
    }
};

exports.payDealerOrderBalance = async (req, res) => {
    const orderId = req.params.orderId;
    const { payment_amount, payment_method, notes } = req.body;
    const payVal = parseFloat(payment_amount || 0);

    if (payVal <= 0) {
        return res.status(400).json({ message: 'Invalid payment amount' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const order = rows[0];

        const currentAdv = parseFloat(order.advance_amount || 0);
        const totalAmt = parseFloat(order.total_amount || 0);
        
        const newAdv = currentAdv + payVal;
        const newBal = Math.max(0, totalAmt - newAdv);

        await pool.query(
            'UPDATE orders SET advance_amount = ?, balance_amount = ? WHERE order_id = ?',
            [newAdv, newBal, orderId]
        );

        await pool.query(
            `INSERT INTO order_payments (order_id, amount, payment_method, payment_date, notes)
             VALUES (?, ?, ?, ?, ?)`,
            [
                orderId,
                payVal,
                payment_method || 'Bank Transfer',
                new Date(),
                notes || 'Balance Payment'
            ]
        );

        res.json({
            message: 'Balance payment recorded successfully',
            order_id: orderId,
            advance_amount: newAdv,
            balance_amount: newBal
        });
    } catch (err) {
        console.error('payDealerOrderBalance Error:', err);
        res.status(500).json({ message: 'Error processing balance payment' });
    }
};

exports.getOrderPaymentHistory = async (req, res) => {
    const orderId = req.params.orderId;
    try {
        await ensureOrderPaymentsTable();
        const [rows] = await pool.query(
            'SELECT * FROM order_payments WHERE order_id = ? ORDER BY created_at ASC',
            [orderId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getOrderPaymentHistory Error:', err);
        res.status(500).json({ message: 'Error fetching payment history' });
    }
};

exports.updateDealerOrder = async (req, res) => {
    const orderId = req.params.orderId;
    const { order_status, shipped_date, delivery_type, total_amount, advance_amount, balance_amount, new_payment_amount, payment_method, payment_notes } = req.body;

    try {
        await ensureOrderPaymentsTable();
        const [rows] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        let totalVal = total_amount !== undefined ? parseFloat(total_amount) : parseFloat(rows[0].total_amount);
        let advVal = advance_amount !== undefined ? parseFloat(advance_amount) : parseFloat(rows[0].advance_amount);
        const addPayVal = parseFloat(new_payment_amount || 0);

        if (addPayVal > 0) {
            advVal = advVal + addPayVal;
            await pool.query(
                `INSERT INTO order_payments (order_id, amount, payment_method, payment_date, notes)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    orderId,
                    addPayVal,
                    payment_method || 'Bank Transfer',
                    new Date(),
                    payment_notes || 'Balance Payment'
                ]
            );
        }

        const balVal = Math.max(0, totalVal - advVal);
        const status = order_status || rows[0].order_status;
        const shippedDateVal = shipped_date !== undefined ? (shipped_date || null) : rows[0].shipped_date;
        const deliveryTypeVal = delivery_type !== undefined ? (delivery_type || null) : rows[0].delivery_type;

        await pool.query(
            `UPDATE orders 
             SET order_status = ?, shipped_date = ?, delivery_type = ?, total_amount = ?, advance_amount = ?, balance_amount = ? 
             WHERE order_id = ?`,
            [status, shippedDateVal, deliveryTypeVal, totalVal, advVal, balVal, orderId]
        );

        if (rows[0].dealer_id) {
            await recalculateDealerStatus(rows[0].dealer_id, pool);
        }

        res.json({
            message: 'Order details updated successfully',
            order_id: orderId,
            order_status: status,
            total_amount: totalVal,
            advance_amount: advVal,
            balance_amount: balVal
        });
    } catch (err) {
        console.error('updateDealerOrder Error:', err);
        res.status(500).json({ message: 'Error updating order details: ' + err.message });
    }
};

exports.deleteDealerOrder = async (req, res) => {
    const orderId = req.params.orderId;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [orders] = await connection.query(
            "SELECT order_id, dealer_id FROM orders WHERE order_id = ? FOR UPDATE",
            [orderId]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        const dealerId = orders[0].dealer_id;

        // 1. Delete order items
        await connection.query("DELETE FROM order_items WHERE order_id = ?", [orderId]);

        // 2. Delete order payments
        try {
            await connection.query("DELETE FROM order_payments WHERE order_id = ?", [orderId]);
        } catch (e) {}

        // 3. Delete order
        await connection.query("DELETE FROM orders WHERE order_id = ?", [orderId]);

        // 4. Recalculate dealer status if this was for a dealer
        if (dealerId) {
            await recalculateDealerStatus(dealerId, connection);
        }

        await connection.commit();

        res.json({ success: true, message: 'Order deleted successfully', order_id: orderId });
    } catch (err) {
        await connection.rollback();
        console.error('deleteDealerOrder Error:', err);
        res.status(500).json({ message: 'Error deleting order: ' + err.message });
    } finally {
        connection.release();
    }
};

exports.bulkDeleteDealerOrders = async (req, res) => {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: 'No order IDs provided for bulk deletion' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch dealer IDs for recalculating dealer status
        const [orders] = await connection.query(
            `SELECT DISTINCT dealer_id FROM orders WHERE order_id IN (?) AND dealer_id IS NOT NULL`,
            [orderIds]
        );
        const dealerIds = orders.map(o => o.dealer_id);

        // 2. Delete order items & payments
        await connection.query("DELETE FROM order_items WHERE order_id IN (?)", [orderIds]);
        try {
            await connection.query("DELETE FROM order_payments WHERE order_id IN (?)", [orderIds]);
        } catch (e) {}

        // 3. Delete orders
        const [result] = await connection.query("DELETE FROM orders WHERE order_id IN (?)", [orderIds]);

        // 4. Recalculate status for affected dealers
        for (const dId of dealerIds) {
            await recalculateDealerStatus(dId, connection);
        }

        await connection.commit();
        res.json({ success: true, count: result.affectedRows, message: `Successfully deleted ${result.affectedRows} order(s)` });
    } catch (err) {
        await connection.rollback();
        console.error('bulkDeleteDealerOrders Error:', err);
        res.status(500).json({ message: 'Error deleting orders: ' + err.message });
    } finally {
        connection.release();
    }
};

exports.bulkClearPaymentDealerOrders = async (req, res) => {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: 'No order IDs provided for bulk payment clearing' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        await ensureOrderPaymentsTable();

        const [orders] = await connection.query(
            `SELECT order_id, total_amount, advance_amount, balance_amount, dealer_id FROM orders WHERE order_id IN (?) FOR UPDATE`,
            [orderIds]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'No valid orders found to clear payment' });
        }

        let updatedCount = 0;
        const dealerIds = new Set();

        for (const order of orders) {
            const totalAmt = parseFloat(order.total_amount || 0);
            const advAmt = parseFloat(order.advance_amount || 0);
            const balAmt = parseFloat(order.balance_amount || 0);
            const remainingToClear = balAmt > 0 ? balAmt : Math.max(0, totalAmt - advAmt);

            if (remainingToClear > 0 || balAmt > 0) {
                const newAdv = totalAmt;

                await connection.query(
                    `UPDATE orders SET advance_amount = ?, balance_amount = 0 WHERE order_id = ?`,
                    [newAdv, order.order_id]
                );

                await connection.query(
                    `INSERT INTO order_payments (order_id, amount, payment_method, payment_date, notes)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        order.order_id,
                        remainingToClear,
                        'Bank Transfer',
                        new Date(),
                        'Bulk Payment Clear'
                    ]
                );
                updatedCount++;
            }

            if (order.dealer_id) {
                dealerIds.add(order.dealer_id);
            }
        }

        for (const dId of dealerIds) {
            await recalculateDealerStatus(dId, connection);
        }

        await connection.commit();
        res.json({
            success: true,
            count: updatedCount,
            message: `Successfully cleared payment for ${updatedCount} order(s)`
        });
    } catch (err) {
        await connection.rollback();
        console.error('bulkClearPaymentDealerOrders Error:', err);
        res.status(500).json({ message: 'Error clearing payment for selected orders: ' + err.message });
    } finally {
        connection.release();
    }
};

exports.bulkUpdateDealerOrdersStatus = async (req, res) => {
    const { orderIds, order_status } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: 'No order IDs provided for bulk status update' });
    }

    const validStatuses = ['ordered', 'packed', 'shipped', 'delivered', 'cancelled'];
    const targetStatus = (order_status || '').toLowerCase().trim();

    if (!validStatuses.includes(targetStatus)) {
        return res.status(400).json({ message: `Invalid status: ${order_status}. Valid statuses: ${validStatuses.join(', ')}` });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let query = `UPDATE orders SET order_status = ? WHERE order_id IN (?)`;
        let params = [targetStatus, orderIds];

        if (targetStatus === 'shipped') {
            query = `UPDATE orders SET order_status = ?, shipped_date = COALESCE(shipped_date, NOW()) WHERE order_id IN (?)`;
        }

        const [result] = await connection.query(query, params);

        const [orders] = await connection.query(
            `SELECT DISTINCT dealer_id FROM orders WHERE order_id IN (?) AND dealer_id IS NOT NULL`,
            [orderIds]
        );

        for (const o of orders) {
            await recalculateDealerStatus(o.dealer_id, connection);
        }

        await connection.commit();

        res.json({
            success: true,
            count: result.affectedRows,
            message: `Successfully updated ${result.affectedRows} order(s) status to ${targetStatus}`
        });
    } catch (err) {
        await connection.rollback();
        console.error('bulkUpdateDealerOrdersStatus Error:', err);
        res.status(500).json({ message: 'Error updating status for selected orders: ' + err.message });
    } finally {
        connection.release();
    }
};

exports.bulkImportDealers = async (req, res) => {
    const { dealers, duplicateAction = 'skip' } = req.body;

    if (!Array.isArray(dealers) || dealers.length === 0) {
        return res.status(400).json({ message: 'No dealer records provided for import' });
    }

    const sanitizePhone = (val) => {
        if (!val) return '';
        const cleaned = String(val).replace(/[^0-9]/g, '');
        if (cleaned.length >= 10) return cleaned.slice(-10);
        return cleaned;
    };

    const extractPhoneNumbers = (item) => {
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
            const cleanedRaw = raw.replace(/\+91/g, ' ').replace(/\b91(?=\d{10}\b)/g, ' ');
            const parts = cleanedRaw.split(/[,;\/|\\&+\n\r\t]|\band\b|\bor\b/i);
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
        });
        return phones;
    };

    const getVal = (obj, keys) => {
        if (!obj || typeof obj !== 'object') return '';
        const objKeys = Object.keys(obj);
        for (const targetKey of keys) {
            const targetNorm = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const k of objKeys) {
                const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (kNorm === targetNorm && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
                    return String(obj[k]).trim();
                }
            }
        }
        return '';
    };

    const normStr = (s) => s ? String(s).toLowerCase().replace(/[^a-z0-9]/g, '') : '';

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Fetch existing dealers for backend duplicate verification
        const [existingDealers] = await connection.query(`SELECT dealer_id, dealer_name, contact_person, phone, gst_no FROM dealers`);

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const item of dealers) {
            const firmName = getVal(item, ['FIRM / SHOP NAME', 'FIRM NAME', 'Firm Name', 'Shop Name', 'dealer_name', 'firm_name', 'Customer Name', 'Party Name', 'Store Name', 'Shop']);
            const dealerName = getVal(item, ['DEALER NAME', 'Dealer Name', 'Contact Person', 'owner_name', 'contact_person', 'dealer_owner_name', 'Owner Name', 'Owner']);
            const extractedPhones = extractPhoneNumbers(item);
            const phone = extractedPhones.length > 0 ? extractedPhones.join(' / ') : sanitizePhone(getVal(item, ['CONTACT', 'PHONE', 'Phone', 'Phone Number', 'Contact Number', 'phone_number', 'phone', 'Mobile', 'Mobile No']));
            const email = getVal(item, ['EMAIL', 'Email', 'email']);
            
            const townVillage = getVal(item, ['TOWN / VILLAGE', 'TOWN/VILLAGE', 'Town/Village', 'Town', 'Village', 'town_village', 'Place']);
            const city = getVal(item, ['CITY', 'City', 'city', 'DISTRICT', 'District']);
            const taluk = getVal(item, ['TALUK', 'Taluk', 'taluk']);
            const district = getVal(item, ['DISTRICT', 'District', 'district']);
            const state = getVal(item, ['STATE', 'State', 'state']) || 'Karnataka';
            const pincode = getVal(item, ['PIN CODE', 'PINCODE', 'Pincode', 'Pin Code', 'pin_code', 'pincode', 'Postal Code', 'ZIP']);

            let address = getVal(item, ['ADDRESS', 'Address', 'address', 'Location']);
            if (!address && (townVillage || city || taluk || district || state || pincode)) {
                const parts = [];
                if (townVillage) parts.push(townVillage);
                if (taluk) parts.push(`${taluk} Taluk`);
                if (city) parts.push(city);
                if (district && district !== city) parts.push(district);
                if (state) parts.push(state);
                if (pincode) parts.push(pincode);
                address = parts.join(', ');
            }

            const visitedDate = getVal(item, ['LAST PURCHASED DATE', 'Last Purchased Date', 'VISITED DATE', 'Visited Date', 'visited_date', 'last_purchased_date']);
            const visitedBy = getVal(item, ['VISITED BY', 'Visited By', 'visited_by']);
            const gstNo = getVal(item, ['GST NO.', 'GST NO', 'GST No', 'GSTIN', 'GST', 'gst_no', 'gst_number']);
            const nearestVrl = getVal(item, ['NEAREST VRL LOCATION', 'NEAREST VRL', 'Nearest VRL Location', 'Nearest VRL', 'nearest_vrl']);
            const vrlCode = getVal(item, ['VRL CODE', 'VRL Code', 'vrl_code', 'Dealer Code', 'Dealer ID']);
            let status = getVal(item, ['CURRENT STATUS', 'STATUS', 'Current Status', 'Status', 'status']);

            // Auto-calculate status dynamically based on LAST PURCHASED DATE
            if (visitedDate) {
                const parsedDate = new Date(visitedDate);
                if (!isNaN(parsedDate.getTime())) {
                    const now = new Date();
                    const diffDays = Math.floor((now.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 45) {
                        status = 'Active';
                    } else if (diffDays > 45) {
                        status = 'Inactive';
                    }
                }
            }

            if (!status) {
                status = 'Active';
            }

            // Skip completely empty rows
            if (!firmName && !dealerName && !phone) continue;

            const finalFirmName = firmName || 'Agri Dealer Store';
            const rowFirmNorm = normStr(finalFirmName);
            const rowGstNorm = normStr(gstNo);

            // Duplicate match check
            let existingMatch = null;
            for (const ed of existingDealers) {
                const edFirmNorm = normStr(ed.dealer_name);
                const edGstNorm = normStr(ed.gst_no);
                const edPhones = extractPhoneNumbers({ phone: ed.phone, contact: ed.contact_person });

                if (extractedPhones.length > 0 && edPhones.length > 0) {
                    if (extractedPhones.some(p => edPhones.includes(p))) {
                        existingMatch = ed;
                        break;
                    }
                }
                if (rowFirmNorm && edFirmNorm && (rowFirmNorm === edFirmNorm)) {
                    existingMatch = ed;
                    break;
                }
                if (rowGstNorm && edGstNorm && rowGstNorm === edGstNorm) {
                    existingMatch = ed;
                    break;
                }
            }

            if (existingMatch) {
                if (duplicateAction === 'skip') {
                    skippedCount++;
                    continue;
                } else if (duplicateAction === 'update') {
                    await connection.query(
                        `UPDATE dealers SET
                            contact_person = COALESCE(NULLIF(?, ''), contact_person),
                            phone = COALESCE(NULLIF(?, ''), phone),
                            email = COALESCE(NULLIF(?, ''), email),
                            address = COALESCE(NULLIF(?, ''), address),
                            town_village = COALESCE(NULLIF(?, ''), town_village),
                            city = COALESCE(NULLIF(?, ''), city),
                            taluk = COALESCE(NULLIF(?, ''), taluk),
                            district = COALESCE(NULLIF(?, ''), district),
                            state = COALESCE(NULLIF(?, ''), state),
                            pincode = COALESCE(NULLIF(?, ''), pincode),
                            visited_date = COALESCE(NULLIF(?, ''), visited_date),
                            visited_by = COALESCE(NULLIF(?, ''), visited_by),
                            gst_no = COALESCE(NULLIF(?, ''), gst_no),
                            nearest_vrl = COALESCE(NULLIF(?, ''), nearest_vrl),
                            vrl_code = COALESCE(NULLIF(?, ''), vrl_code),
                            status = COALESCE(NULLIF(?, ''), status)
                        WHERE dealer_id = ?`,
                        [
                            dealerName, phone, email, address, townVillage, city, taluk, district, state, pincode || null,
                            visitedDate, visitedBy, gstNo, nearestVrl, vrlCode, status, existingMatch.dealer_id
                        ]
                    );
                    updatedCount++;
                    continue;
                }
            }

            await connection.query(
                `INSERT INTO dealers (
                    dealer_name, contact_person, phone, email, address, town_village, city, taluk, district, state, pincode,
                    visited_date, visited_by, gst_no, nearest_vrl, vrl_code, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    finalFirmName, dealerName, phone, email, address,
                    townVillage, city, taluk, district, state, pincode || null,
                    visitedDate, visitedBy, gstNo, nearestVrl, vrlCode, status
                ]
            );
            insertedCount++;
        }

        await connection.commit();

        let message = `Bulk import completed! ${insertedCount} new dealer(s) imported.`;
        if (updatedCount > 0) message += ` ${updatedCount} existing dealer(s) updated.`;
        if (skippedCount > 0) message += ` ${skippedCount} duplicate dealer(s) skipped.`;

        res.status(201).json({
            success: true,
            count: insertedCount + updatedCount,
            insertedCount,
            updatedCount,
            skippedCount,
            message: message
        });
    } catch (err) {
        await connection.rollback();
        console.error('bulkImportDealers Error:', err);
        res.status(500).json({ message: 'Error importing dealers: ' + err.message });
    } finally {
        connection.release();
    }
};
