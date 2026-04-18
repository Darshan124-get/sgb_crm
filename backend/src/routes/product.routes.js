const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticateToken, isAdmin } = require('../middleware/auth.middleware');

const upload = require('../middleware/upload.middleware');

router.get('/', authenticateToken, productController.getProducts);
router.post('/', authenticateToken, isAdmin, upload.single('image'), productController.createProduct);
router.put('/:id', authenticateToken, isAdmin, upload.single('image'), productController.updateProduct);
router.delete('/:id', authenticateToken, isAdmin, productController.deleteProduct);

module.exports = router;
