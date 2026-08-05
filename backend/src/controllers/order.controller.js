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

        // Get order details for notification
        const [[orderInfo]] = await connection.query(
            "SELECT created_by, customer_name, phone FROM orders WHERE order_id = ?",
            [id]
        );

        // 4. Update status
        await connection.query("UPDATE orders SET order_status = ? WHERE order_id = ?", [status, id]);

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
