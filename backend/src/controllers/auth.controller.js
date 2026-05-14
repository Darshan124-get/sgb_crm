const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logActivity } = require('../utils/logger');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

exports.login = async (req, res) => {
    const { identifier, password } = req.body;

    try {
        const [rows] = await pool.query(
            `SELECT u.*, r.name as role_name 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.role_id 
             WHERE u.email = ? OR u.phone = ?`, 
            [identifier, identifier]
        );
        const user = rows[0];

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Account is inactive' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const token = jwt.sign(
            { id: user.user_id, name: user.name, role: user.role_name }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );
        
        // Log the login activity
        await logActivity(user.user_id, 'Auth', 'User Login', `Logged in from IP: ${req.ip || 'Unknown'}`, req.ip);
        
        res.json({ 
            token, 
            user: { 
                id: user.user_id,
                name: user.name, 
                role: user.role_name,
                language: user.language 
            } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.user_id as id, u.name, u.email, u.phone, r.name as role 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.role_id 
             WHERE u.status = 'active'`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};
