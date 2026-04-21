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
            await connection.rollback();
            throw innerErr;
        } finally {
            connection.release();
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
