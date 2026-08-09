const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/', campaignController.createCampaign);
router.get('/', authenticateToken, campaignController.getCampaigns);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

module.exports = router;
