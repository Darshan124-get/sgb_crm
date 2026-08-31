const db = require('../config/db');
const supabase = require('../config/supabase');
const logger = require('../utils/whatsappLogger');

const processAutoReplies = async (campaign_id, auto_replies) => {
    if (!auto_replies || !Array.isArray(auto_replies)) return null;

    const processed = [];
    for (let i = 0; i < auto_replies.length; i++) {
        let reply = { ...auto_replies[i] };
        
        if (reply.mediaData && reply.mimeType) {
            try {
                const buffer = Buffer.from(reply.mediaData.split(',')[1], 'base64');
                const extension = reply.mimeType.split('/')[1] || 'bin';
                const fileName = `campaigns/${campaign_id}/auto-reply-${Date.now()}-${i}.${extension}`;
                
                const { error } = await supabase.storage
                  .from(process.env.SUPABASE_BUCKET_NAME || 'SGB')
                  .upload(fileName, buffer, {
                    contentType: reply.mimeType,
                    upsert: true
                  });

                if (error) {
                    logger.error('Supabase upload error for campaign auto_reply:', error.message);
                    throw error;
                }

                const { data: urlData } = supabase.storage
                  .from(process.env.SUPABASE_BUCKET_NAME || 'SGB')
                  .getPublicUrl(fileName);

                reply.url = urlData.publicUrl;
                delete reply.mediaData; // Remove large base64 payload before saving
                delete reply.mimeType;
            } catch (err) {
                logger.error('Error processing media for campaign:', err.message);
                // Can decide whether to throw or skip this media. Throwing ensures consistency.
                throw err; 
            }
        }
        processed.push(reply);
    }
    return JSON.stringify(processed);
};

exports.createCampaign = async (req, res) => {
    try {
        const { campaign_id, tag_line, product_name, ad_spend, auto_replies } = req.body;
        if (!campaign_id || !tag_line) {
            return res.status(400).json({ error: 'campaign_id and tag_line are required' });
        }
        
        const processedReplies = await processAutoReplies(campaign_id, auto_replies);

        const [result] = await db.query(
            'INSERT INTO campaigns (campaign_id, tag_line, product_name, ad_spend, auto_replies) VALUES (?, ?, ?, ?, ?)',
            [campaign_id, tag_line, product_name || null, ad_spend || 0.00, processedReplies]
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
        const userRole = (req.user && req.user.role) ? req.user.role.toLowerCase() : 'executive';
        const userId = req.user ? req.user.id : null;

        let rows;
        if (userRole.includes('admin') || userRole.includes('manager') || userRole.includes('whatsapp')) {
            // Admins and Managers see all campaigns
            [rows] = await db.query('SELECT * FROM campaigns ORDER BY created_at DESC');
        } else {
            // Telecallers only see campaigns having leads assigned to them
            [rows] = await db.query(`
                SELECT DISTINCT c.*
                FROM campaigns c
                JOIN leads l ON TRIM(REPLACE(REPLACE(l.first_message, '\\n', ''), '\\r', '')) = TRIM(REPLACE(REPLACE(c.tag_line, '\\n', ''), '\\r', ''))
                WHERE l.assigned_to = ?
                ORDER BY c.created_at DESC
            `, [userId]);
        }
        res.json(rows);
    } catch (err) {
        console.error('Error fetching campaigns:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const { campaign_id, tag_line, product_name, status, ad_spend, auto_replies } = req.body;
        
        // Fetch existing campaign to preserve values not sent in payload
        const [existing] = await db.query('SELECT * FROM campaigns WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        const currentCampaign = existing[0];
        
        const finalCampaignId = campaign_id !== undefined ? campaign_id : currentCampaign.campaign_id;
        const finalTagLine = tag_line !== undefined ? tag_line : currentCampaign.tag_line;
        const finalProductName = product_name !== undefined ? product_name : currentCampaign.product_name;
        const finalStatus = status !== undefined ? status : currentCampaign.status;
        const finalAdSpend = ad_spend !== undefined ? ad_spend : currentCampaign.ad_spend;
        
        let finalReplies;
        if (auto_replies !== undefined) {
            finalReplies = await processAutoReplies(finalCampaignId, auto_replies);
        } else {
            finalReplies = currentCampaign.auto_replies;
        }

        const [result] = await db.query(
            'UPDATE campaigns SET campaign_id = ?, tag_line = ?, product_name = ?, status = ?, ad_spend = ?, auto_replies = ? WHERE id = ?',
            [finalCampaignId, finalTagLine, finalProductName, finalStatus, finalAdSpend, finalReplies, id]
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


