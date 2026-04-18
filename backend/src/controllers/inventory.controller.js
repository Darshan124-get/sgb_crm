const pool = require('../config/db');

exports.getInventory = async (req, res) => {
    try {
        const query = `
            SELECT i.*, p.name, p.sku, p.unit, p.min_stock_alert,
                   (i.current_stock - i.reserved_stock) as available_stock
            FROM inventory i
            JOIN products p ON i.product_id = p.product_id
            ORDER BY p.name ASC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching inventory' });
    }
};

exports.adjustStock = async (req, res) => {
    const { product_id, type, quantity, reason } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Update Inventory
        if (type === 'in') {
            await connection.query(
                'UPDATE inventory SET current_stock = current_stock + ? WHERE product_id = ?',
                [quantity, product_id]
            );
        } else if (type === 'out' || type === 'adjustment') {
            await connection.query(
                'UPDATE inventory SET current_stock = current_stock + ? WHERE product_id = ?',
                [quantity, product_id] // quantity can be negative for reductions
            );
        } else {
            throw new Error('Invalid adjustment type');
        }

        // 2. Log the change
        await connection.query(
            `INSERT INTO inventory_logs (product_id, type, quantity, reference_type, reference_id, user_id) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [product_id, type, quantity, 'manual', null, req.user.id]
        );

        await connection.commit();
        res.json({ message: 'Stock adjusted successfully' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: 'Error adjusting stock: ' + err.message });
    } finally {
        connection.release();
    }
};

exports.getInventoryLogs = async (req, res) => {
    try {
        const query = `
            SELECT l.*, p.name as product_name, p.sku, u.name as user_name
            FROM inventory_logs l
            JOIN products p ON l.product_id = p.product_id
            LEFT JOIN users u ON l.user_id = u.user_id
            ORDER BY l.created_at DESC
            LIMIT 500
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching inventory logs' });
    }
};

exports.getLowStockAlerts = async (req, res) => {
    try {
        const query = `
            SELECT i.*, p.name, p.min_stock_alert
            FROM inventory i
            JOIN products p ON i.product_id = p.product_id
            WHERE i.current_stock < p.min_stock_alert
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching low stock alerts' });
    }
};
