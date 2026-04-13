const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, searchController.globalSearch);

module.exports = router;
