const pool = require('../config/db');
const zohoAuth = require('../services/zoho/zohoAuth.service');
const axios = require('axios');

// Helper to generate SKU
const generateSKU = (name) => {
    const prefix = (name || 'PRD').substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(100 + Math.random() * 899);
    return `${prefix}-${timestamp}${random}`;
};

// Fetch Zoho items catalog for dropdown mapping
exports.getZohoItems = async (req, res) => {
    try {
        const orgId = process.env.ZOHO_ORGANIZATION_ID;
        if (!orgId) return res.json({ success: true, items: [] });
        const headers = await zohoAuth.getAuthHeaders();
        let allItems = [];
        for (let page = 1; page <= 3; page++) {
            const zRes = await axios.get(`${zohoAuth.apiDomain}/items?organization_id=${orgId}&page=${page}&per_page=200`, { headers });
            allItems = allItems.concat(zRes.data?.items || []);
            if (!zRes.data?.page_context?.has_more_page) break;
        }
        const cleanItems = allItems.map(i => ({
            item_id: i.item_id,
            name: i.name,
            sku: i.sku || '',
            rate: i.rate || 0,
            status: i.status || 'active'
        }));
        res.json({ success: true, items: cleanItems });
    } catch (err) {
        console.error('Error fetching Zoho items for dropdown:', err);
        res.status(500).json({ success: false, message: err.message, items: [] });
    }
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
        discount_percentage, opening_stock, hsn_code, zoho_item_id 
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
                status, image_url, discount_percentage, hsn_code, zoho_item_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, category_id || null, description, sku, unit, 
                selling_price || 0, dealer_price || 0, min_stock_alert || 10,
                status || 'active', image_url || null, discount_percentage || 0, hsn_code || '',
                zoho_item_id || null
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
        dealer_price, min_stock_alert, status, image_url, discount_percentage, hsn_code, zoho_item_id 
    } = req.body;

    try {
        await pool.query(
            `UPDATE products SET 
                name = ?, category_id = ?, description = ?, sku = ?, unit = ?, 
                selling_price = ?, dealer_price = ?, min_stock_alert = ?, 
                status = ?, image_url = ?, discount_percentage = ?, hsn_code = ?, zoho_item_id = ? 
             WHERE product_id = ?`,
            [
                name, category_id || null, description, sku, unit, 
                selling_price, dealer_price, min_stock_alert, 
                status, image_url, discount_percentage, hsn_code, zoho_item_id || null, req.params.id
            ]
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
        res.status(500).json({ message: 'Error deleting product: ' + err.message });
    }
};
