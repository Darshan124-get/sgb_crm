const pool = require('../config/db');

exports.getOrders = async (req, res) => {
    const { status } = req.query;
    try {
        let query = `
            SELECT 
                o.*, 
                oi.order_item_id as item_id, 
                oi.product_id, 
                oi.quantity, 
                oi.price,
                oi.total_price as item_total,
                p.name as product_name
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.product_id
            WHERE 1=1
        `;
        const params = [];
        if (status) {
            query += " AND o.order_status = ?";
            params.push(status);
        }
        if (req.query.source) {
            query += " AND o.order_source = ?";
            params.push(req.query.source);
        }
        query += " ORDER BY o.created_at DESC";

        const [rows] = await pool.query(query, params);

        const ordersMap = {};
        rows.forEach(row => {
            if (!ordersMap[row.order_id]) {
                ordersMap[row.order_id] = {
                    ...row,
                    items: []
                };
                delete ordersMap[row.order_id].item_id;
                delete ordersMap[row.order_id].product_id;
                delete ordersMap[row.order_id].quantity;
                delete ordersMap[row.order_id].price;
                delete ordersMap[row.order_id].item_total;
                delete ordersMap[row.order_id].product_name;
            }
            if (row.item_id) {
                ordersMap[row.order_id].items.push({
                    id: row.item_id,
                    product_id: row.product_id,
                    quantity: row.quantity,
                    price: row.price,
                    total: row.item_total,
                    product_name: row.product_name
                });
            }
        });
        res.json(Object.values(ordersMap));
    } catch (err) {
        res.status(500).json({ message: 'Error fetching orders: ' + err.message });
    }
};

exports.convertLeadToOrder = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { lead_id, customer_name, phone, address, city, state, advance_amount, items } = req.body;
        if (!lead_id || !customer_name || !phone || !items || items.length === 0) {
            return res.status(400).json({ message: 'Missing required order fields' });
        }
        const [orderResult] = await connection.query(
            `INSERT INTO orders (order_source, lead_id, customer_name, phone, address, city, state, advance_amount, created_by, order_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['lead', lead_id, customer_name, phone, address, city, state, advance_amount || 0, req.user.id, 'draft']
        );
        const orderId = orderResult.insertId;
        let totalAmount = 0;

        for (const item of items) {
            // Reserve stock (holding items without immediate deduction from current_stock)
            await connection.query(
                `UPDATE inventory 
                 SET reserved_stock = reserved_stock + ? 
                 WHERE product_id = ?`,
                [item.quantity, item.product_id]
            );

            // Create Inventory Log
            await connection.query(
                `INSERT INTO inventory_logs (product_id, type, quantity, reference_type, reference_id, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [item.product_id, 'adjustment', item.quantity, 'reservation', orderId, req.user.id]
            );

            const itemTotal = item.quantity * item.price;
            totalAmount += itemTotal;
            await connection.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price, total_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [orderId, item.product_id, item.quantity || 1, item.price || 0, itemTotal]
            );
        }
        await connection.query('UPDATE orders SET total_amount = ?, balance_amount = ? WHERE order_id = ?',
            [totalAmount, totalAmount - (advance_amount || 0), orderId]);
        await connection.query(`UPDATE leads SET status = 'converted' WHERE lead_id = ?`, [lead_id]);
        await connection.query('INSERT INTO lead_notes (lead_id, user_id, note) VALUES (?, ?, ?)',
            [lead_id, req.user.id, `Lead converted to Order #${orderId}. Total: ₹${totalAmount}, Advance: ₹${advance_amount || 0}`]);
        await connection.commit();
        res.status(201).json({ message: 'Order created successfully', orderId, leadStatus: 'converted' });
    } catch (err) {
        console.error('Error converting lead to order:', err);
        if (connection) await connection.rollback();
        res.status(500).json({ message: 'Failed to create order', error: err.message });
    } finally {
        connection.release();
    }
};

exports.createDealerOrder = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { dealer_id, items, advance_amount } = req.body;
        if (!dealer_id || !items || items.length === 0) {
            return res.status(400).json({ message: 'Missing dealer ID or order items' });
        }
        const [dealers] = await connection.query('SELECT * FROM dealers WHERE dealer_id = ?', [dealer_id]);
        if (dealers.length === 0) return res.status(404).json({ message: 'Dealer not found' });
        const dealer = dealers[0];
        const [orderResult] = await connection.query(
            `INSERT INTO orders (order_source, dealer_id, customer_name, phone, address, city, state, advance_amount, created_by, order_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['dealer', dealer_id, dealer.dealer_name, dealer.phone, dealer.address, dealer.city, dealer.state, advance_amount || 0, req.user.id, 'draft']
        );
        const orderId = orderResult.insertId;
        let totalAmount = 0;
        for (const item of items) {
            // Reserve stock (holding items without immediate deduction from current_stock)
            await connection.query(
                `UPDATE inventory 
                 SET reserved_stock = reserved_stock + ? 
                 WHERE product_id = ?`,
                [item.quantity, item.product_id]
            );

            // Create Inventory Log
            await connection.query(
                `INSERT INTO inventory_logs (product_id, type, quantity, reference_type, reference_id, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [item.product_id, 'adjustment', item.quantity, 'reservation', orderId, req.user.id]
            );

            const itemTotal = item.quantity * item.price;
            totalAmount += itemTotal;
            await connection.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price, total_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [orderId, item.product_id, item.quantity || 1, item.price || 0, itemTotal]
            );
        }
        await connection.query('UPDATE orders SET total_amount = ?, balance_amount = ? WHERE order_id = ?',
            [totalAmount, totalAmount - (advance_amount || 0), orderId]);
        await connection.commit();
        res.status(201).json({ message: 'Dealer order created successfully', orderId });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: 'Failed to create dealer order', error: err.message });
    } finally {
        connection.release();
    }
};

exports.updateStatus = async (req, res) => {
    const { status } = req.body;
    if (!['draft', 'in_review', 'billed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }
    try {
        await pool.query('UPDATE orders SET order_status = ? WHERE order_id = ?', [status, req.params.id]);
        res.json({ message: `Order status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ message: 'Error updating order status: ' + err.message });
    }
};
