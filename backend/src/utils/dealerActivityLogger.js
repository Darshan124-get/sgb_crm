const pool = require('../config/db');

/**
 * Parses user agent string into human-friendly "OS · Browser" summary.
 * Matches UI layout shown in system audit screenshots.
 */
function parseDeviceSummary(ua) {
    if (!ua || typeof ua !== 'string') return 'Unknown Device';

    let os = 'Unknown OS';
    if (/windows nt 10\.0/i.test(ua)) os = 'Windows';
    else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
    else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/iphone/i.test(ua)) os = 'iPhone (iOS)';
    else if (/ipad/i.test(ua)) os = 'iPad (iPadOS)';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/cros/i.test(ua)) os = 'Chrome OS';

    let browser = 'Browser';
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
    else if (/postman/i.test(ua)) browser = 'Postman';
    else if (/curl/i.test(ua)) browser = 'curl';

    return `${os} · ${browser}`;
}

/**
 * Extracts and cleans client IP address from Express request.
 */
function extractClientIp(req) {
    if (!req) return '127.0.0.1';
    const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
    let rawIp = forwarded ? String(forwarded).split(',')[0].trim() : (req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1');

    if (rawIp.startsWith('::ffff:')) {
        rawIp = rawIp.replace('::ffff:', '');
    }
    if (rawIp === '::1') {
        rawIp = '127.0.0.1';
    }
    return rawIp;
}

/**
 * Ensure dealer_activity_logs table exists and has all required columns.
 */
async function ensureDealerActivityLogsTable(db = pool) {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS dealer_activity_logs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                user_name VARCHAR(150) NULL,
                user_role VARCHAR(100) NULL,
                module VARCHAR(100) NOT NULL DEFAULT 'DEALER',
                action VARCHAR(150) NOT NULL,
                entity_type VARCHAR(60) NULL,
                entity_id VARCHAR(64) NULL,
                details TEXT NULL,
                ip_address VARCHAR(64) NULL,
                user_agent TEXT NULL,
                device_summary VARCHAR(150) NULL,
                metadata TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_dealer_logs_created (created_at),
                INDEX idx_dealer_logs_module (module),
                INDEX idx_dealer_logs_action (action),
                INDEX idx_dealer_logs_entity (entity_type, entity_id),
                INDEX idx_dealer_logs_user (user_id)
            )
        `);

        // Check if missing columns exist
        try {
            const [cols] = await db.query('SHOW COLUMNS FROM dealer_activity_logs');
            const colNames = cols.map(c => c.Field);
            if (!colNames.includes('user_agent')) {
                await db.query('ALTER TABLE dealer_activity_logs ADD COLUMN user_agent TEXT NULL');
            }
            if (!colNames.includes('device_summary')) {
                await db.query('ALTER TABLE dealer_activity_logs ADD COLUMN device_summary VARCHAR(150) NULL');
            }
            if (!colNames.includes('metadata')) {
                await db.query('ALTER TABLE dealer_activity_logs ADD COLUMN metadata TEXT NULL');
            }
        } catch (colErr) {
            // Already updated or silent
        }
    } catch (err) {
        console.error('ensureDealerActivityLogsTable Error:', err);
    }
}

/**
 * Safe, non-blocking helper to log dealer activities.
 * Never throws an unhandled rejection that interrupts the main controller flow.
 */
async function logDealerActivity(reqOrUser, payload = {}) {
    try {
        await ensureDealerActivityLogsTable();

        let userId = null;
        let userName = 'System';
        let userRole = 'system';
        let ipAddress = '127.0.0.1';
        let userAgent = '';

        if (reqOrUser && (reqOrUser.headers || reqOrUser.user)) {
            // It's an Express request object
            const req = reqOrUser;
            const u = req.user || {};
            userId = u.id || u.user_id || payload.user_id || null;
            userName = u.name || payload.user_name || 'Admin';
            userRole = u.role || payload.user_role || 'admin';
            ipAddress = extractClientIp(req);
            userAgent = (req.headers && req.headers['user-agent']) || '';
        } else if (reqOrUser && typeof reqOrUser === 'object') {
            // It's a user object or context payload
            userId = reqOrUser.id || reqOrUser.user_id || payload.user_id || null;
            userName = reqOrUser.name || payload.user_name || 'Admin';
            userRole = reqOrUser.role || payload.user_role || 'admin';
            ipAddress = reqOrUser.ip_address || payload.ip_address || '127.0.0.1';
            userAgent = reqOrUser.user_agent || payload.user_agent || '';
        }

        if (payload.ip_address) ipAddress = payload.ip_address;
        if (payload.user_agent) userAgent = payload.user_agent;
        if (payload.user_id !== undefined && payload.user_id !== null) userId = payload.user_id;
        if (payload.user_name) userName = payload.user_name;
        if (payload.user_role) userRole = payload.user_role;

        const action = String(payload.action || 'UPDATE').toUpperCase().trim();
        const entityType = String(payload.entity_type || 'DEALER').toUpperCase().trim();
        const entityId = payload.entity_id !== undefined && payload.entity_id !== null ? String(payload.entity_id).trim() : null;
        const details = String(payload.details || payload.description || 'Performed dealer activity');
        const deviceSummary = payload.device_summary || parseDeviceSummary(userAgent);
        const metadata = payload.metadata ? (typeof payload.metadata === 'string' ? payload.metadata : JSON.stringify(payload.metadata)) : null;

        await pool.query(
            `INSERT INTO dealer_activity_logs (
                user_id, user_name, user_role, module, action, entity_type, entity_id,
                details, ip_address, user_agent, device_summary, metadata, created_at
            ) VALUES (?, ?, ?, 'DEALER', ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                userId,
                userName,
                userRole,
                action,
                entityType,
                entityId,
                details,
                ipAddress,
                userAgent ? userAgent.substring(0, 500) : null,
                deviceSummary,
                metadata
            ]
        );

        return true;
    } catch (err) {
        console.error('logDealerActivity failed (safe-handled):', err.message);
        return false;
    }
}

