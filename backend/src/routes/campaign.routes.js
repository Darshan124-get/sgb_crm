const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');
const { authenticateToken, isAdminOrSales } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, campaignController.getCampaigns);
router.post('/', authenticateToken, isAdminOrSales, campaignController.createCampaign);
router.put('/:id', authenticateToken, isAdminOrSales, campaignController.updateCampaign);
router.delete('/:id', authenticateToken, isAdminOrSales, campaignController.deleteCampaign);

module.exports = router;
