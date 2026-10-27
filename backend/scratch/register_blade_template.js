const pool = require('../src/config/db');

async function main() {
    try {
        const [rows] = await pool.query('SELECT * FROM chatbot_templates WHERE name LIKE "%Blade%"');
        if (rows.length === 0) {
            const [res] = await pool.query(
                'INSERT INTO chatbot_templates (name, description, category, icon, icon_color, badge_text, preview_nodes, usage_count, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    'SGB Blade Protector — Direct WhatsApp Sales',
                    'Automated WhatsApp sales flow for the SGB Blade Protector priced at ₹600. Presents product media, collects delivery details, sends the payment QR code, waits for payment evidence, and alerts the admin. Also supports customer-requested call support.',
                    'Direct WhatsApp Sales',
                    'fa-shield-halved',
                    'green',
                    'DIRECT SALES',
                    JSON.stringify(['Product Media', 'Customer Choice', 'Delivery Form', 'Address Review', 'Payment QR', 'Wait Screenshot', 'Call Support']),
                    0,
                    'active'
                ]
            );
            console.log('✅ Template inserted into chatbot_templates table. ID:', res.insertId);
        } else {
            console.log('Template already present in chatbot_templates table:', rows[0].template_id);
        }
    } catch (err) {
        console.error('Error inserting template:', err);
    } finally {
        await pool.end();
    }
}

main();
