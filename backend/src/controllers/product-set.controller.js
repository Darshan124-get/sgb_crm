const pool = require('../config/db');

exports.getProductSets = async (req, res) => {
    try {
        const [sets] = await pool.query('SELECT * FROM product_sets ORDER BY set_id DESC');
        
        if (sets.length === 0) {
            return res.json([]);
        }

        const [items] = await pool.query(`
            SELECT psi.*, p.name as product_name, p.selling_price 
            FROM product_set_items psi
            JOIN products p ON psi.product_id = p.product_id
        `);

        const setsMap = {};
        sets.forEach(s => {
            setsMap[s.set_id] = { ...s, items: [] };
        });

        items.forEach(item => {
            if (setsMap[item.set_id]) {
                setsMap[item.set_id].items.push(item);
            }
        });

        res.json(Object.values(setsMap));
    } catch (err) {
        console.error('Error fetching product sets:', err);
        res.status(500).json({ error: 'Failed to fetch product sets' });
    }
};

exports.createProductSet = async (req, res) => {
    const { name, description, items } = req.body;
    try {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                'INSERT INTO product_sets (name, description) VALUES (?, ?)',
                [name, description || '']
            );
            const setId = result.insertId;

            let parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
            if (Array.isArray(parsedItems)) {
                for (const item of parsedItems) {
                    const pid = parseInt(item.product_id);
                    const qty = parseInt(item.quantity) || 1;
                    if (pid && !isNaN(pid)) {
                        await connection.query(
                            'INSERT INTO product_set_items (set_id, product_id, quantity) VALUES (?, ?, ?)',
                            [setId, pid, qty]
                        );
                    }
                }
            }

            await connection.commit();
            res.status(201).json({ success: true, set_id: setId });
        } catch (innerErr) {
            await connection.rollback();
            throw innerErr;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error('Error creating product set:', err);
        res.status(500).json({ error: 'Failed to create product set' });
    }
};

exports.deleteProductSet = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM product_sets WHERE set_id = ?', [id]);
        res.json({ success: true, message: 'Product set deleted successfully' });
    } catch (err) {
        console.error('Error deleting product set:', err);
        res.status(500).json({ error: 'Failed to delete product set' });
    }
};
