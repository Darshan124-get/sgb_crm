/**
 * temp-order-report.routes.js
 * ─────────────────────────────────────────────────────────────
 * Routes for Sales Manager manual telecaller sales tracking.
 * All routes require authentication + manager/admin role.
 * ─────────────────────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/temp-order-report.controller');
const { authenticateToken, isManagerOrAdmin } = require('../middleware/auth.middleware');

// Summary and Target must be declared BEFORE /:id to avoid route clash
router.get('/summary',    authenticateToken, isManagerOrAdmin, ctrl.getSummary);
router.get('/target',     authenticateToken, isManagerOrAdmin, ctrl.getTarget);
router.post('/target',    authenticateToken, isManagerOrAdmin, ctrl.setTarget);
router.post('/batch',     authenticateToken, isManagerOrAdmin, ctrl.createBatch);

router.get('/',    authenticateToken, isManagerOrAdmin, ctrl.getRecords);
router.post('/',   authenticateToken, isManagerOrAdmin, ctrl.createRecord);
router.put('/:id', authenticateToken, isManagerOrAdmin, ctrl.updateRecord);
router.delete('/:id', authenticateToken, isManagerOrAdmin, ctrl.deleteRecord);

module.exports = router;
