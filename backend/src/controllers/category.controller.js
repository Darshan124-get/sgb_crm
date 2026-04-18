const pool = require('../config/db');

exports.getCategories = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

exports.getCategoryHierarchy = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        
        // Build hierarchy
        const categories = rows.map(cat => ({ ...cat, children: [] }));
        const categoryMap = {};
        categories.forEach(cat => categoryMap[cat.category_id] = cat);
        
        const rootCategories = [];
        categories.forEach(cat => {
            if (cat.parent_id && categoryMap[cat.parent_id]) {
                categoryMap[cat.parent_id].children.push(cat);
            } else {
                rootCategories.push(cat);
            }
        });
        
        res.json(rootCategories);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching category hierarchy' });
    }
};

exports.createCategory = async (req, res) => {
    const { name, parent_id, description } = req.body;
    try {
        await pool.query(
            'INSERT INTO categories (name, parent_id, description) VALUES (?, ?, ?)',
            [name, parent_id || null, description]
        );
        res.status(201).json({ message: 'Category created successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error creating category: ' + err.message });
    }
};

exports.updateCategory = async (req, res) => {
    const { name, parent_id, description } = req.body;
    try {
        await pool.query(
            'UPDATE categories SET name = ?, parent_id = ?, description = ? WHERE category_id = ?',
            [name, parent_id || null, description, req.params.id]
        );
        res.json({ message: 'Category updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating category: ' + err.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        // We might want to check if products exist in this category first, 
        // but for now, we'll rely on the DB to set category_id to NULL on products.
        await pool.query('DELETE FROM categories WHERE category_id = ?', [req.params.id]);
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting category' });
    }
};
