const db = require('../config/db');

exports.createCampaign = async (req, res) => {
    try {
        const { campaign_id, tag_line, ad_spend } = req.body;
        if (!campaign_id || !tag_line) {
            return res.status(400).json({ error: 'campaign_id and tag_line are required' });
        }
        
        const [result] = await db.query(
            'INSERT INTO campaigns (campaign_id, tag_line, ad_spend) VALUES (?, ?, ?)',
            [campaign_id, tag_line, ad_spend || 0.00]
        );
        
        res.status(201).json({ message: 'Campaign created', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Campaign ID already exists' });
        }
        console.error('Error creating campaign:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getCampaigns = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM campaigns ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching campaigns:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const { campaign_id, tag_line, status, ad_spend } = req.body;
        
        const [result] = await db.query(
            'UPDATE campaigns SET campaign_id = ?, tag_line = ?, status = ?, ad_spend = ? WHERE id = ?',
            [campaign_id, tag_line, status, ad_spend || 0.00, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        res.json({ message: 'Campaign updated' });
    } catch (err) {
        console.error('Error updating campaign:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await db.query('DELETE FROM campaigns WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        res.json({ message: 'Campaign deleted' });
    } catch (err) {
        console.error('Error deleting campaign:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
