const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');

router.post('/', campaignController.createCampaign);
router.get('/', campaignController.getCampaigns);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

module.exports = router;
