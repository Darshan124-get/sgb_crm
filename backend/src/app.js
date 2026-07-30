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
const campaignRoutes = require('./routes/campaign.routes');
const departmentRoutes = require('./routes/department.routes');
const productSetRoutes = require('./routes/product-set.routes');

const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Fixes express-rate-limit X-Forwarded-For error)

// Security & Performance Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Allow external assets
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Global Response Sanitizer Middleware (Mitigates raw SQL / DB Info Leakage)
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
        if (body && typeof body === 'object') {
            if (body.error || body.message) {
                let msg = body.error || body.message;
                if (typeof msg === 'string' && (
                    msg.includes('SQL') || 
                    msg.includes('Database') || 
                    msg.includes('connection') || 
                    msg.includes('pool') ||
                    msg.includes('syntax') ||
                    msg.includes('SELECT') ||
                    msg.includes('INSERT') ||
                    msg.includes('UPDATE') ||
                    msg.includes('DELETE') ||
                    msg.includes('Table') ||
                    msg.includes('table') ||
                    msg.includes('Column') ||
                    msg.includes('column') ||
                    msg.includes('foreign key') ||
                    msg.includes('unique key') ||
                    msg.includes('ER_') ||
                    msg.includes('sql')
                )) {
                    if (body.error) body.error = 'Internal database server error';
                    if (body.message) body.message = 'Internal database server error';
                }
            }
            if (body.stack) {
                delete body.stack;
            }
        }
        return originalJson.call(this, body);
    };
    next();
});

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
app.use('/api/campaigns', campaignRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/product-sets', productSetRoutes);

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

