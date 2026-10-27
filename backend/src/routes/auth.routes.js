const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.get('/users', authenticateToken, authController.getUsers);

module.exports = router;
