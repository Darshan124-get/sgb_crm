const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken, isAdmin, isManagerOrAdmin } = require('../middleware/auth.middleware');

// Public routes for authenticated staff
router.get('/sales', authenticateToken, userController.getSalesTeam);

// Role management usually requires admin, but managers might need to view them or create subordinates.
// For now, allow managers to view roles (to assign to subordinates)
router.get('/roles', authenticateToken, isManagerOrAdmin, userController.getRoles);
router.post('/roles', authenticateToken, isAdmin, userController.createRole);
router.put('/roles/:id', authenticateToken, isAdmin, userController.updateRole);
router.delete('/roles/:id', authenticateToken, isAdmin, userController.deleteRole);

// FCM Push Notification Token Management
router.post('/fcm-token', authenticateToken, userController.registerFcmToken);
router.delete('/fcm-token', authenticateToken, userController.deleteFcmToken);

// Allow any authenticated staff to view their own profile
router.get('/profile/me', authenticateToken, (req, res, next) => {
    req.params.id = req.user.user_id;
    return userController.getUserById(req, res, next);
});
router.get('/me', authenticateToken, (req, res, next) => {
    req.params.id = req.user.user_id;
    return userController.getUserById(req, res, next);
});

// User management allows managers to manage users (controller isolates them to their dept)
router.get('/', authenticateToken, isManagerOrAdmin, userController.getAllUsers);
router.get('/:id', authenticateToken, userController.getUserById);
router.post('/', authenticateToken, isManagerOrAdmin, userController.createUser);
router.put('/:id', authenticateToken, isManagerOrAdmin, userController.updateUser);
router.patch('/:id/status', authenticateToken, isManagerOrAdmin, userController.toggleUserStatus);
router.patch('/:id/password', authenticateToken, isManagerOrAdmin, userController.resetPassword);
router.delete('/:id', authenticateToken, isManagerOrAdmin, userController.deleteUser);

module.exports = router;
