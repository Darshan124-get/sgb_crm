const pool = require('../config/db');

exports.getDealers = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM dealers ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching dealers' });
    }
};

exports.createDealer = async (req, res) => {
    const { dealer_name, contact_person, phone, alternate_number, email, address, city, state, status } = req.body;
    try {
        await pool.query(
            'INSERT INTO dealers (dealer_name, contact_person, phone, alternate_number, email, address, city, state, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [dealer_name, contact_person, phone, alternate_number || null, email, address, city, state, status || 'active']
        );
        res.status(201).json({ message: 'Dealer added successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error adding dealer: ' + err.message });
    }
};

exports.updateDealer = async (req, res) => {
    const { dealer_name, contact_person, phone, alternate_number, email, address, city, state, status } = req.body;
    try {
        await pool.query(
            'UPDATE dealers SET dealer_name = ?, contact_person = ?, phone = ?, alternate_number = ?, email = ?, address = ?, city = ?, state = ?, status = ? WHERE dealer_id = ?',
            [dealer_name, contact_person, phone, alternate_number || null, email, address, city, state, status || 'active', req.params.id]
        );
        res.json({ message: 'Dealer updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating dealer: ' + err.message });
    }
};

exports.deleteDealer = async (req, res) => {
    try {
        // Soft delete logic: Check if dealer has orders
        const [orders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE dealer_id = ?', [req.params.id]);
        
        if (orders[0].count > 0) {
            // Deactivate instead of deleting if orders exist
            await pool.query('UPDATE dealers SET status = "inactive" WHERE dealer_id = ?', [req.params.id]);
            return res.json({ message: 'Dealer has orders, deactivated instead of deleting.' });
        }

        await pool.query('DELETE FROM dealers WHERE dealer_id = ?', [req.params.id]);
        res.json({ message: 'Dealer deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting dealer' });
    }
};

exports.getDealerById = async (req, res) => {
    try {
        const [dealer] = await pool.query('SELECT * FROM dealers WHERE dealer_id = ?', [req.params.id]);
        if (dealer.length === 0) return res.status(404).json({ message: 'Dealer not found' });

        // Fetch order stats
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_business,
                SUM(balance_amount) as total_balance
            FROM orders 
            WHERE dealer_id = ? AND order_status != 'cancelled'
        `, [req.params.id]);

        // Fetch recent orders
        const [orders] = await pool.query(`
            SELECT order_id, total_amount, balance_amount, order_status, created_at 
            FROM orders 
            WHERE dealer_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `, [req.params.id]);

        res.json({
            ...dealer[0],
            stats: stats[0] || { total_orders: 0, total_business: 0, total_balance: 0 },
            recent_orders: orders
        });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching dealer details: ' + err.message });
    }
};


