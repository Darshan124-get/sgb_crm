const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken, isAdmin } = require('../middleware/auth.middleware');

// All user management routes require admin privileges
router.get('/', authenticateToken, isAdmin, userController.getAllUsers);
router.get('/roles', authenticateToken, isAdmin, userController.getRoles);
router.post('/', authenticateToken, isAdmin, userController.createUser);
router.put('/:id', authenticateToken, isAdmin, userController.updateUser);
router.patch('/:id/password', authenticateToken, isAdmin, userController.resetPassword);
router.delete('/:id', authenticateToken, isAdmin, userController.deleteUser);

module.exports = router;
