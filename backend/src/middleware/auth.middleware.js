const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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
    if (role === 'admin' || role === 'super-admin' || role === 'sales') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Requires Admin or Sales role' });
    }
}

module.exports = { authenticateToken, isAdmin, isAdminOrSales };
