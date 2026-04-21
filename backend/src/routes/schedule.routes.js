const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticateToken);

router.get('/', scheduleController.getSchedules);
router.get('/stats', scheduleController.getScheduleStats);
router.put('/:id/status', scheduleController.updateStatus);
router.put('/:id/reschedule', scheduleController.reschedule);
router.put('/:id/reassign', scheduleController.reassign);
router.put('/:id/reminders', scheduleController.toggleReminders);

module.exports = router;
