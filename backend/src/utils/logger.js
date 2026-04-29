const pool = require('../config/db');

/**
 * Logs a system activity to the system_logs table.
 * @param {number|null} userId - ID of the user performing the action
 * @param {string} module - The system module (e.g., 'Auth', 'Leads', 'Inventory')
 * @param {string} action - The action performed (e.g., 'Login', 'Lead Converted')
 * @param {string|null} details - Additional details for the log
 * @param {string|null} ipAddress - IP address of the user
 */
exports.logActivity = async (userId, module, action, details = null, ipAddress = null) => {
    try {
        await pool.execute(
            'INSERT INTO system_logs (user_id, module, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
            [userId, module, action, details, ipAddress]
        );
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
};