/**
 * Query dealer activity logs with pagination, search, action, and entity filters.
 */
async function fetchDealerActivityLogs(filters = {}) {
    await ensureDealerActivityLogsTable();

    const {
        search = '',
        action = '',
        entity = '',
        limit = 50,
        page = 1
    } = filters;

    const parsedLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (parsedPage - 1) * parsedLimit;

    let whereClause = "WHERE module = 'DEALER'";
    const params = [];

    if (action && action.toUpperCase() !== 'ALL') {
        whereClause += ' AND action = ?';
        params.push(action.toUpperCase().trim());
    }

    if (entity && entity.toUpperCase() !== 'ALL') {
        whereClause += ' AND entity_type = ?';
        params.push(entity.toUpperCase().trim());
    }

    if (search && search.trim() !== '') {
        const term = `%${search.trim()}%`;
        whereClause += ` AND (
            details LIKE ? OR
            user_name LIKE ? OR
            user_role LIKE ? OR
            action LIKE ? OR
            entity_type LIKE ? OR
            entity_id LIKE ? OR
            ip_address LIKE ? OR
            device_summary LIKE ?
        )`;
        params.push(term, term, term, term, term, term, term, term);
    }

    // 1. Total counts & distinct operator count
    const countSql = `
        SELECT 
            COUNT(*) as total_count,
            COUNT(DISTINCT COALESCE(NULLIF(user_name, ''), CAST(user_id AS CHAR))) as total_operators
        FROM dealer_activity_logs
        ${whereClause}
    `;
    const [countRows] = await pool.query(countSql, params);
    const totalCount = countRows[0]?.total_count || 0;
    const totalOperators = countRows[0]?.total_operators || 0;

    // 2. Fetch paginated rows
    const dataSql = `
        SELECT 
            log_id,
            user_id,
            user_name,
            user_role,
            module,
            action,
            entity_type,
            entity_id,
            details,
            ip_address,
            user_agent,
            device_summary,
            metadata,
            created_at
        FROM dealer_activity_logs
        ${whereClause}
        ORDER BY log_id DESC
        LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, parsedLimit, offset];
    const [rows] = await pool.query(dataSql, dataParams);

    return {
        success: true,
        logs: rows,
        total: totalCount,
        operators: totalOperators,
        page: parsedPage,
        limit: parsedLimit,
        showing: rows.length,
        totalPages: Math.ceil(totalCount / parsedLimit) || 1
    };
}

module.exports = {
    parseDeviceSummary,
    extractClientIp,
    ensureDealerActivityLogsTable,
    logDealerActivity,
    fetchDealerActivityLogs
};

