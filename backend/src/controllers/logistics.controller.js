const pool = require('../config/db');

exports.packOrder = async (req, res) => {
    const { order_id, remarks } = req.body;
    try {
        await pool.query(
            'INSERT INTO packing (order_id, packed_by, packed_at, status, remarks) VALUES (?, ?, CURRENT_TIMESTAMP, "packed", ?)',
            [order_id, req.user.id, remarks || '']
        );
        await pool.query('UPDATE orders SET order_status = "packed" WHERE order_id = ?', [order_id]);
        res.status(201).json({ message: 'Order marked as packed' });
    } catch (err) {
        console.error('Packing Error:', err);
        res.status(500).json({ message: 'Failed to record packing' });
    }
};

exports.shipOrder = async (req, res) => {
    const { order_id, courier_name, tracking_id } = req.body;
    try {
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
