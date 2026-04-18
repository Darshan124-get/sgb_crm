const express = require('express');
const router = express.Router();
const dealerController = require('../controllers/dealer.controller');
const { authenticateToken, isAdmin } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, dealerController.getDealers);
router.get('/:id', authenticateToken, dealerController.getDealerById);
router.post('/', authenticateToken, isAdmin, dealerController.createDealer);
router.put('/:id', authenticateToken, isAdmin, dealerController.updateDealer);
router.delete('/:id', authenticateToken, isAdmin, dealerController.deleteDealer);

module.exports = router;
