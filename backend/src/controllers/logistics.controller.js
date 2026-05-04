const pool = require('../config/db');

exports.packOrder = async (req, res) => {
    const { order_id, remarks } = req.body;
    try {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Ensure order is billed before packing
            const [order] = await connection.query('SELECT order_status FROM orders WHERE order_id = ? FOR UPDATE', [order_id]);
            if (!order.length || order[0].order_status !== 'billed') {
                throw new Error('Order must be billed before it can be packed.');
            }

            // 2. Get items to deduct from inventory
            const [items] = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [order_id]);

            for (const item of items) {
                // Deduct from current_stock AND remove from reserved_stock
                await connection.query(
                    `UPDATE inventory 
                     SET current_stock = current_stock - ?, 
                         reserved_stock = reserved_stock - ? 
                     WHERE product_id = ?`,
                    [item.quantity, item.quantity, item.product_id]
                );

                // Log actual deduction
                await connection.query(
                    `INSERT INTO inventory_logs (product_id, type, quantity, reference_type, reference_id, created_by) 
                     VALUES (?, 'out', ?, 'packing', ?, ?)`,
                    [item.product_id, -item.quantity, order_id, req.user.id]
                );
            }

            // 3. Record packing
            await connection.query(
                'INSERT INTO packing (order_id, packed_by, packed_at, status, remarks) VALUES (?, ?, CURRENT_TIMESTAMP, "packed", ?)',
                [order_id, req.user.id, remarks || '']
            );
            await connection.query('UPDATE orders SET order_status = "packed" WHERE order_id = ?', [order_id]);

            await connection.commit();
            res.status(201).json({ message: 'Order marked as packed and stock deducted' });
        } catch (innerErr) {
            try { if (connection) await connection.rollback(); } catch (re) {}
            throw innerErr;
        } finally {
            if (connection) connection.release();
        }
    } catch (err) {
        console.error('Packing Error:', err);
        res.status(500).json({ message: err.message || 'Failed to record packing' });
    }
};

exports.shipOrder = async (req, res) => {
    const { order_id, courier_name, tracking_id } = req.body;
    try {
        // Ensure order is packed before shipping
        const [order] = await pool.query('SELECT order_status FROM orders WHERE order_id = ?', [order_id]);
        if (!order.length || order[0].order_status !== 'packed') {
            return res.status(400).json({ message: 'Order must be packed before it can be shipped.' });
        }

        await pool.query(
            'INSERT INTO shipments (order_id, courier_name, tracking_id, shipped_by, shipped_at, status) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, "shipped")',
            [order_id, courier_name, tracking_id, req.user.id]
        );
        await pool.query('UPDATE orders SET order_status = "shipped" WHERE order_id = ?', [order_id]);
        res.status(201).json({ message: 'Order marked as shipped' });
    } catch (err) {
        console.error('Shipping Error:', err);
        res.status(500).json({ message: 'Failed to record shipment' });
    }
};

exports.getDashboardStats = async (req, res) => {
    const { range = '7days' } = req.query;
    try {
        // 1. Basic KPIs (Always show overall/today)
        const [pending] = await pool.query("SELECT COUNT(*) as count FROM orders WHERE order_status = 'packed'");
        const [todayShipped] = await pool.query("SELECT COUNT(*) as count FROM shipments WHERE DATE(shipped_at) = CURRENT_DATE");
        const [inTransit] = await pool.query("SELECT COUNT(*) as count FROM shipments WHERE status IN ('shipped', 'in_transit')");

        // 2. Dispatch Trends based on range
        let trendsQuery = "";
        if (range === 'today') {
            trendsQuery = `
                SELECT 
                    HOUR(shipped_at) as label,
                    COUNT(*) as count
                FROM shipments 
                WHERE DATE(shipped_at) = CURRENT_DATE
                GROUP BY label
                ORDER BY label ASC
            `;
        } else {
            trendsQuery = `
                SELECT 
                    DATE_FORMAT(shipped_at, '%a') as label,
                    COUNT(*) as count
                FROM shipments 
                WHERE shipped_at >= DATE_SUB(CURRENT_DATE, INTERVAL 6 DAY)
                GROUP BY DATE(shipped_at), label
                ORDER BY DATE(shipped_at) ASC
            `;
        }
        const [trends] = await pool.query(trendsQuery);

        // Map hourly labels for 'today' (e.g. 0 -> '12 AM', 9 -> '9 AM')
        const processedTrends = trends.map(t => {
            if (range === 'today') {
                const hour = parseInt(t.label);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 || 12;
                return { label: `${displayHour} ${ampm}`, count: t.count };
            }
            return { label: t.label, count: t.count };
        });

        // 3. Carrier Load Distribution
        const [carriers] = await pool.query(`
            SELECT courier_name as label, COUNT(*) as value
            FROM shipments 
            GROUP BY courier_name
        `);

        res.json({
            pendingCount: pending[0].count,
            todayCount: todayShipped[0].count,
            transitCount: inTransit[0].count,
            trends: processedTrends,
            carriers: carriers
        });
    } catch (err) {
        console.error('Stats Error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
};

exports.getShippingOrders = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT o.*, s.courier_name, s.tracking_id, s.shipped_at, s.status as shipment_status
            FROM orders o
            LEFT JOIN shipments s ON o.order_id = s.order_id
            WHERE o.order_status IN ('packed', 'shipped', 'delivered')
            ORDER BY o.updated_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Fetch Shipping Orders Error:', err);
        res.status(500).json({ error: 'Failed to fetch shipping orders' });
    }
};
