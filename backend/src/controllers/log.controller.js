const pool = require('../config/db');

exports.getSystemLogs = async (req, res) => {
    try {
        // ─── Step 1: Ensure system_logs table exists ───
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS system_logs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                action VARCHAR(255) NOT NULL,
                module VARCHAR(100) NULL,
                details TEXT NULL,
                ip_address VARCHAR(45) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
            )
        `);

        // ─── Step 2: Auto-Cleanup (Delete logs older than 72 hours) ───
        // This keeps the system_logs table lean.
        await pool.execute(`
            DELETE FROM system_logs 
            WHERE created_at < NOW() - INTERVAL 72 HOUR
        `);

        // ─── Step 3: Aggregate logs from the last 72 hours ───
        const query = `
            SELECT * FROM (
                SELECT 
                    CAST(l.log_id AS CHAR) as id,
                    l.created_at,
                    u.name as user_name,
                    l.module,
                    l.action,
                    l.details
                FROM system_logs l
                LEFT JOIN users u ON l.user_id = u.user_id
                WHERE l.created_at >= NOW() - INTERVAL 72 HOUR
                
                UNION ALL
                
                SELECT 
                    CONCAT('ln_', ln.note_id) as id,
                    ln.created_at,
                    u.name as user_name,
                    'Leads' as module,
                    'Note/Activity' as action,
                    CONCAT('Lead #', ln.lead_id, ': ', LEFT(ln.note, 100)) as details
                FROM lead_notes ln
                LEFT JOIN users u ON ln.user_id = u.user_id
                WHERE ln.created_at >= NOW() - INTERVAL 72 HOUR
                
                UNION ALL
                
                SELECT 
                    CONCAT('inv_', il.log_id) as id,
                    il.created_at,
                    u.name as user_name,
                    'Inventory' as module,
                    CONCAT(UPPER(il.type), ' - ', COALESCE(p.name, 'Product')) as action,
                    CONCAT('Qty: ', il.quantity, ' | ', il.reference_type) as details
                FROM inventory_logs il
                LEFT JOIN users u ON il.created_by = u.user_id
                LEFT JOIN products p ON il.product_id = p.product_id
                WHERE il.created_at >= NOW() - INTERVAL 72 HOUR

                UNION ALL

                SELECT 
                    CONCAT('bill_', bl.log_id) as id,
                    bl.timestamp as created_at,
                    u.name as user_name,
                    'Billing' as module,
                    bl.action,
                    CONCAT('Order #', COALESCE(bl.order_id, 'N/A'), ' | ', COALESCE(bl.new_value, '')) as details
                FROM invoice_logs bl
                LEFT JOIN users u ON bl.changed_by = u.user_id
                WHERE bl.timestamp >= NOW() - INTERVAL 72 HOUR
            ) AS combined_logs
            ORDER BY created_at DESC
            LIMIT 500
        `;
        
        const [logs] = await pool.execute(query);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
};
