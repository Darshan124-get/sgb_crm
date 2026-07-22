const express = require('express');
const router = express.Router();
const productSetController = require('../controllers/product-set.controller');
const { authenticateToken, isAdmin } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, productSetController.getProductSets);
router.post('/', authenticateToken, isAdmin, productSetController.createProductSet);
router.delete('/:id', authenticateToken, isAdmin, productSetController.deleteProductSet);

module.exports = router;
