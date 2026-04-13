const pool = require('../config/db');

exports.getProducts = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching products' });
    }
};

exports.createProduct = async (req, res) => {
    const { name, category, description, sku, unit, selling_price, dealer_price, min_stock_alert } = req.body;
    try {
        await pool.query(
            `INSERT INTO products (name, category, description, sku, unit, selling_price, dealer_price, min_stock_alert) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, category, description, sku, unit, selling_price || 0, dealer_price || 0, min_stock_alert || 10]
        );
        res.status(201).json({ message: 'Product added successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error adding product: ' + err.message });
    }
};

exports.updateProduct = async (req, res) => {
    const { name, category, description, sku, unit, selling_price, dealer_price, min_stock_alert } = req.body;
    try {
        await pool.query(
            `UPDATE products SET name = ?, category = ?, description = ?, sku = ?, unit = ?, 
             selling_price = ?, dealer_price = ?, min_stock_alert = ? WHERE product_id = ?`,
            [name, category, description, sku, unit, selling_price, dealer_price, min_stock_alert, req.params.id]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating product: ' + err.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE product_id = ?', [req.params.id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting product' });
    }
};
