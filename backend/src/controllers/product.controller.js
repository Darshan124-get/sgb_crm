const pool = require('../config/db');

// Helper to generate SKU
const generateSKU = (name) => {
    const prefix = (name || 'PRD').substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(100 + Math.random() * 899);
    return `${prefix}-${timestamp}${random}`;
};

exports.getProducts = async (req, res) => {
    try {
        const query = `
            SELECT p.*, c.name as category_name, i.current_stock, i.reserved_stock
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN inventory i ON p.product_id = i.product_id
            ORDER BY p.created_at DESC
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching products: ' + err.message });
    }
};

exports.createProduct = async (req, res) => {
    const { 
        name, category_id, description, unit, selling_price, 
        dealer_price, min_stock_alert, status, image_url, 
        discount_percentage, opening_stock 
    } = req.body;

    const sku = req.body.sku || generateSKU(name);
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Insert Product
        const [productResult] = await connection.query(
            `INSERT INTO products (
                name, category_id, description, sku, unit, 
                selling_price, dealer_price, min_stock_alert, 
                status, image_url, discount_percentage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, category_id || null, description, sku, unit, 
                selling_price || 0, dealer_price || 0, min_stock_alert || 10,
                status || 'active', image_url || null, discount_percentage || 0
            ]
        );

        const productId = productResult.insertId;

        // 2. Initialize Inventory
        await connection.query(
            'INSERT INTO inventory (product_id, current_stock, reserved_stock) VALUES (?, ?, ?)',
            [productId, opening_stock || 0, 0]
        );

        // 3. Log initial stock if any
        if (opening_stock > 0) {
            await connection.query(
                `INSERT INTO inventory_logs (product_id, type, quantity, reference_type, created_by) 
                 VALUES (?, ?, ?, ?, ?)`,
                [productId, 'in', opening_stock, 'opening_stock', req.user.id]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Product added successfully', product_id: productId, sku });
    } catch (err) {
        try { if (connection) await connection.rollback(); } catch (re) {}
        res.status(500).json({ message: 'Error adding product: ' + err.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.updateProduct = async (req, res) => {
    const { 
        name, category_id, description, sku, unit, selling_price, 
        dealer_price, min_stock_alert, status, image_url, discount_percentage 
    } = req.body;

    try {
        await pool.query(
            `UPDATE products SET 
                name = ?, category_id = ?, description = ?, sku = ?, unit = ?, 
                selling_price = ?, dealer_price = ?, min_stock_alert = ?, 
                status = ?, image_url = ?, discount_percentage = ? 
             WHERE product_id = ?`,
            [
                name, category_id || null, description, sku, unit, 
                selling_price, dealer_price, min_stock_alert, 
                status, image_url, discount_percentage, req.params.id
            ]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating product: ' + err.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        // Soft delete or status change is often better, but for now we'll stick to DELETE
        // The DB has ON DELETE CASCADE for inventory record.
        await pool.query('DELETE FROM products WHERE product_id = ?', [req.params.id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting product: ' + err.message });
    }
};
