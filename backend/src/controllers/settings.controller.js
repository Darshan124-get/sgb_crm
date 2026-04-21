const pool = require('../config/db');

exports.getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
        const settings = {};
        rows.forEach(r => settings[r.setting_key] = r.setting_value);
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching settings' });
    }
};

exports.updateSettings = async (req, res) => {
    const settings = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const [key, val] of Object.entries(settings)) {
            await connection.query(
                'UPDATE settings SET setting_value = ? WHERE setting_key = ?',
                [String(val), key]
            );
        }
        await connection.commit();
        res.json({ message: 'Settings updated successfully' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: 'Error updating settings' });
    } finally {
        connection.release();
    }
};
