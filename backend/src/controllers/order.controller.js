const pool = require('../config/db');

exports.getOrders = async (req, res) => {
    const { status, source, search, date } = req.query;
    try {
        let query = `
            SELECT 
                o.*, 
                p.name as product_name, 
                oi.quantity, 
                oi.price, 
                oi.total_price as item_total,
                pk.packed_at
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.product_id
            LEFT JOIN packing pk ON o.order_id = pk.order_id AND pk.status = 'packed'
        `;
        const conditions = [];
        const params = [];

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
            const searchVal = `%${search}%`;
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
                ordersMap[row.order_id] = { ...row, items: [] };
            }
            if (row.product_name || row.quantity) {
                ordersMap[row.order_id].items.push({
                    product_name: row.product_name || 'Generic Product',
                    quantity: row.quantity || 1,
                    price: row.price || 0,
                    item_total: row.item_total || 0,
                    subtotal: row.item_total || 0
                });
            }
        });
        res.json(Object.values(ordersMap));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.convertLeadToOrder = async (req, res) => {
    try {
        let { lead_id, customer_name, phone, address, city, state, village, district, pincode, delivery_type, total_amount, advance_amount, items } = req.body;
        const [resOrder] = await pool.query(
            "INSERT INTO orders (order_source, lead_id, customer_name, phone, address, village, district, pincode, city, state, delivery_type, total_amount, advance_amount, balance_amount, order_status, created_by) VALUES ('lead', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1)",
            [lead_id, customer_name, phone, address || '', village || '', district || '', pincode || '', city || '', state || '', delivery_type || null, total_amount || 0, advance_amount || 0, (total_amount - advance_amount) || 0]
        );
        const orderId = resOrder.insertId;

        let parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        if (Array.isArray(parsedItems)) {
            for (const item of parsedItems) {
                let pid = parseInt(item.product_id);
                let dbPrice = parseFloat(item.price) || 0;

                if (isNaN(pid) || dbPrice === 0) {
                    // FIX: Using 'selling_price' instead of 'sale_price'
                    const [pRows] = await pool.query("SELECT product_id, selling_price, dealer_price FROM products WHERE sku = ? OR name = ? OR name LIKE ? LIMIT 1", [item.product_id, item.product_id, `%${item.product_id}%`]);
                    if (pRows[0]) {
                        pid = pRows[0].product_id;
                        if (dbPrice === 0) dbPrice = pRows[0].selling_price || pRows[0].dealer_price || 0;
                    }
                }

                if (pid && !isNaN(pid)) {
                    const qty = item.quantity || 1;
                    await pool.query(
                        "INSERT INTO order_items (order_id, product_id, quantity, price, total_price) VALUES (?, ?, ?, ?, ?)",
                        [orderId, pid, qty, dbPrice, qty * dbPrice]
                    );
                }
            }
        }

        await pool.query("UPDATE leads SET status = 'converted' WHERE lead_id = ?", [lead_id]);
        res.status(201).json({ success: true, orderId: orderId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createDealerOrder = async (req, res) => { res.json({ msg: 'ok' }); };
exports.getStats = async (req, res) => { res.json({ total: 0 }); };
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query("UPDATE orders SET order_status = ? WHERE order_id = ?", [status, id]);
        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
