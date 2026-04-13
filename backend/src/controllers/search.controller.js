const pool = require('../config/db');

exports.globalSearch = async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) {
        return res.json({ leads: [], products: [], users: [] });
    }

    const searchTerm = `%${query}%`;
    try {
        const [leads] = await pool.query(
            'SELECT lead_id as id, customer_name as name, phone_number, status FROM leads WHERE customer_name LIKE ? OR phone_number LIKE ? LIMIT 5',
            [searchTerm, searchTerm]
        );
        const [products] = await pool.query(
            'SELECT product_id as id, name, selling_price as price FROM products WHERE name LIKE ? OR sku LIKE ? LIMIT 5',
            [searchTerm, searchTerm]
        );
        const [users] = await pool.query(
            'SELECT user_id as id, name as username FROM users WHERE name LIKE ? LIMIT 5',
            [searchTerm]
        );
        res.json({ leads, products, users });
    } catch (err) {
        console.error('Search ERROR:', err);
        res.status(500).json({ message: 'Search failed' });
    }
};
