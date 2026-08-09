const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable must be set.');
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        
        // Backward compatibility: If old token lacks role, fetch from database.
        if (!user.role && user.id) {
            try {
                const [rows] = await pool.query(
                    'SELECT r.name as role FROM users u JOIN roles r ON u.role_id = r.role_id WHERE u.user_id = ?', 
                    [user.id]
                );
                if (rows.length > 0) {
                    user.role = rows[0].role;
                }
            } catch (dbErr) {
                console.error('Failed to fetch role for legacy token:', dbErr);
            }
        }
        // ── Block Mutations for Super Admin (Read-Only/Monitoring) ──
        if (user.role && user.role.toLowerCase() === 'super-admin') {
            const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
            const urlToCheck = req.originalUrl || req.url || '';
            const isAccessControlRoute = urlToCheck.includes('/users') || urlToCheck.includes('/departments') || urlToCheck.includes('/roles');
            
            if (mutatingMethods.includes(req.method) && !isAccessControlRoute) {
                return res.status(403).json({ message: 'Monitoring Access Only: Super Admins can only modify users/roles.' });
            }
        }
        
        req.user = user;
        next();
    });
}

function isAdmin(req, res, next) {
    if (!req.user || !req.user.role) return res.status(403).json({ message: 'Access denied' });
    
    const role = req.user.role.toLowerCase();
    if (role === 'admin' || role === 'super-admin') {
        next();
    } else {
        res.status(403).json({ message: 'Admin access required' });
    }
}

function isAdminOrSales(req, res, next) {
    if (!req.user || !req.user.role) return res.status(403).json({ message: 'Access denied' });
    
    const role = req.user.role.toLowerCase();
    if (role === 'admin' || role === 'super-admin' || role === 'sales' || role.includes('executive') || role === 'manager' || role.includes('telecaller')) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Requires Admin, Manager, Sales/Executive, or Telecaller role' });
    }
}

function isManagerOrAdmin(req, res, next) {
    if (!req.user) return res.status(403).json({ message: 'Access denied' });
    
    const role = (req.user.role || '').toLowerCase();
    if (role === 'admin' || role === 'super-admin' || req.user.is_manager) {
        next();
    } else {
        res.status(403).json({ message: 'Admin or Manager access required' });
    }
}

function hasPermission(permissionName) {
    return (req, res, next) => {
        if (!req.user) return res.status(403).json({ message: 'Access denied' });
        
        const role = (req.user.role || '').toLowerCase();
        if (role === 'admin' || role === 'super-admin') {
            return next();
        }

        // Managers automatically have access to their own panels based on department, but checking explicit permission is safer
        let perms = req.user.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch(e) { perms = []; }
        }
        if (!Array.isArray(perms)) perms = [];

        if (perms.includes(permissionName)) {
            return next();
        }

        // Fallbacks for backward compatibility
        if (permissionName === 'sales_access' && role === 'sales') return next();
        if (permissionName === 'billing_access' && role === 'billing') return next();

        res.status(403).json({ message: `Access denied: Requires ${permissionName} permission` });
    };
}

module.exports = { authenticateToken, isAdmin, isAdminOrSales, isManagerOrAdmin, hasPermission };
