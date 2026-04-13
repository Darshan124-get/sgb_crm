const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const { authenticateToken, isAdminOrSales } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, leadController.getLeads);
router.get('/stats', authenticateToken, leadController.getStats);
router.post('/bulk-assign', authenticateToken, leadController.bulkAssign);
router.post('/auto-assign', authenticateToken, leadController.autoAssign);

router.get('/:id', authenticateToken, leadController.getLeadById);
router.post('/', authenticateToken, isAdminOrSales, leadController.createLead);
router.put('/:id', authenticateToken, isAdminOrSales, leadController.updateLead);
router.patch('/:id/assign', authenticateToken, isAdminOrSales, leadController.assignLead);
router.post('/:id/transfer', authenticateToken, isAdminOrSales, leadController.transferLead);
router.delete('/:id', authenticateToken, isAdminOrSales, leadController.deleteLead);
router.get('/:id/notes', authenticateToken, leadController.getLeadNotes);
router.post('/:id/notes', authenticateToken, leadController.addLeadNote);

module.exports = router;
