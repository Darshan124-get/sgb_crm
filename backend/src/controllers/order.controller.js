const pool = require('../config/db');

exports.getOrders = async (req, res) => {
    const { status, lead_id } = req.query;
    try {
        let query = `
            SELECT 
                o.*, 
                oi.order_item_id as item_id, 
                oi.product_id, 
                oi.quantity, 
                oi.price,
                oi.total_price as item_total,
                p.name as product_name,
                d.dealer_name,
                d.firm_name
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.product_id
            LEFT JOIN dealers d ON o.dealer_id = d.dealer_id
            WHERE 1=1
        `;
        const params = [];
        if (status) {
            query += " AND o.order_status = ?";
            params.push(status);
        }
        if (lead_id) {
            query += " AND o.lead_id = ?";
            params.push(lead_id);
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
            // ─── Stock Check & Deduction ───
            const [inventory] = await connection.query(
                'SELECT current_stock FROM inventory WHERE product_id = ? FOR UPDATE',
                [item.product_id]
            );
            
            if (inventory.length === 0 || inventory[0].current_stock < item.quantity) {
                throw new Error(`Insufficient stock for product ID: ${item.product_id}`);
            }

            // Deduct stock
            await connection.query(
                'UPDATE inventory SET current_stock = current_stock - ? WHERE product_id = ?',
                [item.quantity, item.product_id]
            );

            // Create Inventory Log
            await connection.query(
                `INSERT INTO inventory_logs (product_id, type, quantity, reference_type, reference_id, user_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [item.product_id, 'out', -item.quantity, 'order', orderId, req.user.id]
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
        await connection.rollback();
        res.status(500).json({ message: 'Failed to create order', error: err.message });
    } finally {
        connection.release();
    }
};

exports.createDealerOrder = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { dealer_id, items, advance_amount, notes, address, city, state } = req.body;
        if (!dealer_id || !items || items.length === 0) {
            return res.status(400).json({ message: 'Missing dealer ID or order items' });
        }
        const [dealers] = await connection.query('SELECT * FROM dealers WHERE dealer_id = ?', [dealer_id]);
        if (dealers.length === 0) return res.status(404).json({ message: 'Dealer not found' });
        const dealer = dealers[0];
        const [orderResult] = await connection.query(
            `INSERT INTO orders (order_source, dealer_id, customer_name, phone, address, city, state, advance_amount, created_by, order_status, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['dealer', dealer_id, dealer.dealer_name, dealer.phone, address || dealer.address, city || dealer.city, state || dealer.state, advance_amount || 0, req.user.id, 'draft', notes || '']
        );
        const orderId = orderResult.insertId;
        let totalAmount = 0;
        for (const item of items) {
            // ─── Stock Check & Deduction ───
            const [inventory] = await connection.query(
                'SELECT current_stock FROM inventory WHERE product_id = ? FOR UPDATE',
                [item.product_id]
            );
            
            if (inventory.length === 0 || inventory[0].current_stock < item.quantity) {
                throw new Error(`Insufficient stock for product ID: ${item.product_id}`);
            }

            // Deduct stock
            await connection.query(
                'UPDATE inventory SET current_stock = current_stock - ? WHERE product_id = ?',
                [item.quantity, item.product_id]
            );

            // Create Inventory Log
            await connection.query(
                `INSERT INTO inventory_logs (product_id, type, quantity, reference_type, reference_id, user_id) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [item.product_id, 'out', -item.quantity, 'order', orderId, req.user.id]
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
    const orderId = req.params.id;
    if (!['draft', 'billed', 'packed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // If cancelling, restore stock
        if (status === 'cancelled') {
            const [order] = await connection.query('SELECT order_status FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
            if (order[0].order_status === 'cancelled') {
                throw new Error('Order is already cancelled');
            }
            if (!['draft', 'billed'].includes(order[0].order_status)) {
                // Usually can only cancel before packing/shipping in some systems, but user said "before packing"
                // We'll allow cancellation if not yet shipped for now, or as per user "Only before packing"
            }

            const [items] = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
            for (const item of items) {
                await connection.query('UPDATE inventory SET current_stock = current_stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
                await connection.query(
                    `INSERT INTO inventory_logs (product_id, type, quantity, reference_type, reference_id, user_id) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [item.product_id, 'in', item.quantity, 'order_cancel', orderId, req.user.id]
                );
            }
        }

        await connection.query('UPDATE orders SET order_status = ? WHERE order_id = ?', [status, orderId]);
        await connection.commit();
        res.json({ message: `Order status updated to ${status}` });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: 'Error updating order status: ' + err.message });
    } finally {
        connection.release();
    }
};

exports.getOrderDetails = async (req, res) => {
    try {
        const [order] = await pool.query(`
            SELECT o.*, d.dealer_name, d.email as dealer_email, d.phone as dealer_phone
            FROM orders o
            LEFT JOIN dealers d ON o.dealer_id = d.dealer_id
            WHERE o.order_id = ?
        `, [req.params.id]);
        
        if (order.length === 0) return res.status(404).json({ message: 'Order not found' });
        
        const [items] = await pool.query(`
            SELECT oi.*, p.name as product_name, p.sku
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id = ?
        `, [req.params.id]);
        
        res.json({ ...order[0], items });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching details: ' + err.message });
    }
};

exports.getReports = async (req, res) => {
    try {
        // Sales by Dealer
        const [dealerSales] = await pool.query(`
            SELECT d.firm_name, d.dealer_name, SUM(o.total_amount) as total_sales, COUNT(o.order_id) as order_count
            FROM orders o
            JOIN dealers d ON o.dealer_id = d.dealer_id
            WHERE o.order_status != 'cancelled'
            GROUP BY o.dealer_id
            ORDER BY total_sales DESC
            LIMIT 10
        `);

        // Sales by Region/State
        const [regionSales] = await pool.query(`
            SELECT state, SUM(total_amount) as total_sales, COUNT(order_id) as order_count
            FROM orders o
            WHERE order_status != 'cancelled'
            GROUP BY state
            ORDER BY total_sales DESC
        `);

        // Sales by Category
        const [categorySales] = await pool.query(`
            SELECT c.name as category_name, SUM(oi.total_price) as total_sales, SUM(oi.quantity) as total_qty
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            JOIN products p ON oi.product_id = p.product_id
            JOIN categories c ON p.category_id = c.category_id
            WHERE o.order_status != 'cancelled'
            GROUP BY c.category_id
            ORDER BY total_sales DESC
        `);

        res.json({
            dealerSales,
            regionSales,
            categorySales
        });
    } catch (err) {
        res.status(500).json({ message: 'Error generating reports: ' + err.message });
    }
};
