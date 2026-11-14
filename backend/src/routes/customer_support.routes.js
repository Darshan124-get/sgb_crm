const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const controller = require('../controllers/customer_support.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const csTempUploadDir = path.join(__dirname, '../../uploads/customer_support');
const csUploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(csTempUploadDir)) {
            fs.mkdirSync(csTempUploadDir, { recursive: true });
        }
        cb(null, csTempUploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: csUploadStorage,
    limits: { fileSize: 550 * 1024 * 1024 }, // Allows up to 550MB per file; compressed to <60MB on ingestion
    fileFilter: (req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        const ext = path.extname(file.originalname || '').toLowerCase();
        const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.3gp']);
        if (mime.startsWith('image/') || mime.startsWith('video/') || allowedExts.has(ext)) {
            return cb(null, true);
        }
        cb(new Error('Only image and video files are allowed in Customer Support'));
    }
});

// All customer support routes require authentication
router.use(authenticateToken);

// Dashboard metrics
router.get('/dashboard-metrics', controller.getDashboardMetrics);

// Sync / recovery for delivered orders
router.post('/sync-delivered', controller.syncDeliveredOrders);

// In-app notifications
router.get('/notifications', controller.getNotifications);
router.patch('/notifications/:id/read', controller.markNotificationRead);

// Customer & Order Lookup
router.get('/lookup-customer', controller.lookupCustomer);

// Cases management
router.get('/cases', controller.getCases);
router.post('/cases', controller.createManualCase);
router.get('/cases/:id', controller.getCaseDetails);
router.post('/cases/:id/calls', controller.recordCall);
router.post('/cases/:id/notes', controller.addNote);
router.post('/cases/:id/photos', upload.array('photos', 10), controller.uploadPhotos);
router.post('/cases/:id/complete', controller.completeSupport);

// 30-Day Follow-ups
router.get('/followups', controller.getFollowups);
router.get('/followups/:id', controller.getFollowupDetails);
router.post('/followups/:id/call', controller.recordFollowupCall);

// Settings & Staff Roster
router.get('/settings', controller.getSettings);

// Job Cards management
const jobCardPhotoUpload = upload.fields([
    { name: 'before_photos', maxCount: 20 },
    { name: 'after_photos', maxCount: 20 },
    { name: 'photos', maxCount: 20 }
]);

router.get('/job-cards/init-meta', controller.getJobCardInitMeta);
router.get('/job-cards', controller.getJobCards);
router.post('/job-cards', jobCardPhotoUpload, controller.createJobCard);
router.get('/job-cards/:id', controller.getJobCardDetails);
router.put('/job-cards/:id', jobCardPhotoUpload, controller.updateJobCard);
router.patch('/job-cards/:id/status', controller.updateJobCardStatus);
router.put('/job-cards/:id/status', controller.updateJobCardStatus);
router.post('/job-cards/:id/photos', jobCardPhotoUpload, controller.uploadJobCardPhotos);
router.delete('/job-cards/:id/photos/:photoId', controller.deleteJobCardPhoto);
router.post('/job-cards/:id/complete', jobCardPhotoUpload, controller.completeJobCard);

module.exports = router;

