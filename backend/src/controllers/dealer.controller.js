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
    const { dealer_name, contact_person, phone, email, address, city, state } = req.body;
    try {
        await pool.query(
            'INSERT INTO dealers (dealer_name, contact_person, phone, email, address, city, state) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [dealer_name, contact_person, phone, email, address, city, state]
        );
        res.status(201).json({ message: 'Dealer added successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error adding dealer: ' + err.message });
    }
};

exports.updateDealer = async (req, res) => {
    const { dealer_name, contact_person, phone, email, address, city, state } = req.body;
    try {
        await pool.query(
            'UPDATE dealers SET dealer_name = ?, contact_person = ?, phone = ?, email = ?, address = ?, city = ?, state = ? WHERE dealer_id = ?',
            [dealer_name, contact_person, phone, email, address, city, state, req.params.id]
        );
        res.json({ message: 'Dealer updated successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating dealer: ' + err.message });
    }
};

exports.deleteDealer = async (req, res) => {
    try {
        await pool.query('DELETE FROM dealers WHERE dealer_id = ?', [req.params.id]);
        res.json({ message: 'Dealer deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting dealer' });
    }
};
