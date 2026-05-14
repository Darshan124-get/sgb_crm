const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth.routes');
const leadRoutes = require('./routes/lead.routes');
const productRoutes = require('./routes/product.routes');
const dealerRoutes = require('./routes/dealer.routes');
const orderRoutes = require('./routes/order.routes');
const logisticsRoutes = require('./routes/logistics.routes');
const reportRoutes = require('./routes/report.routes');
const searchRoutes = require('./routes/search.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const settingsRoutes = require('./routes/settings.routes');
const billingRoutes = require('./routes/billing.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const logRoutes = require('./routes/log.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const webhookRoutes = require('./routes/webhook.routes');

const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// Security & Performance Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow external assets
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate Limiting (General API)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Webhook Route (Public - Must be BEFORE any auth or fallback)
app.use('/webhook', webhookRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/products', productRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/whatsapp', whatsappRoutes);

console.log('✅ WhatsApp API: Mounted at /api/whatsapp');
console.log('✅ WhatsApp Webhook: Mounted at /webhook');

// Fallback: API routes that don't exist return 404 JSON (not HTML)
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// Fallback: All other routes serve index.html (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

module.exports = app;
